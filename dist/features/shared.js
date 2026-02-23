"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clamp01 = clamp01;
exports.angleDelta = angleDelta;
exports.percentile = percentile;
exports.buildStats = buildStats;
function clamp01(value) {
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}
function angleDelta(current, previous) {
    let delta = current - previous;
    while (delta > 180) {
        delta -= 360;
    }
    while (delta < -180) {
        delta += 360;
    }
    return delta;
}
function percentile(values, q) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))));
    return sorted[index];
}
function buildStats(values) {
    if (values.length === 0) {
        return {};
    }
    const min = Math.min(...values);
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
        min,
        avg: sum / values.length,
        p95: percentile(values, 0.95),
    };
}
