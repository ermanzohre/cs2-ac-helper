import type { Locale } from "../domain/types";

export const SCORE_WEIGHTS = {
  aim: 0.35,
  info: 0.35,
  wallhack: 0.2,
  guardrail: 0.1,
};

export function summarizeExplanation(
  flick: { value: number; samples: number; evidence: Array<{ timeSec: number }> },
  prefire: { value: number; samples: number; evidence: Array<{ timeSec: number }> },
  wallhack: { value: number; samples: number; evidence: Array<{ timeSec: number }> },
  guardrail: { samplePenalty: number; roundPenalty: number; weaponAdjustment: number },
  score: { scoreFinal: number; confidence: number },
  language: Locale,
  tickRate: number,
): string[] {
  const lines: string[] = [];

  if (language === "tr") {
    lines.push(
      `Suphe skoru ${score.scoreFinal}/100, guven ${(score.confidence * 100).toFixed(0)}%.`,
    );
    lines.push(
      `Flick ${(flick.value * 100).toFixed(1)}% (${flick.samples} ornek), prefire ${(prefire.value * 100).toFixed(1)}% (${prefire.samples} kill), wallhack proxy ${(wallhack.value * 100).toFixed(1)}% (${wallhack.samples} kill).`,
    );
  } else {
    lines.push(
      `Suspicion score ${score.scoreFinal}/100 with confidence ${(score.confidence * 100).toFixed(0)}%.`,
    );
    lines.push(
      `Flick ${(flick.value * 100).toFixed(1)}% (${flick.samples} samples), prefire ${(prefire.value * 100).toFixed(1)}% (${prefire.samples} kills), wallhack proxy ${(wallhack.value * 100).toFixed(1)}% (${wallhack.samples} kills).`,
    );
  }

  if (
    guardrail.samplePenalty > 0 ||
    guardrail.roundPenalty > 0 ||
    guardrail.weaponAdjustment > 0
  ) {
    if (language === "tr") {
      lines.push(
        `Koruma katsayisi uygulandi (ornek=${guardrail.samplePenalty.toFixed(2)}, round=${guardrail.roundPenalty.toFixed(2)}, silah=${guardrail.weaponAdjustment.toFixed(2)}).`,
      );
    } else {
      lines.push(
        `Guardrails applied (sample=${guardrail.samplePenalty.toFixed(2)}, rounds=${guardrail.roundPenalty.toFixed(2)}, weapon=${guardrail.weaponAdjustment.toFixed(2)}).`,
      );
    }
  }

  if (flick.evidence[0]) {
    if (language === "tr") {
      lines.push(`En yuksek aim anomali zamani ${formatTime(flick.evidence[0].timeSec)}.`);
    } else {
      lines.push(`Peak aim anomaly around ${formatTime(flick.evidence[0].timeSec)}.`);
    }
  }

  if (prefire.evidence[0]) {
    if (language === "tr") {
      lines.push(
        `En guclu prefire sinyali ${formatTime(prefire.evidence[0].timeSec)} civari.`,
      );
    } else {
      lines.push(
        `Strongest prefire proxy around ${formatTime(prefire.evidence[0].timeSec)}.`,
      );
    }
  }

  if (wallhack.evidence[0]) {
    if (language === "tr") {
      lines.push(
        `En guclu wallhack sinyali ${formatTime(wallhack.evidence[0].timeSec)} civari.`,
      );
    } else {
      lines.push(
        `Strongest wallhack proxy around ${formatTime(wallhack.evidence[0].timeSec)}.`,
      );
    }
  }

  return lines;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(whole % 60)
    .toString()
    .padStart(2, "0");

  return `${mins}:${secs}`;
}
