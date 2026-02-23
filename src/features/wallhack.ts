import type { EvidenceMoment, MetricScore, PlayerIdentity } from "../domain/types";
import type { FrameSample, ParsedKill } from "../ingest/types";
import { angleDelta, buildStats, clamp01 } from "./shared";

const EVIDENCE_WINDOW_MS = 300;
const STRONG_SIGNAL_THRESHOLD = 0.58;
const BURST_EVENT_TARGET = 4;
const TOP_SIGNAL_WINDOW = 3;
const TRACK_WINDOW_MS = 900;
const TRACK_LOCK_ERROR_DEG = 7;
const TRACK_MIN_UNSPOTTED_SAMPLES = 8;
const TRACK_STREAK_TARGET_MS = 240;

export function computeWallhackMetric(
  player: PlayerIdentity,
  kills: ParsedKill[],
  frames: FrameSample[],
  tickRate: number,
): MetricScore {
  const playerKills = kills.filter((kill) => kill.attackerSlot === player.slot);
  const frameIndex = buildFrameIndex(frames);
  const signalScores: number[] = [];
  const evidence: EvidenceMoment[] = [];
  let trackingHits = 0;

  for (const kill of playerKills) {
    let signalScore = 0;
    const reasons: string[] = [];

    if (kill.throughSmoke) {
      signalScore += 0.2;
      reasons.push("through smoke");
    }

    if (kill.throughSmoke && kill.headshot) {
      signalScore += 0.38;
      reasons.push("smoke headshot");
    }

    if (kill.penetrated > 0) {
      signalScore += Math.min(0.35, 0.12 + kill.penetrated * 0.07);
      reasons.push(
        kill.penetrated === 1
          ? "single wall penetration"
          : `${kill.penetrated} wall penetrations`,
      );
    }

    if (kill.penetrated > 0 && kill.headshot) {
      signalScore += 0.18;
      reasons.push("penetration headshot");
    }

    if (kill.attackerBlind) {
      signalScore += 0.2;
      reasons.push("attacker was blind");
    }

    if (kill.attackerBlind && kill.headshot) {
      signalScore += 0.12;
      reasons.push("blind headshot");
    }

    if (kill.victimSpottedByAttacker === false) {
      signalScore += 0.16;
      reasons.push("victim not spotted by attacker");
    }

    if (
      kill.victimSpottedByAttacker === false &&
      (kill.throughSmoke || kill.penetrated > 0)
    ) {
      signalScore += 0.2;
      reasons.push("occluded kill without spot info");
    }

    if (
      kill.victimSpottedByAttacker === false &&
      kill.headshot &&
      kill.attackerVictimDistance !== undefined &&
      kill.attackerVictimDistance > 900
    ) {
      signalScore += 0.08;
      reasons.push("long-range unspotted headshot");
    }

    const tracking = computeUnspottedTrackingSignal(
      kill,
      player,
      frameIndex,
      tickRate,
    );
    if (tracking.score >= 0.5) {
      signalScore += 0.28;
      reasons.push(`unspotted aim tracking ${tracking.maxTrackMs.toFixed(0)} ms`);
      trackingHits += 1;
    }

    if (tracking.score >= 0.72) {
      signalScore += 0.12;
      reasons.push("persistent tracking streak");
    }

    if (kill.throughSmoke && kill.penetrated > 0) {
      signalScore += 0.1;
      reasons.push("smoke + wallbang overlap");
    }

    if (kill.throughSmoke && kill.penetrated > 0 && kill.headshot) {
      signalScore += 0.1;
      reasons.push("smoke wallbang headshot");
    }

    const normalized = clamp01(signalScore);
    signalScores.push(normalized);

    if (normalized >= STRONG_SIGNAL_THRESHOLD) {
      evidence.push({
        playerName: player.name,
        round: kill.round,
        tickStart: Math.max(
          0,
          kill.tick - Math.floor((EVIDENCE_WINDOW_MS / 1000) * tickRate),
        ),
        tickEnd: kill.tick,
        timeSec: kill.tick / tickRate,
        reason: `Visibility proxy hit (${reasons.join(", ")})`,
        tags: ["info", "wallhack"],
      });
    }
  }

  const meanValue = signalScores.length
    ? signalScores.reduce((acc, item) => acc + item, 0) / signalScores.length
    : 0;
  const strongSignals = signalScores.filter(
    (item) => item >= STRONG_SIGNAL_THRESHOLD,
  );
  const topSignals = [...signalScores]
    .sort((a, b) => b - a)
    .slice(0, TOP_SIGNAL_WINDOW);
  const topMean = topSignals.length
    ? topSignals.reduce((acc, item) => acc + item, 0) / topSignals.length
    : 0;
  const burstFactor = clamp01(strongSignals.length / BURST_EVENT_TARGET);
  const value = clamp01(0.45 * meanValue + 0.35 * topMean + 0.2 * burstFactor);

  const suspiciousRatio = signalScores.length
    ? strongSignals.length / signalScores.length
    : 0;
  const smokeHeadshotRatio = playerKills.length
    ? playerKills.filter((kill) => kill.throughSmoke && kill.headshot).length /
      playerKills.length
    : 0;
  const trackingRatio = playerKills.length ? trackingHits / playerKills.length : 0;
  const confidence = clamp01(
    Math.min(signalScores.length / 12, 1) *
      (0.3 +
        0.35 * suspiciousRatio +
        0.2 * smokeHeadshotRatio +
        0.1 * burstFactor +
        0.05 * trackingRatio),
  );

  return {
    value: clamp01(value),
    samples: signalScores.length,
    confidence,
    stats: buildStats(signalScores),
    evidence: evidence.slice(0, 5),
  };
}

