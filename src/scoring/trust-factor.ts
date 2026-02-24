import type {
  Locale,
  PlayerSuspicion,
  TeamTrustSnapshot,
  TrustFactorEntry,
} from "../domain/types";
import { normalizePlayerName } from "./feedback";

export function buildTeamTrustSnapshot(
  ranking: PlayerSuspicion[],
  focusPlayer: string,
  language: Locale,
): TeamTrustSnapshot {
  const normalizedFocus = normalizePlayerName(focusPlayer);
  const focus = ranking.find(
    (entry) => normalizePlayerName(entry.player.name) === normalizedFocus,
  );

  if (!focus?.player.team || focus.player.team === "SPEC") {
    return {
      focusPlayer: focus?.player.name ?? focusPlayer,
      focusTeam: focus?.player.team,
      rows: [],
    };
  }

  const rows = ranking
    .filter((entry) => entry.player.team === focus.player.team)
    .map((entry) => toTrustFactorEntry(entry, language))
    .sort((a, b) => b.trustFactor - a.trustFactor);

  return {
    focusPlayer: focus.player.name,
    focusTeam: focus.player.team,
    rows,
  };
}

function toTrustFactorEntry(
  player: PlayerSuspicion,
  language: Locale,
): TrustFactorEntry {
  const trustFactor = computeTrustFactor(player);
  return {
    playerName: player.player.name,
    team: player.player.team,
    trustFactor,
    trustLabel: trustLabel(trustFactor, language),
    improvementPlan: buildImprovementPlan(player, language),
  };
}

function computeTrustFactor(player: PlayerSuspicion): number {
  const base = 100 - player.scoreFinal;
  const uncertaintyBuffer = Math.round((1 - player.confidence) * 8);
  return clamp(Math.round(base + uncertaintyBuffer), 0, 100);
}

function trustLabel(trustFactor: number, language: Locale): string {
  if (trustFactor >= 85) {
    return language === "tr" ? "Yuksek" : "High";
  }

  if (trustFactor >= 70) {
    return language === "tr" ? "Iyi" : "Good";
  }

  if (trustFactor >= 50) {
    return language === "tr" ? "Orta" : "Medium";
  }

  return language === "tr" ? "Dusuk" : "Low";
}

function buildImprovementPlan(
  player: PlayerSuspicion,
  language: Locale,
): string[] {
  const plan: string[] = [];

  if (
    player.metrics.wallhack.value >= 0.18 ||
    player.metrics.wallhack.evidence.length >= 2
  ) {
    plan.push(
      language === "tr"
        ? "Duman ve duvar arkasina surekli spray yerine utility veya bilgi bekleyerek oynayin."
        : "Avoid repeated blind sprays through smoke/walls; prefer utility and confirmed info.",
    );
  }

  if (player.metrics.prefire.value >= 0.2) {
    plan.push(
      language === "tr"
        ? "Ayni acilara on-fire prefire zincirini azaltin; jiggle + bilgi ile giris yapin."
        : "Reduce repeated no-info prefire chains; enter with jiggle peeks and info.",
    );
  }

  if (player.metrics.flick.value >= 0.22) {
    plan.push(
      language === "tr"
        ? "Ani buyuk flick hareketlerini azaltip crosshair'i daha stabil tutun."
        : "Limit large snap flicks and keep crosshair placement more stable.",
    );
  }

  if (player.combat.headshotRate >= 0.68 && player.combat.kills >= 8) {
    plan.push(
      language === "tr"
        ? "Sadece headshot zorlamasi yerine kontrollu burst/tap dagilimi kullanin."
        : "Use a balanced burst/tap mix instead of forcing only headshot attempts.",
    );
  }

  if (player.confidence < 0.7) {
    plan.push(
      language === "tr"
        ? "Daha fazla tam mac verisi ile istatistikleri stabilize edin."
        : "Play more full matches to stabilize the signal with richer samples.",
    );
  }

  if (plan.length === 0) {
    return [
      language === "tr"
        ? "Mevcut temiz oyun disiplinini koruyun; tutarli oyun Trust Factor'u yuksek tutar."
        : "Maintain this disciplined playstyle; consistency keeps Trust Factor high.",
    ];
  }

  return plan.slice(0, 3);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
