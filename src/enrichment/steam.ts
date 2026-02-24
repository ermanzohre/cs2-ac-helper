import type { Locale, SteamAccountInsight } from "../domain/types";
import { fetchJson } from "./http";

interface FetchSteamInsightInput {
  playerName: string;
  steamId?: string;
  apiKey?: string;
  language: Locale;
}

interface SteamScoreInput {
  accountAgeYears?: number;
  steamLevel?: number;
  cs2Hours?: number;
  vacBans?: number;
  gameBans?: number;
  daysSinceLastBan?: number;
  communityBanned?: boolean;
  economyBan?: string;
}

export async function fetchSteamAccountInsight(
  input: FetchSteamInsightInput,
): Promise<{ insight?: SteamAccountInsight; warnings: string[] }> {
  if (!input.apiKey) {
    return { warnings: [localizeMissingKey(input.language, "steam")] };
  }

  if (!input.steamId) {
    return { warnings: [localizeMissingSteamId(input.language)] };
  }

  const warnings: string[] = [];
  const encodedSteamId = encodeURIComponent(input.steamId);
  const key = encodeURIComponent(input.apiKey);
  const summariesUrl =
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${encodedSteamId}`;
  const bansUrl =
    `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${encodedSteamId}`;
  const steamLevelUrl =
    `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${encodedSteamId}`;
  const ownedGamesUrl =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${encodedSteamId}&include_played_free_games=1`;

  const [summaryRes, bansRes, levelRes, gamesRes] = await Promise.allSettled([
    fetchJson(summariesUrl, { method: "GET" }),
    fetchJson(bansUrl, { method: "GET" }),
    fetchJson(steamLevelUrl, { method: "GET" }),
    fetchJson(ownedGamesUrl, { method: "GET" }),
  ]);

  const summary = settledValue(summaryRes);
  const bans = settledValue(bansRes);
  const level = settledValue(levelRes);
  const games = settledValue(gamesRes);

  if (!summary) {
    warnings.push(localizeEndpointWarning(input.language, "Steam summaries"));
  }

  if (!bans) {
    warnings.push(localizeEndpointWarning(input.language, "Steam bans"));
  }

  if (!level) {
    warnings.push(localizeEndpointWarning(input.language, "Steam level"));
  }

  if (!games) {
    warnings.push(localizeEndpointWarning(input.language, "Steam games"));
  }

  const player = getFirstPlayer(summary);
  const banRow = getFirstBanRow(bans);
  const steamLevel = safeNumber((level as { response?: { player_level?: number } })?.response?.player_level);
  const cs2Hours = extractCs2Hours(games);
  const accountAgeYears = computeAccountAgeYears(
    safeNumber((player as { timecreated?: number })?.timecreated),
  );
  const vacBans = safeNumber((banRow as { NumberOfVACBans?: number })?.NumberOfVACBans) ?? 0;
  const gameBans = safeNumber((banRow as { NumberOfGameBans?: number })?.NumberOfGameBans) ?? 0;
  const daysSinceLastBan = safeNumber(
    (banRow as { DaysSinceLastBan?: number })?.DaysSinceLastBan,
  );
  const communityBanned = Boolean(
    (banRow as { CommunityBanned?: boolean })?.CommunityBanned ?? false,
  );
  const economyBan = safeString((banRow as { EconomyBan?: string })?.EconomyBan);

  const scoreInput: SteamScoreInput = {
    accountAgeYears,
    steamLevel,
    cs2Hours,
    vacBans,
    gameBans,
    daysSinceLastBan,
    communityBanned,
    economyBan,
  };
  const reputationScore = computeSteamReputationScore(scoreInput);
  const analysis = summarizeSteamSignals(scoreInput, input.language);

  const insight: SteamAccountInsight = {
    playerName: safeString((player as { personaname?: string })?.personaname) ?? input.playerName,
    steamId: input.steamId,
    profileUrl: safeString((player as { profileurl?: string })?.profileurl),
    accountAgeYears,
    steamLevel,
    cs2Hours,
    vacBans,
    gameBans,
    daysSinceLastBan,
    communityBanned,
    economyBan,
    reputationScore,
    reputationLabel: reputationLabel(reputationScore, input.language),
    analysis,
  };

  return { insight, warnings };
}

