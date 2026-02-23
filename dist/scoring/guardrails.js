"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeGuardrails = computeGuardrails;
const shared_1 = require("../features/shared");
function computeGuardrails(input) {
    const combinedSamples = input.flick.samples + input.prefire.samples + input.wallhack.samples;
    const sampleRatio = input.minSamples > 0 ? combinedSamples / (input.minSamples * 3) : 1;
    const sampleConfidence = (0, shared_1.clamp01)(sampleRatio);
    const samplePenalty = (0, shared_1.clamp01)(1 - sampleConfidence);
    const roundRatio = input.minRounds > 0 ? input.rounds / input.minRounds : 1;
    const roundConfidence = (0, shared_1.clamp01)(roundRatio);
    const roundPenalty = (0, shared_1.clamp01)(1 - roundConfidence);
    const awpRatio = input.killCount > 0 ? input.awpKillCount / input.killCount : 0;
    const weaponAdjustment = (0, shared_1.clamp01)(awpRatio * 0.6);
    return {
        samplePenalty,
        roundPenalty,
        weaponAdjustment,
        sampleConfidence,
        roundConfidence,
    };
}
