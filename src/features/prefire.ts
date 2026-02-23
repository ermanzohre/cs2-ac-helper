import type { EvidenceMoment, MetricScore, PlayerIdentity } from "../domain/types";
import type { ParsedKill, ParsedShot } from "../ingest/types";
import { buildStats, clamp01 } from "./shared";

const PREFIRE_MIN_LEAD_MS = 20;
const PREFIRE_MAX_LEAD_MS = 140;
const INSTANT_SHOT_THRESHOLD_MS = 12;

export function computePrefireMetric(
  player: PlayerIdentity,
  kills: ParsedKill[],
  shots: ParsedShot[],
  tickRate: number,
): MetricScore {
  const playerKills = kills.filter((kill) => kill.attackerSlot === player.slot);
  const playerShots = shots
    .filter((shot) => shot.shooterSlot === player.slot)
    .sort((a, b) => a.tick - b.tick);

  const signalSamples: number[] = [];
  const confidenceSamples: number[] = [];
  const evidence: EvidenceMoment[] = [];

  for (const kill of playerKills) {
    const previousShot = findLastShotBeforeTick(playerShots, kill.tick);
    const leadMs = previousShot
      ? ((kill.tick - previousShot.tick) / tickRate) * 1000
      : Number.POSITIVE_INFINITY;

    let signal = 0;
    const reasons: string[] = [];

    const hasLeadSignal =
      Number.isFinite(leadMs) &&
      leadMs >= PREFIRE_MIN_LEAD_MS &&
      leadMs <= PREFIRE_MAX_LEAD_MS;
    if (hasLeadSignal) {
      signal += 0.35;
      reasons.push(`shot-to-kill ${leadMs.toFixed(1)} ms`);
    }

    if (kill.throughSmoke) {
      signal += 0.4;
      reasons.push("through smoke");
    }

    if (kill.penetrated > 0) {
      signal += Math.min(0.35, 0.15 + kill.penetrated * 0.07);
      reasons.push(
        kill.penetrated === 1
          ? "single wall penetration"
          : `${kill.penetrated} wall penetrations`,
      );
    }

    if (kill.attackerBlind) {
      signal += 0.1;
      reasons.push("attacker blind");
    }

    // Same-tick shot+kill is often normal and should not be treated as prefire by itself.
    if (
      Number.isFinite(leadMs) &&
      leadMs >= 0 &&
      leadMs <= INSTANT_SHOT_THRESHOLD_MS &&
      signal <= 0.35
    ) {
      signal = 0;
    }

    const normalized = clamp01(signal);
    signalSamples.push(normalized);

    if (normalized >= 0.5) {
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

    confidenceSamples.push(Number.isFinite(leadMs) ? 1 : 0.6);
  }

  const value = signalSamples.length
    ? signalSamples.reduce((acc, valueItem) => acc + valueItem, 0) / signalSamples.length
    : 0;

  const availability = confidenceSamples.length
    ? confidenceSamples.reduce((acc, item) => acc + item, 0) / confidenceSamples.length
    : 0;
  const suspiciousRatio = signalSamples.length
    ? signalSamples.filter((item) => item >= 0.45).length / signalSamples.length
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
