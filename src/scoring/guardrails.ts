import type { MetricScore } from "../domain/types";
import { clamp01 } from "../features/shared";

export interface GuardrailInput {
  flick: MetricScore;
  prefire: MetricScore;
  wallhack: MetricScore;
  rounds: number;
  minRounds: number;
  minSamples: number;
  killCount: number;
  awpKillCount: number;
}

export interface GuardrailOutput {
  samplePenalty: number;
  roundPenalty: number;
  weaponAdjustment: number;
  sampleConfidence: number;
  roundConfidence: number;
}

export function computeGuardrails(input: GuardrailInput): GuardrailOutput {
  const combinedSamples =
    input.flick.samples + input.prefire.samples + input.wallhack.samples;
  const sampleRatio =
    input.minSamples > 0 ? combinedSamples / (input.minSamples * 3) : 1;
  const sampleConfidence = clamp01(sampleRatio);
  const samplePenalty = clamp01(1 - sampleConfidence);

  const roundRatio = input.minRounds > 0 ? input.rounds / input.minRounds : 1;
  const roundConfidence = clamp01(roundRatio);
  const roundPenalty = clamp01(1 - roundConfidence);

  const awpRatio = input.killCount > 0 ? input.awpKillCount / input.killCount : 0;
  const weaponAdjustment = clamp01(awpRatio * 0.6);

  return {
    samplePenalty,
    roundPenalty,
    weaponAdjustment,
    sampleConfidence,
    roundConfidence,
  };
}
