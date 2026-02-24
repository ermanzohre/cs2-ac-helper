"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTeamTrustSnapshot = buildTeamTrustSnapshot;
const feedback_1 = require("./feedback");
function buildTeamTrustSnapshot(ranking, focusPlayer, language, knownLowTrustNames = []) {
    const normalizedFocus = (0, feedback_1.normalizePlayerName)(focusPlayer);
    const knownLowTrust = new Set(knownLowTrustNames.map((name) => (0, feedback_1.normalizePlayerName)(name)).filter(Boolean));
    const focus = ranking.find((entry) => (0, feedback_1.normalizePlayerName)(entry.player.name) === normalizedFocus);
    if (!focus?.player.team || focus.player.team === "SPEC") {
        return {
            focusPlayer: focus?.player.name ?? focusPlayer,
            focusTeam: focus?.player.team,
            rows: [],
        };
    }
    const rows = ranking
        .filter((entry) => entry.player.team === focus.player.team)
        .map((entry) => toTrustFactorEntry(entry, language, knownLowTrust.has((0, feedback_1.normalizePlayerName)(entry.player.name))))
        .sort((a, b) => b.trustFactor - a.trustFactor);
    return {
        focusPlayer: focus.player.name,
        focusTeam: focus.player.team,
        rows,
    };
}
function toTrustFactorEntry(player, language, isKnownLowTrust) {
    const trustFactor = computeTrustFactor(player, isKnownLowTrust);
    return {
        playerName: player.player.name,
        team: player.player.team,
        trustFactor,
        trustLabel: trustLabel(trustFactor, language),
        improvementPlan: buildImprovementPlan(player, trustFactor, language, isKnownLowTrust),
    };
}
function computeTrustFactor(player, isKnownLowTrust) {
    const metricRisk = (0.4 * player.metrics.flick.value +
        0.3 * player.metrics.prefire.value +
        0.3 * player.metrics.wallhack.value) *
        100;
    const suspicionRisk = player.scoreFinal;
    const evidenceRisk = Math.min(player.metrics.flick.evidence.length +
        player.metrics.prefire.evidence.length +
        player.metrics.wallhack.evidence.length, 6);
    const uncertaintyPenalty = Math.round((1 - player.confidence) * 18);
    const verdictPenalty = verdictRiskPenalty(player.verdict.code);
    const knownLowTrustPenalty = isKnownLowTrust ? 18 : 0;
    const cleanBonus = player.verdict.code === "clean" ? 4 : 0;
    const trust = 84 -
        suspicionRisk * 0.45 -
        metricRisk * 0.55 -
        evidenceRisk * 2 -
        uncertaintyPenalty -
        verdictPenalty +
        cleanBonus -
        knownLowTrustPenalty;
    return clamp(Math.round(trust), 0, 100);
}
function trustLabel(trustFactor, language) {
    if (trustFactor >= 80) {
        return language === "tr" ? "Yuksek" : "High";
    }
    if (trustFactor >= 65) {
        return language === "tr" ? "Iyi" : "Good";
    }
    if (trustFactor >= 50) {
        return language === "tr" ? "Orta" : "Medium";
    }
    return language === "tr" ? "Dusuk" : "Low";
}
function buildImprovementPlan(player, trustFactor, language, isKnownLowTrust) {
    const plan = [];
    if (player.metrics.wallhack.value >= 0.18 ||
        player.metrics.wallhack.evidence.length >= 2) {
        plan.push(language === "tr"
            ? "Duman ve duvar arkasina surekli spray yerine utility veya bilgi bekleyerek oynayin."
            : "Avoid repeated blind sprays through smoke/walls; prefer utility and confirmed info.");
    }
    if (player.metrics.prefire.value >= 0.2) {
        plan.push(language === "tr"
            ? "Ayni acilara on-fire prefire zincirini azaltin; jiggle + bilgi ile giris yapin."
            : "Reduce repeated no-info prefire chains; enter with jiggle peeks and info.");
    }
    if (player.metrics.flick.value >= 0.22) {
        plan.push(language === "tr"
            ? "Ani buyuk flick hareketlerini azaltip crosshair'i daha stabil tutun."
            : "Limit large snap flicks and keep crosshair placement more stable.");
    }
    if (player.combat.headshotRate >= 0.68 && player.combat.kills >= 8) {
        plan.push(language === "tr"
            ? "Sadece headshot zorlamasi yerine kontrollu burst/tap dagilimi kullanin."
            : "Use a balanced burst/tap mix instead of forcing only headshot attempts.");
    }
    if (player.confidence < 0.7) {
        plan.push(language === "tr"
            ? "Daha fazla tam mac verisi ile istatistikleri stabilize edin."
            : "Play more full matches to stabilize the signal with richer samples.");
    }
    if (trustFactor < 70) {
        plan.push(language === "tr"
            ? "Matchmaking Trust icin toxic chat/report tetikleyen davranislardan kacin; temiz davranis ve istikrarli hesap kullanimi onemli."
            : "For matchmaking trust, avoid report-triggering toxic behavior and keep account/device usage consistent.");
    }
    if (isKnownLowTrust) {
        plan.push(language === "tr"
            ? "Bu oyuncu icin low-trust geri bildirimi var; report sayisini arttiran toxic/afk/grief davranislarini net sekilde azaltin."
            : "This player is marked as low-trust; reduce toxic/AFK/grief behavior that can increase report volume.");
    }
    if (plan.length === 0) {
        return [
            language === "tr"
                ? "Mevcut temiz oyun disiplinini koruyun; tutarli oyun Trust Factor'u yuksek tutar."
                : "Maintain this disciplined playstyle; consistency keeps Trust Factor high.",
        ];
    }
    return plan.slice(0, 3);
}
function verdictRiskPenalty(code) {
    if (code === "high_suspicion") {
        return 15;
    }
    if (code === "suspicious") {
        return 10;
    }
    if (code === "watch") {
        return 6;
    }
    if (code === "inconclusive") {
        return 3;
    }
    return 0;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
