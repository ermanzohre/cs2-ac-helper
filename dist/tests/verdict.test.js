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
