"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeWallhackMetric = computeWallhackMetric;
const shared_1 = require("./shared");
const EVIDENCE_WINDOW_MS = 300;
function computeWallhackMetric(player, kills, tickRate) {
    const playerKills = kills.filter((kill) => kill.attackerSlot === player.slot);
    const signalScores = [];
    const evidence = [];
    for (const kill of playerKills) {
        let signalScore = 0;
        const reasons = [];
        if (kill.throughSmoke) {
            signalScore += 0.55;
            reasons.push("through smoke");
        }
        if (kill.penetrated > 0) {
            signalScore += Math.min(0.45, 0.2 + kill.penetrated * 0.1);
            reasons.push(kill.penetrated === 1
                ? "single wall penetration"
                : `${kill.penetrated} wall penetrations`);
        }
        if (kill.attackerBlind) {
            signalScore += 0.3;
            reasons.push("attacker was blind");
        }
        if (kill.throughSmoke && kill.penetrated > 0) {
            signalScore += 0.15;
            reasons.push("smoke + wallbang overlap");
        }
        const normalized = (0, shared_1.clamp01)(signalScore);
        signalScores.push(normalized);
        if (normalized >= 0.5) {
            evidence.push({
                playerName: player.name,
                round: kill.round,
                tickStart: Math.max(0, kill.tick - Math.floor((EVIDENCE_WINDOW_MS / 1000) * tickRate)),
                tickEnd: kill.tick,
                timeSec: kill.tick / tickRate,
                reason: `Visibility proxy hit (${reasons.join(", ")})`,
                tags: ["info", "wallhack"],
            });
        }
    }
    const value = signalScores.length
        ? signalScores.reduce((acc, item) => acc + item, 0) / signalScores.length
        : 0;
    const suspiciousRatio = signalScores.length
        ? signalScores.filter((item) => item >= 0.5).length / signalScores.length
        : 0;
    const confidence = (0, shared_1.clamp01)(Math.min(signalScores.length / 12, 1) * (0.4 + 0.6 * suspiciousRatio));
    return {
        value: (0, shared_1.clamp01)(value),
        samples: signalScores.length,
        confidence,
        stats: (0, shared_1.buildStats)(signalScores),
        evidence: evidence.slice(0, 5),
    };
}
