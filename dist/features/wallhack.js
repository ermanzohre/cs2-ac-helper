"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeWallhackMetric = computeWallhackMetric;
const shared_1 = require("./shared");
const EVIDENCE_WINDOW_MS = 300;
const STRONG_SIGNAL_THRESHOLD = 0.58;
const BURST_EVENT_TARGET = 4;
const TOP_SIGNAL_WINDOW = 3;
function computeWallhackMetric(player, kills, tickRate) {
    const playerKills = kills.filter((kill) => kill.attackerSlot === player.slot);
    const signalScores = [];
    const evidence = [];
    for (const kill of playerKills) {
        let signalScore = 0;
        const reasons = [];
        if (kill.throughSmoke) {
            signalScore += 0.2;
            reasons.push("through smoke");
        }
        if (kill.throughSmoke && kill.headshot) {
            signalScore += 0.38;
            reasons.push("smoke headshot");
        }
        if (kill.penetrated > 0) {
            signalScore += Math.min(0.35, 0.12 + kill.penetrated * 0.07);
            reasons.push(kill.penetrated === 1
                ? "single wall penetration"
                : `${kill.penetrated} wall penetrations`);
        }
        if (kill.penetrated > 0 && kill.headshot) {
            signalScore += 0.18;
            reasons.push("penetration headshot");
        }
        if (kill.attackerBlind) {
            signalScore += 0.2;
            reasons.push("attacker was blind");
        }
        if (kill.attackerBlind && kill.headshot) {
            signalScore += 0.12;
            reasons.push("blind headshot");
        }
        if (kill.victimSpottedByAttacker === false) {
            signalScore += 0.16;
            reasons.push("victim not spotted by attacker");
        }
        if (kill.victimSpottedByAttacker === false &&
            (kill.throughSmoke || kill.penetrated > 0)) {
            signalScore += 0.2;
            reasons.push("occluded kill without spot info");
        }
        if (kill.victimSpottedByAttacker === false &&
            kill.headshot &&
            kill.attackerVictimDistance !== undefined &&
            kill.attackerVictimDistance > 900) {
            signalScore += 0.08;
            reasons.push("long-range unspotted headshot");
        }
        if (kill.throughSmoke && kill.penetrated > 0) {
            signalScore += 0.1;
            reasons.push("smoke + wallbang overlap");
        }
        if (kill.throughSmoke && kill.penetrated > 0 && kill.headshot) {
            signalScore += 0.1;
            reasons.push("smoke wallbang headshot");
        }
        const normalized = (0, shared_1.clamp01)(signalScore);
        signalScores.push(normalized);
        if (normalized >= STRONG_SIGNAL_THRESHOLD) {
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
    const meanValue = signalScores.length
        ? signalScores.reduce((acc, item) => acc + item, 0) / signalScores.length
        : 0;
    const strongSignals = signalScores.filter((item) => item >= STRONG_SIGNAL_THRESHOLD);
    const topSignals = [...signalScores]
        .sort((a, b) => b - a)
        .slice(0, TOP_SIGNAL_WINDOW);
    const topMean = topSignals.length
        ? topSignals.reduce((acc, item) => acc + item, 0) / topSignals.length
        : 0;
    const burstFactor = (0, shared_1.clamp01)(strongSignals.length / BURST_EVENT_TARGET);
    const value = (0, shared_1.clamp01)(0.45 * meanValue + 0.35 * topMean + 0.2 * burstFactor);
    const suspiciousRatio = signalScores.length
        ? strongSignals.length / signalScores.length
        : 0;
    const smokeHeadshotRatio = playerKills.length
        ? playerKills.filter((kill) => kill.throughSmoke && kill.headshot).length /
            playerKills.length
        : 0;
    const confidence = (0, shared_1.clamp01)(Math.min(signalScores.length / 12, 1) *
        (0.3 +
            0.35 * suspiciousRatio +
            0.2 * smokeHeadshotRatio +
            0.15 * burstFactor));
    return {
        value: (0, shared_1.clamp01)(value),
        samples: signalScores.length,
        confidence,
        stats: (0, shared_1.buildStats)(signalScores),
        evidence: evidence.slice(0, 5),
    };
}
