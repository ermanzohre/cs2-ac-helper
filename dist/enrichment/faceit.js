"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchFaceitAccountInsight = fetchFaceitAccountInsight;
exports.computeFaceitReputationScore = computeFaceitReputationScore;
exports.summarizeFaceitSignals = summarizeFaceitSignals;
const http_1 = require("./http");
async function fetchFaceitAccountInsight(input) {
    if (!input.apiKey) {
        return { warnings: [localizeMissingKey(input.language)] };
    }
    const warnings = [];
    const playerLookup = await fetchFaceitPlayer(input, warnings);
    if (!playerLookup) {
        return { warnings };
    }
    const statsUrl = `https://open.faceit.com/data/v4/players/${encodeURIComponent(playerLookup.playerId)}/stats/cs2`;
    const stats = await tryFetchFaceit(statsUrl, input.apiKey, input.language, warnings, "FACEIT stats");
    const lifetime = stats?.lifetime ?? {};
    const skillLevel = safeNumber(playerLookup.cs2?.skill_level);
    const elo = safeNumber(playerLookup.cs2?.faceit_elo);
    const matches = parseLooseNumber(lifetime["Matches"] ?? lifetime["matches"] ?? lifetime["Total Matches"]);
    const winRatePct = parseLooseNumber(lifetime["Win Rate %"] ?? lifetime["Win Rate"] ?? lifetime["Winrate"]);
    const kdRatio = parseLooseNumber(lifetime["Average K/D Ratio"] ?? lifetime["K/D Ratio"] ?? lifetime["Average K/D"]);
    const hsPct = parseLooseNumber(lifetime["Average Headshots %"] ?? lifetime["Headshots %"] ?? lifetime["HS%"]);
    const scoreInput = {
        skillLevel,
        elo,
        matches,
        winRatePct,
        kdRatio,
        hsPct,
    };
    const reputationScore = computeFaceitReputationScore(scoreInput);
    const analysis = summarizeFaceitSignals(scoreInput, input.language);
    const insight = {
        playerName: input.playerName,
        steamId: input.steamId,
        playerId: playerLookup.playerId,
        nickname: playerLookup.nickname ?? input.playerName,
        region: safeString(playerLookup.cs2?.region),
        skillLevel,
        elo,
        matches,
        winRatePct,
        kdRatio,
        hsPct,
        reputationScore,
        reputationLabel: reputationLabel(reputationScore, input.language),
        analysis,
    };
    return { insight, warnings };
}
function computeFaceitReputationScore(input) {
    let score = 56;
    if (input.skillLevel !== undefined) {
        score += clamp((input.skillLevel - 5) * 4, -18, 20);
    }
    if (input.elo !== undefined) {
        score += clamp(Math.round((input.elo - 1000) / 50), -12, 20);
    }
    if (input.matches !== undefined) {
        if (input.matches < 50) {
            score -= 8;
        }
        else if (input.matches >= 500) {
            score += 4;
        }
    }
    if (input.winRatePct !== undefined) {
        if (input.winRatePct < 45) {
            score -= 6;
        }
        else if (input.winRatePct > 55) {
            score += 6;
        }
    }
    if (input.kdRatio !== undefined) {
        if (input.kdRatio < 0.9) {
            score -= 8;
        }
        else if (input.kdRatio > 1.2) {
            score += 8;
        }
    }
    if (input.hsPct !== undefined &&
        input.kdRatio !== undefined &&
        input.hsPct > 65 &&
        input.kdRatio < 1) {
        score -= 6;
    }
    return clamp(Math.round(score), 0, 100);
}
function summarizeFaceitSignals(input, language) {
    const notes = [];
    if (input.matches !== undefined && input.matches < 50) {
        notes.push(language === "tr"
            ? "FACEIT mac ornegi az oldugu icin trend guveni dusuk."
            : "FACEIT match sample is small, so trend confidence is lower.");
    }
    if (input.kdRatio !== undefined && input.kdRatio < 0.9) {
        notes.push(language === "tr"
            ? "K/D dusuk; duel tutarliligini arttirmak genel puani iyilestirir."
            : "Low K/D suggests duel consistency improvements can raise this score.");
    }
    if (input.winRatePct !== undefined && input.winRatePct < 45) {
        notes.push(language === "tr"
            ? "Dusuk win rate, takim oyunu ve round kapanis kalitesinin gelistirilmesini gosteriyor."
            : "Low win rate points to teamplay/round-closing improvements.");
    }
    if (notes.length === 0) {
        notes.push(language === "tr"
            ? "FACEIT rekabet sinyalleri dengeli gorunuyor."
            : "FACEIT competitive signals look balanced.");
    }
    return notes;
}
async function fetchFaceitPlayer(input, warnings) {
    if (input.playerId) {
        const player = await tryFetchFaceit(`https://open.faceit.com/data/v4/players/${encodeURIComponent(input.playerId)}`, input.apiKey ?? "", input.language, warnings, "FACEIT player");
        const parsed = parseFaceitPlayer(player);
        if (parsed) {
            return parsed;
        }
    }
    if (input.steamId) {
        const bySteam = await tryFetchFaceit(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${encodeURIComponent(input.steamId)}`, input.apiKey ?? "", input.language, warnings, "FACEIT player-by-steam");
        const parsed = parseFaceitPlayer(bySteam);
        if (parsed) {
            return parsed;
        }
    }
    if (input.nickname) {
        const byName = await tryFetchFaceit(`https://open.faceit.com/data/v4/players?nickname=${encodeURIComponent(input.nickname)}`, input.apiKey ?? "", input.language, warnings, "FACEIT player-by-nickname");
        const parsed = parseFaceitPlayer(byName);
        if (parsed) {
            return parsed;
        }
    }
    warnings.push(input.language === "tr"
        ? "FACEIT oyuncusu bulunamadi (player-id, steamId veya nickname ile)."
        : "FACEIT player could not be resolved (player-id, steamId, or nickname).");
    return undefined;
}
function parseFaceitPlayer(payload) {
    const data = payload;
    if (!data || typeof data.player_id !== "string" || !data.player_id.trim()) {
        return undefined;
    }
    return {
        playerId: data.player_id,
        nickname: safeString(data.nickname),
        cs2: data.games?.cs2,
    };
}
async function tryFetchFaceit(url, apiKey, language, warnings, label) {
    try {
        return await (0, http_1.fetchJson)(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${apiKey}`,
            },
        });
    }
    catch {
        warnings.push(localizeEndpointWarning(language, label));
        return undefined;
    }
}
function parseLooseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value !== "string") {
        return undefined;
    }
    const normalized = value.replace(",", ".").replace(/[^0-9.\-]/g, "").trim();
    if (!normalized) {
        return undefined;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function safeNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function safeString(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
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
function localizeMissingKey(language) {
    if (language === "tr") {
        return "FACEIT API analizi atlandi: FACEIT API key saglanmadi.";
    }
    return "FACEIT API analysis skipped: missing FACEIT API key.";
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