export function computeSteamReputationScore(input: SteamScoreInput): number {
  let score = 74;

  if (input.accountAgeYears !== undefined) {
    if (input.accountAgeYears < 1) {
      score -= 18;
    } else if (input.accountAgeYears < 3) {
      score -= 10;
    } else if (input.accountAgeYears >= 10) {
      score += 6;
    }
  }

  if (input.steamLevel !== undefined) {
    if (input.steamLevel < 5) {
      score -= 7;
    } else if (input.steamLevel >= 20) {
      score += 4;
    }
  }

  if (input.cs2Hours !== undefined) {
    if (input.cs2Hours < 100) {
      score -= 10;
    } else if (input.cs2Hours < 500) {
      score -= 5;
    } else if (input.cs2Hours >= 1500) {
      score += 4;
    }
  }

  if ((input.vacBans ?? 0) > 0) {
    score -= 40;
  }

  if ((input.gameBans ?? 0) > 0) {
    score -= 20;
  }

  if (input.communityBanned) {
    score -= 15;
  }

  if (input.economyBan && input.economyBan.toLowerCase() !== "none") {
    score -= 8;
  }

  if (input.daysSinceLastBan !== undefined) {
    if (input.daysSinceLastBan < 365) {
      score -= 18;
    } else if (input.daysSinceLastBan > 1800) {
      score += 2;
    }
  }

  return clamp(Math.round(score), 0, 100);
}

export function summarizeSteamSignals(
  input: SteamScoreInput,
  language: Locale,
): string[] {
  const notes: string[] = [];

  if ((input.vacBans ?? 0) > 0 || (input.gameBans ?? 0) > 0) {
    notes.push(
      language === "tr"
        ? "Ban gecmisi negatif etki olusturuyor."
        : "Ban history contributes a strong negative signal.",
    );
  }

  if (input.accountAgeYears !== undefined && input.accountAgeYears < 3) {
    notes.push(
      language === "tr"
        ? "Hesap yasi dusuk oldugu icin guven sinyali zayif."
        : "Low account age weakens long-term trust signals.",
    );
  }

  if (input.cs2Hours !== undefined && input.cs2Hours < 500) {
    notes.push(
      language === "tr"
        ? "CS2 oynama saati arttikca guven sinyali daha stabil olur."
        : "Higher CS2 playtime usually stabilizes trust signals.",
    );
  }

  if (notes.length === 0) {
    notes.push(
      language === "tr"
        ? "Steam sinyalleri dengeli gorunuyor."
        : "Steam-side signals look balanced.",
    );
  }

  return notes;
}

function reputationLabel(score: number, language: Locale): string {
  if (score >= 80) {
    return language === "tr" ? "Yuksek" : "High";
  }

  if (score >= 65) {
    return language === "tr" ? "Iyi" : "Good";
  }

  if (score >= 50) {
    return language === "tr" ? "Orta" : "Medium";
  }

  return language === "tr" ? "Dusuk" : "Low";
}

function extractCs2Hours(payload: unknown): number | undefined {
  const games = (payload as { response?: { games?: Array<{ appid?: number; playtime_forever?: number }> } })?.response?.games;
  if (!Array.isArray(games)) {
    return undefined;
  }

  const cs2 = games.find((game) => Number(game.appid) === 730);
  if (!cs2 || typeof cs2.playtime_forever !== "number") {
    return undefined;
  }

  return Math.round((cs2.playtime_forever / 60) * 10) / 10;
}

function getFirstPlayer(payload: unknown): unknown {
  const players = (payload as { response?: { players?: unknown[] } })?.response?.players;
  return Array.isArray(players) ? players[0] : undefined;
}

function getFirstBanRow(payload: unknown): unknown {
  const players = (payload as { players?: unknown[] })?.players;
  return Array.isArray(players) ? players[0] : undefined;
}

function computeAccountAgeYears(timeCreated?: number): number | undefined {
  if (!timeCreated || !Number.isFinite(timeCreated)) {
    return undefined;
  }

  const nowSec = Date.now() / 1000;
  if (timeCreated <= 0 || timeCreated > nowSec) {
    return undefined;
  }

  const years = (nowSec - timeCreated) / (365.25 * 24 * 3600);
  return Math.round(years * 10) / 10;
}

function settledValue(result: PromiseSettledResult<unknown>): unknown | undefined {
  if (result.status === "fulfilled") {
    return result.value;
  }
  return undefined;
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function localizeMissingKey(language: Locale, source: "steam" | "faceit"): string {
  if (language === "tr") {
    return source === "steam"
      ? "Steam API analizi atlandi: STEAM API key saglanmadi."
      : "FACEIT API analizi atlandi: FACEIT API key saglanmadi.";
  }

  return source === "steam"
    ? "Steam API analysis skipped: missing STEAM API key."
    : "FACEIT API analysis skipped: missing FACEIT API key.";
}

function localizeMissingSteamId(language: Locale): string {
  if (language === "tr") {
    return "Steam API analizi atlandi: odak steamId bulunamadi.";
  }

  return "Steam API analysis skipped: focus steamId is missing.";
}

function localizeEndpointWarning(language: Locale, endpoint: string): string {
  if (language === "tr") {
    return `${endpoint} verisi alinamadi. Kismi analiz kullanildi.`;
  }

  return `${endpoint} endpoint failed. Partial analysis was used.`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
