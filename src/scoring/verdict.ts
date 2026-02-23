import type { Locale, MetricScore, VerdictCode } from "../domain/types";

export interface VerdictInput {
  scoreFinal: number;
  confidence: number;
  wallhack: MetricScore;
}

export interface VerdictOutput {
  code: VerdictCode;
  label: string;
}

export function computeVerdict(
  input: VerdictInput,
  language: Locale,
): VerdictOutput {
  const code = resolveVerdictCode(input);
  return {
    code,
    label: localizeVerdict(code, language),
  };
}

function resolveVerdictCode(input: VerdictInput): VerdictCode {
  const wallEvidenceCount = input.wallhack.evidence.length;

  if (
    input.scoreFinal >= 78 ||
    (input.scoreFinal >= 66 &&
      input.wallhack.value >= 0.28 &&
      input.confidence >= 0.9) ||
    (wallEvidenceCount >= 5 &&
      input.wallhack.value >= 0.22 &&
      input.confidence >= 0.9)
  ) {
    return "high_suspicion";
  }

  if (
    input.scoreFinal >= 58 ||
    (input.scoreFinal >= 46 &&
      input.wallhack.value >= 0.24 &&
      input.confidence >= 0.85) ||
    (input.wallhack.value >= 0.3 && input.confidence >= 0.85) ||
    (wallEvidenceCount >= 3 &&
      input.wallhack.value >= 0.14 &&
      input.confidence >= 0.8)
  ) {
    return "suspicious";
  }

  if (
    input.scoreFinal >= 38 ||
    (input.scoreFinal >= 28 &&
      input.wallhack.value >= 0.18 &&
      input.confidence >= 0.8) ||
    (input.wallhack.value >= 0.16 && input.confidence >= 0.8) ||
    (wallEvidenceCount >= 2 &&
      input.wallhack.value >= 0.1 &&
      input.confidence >= 0.75)
  ) {
    return "watch";
  }

  const ultraCleanProfile =
    input.scoreFinal < 12 &&
    input.wallhack.value < 0.05 &&
    wallEvidenceCount === 0 &&
    input.confidence >= 0.85;
  if (ultraCleanProfile) {
    return "clean";
  }

  const inconclusiveProfile =
    input.scoreFinal < 30 &&
    input.wallhack.value < 0.18 &&
    wallEvidenceCount === 0;
  if (inconclusiveProfile) {
    return "inconclusive";
  }

  return "clean";
}

function localizeVerdict(code: VerdictCode, language: Locale): string {
  if (language === "tr") {
    switch (code) {
      case "high_suspicion":
        return "Yuksek suphe";
      case "suspicious":
        return "Supheli";
      case "watch":
        return "Izlenmeli";
      case "inconclusive":
        return "Belirsiz";
      case "clean":
      default:
        return "Temiz";
    }
  }

  switch (code) {
    case "high_suspicion":
      return "High Suspicion";
    case "suspicious":
      return "Suspicious";
    case "watch":
      return "Watch";
    case "inconclusive":
      return "Inconclusive";
    case "clean":
    default:
      return "Clean";
  }
}
