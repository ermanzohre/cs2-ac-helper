"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCORE_WEIGHTS = void 0;
exports.summarizeExplanation = summarizeExplanation;
exports.SCORE_WEIGHTS = {
    aim: 0.35,
    info: 0.35,
    wallhack: 0.2,
    guardrail: 0.1,
};
function summarizeExplanation(flick, prefire, wallhack, guardrail, score, tickRate) {
    const lines = [];
    lines.push(`Suspicion score ${score.scoreFinal}/100 with confidence ${(score.confidence * 100).toFixed(0)}%.`);
    lines.push(`Flick ${(flick.value * 100).toFixed(1)}% (${flick.samples} samples), prefire ${(prefire.value * 100).toFixed(1)}% (${prefire.samples} kills), wallhack proxy ${(wallhack.value * 100).toFixed(1)}% (${wallhack.samples} kills).`);
    if (guardrail.samplePenalty > 0 ||
        guardrail.roundPenalty > 0 ||
        guardrail.weaponAdjustment > 0) {
        lines.push(`Guardrails applied (sample=${guardrail.samplePenalty.toFixed(2)}, rounds=${guardrail.roundPenalty.toFixed(2)}, weapon=${guardrail.weaponAdjustment.toFixed(2)}).`);
    }
    if (flick.evidence[0]) {
        lines.push(`Peak aim anomaly around ${formatTime(flick.evidence[0].timeSec)}.`);
    }
    if (prefire.evidence[0]) {
        lines.push(`Strongest prefire proxy around ${formatTime(prefire.evidence[0].timeSec)}.`);
    }
    if (wallhack.evidence[0]) {
        lines.push(`Strongest wallhack proxy around ${formatTime(wallhack.evidence[0].timeSec)}.`);
    }
    return lines;
}
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "00:00";
    }
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60)
        .toString()
        .padStart(2, "0");
    const secs = Math.floor(whole % 60)
        .toString()
        .padStart(2, "0");
    return `${mins}:${secs}`;
}
