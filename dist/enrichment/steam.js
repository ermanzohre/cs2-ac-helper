"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSteamAccountInsight = fetchSteamAccountInsight;
exports.computeSteamReputationScore = computeSteamReputationScore;
exports.summarizeSteamSignals = summarizeSteamSignals;
const http_1 = require("./http");
async function fetchSteamAccountInsight(input) {
    if (!input.apiKey) {
        return { warnings: [localizeMissingKey(input.language, "steam")] };
    }
    if (!input.steamId) {
        return { warnings: [localizeMissingSteamId(input.language)] };
    }
    const warnings = [];
    const encodedSteamId = encodeURIComponent(input.steamId);
    const key = encodeURIComponent(input.apiKey);
    const summariesUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${key}&steamids=${encodedSteamId}`;
    const bansUrl = `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${encodedSteamId}`;
    const steamLevelUrl = `https://api.steampowered.com/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${encodedSteamId}`;
    const ownedGamesUrl = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${encodedSteamId}&include_played_free_games=1`;
    const [summaryRes, bansRes, levelRes, gamesRes] = await Promise.allSettled([
        (0, http_1.fetchJson)(summariesUrl, { method: "GET" }),
        (0, http_1.fetchJson)(bansUrl, { method: "GET" }),
        (0, http_1.fetchJson)(steamLevelUrl, { method: "GET" }),
        (0, http_1.fetchJson)(ownedGamesUrl, { method: "GET" }),
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
    const steamLevel = safeNumber(level?.response?.player_level);
    const cs2Hours = extractCs2Hours(games);
    const accountAgeYears = computeAccountAgeYears(safeNumber(player?.timecreated));
    const vacBans = safeNumber(banRow?.NumberOfVACBans) ?? 0;
    const gameBans = safeNumber(banRow?.NumberOfGameBans) ?? 0;
    const daysSinceLastBan = safeNumber(banRow?.DaysSinceLastBan);
    const communityBanned = Boolean(banRow?.CommunityBanned ?? false);
    const economyBan = safeString(banRow?.EconomyBan);
    const scoreInput = {
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
    const insight = {
        playerName: safeString(player?.personaname) ?? input.playerName,
        steamId: input.steamId,
        profileUrl: safeString(player?.profileurl),
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
function computeSteamReputationScore(input) {
    let score = 74;
    if (input.accountAgeYears !== undefined) {
        if (input.accountAgeYears < 1) {
            score -= 18;
        }
        else if (input.accountAgeYears < 3) {
            score -= 10;
        }
        else if (input.accountAgeYears >= 10) {
            score += 6;
        }
    }
    if (input.steamLevel !== undefined) {
        if (input.steamLevel < 5) {
            score -= 7;
        }
        else if (input.steamLevel >= 20) {
            score += 4;
        }
    }
    if (input.cs2Hours !== undefined) {
        if (input.cs2Hours < 100) {
            score -= 10;
        }
        else if (input.cs2Hours < 500) {
            score -= 5;
        }
        else if (input.cs2Hours >= 1500) {
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
        }
        else if (input.daysSinceLastBan > 1800) {
            score += 2;
        }
    }
    return clamp(Math.round(score), 0, 100);
}
function summarizeSteamSignals(input, language) {
    const notes = [];
    if ((input.vacBans ?? 0) > 0 || (input.gameBans ?? 0) > 0) {
        notes.push(language === "tr"
            ? "Ban gecmisi negatif etki olusturuyor."
            : "Ban history contributes a strong negative signal.");
    }
    if (input.accountAgeYears !== undefined && input.accountAgeYears < 3) {
        notes.push(language === "tr"
            ? "Hesap yasi dusuk oldugu icin guven sinyali zayif."
            : "Low account age weakens long-term trust signals.");
    }
    if (input.cs2Hours !== undefined && input.cs2Hours < 500) {
        notes.push(language === "tr"
            ? "CS2 oynama saati arttikca guven sinyali daha stabil olur."
            : "Higher CS2 playtime usually stabilizes trust signals.");
    }
    if (notes.length === 0) {
        notes.push(language === "tr"
            ? "Steam sinyalleri dengeli gorunuyor."
            : "Steam-side signals look balanced.");
    }
    return notes;
}
function reputationLabel(score, language) {
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
function extractCs2Hours(payload) {
    const games = payload?.response?.games;
    if (!Array.isArray(games)) {
        return undefined;
    }
    const cs2 = games.find((game) => Number(game.appid) === 730);
    if (!cs2 || typeof cs2.playtime_forever !== "number") {
        return undefined;
    }
    return Math.round((cs2.playtime_forever / 60) * 10) / 10;
}
function getFirstPlayer(payload) {
    const players = payload?.response?.players;
    return Array.isArray(players) ? players[0] : undefined;
}
function getFirstBanRow(payload) {
    const players = payload?.players;
    return Array.isArray(players) ? players[0] : undefined;
}
function computeAccountAgeYears(timeCreated) {
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
function settledValue(result) {
    if (result.status === "fulfilled") {
        return result.value;
    }
    return undefined;
}
function safeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function safeString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function localizeMissingKey(language, source) {
    if (language === "tr") {
        return source === "steam"
            ? "Steam API analizi atlandi: STEAM API key saglanmadi."
            : "FACEIT API analizi atlandi: FACEIT API key saglanmadi.";
    }
    return source === "steam"
        ? "Steam API analysis skipped: missing STEAM API key."
        : "FACEIT API analysis skipped: missing FACEIT API key.";
}
function localizeMissingSteamId(language) {
    if (language === "tr") {
        return "Steam API analizi atlandi: odak steamId bulunamadi.";
    }
    return "Steam API analysis skipped: focus steamId is missing.";
}
function localizeEndpointWarning(language, endpoint) {
    if (language === "tr") {
        return `${endpoint} verisi alinamadi. Kismi analiz kullanildi.`;
    }
    return `${endpoint} endpoint failed. Partial analysis was used.`;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
