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
  if (
    input.scoreFinal >= 78 ||
    (input.scoreFinal >= 66 &&
      input.wallhack.value >= 0.28 &&
      input.confidence >= 0.9)
  ) {
    return "high_suspicion";
  }

  if (
    input.scoreFinal >= 58 ||
    (input.scoreFinal >= 46 &&
      input.wallhack.value >= 0.24 &&
      input.confidence >= 0.85)
  ) {
    return "suspicious";
  }

  if (
    input.scoreFinal >= 38 ||
    (input.scoreFinal >= 28 &&
      input.wallhack.value >= 0.18 &&
      input.confidence >= 0.8)
  ) {
    return "watch";
  }

  return "clean";
}

function localizeVerdict(code: VerdictCode, language: Locale): string {
  if (language === "tr") {
    switch (code) {
      case "high_suspicion":
        return "Yüksek şüphe";
      case "suspicious":
        return "Şüpheli";
      case "watch":
        return "İzlenmeli";
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
    case "clean":
    default:
      return "Clean";
  }
}
