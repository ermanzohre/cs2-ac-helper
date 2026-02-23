"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const guardrails_1 = require("../scoring/guardrails");
const compute_score_1 = require("../scoring/compute-score");
const prefire_1 = require("../features/prefire");
function metric(value, samples, confidence = 1) {
    return {
        value,
        samples,
        confidence,
        evidence: [],
    };
}
(0, node_test_1.default)("guardrail penalty increases with small sample size", () => {
    const low = (0, guardrails_1.computeGuardrails)({
        flick: metric(0.2, 1),
        prefire: metric(0.2, 1),
        wallhack: metric(0.2, 1),
        rounds: 12,
        minRounds: 10,
        minSamples: 8,
        killCount: 2,
        awpKillCount: 0,
    });
    const high = (0, guardrails_1.computeGuardrails)({
        flick: metric(0.2, 20),
        prefire: metric(0.2, 20),
        wallhack: metric(0.2, 20),
        rounds: 12,
        minRounds: 10,
        minSamples: 8,
        killCount: 20,
        awpKillCount: 0,
    });
    strict_1.default.ok(low.samplePenalty > high.samplePenalty);
});
(0, node_test_1.default)("score is monotonic when metric values increase and penalty fixed", () => {
    const guardrail = (0, guardrails_1.computeGuardrails)({
        flick: metric(0.2, 20),
        prefire: metric(0.2, 20),
        wallhack: metric(0.2, 20),
        rounds: 20,
        minRounds: 10,
        minSamples: 8,
        killCount: 20,
        awpKillCount: 0,
    });
    const low = (0, compute_score_1.computeSuspicionScore)({
        flick: metric(0.2, 20),
        prefire: metric(0.2, 20),
        wallhack: metric(0.2, 20),
        guardrail,
        rounds: 20,
        minRounds: 10,
    });
    const high = (0, compute_score_1.computeSuspicionScore)({
        flick: metric(0.8, 20),
        prefire: metric(0.8, 20),
        wallhack: metric(0.8, 20),
        guardrail,
        rounds: 20,
        minRounds: 10,
    });
    strict_1.default.ok(high.scoreFinal >= low.scoreFinal);
});
(0, node_test_1.default)("prefire metric detects short shot-to-kill windows", () => {
    const result = (0, prefire_1.computePrefireMetric)({ name: "tester", slot: 1, team: "CT" }, [
        {
            tick: 100,
            round: 1,
            attackerSlot: 1,
            victimSlot: 2,
            weapon: "ak47",
            weaponClass: "rifle",
            throughSmoke: false,
            penetrated: 0,
            attackerBlind: false,
        },
    ], [{ tick: 95, round: 1, shooterSlot: 1, weapon: "ak47" }], 64);
    strict_1.default.ok(result.value > 0);
});
(0, node_test_1.default)("prefire metric does not mark same-tick shot+kill as suspicious alone", () => {
    const result = (0, prefire_1.computePrefireMetric)({ name: "tester", slot: 1, team: "CT" }, [
        {
            tick: 200,
            round: 2,
            attackerSlot: 1,
            victimSlot: 2,
            weapon: "ak47",
            weaponClass: "rifle",
            throughSmoke: false,
            penetrated: 0,
            attackerBlind: false,
        },
    ], [{ tick: 200, round: 2, shooterSlot: 1, weapon: "ak47" }], 64);
    strict_1.default.equal(result.value, 0);
    strict_1.default.equal(result.evidence.length, 0);
});
