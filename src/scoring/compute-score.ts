import type { MetricScore } from "../domain/types";
import { clamp01 } from "../features/shared";
import { SCORE_WEIGHTS } from "./weights";
import type { GuardrailOutput } from "./guardrails";

export interface ScoreInput {
  flick: MetricScore;
  prefire: MetricScore;
  wallhack: MetricScore;
  guardrail: GuardrailOutput;
  rounds: number;
  minRounds: number;
}

export interface ScoreOutput {
  scoreRaw: number;
  scoreFinal: number;
  confidence: number;
}

export function computeSuspicionScore(input: ScoreInput): ScoreOutput {
  const aimComponent = SCORE_WEIGHTS.aim * input.flick.value;
  const infoComponent = SCORE_WEIGHTS.info * input.prefire.value;
  const wallhackComponent = SCORE_WEIGHTS.wallhack * input.wallhack.value;

  const guardrailPenalty = clamp01(
    input.guardrail.samplePenalty +
      input.guardrail.roundPenalty +
      input.guardrail.weaponAdjustment,
  );
  const guardrailComponent = -SCORE_WEIGHTS.guardrail * guardrailPenalty;

  const confidence = clamp01(
    0.6 * input.guardrail.sampleConfidence + 0.4 * input.guardrail.roundConfidence,
  );

  let scoreRaw = aimComponent + infoComponent + wallhackComponent + guardrailComponent;

  const cleanPlayProfile =
    input.wallhack.value < 0.08 &&
    input.flick.value < 0.08 &&
    input.prefire.value < 0.45;
  if (cleanPlayProfile) {
    scoreRaw -= 0.08;
  }

  const scoreFinal = Math.round(clamp01(scoreRaw) * 100 * confidence);

  return {
    scoreRaw,
    scoreFinal,
    confidence,
  };
}
