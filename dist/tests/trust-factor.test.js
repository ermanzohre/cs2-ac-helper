"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const trust_factor_1 = require("../scoring/trust-factor");
let nextSlot = 1;
function metric(value, evidenceCount = 0) {
    return {
        value,
        samples: 12,
        confidence: 1,
        evidence: Array.from({ length: evidenceCount }, (_, index) => ({
            round: index + 1,
            tickStart: 100 + index,
            tickEnd: 101 + index,
            timeSec: 2 + index,
            reason: "signal",
            tags: ["test"],
        })),
    };
}
function player(name, team, scoreFinal, confidence, overrides) {
    return {
        player: { name, team, slot: nextSlot++ },
        metrics: {
            flick: metric(0.1),
            prefire: metric(0.1),
            wallhack: metric(0.1),
        },
        verdict: { code: "clean", label: "Temiz" },
        guardrails: { samplePenalty: 0, weaponAdjustment: 0 },
        combat: {
            kills: 10,
            deaths: 8,
            kdRatio: 1.25,
            headshotKills: 4,
            headshotRate: 0.4,
            damageGiven: 900,
            damageTaken: 780,
            adr: 85,
        },
        scoreRaw: scoreFinal / 100,
        scoreFinal,
        confidence,
        explanation: [],
        ...overrides,
    };
}
(0, node_test_1.default)("team trust snapshot includes only focus player and teammates", () => {
    const ranking = [
        player("Morpheus", "T", 10, 0.9),
        player("aKs--", "T", 6, 0.95),
        player("EnemyCT", "CT", 3, 0.9),
    ];
    const snapshot = (0, trust_factor_1.buildTeamTrustSnapshot)(ranking, "Morpheus", "tr");
    strict_1.default.equal(snapshot.focusPlayer, "Morpheus");
    strict_1.default.equal(snapshot.focusTeam, "T");
    strict_1.default.equal(snapshot.rows.length, 2);
    strict_1.default.ok(snapshot.rows.every((entry) => entry.team === "T"));
});
(0, node_test_1.default)("team trust snapshot generates improvement plan for risky patterns", () => {
    const risky = player("Morpheus", "T", 48, 0.92, {
        metrics: {
            flick: metric(0.28),
            prefire: metric(0.31),
            wallhack: metric(0.27, 3),
        },
        combat: {
            kills: 15,
            deaths: 9,
            kdRatio: 1.66,
            headshotKills: 12,
            headshotRate: 0.8,
            damageGiven: 1400,
            damageTaken: 900,
            adr: 110,
        },
    });
    const snapshot = (0, trust_factor_1.buildTeamTrustSnapshot)([risky], "Morpheus", "tr");
    strict_1.default.equal(snapshot.rows.length, 1);
    strict_1.default.ok(snapshot.rows[0].improvementPlan.length > 0);
    strict_1.default.ok(snapshot.rows[0].trustFactor < 70);
});
(0, node_test_1.default)("team trust snapshot is empty when focus player is missing", () => {
    const ranking = [player("aKs--", "T", 7, 0.9)];
    const snapshot = (0, trust_factor_1.buildTeamTrustSnapshot)(ranking, "Morpheus", "tr");
    strict_1.default.equal(snapshot.rows.length, 0);
    strict_1.default.equal(snapshot.focusPlayer, "Morpheus");
});
(0, node_test_1.default)("known low trust list applies extra penalty", () => {
    const ranking = [player("Morpheus", "T", 8, 0.9)];
    const baseline = (0, trust_factor_1.buildTeamTrustSnapshot)(ranking, "Morpheus", "tr");
    const calibrated = (0, trust_factor_1.buildTeamTrustSnapshot)(ranking, "Morpheus", "tr", ["Morpheus"]);
    strict_1.default.ok(calibrated.rows[0].trustFactor < baseline.rows[0].trustFactor);
});
