import { parseDemo, validateDemoExtension } from "../ingest/parser-adapter";
import type {
  AnalyzeInput,
  EvidenceMoment,
  Locale,
  MatchReport,
  PlayerSuspicion,
} from "../domain/types";
import { computeFlickMetric } from "../features/flick";
import { computePrefireMetric } from "../features/prefire";
import { computeWallhackMetric } from "../features/wallhack";
import { computePlayerCombatSummary } from "./combat";
import { computeGuardrails } from "../scoring/guardrails";
import { computeSuspicionScore } from "../scoring/compute-score";
import {
  buildKnownPlayerFeedback,
  buildUnmatchedKnownNameWarnings,
  resolveKnownPlayerLabel,
} from "../scoring/feedback";
import { computeVerdict } from "../scoring/verdict";
import { summarizeExplanation } from "../scoring/weights";
import { currentIsoTimestamp } from "../utils/time";

export async function analyzeDemo(input: AnalyzeInput): Promise<MatchReport> {
  validateDemoExtension(input.demoPath);
  const parsed = await parseDemo(input.demoPath, input.parser, input.verbose);

  const warnings = parsed.warnings.map((warning) =>
    localizeWarning(warning, input.language),
  );
  const feedback = buildKnownPlayerFeedback(
    input.knownCleanNames,
    input.knownSuspiciousNames,
    input.language,
  );
  warnings.push(...feedback.warnings);
  warnings.push(
    ...buildUnmatchedKnownNameWarnings(
      parsed.players.map((player) => player.name),
      feedback,
      input.language,
    ),
  );
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
      playerFrames,
      parsed.tickRate,
    );
    const wallhack = computeWallhackMetric(player, playerKills, parsed.tickRate);
    const combat = computePlayerCombatSummary(
      player.slot,
      parsed.kills,
      parsed.damages,
      parsed.rounds,
    );

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

    let scoreRaw = score.scoreRaw;
    let scoreFinal = score.scoreFinal;
    let confidence = score.confidence;
    let verdict = computeVerdict(
      {
        scoreFinal,
        confidence,
        wallhack,
      },
      input.language,
    );
    const knownLabel = resolveKnownPlayerLabel(player.name, feedback);
    let labelNote: string | undefined;

    if (knownLabel === "known_clean") {
      scoreRaw = Math.min(scoreRaw, 0.05);
      scoreFinal = Math.min(scoreFinal, 5);
      confidence = Math.max(confidence, 0.8);
      verdict = computeVerdict(
        {
          scoreFinal: 0,
          confidence,
          wallhack,
        },
        input.language,
      );
      labelNote =
        input.language === "tr"
          ? "Geri bildirim etiketi uygulandi: bilinen temiz oyuncu."
          : "Feedback label applied: known clean player.";
    } else if (knownLabel === "known_suspicious") {
      scoreRaw = Math.max(scoreRaw, 0.6);
      scoreFinal = Math.max(scoreFinal, 60);
      confidence = Math.max(confidence, 0.85);
      verdict = computeVerdict(
        {
          scoreFinal,
          confidence,
          wallhack,
        },
        input.language,
      );
      labelNote =
        input.language === "tr"
          ? "Geri bildirim etiketi uygulandi: bilinen supheli oyuncu."
          : "Feedback label applied: known suspicious player.";
    }

    const explanation = summarizeExplanation(
      flick,
      prefire,
      wallhack,
      guardrail,
      { scoreFinal, confidence },
      input.language,
      parsed.tickRate,
    );

    if (labelNote) {
      explanation.push(labelNote);
    }

    explanation.push(localizeCombatSummary(combat, input.language));

    players.push({
      player,
      metrics: { flick, prefire, wallhack },
      verdict,
      guardrails: {
        samplePenalty: guardrail.samplePenalty,
        weaponAdjustment: guardrail.weaponAdjustment,
      },
      combat,
      scoreRaw,
      scoreFinal,
      confidence,
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
    if (input.language === "tr") {
      warnings.push(
        `Round sayısı düşük (${parsed.rounds}), minimum değer (${input.minRounds}) altında. Güven sınırlandı.`,
      );
    } else {
      warnings.push(
        `Low round count (${parsed.rounds}) below configured minimum (${input.minRounds}). Confidence is capped.`,
      );
    }
  }

  return {
    meta: {
      inputDemo: input.demoPath,
      generatedAt: currentIsoTimestamp(),
      parser: parsed.parser,
      language: input.language,
      rounds: parsed.rounds,
      ticks: parsed.totalTicks,
    },
    ranking: players,
    topEvents,
    warnings,
  };
}

function localizeCombatSummary(
  combat: {
    kills: number;
    deaths: number;
    kdRatio: number;
    headshotKills: number;
    headshotRate: number;
    damageGiven: number;
    damageTaken: number;
    adr: number;
  },
  language: Locale,
): string {
  if (language === "tr") {
    return `Savas ozeti: K/D ${combat.kills}/${combat.deaths} (${combat.kdRatio.toFixed(2)}), HS ${combat.headshotKills} (${(combat.headshotRate * 100).toFixed(0)}%), verilen hasar ${combat.damageGiven}, alinan hasar ${combat.damageTaken}, ADR ${combat.adr.toFixed(1)}.`;
  }

  return `Combat snapshot: K/D ${combat.kills}/${combat.deaths} (${combat.kdRatio.toFixed(2)}), HS ${combat.headshotKills} (${(combat.headshotRate * 100).toFixed(0)}%), damage given ${combat.damageGiven}, damage taken ${combat.damageTaken}, ADR ${combat.adr.toFixed(1)}.`;
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

function localizeWarning(warning: string, language: Locale): string {
  if (language !== "tr") {
    return warning;
  }

  if (
    warning === "Parser returned no players. Demo may be unsupported or incomplete."
  ) {
    return "Parser oyuncu verisi çıkarmadı. Demo desteklenmiyor veya eksik olabilir.";
  }

  if (
    warning ===
    "No frame samples available. Flick metric confidence will be reduced."
  ) {
    return "Frame örnekleri bulunamadı. Flick metriği güveni düşürülecek.";
  }

  if (warning.startsWith("[verbose] Parsed events:")) {
    return warning.replace("[verbose] Parsed events:", "[verbose] Çözümlenen eventler:");
  }

  return warning;
}
