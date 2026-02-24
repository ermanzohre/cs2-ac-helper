"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchExternalInsights = fetchExternalInsights;
const faceit_1 = require("./faceit");
const steam_1 = require("./steam");
async function fetchExternalInsights(input) {
    const warnings = [];
    const steamPromise = input.steamApiKey
        ? (0, steam_1.fetchSteamAccountInsight)({
            playerName: input.focusPlayer,
            steamId: input.focusSteamId,
            apiKey: input.steamApiKey,
            language: input.language,
        }).catch((error) => ({
            insight: undefined,
            warnings: [localizeError(input.language, "steam", error)],
        }))
        : Promise.resolve({ insight: undefined, warnings: [] });
    const faceitPromise = input.faceitApiKey
        ? (0, faceit_1.fetchFaceitAccountInsight)({
            playerName: input.focusPlayer,
            steamId: input.focusSteamId,
            playerId: input.faceitPlayerId,
            nickname: input.faceitNickname,
            apiKey: input.faceitApiKey,
            language: input.language,
        }).catch((error) => ({
            insight: undefined,
            warnings: [localizeError(input.language, "faceit", error)],
        }))
        : Promise.resolve({ insight: undefined, warnings: [] });
    const [steamResult, faceitResult] = await Promise.all([
        steamPromise,
        faceitPromise,
    ]);
    warnings.push(...steamResult.warnings);
    warnings.push(...faceitResult.warnings);
    const insights = {
        focusPlayer: input.focusPlayer,
        focusSteamId: input.focusSteamId,
        steam: steamResult.insight,
        faceit: faceitResult.insight,
    };
    if (!insights.steam && !insights.faceit) {
        return { warnings };
    }
    return { insights, warnings };
}
function localizeError(language, source, error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (language === "tr") {
        return source === "steam"
            ? `Steam API analizinde hata: ${reason}`
            : `FACEIT API analizinde hata: ${reason}`;
    }
    return source === "steam"
        ? `Steam API analysis failed: ${reason}`
        : `FACEIT API analysis failed: ${reason}`;
}
