import type { Locale } from "../domain/types";

export type KnownPlayerLabel = "known_clean" | "known_suspicious";

export interface KnownPlayerFeedback {
  cleanNames: Map<string, string>;
  suspiciousNames: Map<string, string>;
  warnings: string[];
}

export function buildKnownPlayerFeedback(
  knownCleanNames: string[],
  knownSuspiciousNames: string[],
  language: Locale,
): KnownPlayerFeedback {
  const cleanNames = toNormalizedNameMap(knownCleanNames);
  const suspiciousNames = toNormalizedNameMap(knownSuspiciousNames);
  const warnings: string[] = [];

  for (const [normalized, rawName] of cleanNames) {
    if (!suspiciousNames.has(normalized)) {
      continue;
    }

    // Suspicious label takes precedence if both are provided by mistake.
    cleanNames.delete(normalized);
    warnings.push(
      language === "tr"
        ? `Ayni oyuncu hem temiz hem supheli listesinde: ${rawName}. Supheli etiketi kullanildi.`
        : `Player exists in both known-clean and known-suspicious lists: ${rawName}. Suspicious label was kept.`,
    );
  }

  return { cleanNames, suspiciousNames, warnings };
}

export function resolveKnownPlayerLabel(
  playerName: string,
  feedback: KnownPlayerFeedback,
): KnownPlayerLabel | undefined {
  const normalized = normalizePlayerName(playerName);
  if (feedback.suspiciousNames.has(normalized)) {
    return "known_suspicious";
  }

  if (feedback.cleanNames.has(normalized)) {
    return "known_clean";
  }

  return undefined;
}

export function buildUnmatchedKnownNameWarnings(
  playerNames: string[],
  feedback: KnownPlayerFeedback,
  language: Locale,
): string[] {
  const parsedNames = new Set(playerNames.map((name) => normalizePlayerName(name)));
  const warnings: string[] = [];

  for (const [normalized, rawName] of feedback.cleanNames) {
    if (!parsedNames.has(normalized)) {
      warnings.push(
        language === "tr"
          ? `Bilinen temiz oyuncu demoda bulunamadi: ${rawName}`
          : `Known clean player was not found in demo: ${rawName}`,
      );
    }
  }

  for (const [normalized, rawName] of feedback.suspiciousNames) {
    if (!parsedNames.has(normalized)) {
      warnings.push(
        language === "tr"
          ? `Bilinen supheli oyuncu demoda bulunamadi: ${rawName}`
          : `Known suspicious player was not found in demo: ${rawName}`,
      );
    }
  }

  return warnings;
}

export function normalizePlayerName(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function toNormalizedNameMap(values: string[]): Map<string, string> {
  const result = new Map<string, string>();
  for (const raw of values) {
    const normalized = normalizePlayerName(raw);
    if (!normalized || result.has(normalized)) {
      continue;
    }

    result.set(normalized, raw.trim());
  }

  return result;
}
