"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const faceit_1 = require("../enrichment/faceit");
const steam_1 = require("../enrichment/steam");
(0, node_test_1.default)("steam reputation score drops with ban history", () => {
    const clean = (0, steam_1.computeSteamReputationScore)({
        accountAgeYears: 9,
        steamLevel: 25,
        cs2Hours: 1800,
        vacBans: 0,
        gameBans: 0,
        communityBanned: false,
        economyBan: "none",
    });
    const banned = (0, steam_1.computeSteamReputationScore)({
        accountAgeYears: 1.5,
        steamLevel: 3,
        cs2Hours: 90,
        vacBans: 1,
        gameBans: 1,
        daysSinceLastBan: 120,
        communityBanned: true,
        economyBan: "probation",
    });
    strict_1.default.ok(clean > banned);
    strict_1.default.ok(banned < 45);
});
(0, node_test_1.default)("faceit reputation score rewards stronger competitive profile", () => {
    const low = (0, faceit_1.computeFaceitReputationScore)({
        skillLevel: 3,
        elo: 950,
        matches: 30,
        winRatePct: 42,
        kdRatio: 0.82,
        hsPct: 38,
    });
    const high = (0, faceit_1.computeFaceitReputationScore)({
        skillLevel: 8,
        elo: 1850,
        matches: 600,
        winRatePct: 58,
        kdRatio: 1.28,
        hsPct: 49,
    });
    strict_1.default.ok(high > low);
    strict_1.default.ok(high >= 70);
});