interface TrackingSignal {
  score: number;
  maxTrackMs: number;
}

function buildFrameIndex(
  frames: FrameSample[],
): Map<number, Map<number, FrameSample>> {
  const bySlot = new Map<number, Map<number, FrameSample>>();
  for (const frame of frames) {
    let byTick = bySlot.get(frame.playerSlot);
    if (!byTick) {
      byTick = new Map<number, FrameSample>();
      bySlot.set(frame.playerSlot, byTick);
    }

    byTick.set(frame.tick, frame);
  }

  return bySlot;
}

function computeUnspottedTrackingSignal(
  kill: ParsedKill,
  player: PlayerIdentity,
  frameIndex: Map<number, Map<number, FrameSample>>,
  tickRate: number,
): TrackingSignal {
  const attackerFramesByTick = frameIndex.get(kill.attackerSlot);
  const victimFramesByTick = frameIndex.get(kill.victimSlot);
  if (!attackerFramesByTick || !victimFramesByTick) {
    return { score: 0, maxTrackMs: 0 };
  }

  const startTick = Math.max(
    0,
    kill.tick - Math.floor((TRACK_WINDOW_MS / 1000) * tickRate),
  );

  let unspottedSamples = 0;
  let lockedSamples = 0;
  let currentStreak = 0;
  let maxStreak = 0;

  for (let tick = startTick; tick <= kill.tick; tick += 1) {
    const attackerFrame = attackerFramesByTick.get(tick);
    const victimFrame = victimFramesByTick.get(tick);
    if (!attackerFrame || !victimFrame) {
      continue;
    }

    if (
      attackerFrame.x === undefined ||
      attackerFrame.y === undefined ||
      attackerFrame.z === undefined ||
      victimFrame.x === undefined ||
      victimFrame.y === undefined ||
      victimFrame.z === undefined
    ) {
      continue;
    }

    const victimSeenByAttacker =
      Array.isArray(victimFrame.spottedByMask) &&
      player.steamId !== undefined &&
      victimFrame.spottedByMask.includes(player.steamId);
    const isUnspotted =
      victimSeenByAttacker === false ||
      (victimFrame.spottedByMask === undefined &&
        kill.victimSpottedByAttacker === false);
    if (!isUnspotted) {
      currentStreak = 0;
      continue;
    }

    unspottedSamples += 1;
    const targetAngles = computeTargetAngles(
      attackerFrame.x,
      attackerFrame.y,
      attackerFrame.z,
      victimFrame.x,
      victimFrame.y,
      victimFrame.z,
    );

    const yawError = Math.abs(angleDelta(attackerFrame.yaw, targetAngles.yaw));
    const pitchError = Math.abs(
      angleDelta(attackerFrame.pitch, targetAngles.pitch),
    );
    const error = Math.sqrt(yawError * yawError + pitchError * pitchError);
    if (error <= TRACK_LOCK_ERROR_DEG) {
      lockedSamples += 1;
      currentStreak += 1;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  if (unspottedSamples < TRACK_MIN_UNSPOTTED_SAMPLES) {
    return { score: 0, maxTrackMs: 0 };
  }

  const streakTargetSamples = Math.max(
    1,
    Math.floor((TRACK_STREAK_TARGET_MS / 1000) * tickRate),
  );
  const lockRatio = lockedSamples / unspottedSamples;
  const streakRatio = clamp01(maxStreak / streakTargetSamples);
  const score = clamp01(0.6 * lockRatio + 0.4 * streakRatio);
  return {
    score,
    maxTrackMs: (maxStreak / tickRate) * 1000,
  };
}

function computeTargetAngles(
  fromX: number,
  fromY: number,
  fromZ: number,
  toX: number,
  toY: number,
  toZ: number,
): { yaw: number; pitch: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dz = toZ - fromZ;
  const yaw = (Math.atan2(dy, dx) * 180) / Math.PI;
  const horizontal = Math.sqrt(dx * dx + dy * dy);
  const pitch = (Math.atan2(-dz, horizontal) * 180) / Math.PI;
  return { yaw, pitch };
}
