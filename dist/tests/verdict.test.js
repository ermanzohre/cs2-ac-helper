"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const verdict_1 = require("../scoring/verdict");
function metric(value) {
    return {
        value,
        samples: 10,
        confidence: 1,
        evidence: [],
    };
}
(0, node_test_1.default)("verdict marks low-score player as clean", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 37,
        confidence: 1,
        wallhack: metric(0.038),
    }, "tr");
    strict_1.default.equal(verdict.code, "clean");
    strict_1.default.equal(verdict.label, "Temiz");
});
(0, node_test_1.default)("verdict keeps low-score wallhack spikes at watch level", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 43,
        confidence: 0.92,
        wallhack: metric(0.24),
    }, "tr");
    strict_1.default.equal(verdict.code, "watch");
});
(0, node_test_1.default)("verdict marks high wallhack signal as suspicious with stronger score", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 49,
        confidence: 0.92,
        wallhack: metric(0.24),
    }, "tr");
    strict_1.default.equal(verdict.code, "suspicious");
});
(0, node_test_1.default)("verdict marks repeated wall evidence as suspicious even with low total score", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 22,
        confidence: 0.9,
        wallhack: {
            value: 0.16,
            samples: 20,
            confidence: 0.6,
            evidence: [
                {
                    round: 3,
                    tickStart: 10,
                    tickEnd: 12,
                    timeSec: 1,
                    reason: "Visibility proxy hit",
                    tags: ["info", "wallhack"],
                },
                {
                    round: 7,
                    tickStart: 20,
                    tickEnd: 22,
                    timeSec: 2,
                    reason: "Visibility proxy hit",
                    tags: ["info", "wallhack"],
                },
                {
                    round: 11,
                    tickStart: 30,
                    tickEnd: 32,
                    timeSec: 3,
                    reason: "Visibility proxy hit",
                    tags: ["info", "wallhack"],
                },
            ],
        },
    }, "tr");
    strict_1.default.equal(verdict.code, "suspicious");
});
(0, node_test_1.default)("verdict marks strong wall-only profile as suspicious", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 18,
        confidence: 0.9,
        wallhack: metric(0.32),
    }, "tr");
    strict_1.default.equal(verdict.code, "suspicious");
});
(0, node_test_1.default)("verdict marks low-signal single-demo profiles as inconclusive", () => {
    const verdict = (0, verdict_1.computeVerdict)({
        scoreFinal: 14,
        confidence: 1,
        wallhack: metric(0.1),
    }, "tr");
    strict_1.default.equal(verdict.code, "inconclusive");
});
