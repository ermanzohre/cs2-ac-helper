import type { EvidenceMoment, MetricScore, PlayerIdentity } from "../domain/types";
import type { FrameSample, ParsedKill, ParsedShot } from "../ingest/types";
import { angleDelta, buildStats, clamp01 } from "./shared";

const PREFIRE_MIN_LEAD_MS = 20;
const PREFIRE_MAX_LEAD_MS = 140;
const INSTANT_SHOT_THRESHOLD_MS = 12;
const PREP_SHOT_WINDOW_MIN_MS = 250;
const PREP_SHOT_WINDOW_MAX_MS = 1800;
const HOLD_WINDOW_MS = 700;
const HOLD_YAW_SPAN_DEG = 16;
const HOLD_PITCH_SPAN_DEG = 10;
const STRONG_SIGNAL_THRESHOLD = 0.55;

export function computePrefireMetric(
  player: PlayerIdentity,
  kills: ParsedKill[],
  shots: ParsedShot[],
  frames: FrameSample[],
  tickRate: number,
): MetricScore {
  const playerKills = kills.filter((kill) => kill.attackerSlot === player.slot);
  const playerShots = shots
    .filter((shot) => shot.shooterSlot === player.slot)
    .sort((a, b) => a.tick - b.tick);
  const playerFrames = frames
    .filter((frame) => frame.playerSlot === player.slot)
    .sort((a, b) => a.tick - b.tick);

  const signalSamples: number[] = [];
  const confidenceSamples: number[] = [];
  const evidence: EvidenceMoment[] = [];

  for (const kill of playerKills) {
    const previousShot = findLastShotBeforeTick(playerShots, kill.tick);
    const leadMs = previousShot
      ? ((kill.tick - previousShot.tick) / tickRate) * 1000
      : Number.POSITIVE_INFINITY;
    const prepShots = findShotsInWindow(
      playerShots,
      kill.tick,
      Math.floor((PREP_SHOT_WINDOW_MIN_MS / 1000) * tickRate),
      Math.floor((PREP_SHOT_WINDOW_MAX_MS / 1000) * tickRate),
    );
    const prepShotCount = prepShots.length;
    const holdSignal = hasStableAimBeforeKill(playerFrames, kill.tick, tickRate);

    let signal = 0;
    const reasons: string[] = [];

    const hasLeadSignal =
      Number.isFinite(leadMs) &&
      leadMs >= PREFIRE_MIN_LEAD_MS &&
      leadMs <= PREFIRE_MAX_LEAD_MS;
    if (hasLeadSignal) {
      signal += 0.28;
      reasons.push(`shot-to-kill ${leadMs.toFixed(1)} ms`);
    }

    if (prepShotCount >= 2) {
      signal += Math.min(0.18, 0.08 + (prepShotCount - 2) * 0.03);
      reasons.push(`pre-kill probing shots x${prepShotCount}`);
    }

    if (holdSignal) {
      signal += 0.16;
      reasons.push("stable angle hold before kill");
    }

    if (hasLeadSignal && prepShotCount >= 2) {
      signal += 0.1;
      reasons.push("prepared timing overlap");
    }

    if (hasLeadSignal && holdSignal && kill.headshot) {
      signal += 0.12;
      reasons.push("hold + short-lead headshot");
    }

    if (kill.throughSmoke) {
      signal += 0.22;
      reasons.push("through smoke");
    }

    if (kill.penetrated > 0) {
      signal += Math.min(0.32, 0.12 + kill.penetrated * 0.06);
      reasons.push(
        kill.penetrated === 1
          ? "single wall penetration"
          : `${kill.penetrated} wall penetrations`,
      );
    }

    if (kill.attackerBlind) {
      signal += 0.08;
      reasons.push("attacker blind");
    }

    if (kill.throughSmoke && kill.headshot) {
      signal += 0.28;
      reasons.push("smoke headshot");
    }

    // Same-tick shot+kill is often normal and should not be treated as prefire by itself.
    if (
      Number.isFinite(leadMs) &&
      leadMs >= 0 &&
      leadMs <= INSTANT_SHOT_THRESHOLD_MS &&
      signal <= 0.4
    ) {
      signal = 0;
    }

    const normalized = clamp01(signal);
    signalSamples.push(normalized);

    if (normalized >= STRONG_SIGNAL_THRESHOLD) {
      evidence.push({
        playerName: player.name,
        round: kill.round,
        tickStart: Math.max(0, kill.tick - Math.floor((250 / 1000) * tickRate)),
        tickEnd: kill.tick,
        timeSec: kill.tick / tickRate,
        reason: `Prefire proxy hit (${reasons.join(", ")})`,
        tags: ["info", "prefire"],
      });
    }

    confidenceSamples.push(Number.isFinite(leadMs) ? 1 : 0.65);
    confidenceSamples.push(holdSignal ? 1 : 0.75);
  }

  const value = signalSamples.length
    ? signalSamples.reduce((acc, valueItem) => acc + valueItem, 0) / signalSamples.length
    : 0;

  const availability = confidenceSamples.length
    ? confidenceSamples.reduce((acc, item) => acc + item, 0) / confidenceSamples.length
    : 0;
  const suspiciousRatio = signalSamples.length
    ? signalSamples.filter((item) => item >= STRONG_SIGNAL_THRESHOLD).length /
      signalSamples.length
    : 0;
  const confidence = clamp01(
    Math.min(playerKills.length / 12, 1) * availability * (0.45 + 0.55 * suspiciousRatio),
  );

  return {
    value: clamp01(value),
    samples: playerKills.length,
    confidence,
    stats: buildStats(signalSamples),
    evidence: evidence.slice(0, 5),
  };
}

function findLastShotBeforeTick(shots: ParsedShot[], tick: number): ParsedShot | undefined {
  for (let index = shots.length - 1; index >= 0; index -= 1) {
    if (shots[index].tick <= tick) {
      return shots[index];
    }
  }

  return undefined;
}

function findShotsInWindow(
  shots: ParsedShot[],
  killTick: number,
  minLeadTicks: number,
  maxLeadTicks: number,
): ParsedShot[] {
  const lowerBound = killTick - maxLeadTicks;
  const upperBound = killTick - minLeadTicks;
  return shots.filter((shot) => shot.tick >= lowerBound && shot.tick <= upperBound);
}

function hasStableAimBeforeKill(
  frames: FrameSample[],
  killTick: number,
  tickRate: number,
): boolean {
  const holdWindowTicks = Math.max(1, Math.floor((HOLD_WINDOW_MS / 1000) * tickRate));
  const inWindow = frames.filter(
    (frame) => frame.tick >= killTick - holdWindowTicks && frame.tick < killTick,
  );

  if (inWindow.length < 3) {
    return false;
  }

  const anchor = inWindow[0];
  let maxYawDelta = 0;
  let maxPitchDelta = 0;
  for (const frame of inWindow) {
    maxYawDelta = Math.max(maxYawDelta, Math.abs(angleDelta(frame.yaw, anchor.yaw)));
    maxPitchDelta = Math.max(
      maxPitchDelta,
      Math.abs(angleDelta(frame.pitch, anchor.pitch)),
    );
  }

  return maxYawDelta <= HOLD_YAW_SPAN_DEG && maxPitchDelta <= HOLD_PITCH_SPAN_DEG;
}
