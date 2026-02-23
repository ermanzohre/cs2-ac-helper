import { parseDemo, validateDemoExtension } from "../ingest/parser-adapter";
import type {
  AnalyzeInput,
  EvidenceMoment,
  MatchReport,
  PlayerSuspicion,
} from "../domain/types";
import { computeFlickMetric } from "../features/flick";
import { computePrefireMetric } from "../features/prefire";
import { computeWallhackMetric } from "../features/wallhack";
import { computeGuardrails } from "../scoring/guardrails";
import { computeSuspicionScore } from "../scoring/compute-score";
import { summarizeExplanation } from "../scoring/weights";
import { currentIsoTimestamp } from "../utils/time";

export async function analyzeDemo(input: AnalyzeInput): Promise<MatchReport> {
  validateDemoExtension(input.demoPath);
  const parsed = await parseDemo(input.demoPath, input.parser, input.verbose);

  const warnings = [...parsed.warnings];
  const players: PlayerSuspicion[] = [];

  for (const player of parsed.players) {
    const playerKills = parsed.kills.filter(
      (kill) => kill.attackerSlot === player.slot,
    );
    const playerShots = parsed.shots.filter(
      (shot) => shot.shooterSlot === player.slot,
    );
    const playerFrames = parsed.frames.filter(
      (frame) => frame.playerSlot === player.slot,
    );

    const flick = computeFlickMetric(
      player,
      playerKills,
      playerFrames,
      parsed.tickRate,
    );
    const prefire = computePrefireMetric(
      player,
      playerKills,
      playerShots,
      parsed.tickRate,
    );
    const wallhack = computeWallhackMetric(player, playerKills, parsed.tickRate);

    const guardrail = computeGuardrails({
      flick,
      prefire,
      wallhack,
      rounds: parsed.rounds,
      minRounds: input.minRounds,
      minSamples: input.minSamples,
      killCount: playerKills.length,
      awpKillCount: playerKills.filter((kill) => kill.weaponClass === "awp")
        .length,
    });

    const score = computeSuspicionScore({
      flick,
      prefire,
      wallhack,
      guardrail,
      rounds: parsed.rounds,
      minRounds: input.minRounds,
    });

    const explanation = summarizeExplanation(
      flick,
      prefire,
      wallhack,
      guardrail,
      score,
      parsed.tickRate,
    );

    players.push({
      player,
      metrics: { flick, prefire, wallhack },
      guardrails: {
        samplePenalty: guardrail.samplePenalty,
        weaponAdjustment: guardrail.weaponAdjustment,
      },
      scoreRaw: score.scoreRaw,
      scoreFinal: score.scoreFinal,
      confidence: score.confidence,
      explanation,
    });
  }

  players.sort((a, b) => {
    if (b.scoreFinal !== a.scoreFinal) {
      return b.scoreFinal - a.scoreFinal;
    }

    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }

    const aSamples =
      a.metrics.flick.samples +
      a.metrics.prefire.samples +
      a.metrics.wallhack.samples;
    const bSamples =
      b.metrics.flick.samples +
      b.metrics.prefire.samples +
      b.metrics.wallhack.samples;
    return bSamples - aSamples;
  });

  const topEvents = collectTopEvents(players);

  if (parsed.rounds < input.minRounds) {
    warnings.push(
      `Low round count (${parsed.rounds}) below configured minimum (${input.minRounds}). Confidence is capped.`,
    );
  }

  return {
    meta: {
      inputDemo: input.demoPath,
      generatedAt: currentIsoTimestamp(),
      parser: parsed.parser,
      rounds: parsed.rounds,
      ticks: parsed.totalTicks,
    },
    ranking: players,
    topEvents,
    warnings,
  };
}

function collectTopEvents(players: PlayerSuspicion[]): EvidenceMoment[] {
  return players
    .flatMap((player) => [
      ...player.metrics.flick.evidence,
      ...player.metrics.prefire.evidence,
      ...player.metrics.wallhack.evidence,
    ])
    .sort((a, b) => b.timeSec - a.timeSec)
    .slice(0, 5);
}
