import type { EvidenceMoment, MetricScore, PlayerIdentity } from "../domain/types";
import type { ParsedKill, ParsedShot } from "../ingest/types";
import { buildStats, clamp01 } from "./shared";

const PREFIRE_SHOT_WINDOW_MS = 120;

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

  const suspiciousSamples: number[] = [];
  const confidenceSamples: number[] = [];
  const evidence: EvidenceMoment[] = [];

  for (const kill of playerKills) {
    const previousShot = findLastShotBeforeTick(playerShots, kill.tick);
    const leadMs = previousShot
      ? ((kill.tick - previousShot.tick) / tickRate) * 1000
      : Number.POSITIVE_INFINITY;

    const prefireSignal =
      (Number.isFinite(leadMs) && leadMs >= 0 && leadMs <= PREFIRE_SHOT_WINDOW_MS) ||
      kill.throughSmoke ||
      kill.penetrated > 0;

    if (prefireSignal) {
      suspiciousSamples.push(1);
      evidence.push({
        round: kill.round,
        tickStart: Math.max(0, kill.tick - Math.floor((250 / 1000) * tickRate)),
        tickEnd: kill.tick,
        timeSec: kill.tick / tickRate,
        reason: formatPrefireReason(leadMs, kill),
        tags: ["info", "prefire"],
      });
    } else {
      suspiciousSamples.push(0);
    }

    confidenceSamples.push(Number.isFinite(leadMs) ? 1 : 0.6);
  }

  const totalKills = playerKills.length;
  const suspiciousCount = suspiciousSamples.reduce((acc, value) => acc + value, 0);
  const value = totalKills > 0 ? suspiciousCount / totalKills : 0;

  const availability = confidenceSamples.length
    ? confidenceSamples.reduce((acc, item) => acc + item, 0) / confidenceSamples.length
    : 0;
  const confidence = clamp01(Math.min(totalKills / 12, 1) * availability);

  return {
    value: clamp01(value),
    samples: totalKills,
    confidence,
    stats: buildStats(suspiciousSamples),
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

function formatPrefireReason(leadMs: number, kill: ParsedKill): string {
  if (kill.throughSmoke) {
    return "Kill through smoke shortly after firing";
  }

  if (kill.penetrated > 0) {
    return `Wall-penetration kill (penetrations=${kill.penetrated})`;
  }

  if (Number.isFinite(leadMs)) {
    return `Shot-to-kill lead time ${leadMs.toFixed(1)} ms`;
  }

  return "Prefire proxy signal detected";
}
