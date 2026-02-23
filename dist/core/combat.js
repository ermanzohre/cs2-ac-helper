"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePlayerCombatSummary = computePlayerCombatSummary;
function computePlayerCombatSummary(playerSlot, kills, damages, rounds) {
    const killCount = kills.filter((kill) => kill.attackerSlot === playerSlot).length;
    const deathCount = kills.filter((kill) => kill.victimSlot === playerSlot).length;
    const headshotKills = kills.filter((kill) => kill.attackerSlot === playerSlot && kill.headshot).length;
    const damageGiven = damages
        .filter((damage) => damage.attackerSlot === playerSlot)
        .reduce((sum, damage) => sum + Math.max(0, damage.damageHealth), 0);
    const damageTaken = damages
        .filter((damage) => damage.victimSlot === playerSlot)
        .reduce((sum, damage) => sum + Math.max(0, damage.damageHealth), 0);
    const safeRounds = Math.max(1, rounds);
    return {
        kills: killCount,
        deaths: deathCount,
        kdRatio: roundTo(killCount / Math.max(1, deathCount), 2),
        headshotKills,
        headshotRate: killCount > 0 ? roundTo(headshotKills / killCount, 3) : 0,
        damageGiven,
        damageTaken,
        adr: roundTo(damageGiven / safeRounds, 1),
    };
}
function roundTo(value, digits) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}
