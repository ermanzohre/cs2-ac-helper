"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFlickMetric = computeFlickMetric;
const shared_1 = require("./shared");
const MAX_FLICK_SPEED = 2000;
const SUSPICIOUS_FLICK_SPEED = 900;
function computeFlickMetric(player, kills, frames, tickRate) {
    const playerFrames = frames
        .filter((frame) => frame.playerSlot === player.slot)
        .sort((a, b) => a.tick - b.tick);
    const speedSamples = [];
    const evidence = [];
    const windowStart = Math.floor((250 / 1000) * tickRate);
    const windowEnd = Math.floor((50 / 1000) * tickRate);
    for (const kill of kills) {
        const inWindow = playerFrames.filter((frame) => frame.tick >= kill.tick - windowStart &&
            frame.tick <= kill.tick + windowEnd);
        if (inWindow.length < 2) {
            continue;
        }
        let maxSpeed = 0;
        for (let index = 1; index < inWindow.length; index += 1) {
            const previous = inWindow[index - 1];
            const current = inWindow[index];
            const dtSeconds = Math.max((current.tick - previous.tick) / tickRate, 1 / tickRate);
            const yawSpeed = Math.abs((0, shared_1.angleDelta)(current.yaw, previous.yaw)) / dtSeconds;
            const pitchSpeed = Math.abs((0, shared_1.angleDelta)(current.pitch, previous.pitch)) / dtSeconds;
            const totalSpeed = Math.sqrt(yawSpeed ** 2 + pitchSpeed ** 2);
            maxSpeed = Math.max(maxSpeed, totalSpeed);
        }
        speedSamples.push(maxSpeed);
        if (maxSpeed >= SUSPICIOUS_FLICK_SPEED) {
            evidence.push({
                round: kill.round,
                tickStart: kill.tick - windowStart,
                tickEnd: kill.tick + windowEnd,
                timeSec: kill.tick / tickRate,
                reason: `High angular speed near kill (${maxSpeed.toFixed(1)} deg/s)`,
                tags: ["aim", "flick"],
            });
        }
    }
    const normalizedSamples = speedSamples.map((speed) => (0, shared_1.clamp01)(speed / MAX_FLICK_SPEED));
    const value = normalizedSamples.length
        ? normalizedSamples.reduce((acc, item) => acc + item, 0) / normalizedSamples.length
        : 0;
    const confidence = (0, shared_1.clamp01)(Math.min(speedSamples.length / 10, 1));
    return {
        value,
        samples: speedSamples.length,
        confidence,
        stats: (0, shared_1.buildStats)(speedSamples),
        evidence: evidence.slice(0, 5),
    };
}
