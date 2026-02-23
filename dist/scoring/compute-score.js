"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeSuspicionScore = computeSuspicionScore;
const shared_1 = require("../features/shared");
const weights_1 = require("./weights");
function computeSuspicionScore(input) {
    const aimComponent = weights_1.SCORE_WEIGHTS.aim * input.flick.value;
    const infoComponent = weights_1.SCORE_WEIGHTS.info * input.prefire.value;
    const wallhackComponent = weights_1.SCORE_WEIGHTS.wallhack * input.wallhack.value;
    const guardrailPenalty = (0, shared_1.clamp01)(input.guardrail.samplePenalty +
        input.guardrail.roundPenalty +
        input.guardrail.weaponAdjustment);
    const guardrailComponent = -weights_1.SCORE_WEIGHTS.guardrail * guardrailPenalty;
    const confidence = (0, shared_1.clamp01)(0.6 * input.guardrail.sampleConfidence + 0.4 * input.guardrail.roundConfidence);
    let scoreRaw = aimComponent + infoComponent + wallhackComponent + guardrailComponent;
    const cleanPlayProfile = input.wallhack.value < 0.08 &&
        input.flick.value < 0.08 &&
        input.prefire.value < 0.45;
    if (cleanPlayProfile) {
        scoreRaw -= 0.08;
    }
    const scoreFinal = Math.round((0, shared_1.clamp01)(scoreRaw) * 100 * confidence);
    return {
        scoreRaw,
        scoreFinal,
        confidence,
    };
}
