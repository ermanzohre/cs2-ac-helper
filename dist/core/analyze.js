"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDemo = analyzeDemo;
const parser_adapter_1 = require("../ingest/parser-adapter");
const flick_1 = require("../features/flick");
const prefire_1 = require("../features/prefire");
const wallhack_1 = require("../features/wallhack");
const guardrails_1 = require("../scoring/guardrails");
const compute_score_1 = require("../scoring/compute-score");
const feedback_1 = require("../scoring/feedback");
const verdict_1 = require("../scoring/verdict");
const weights_1 = require("../scoring/weights");
const time_1 = require("../utils/time");
async function analyzeDemo(input) {
    (0, parser_adapter_1.validateDemoExtension)(input.demoPath);
    const parsed = await (0, parser_adapter_1.parseDemo)(input.demoPath, input.parser, input.verbose);
    const warnings = parsed.warnings.map((warning) => localizeWarning(warning, input.language));
    const feedback = (0, feedback_1.buildKnownPlayerFeedback)(input.knownCleanNames, input.knownSuspiciousNames, input.language);
    warnings.push(...feedback.warnings);
    warnings.push(...(0, feedback_1.buildUnmatchedKnownNameWarnings)(parsed.players.map((player) => player.name), feedback, input.language));
    const players = [];
    for (const player of parsed.players) {
        const playerKills = parsed.kills.filter((kill) => kill.attackerSlot === player.slot);
        const playerShots = parsed.shots.filter((shot) => shot.shooterSlot === player.slot);
        const playerFrames = parsed.frames.filter((frame) => frame.playerSlot === player.slot);
        const flick = (0, flick_1.computeFlickMetric)(player, playerKills, playerFrames, parsed.tickRate);
        const prefire = (0, prefire_1.computePrefireMetric)(player, playerKills, playerShots, playerFrames, parsed.tickRate);
        const wallhack = (0, wallhack_1.computeWallhackMetric)(player, playerKills, parsed.tickRate);
        const guardrail = (0, guardrails_1.computeGuardrails)({
            flick,
            prefire,
            wallhack,
            rounds: parsed.rounds,
            minRounds: input.minRounds,
            minSamples: input.minSamples,
            killCount: playerKills.length,
            awpKillCount: playerKills.filter((kill) => kill.weaponClass === "awp")
                .length,
        });
        const score = (0, compute_score_1.computeSuspicionScore)({
            flick,
            prefire,
            wallhack,
            guardrail,
            rounds: parsed.rounds,
            minRounds: input.minRounds,
        });
        let scoreRaw = score.scoreRaw;
        let scoreFinal = score.scoreFinal;
        let confidence = score.confidence;
        let verdict = (0, verdict_1.computeVerdict)({
            scoreFinal,
            confidence,
            wallhack,
        }, input.language);
        const knownLabel = (0, feedback_1.resolveKnownPlayerLabel)(player.name, feedback);
        let labelNote;
        if (knownLabel === "known_clean") {
            scoreRaw = Math.min(scoreRaw, 0.05);
            scoreFinal = Math.min(scoreFinal, 5);
            confidence = Math.max(confidence, 0.8);
            verdict = (0, verdict_1.computeVerdict)({
                scoreFinal: 0,
                confidence,
                wallhack,
            }, input.language);
            labelNote =
                input.language === "tr"
                    ? "Geri bildirim etiketi uygulandi: bilinen temiz oyuncu."
                    : "Feedback label applied: known clean player.";
        }
        else if (knownLabel === "known_suspicious") {
            scoreRaw = Math.max(scoreRaw, 0.6);
            scoreFinal = Math.max(scoreFinal, 60);
            confidence = Math.max(confidence, 0.85);
            verdict = (0, verdict_1.computeVerdict)({
                scoreFinal,
                confidence,
                wallhack,
            }, input.language);
            labelNote =
                input.language === "tr"
                    ? "Geri bildirim etiketi uygulandi: bilinen supheli oyuncu."
                    : "Feedback label applied: known suspicious player.";
        }
        const explanation = (0, weights_1.summarizeExplanation)(flick, prefire, wallhack, guardrail, { scoreFinal, confidence }, input.language, parsed.tickRate);
        if (labelNote) {
            explanation.push(labelNote);
        }
        players.push({
            player,
            metrics: { flick, prefire, wallhack },
            verdict,
            guardrails: {
                samplePenalty: guardrail.samplePenalty,
                weaponAdjustment: guardrail.weaponAdjustment,
            },
            scoreRaw,
            scoreFinal,
            confidence,
            explanation,
        });
    }
    players.sort((a, b) => {
        if (b.scoreFinal !== a.scoreFinal) {
            return b.scoreFinal - a.scoreFinal;
        }
        if (b.confidence !== a.confidence) {
            return b.confidence - a.confidence;
        }
        const aSamples = a.metrics.flick.samples +
            a.metrics.prefire.samples +
            a.metrics.wallhack.samples;
        const bSamples = b.metrics.flick.samples +
            b.metrics.prefire.samples +
            b.metrics.wallhack.samples;
        return bSamples - aSamples;
    });
    const topEvents = collectTopEvents(players);
    if (parsed.rounds < input.minRounds) {
        if (input.language === "tr") {
            warnings.push(`Round sayısı düşük (${parsed.rounds}), minimum değer (${input.minRounds}) altında. Güven sınırlandı.`);
        }
        else {
            warnings.push(`Low round count (${parsed.rounds}) below configured minimum (${input.minRounds}). Confidence is capped.`);
        }
    }
    return {
        meta: {
            inputDemo: input.demoPath,
            generatedAt: (0, time_1.currentIsoTimestamp)(),
            parser: parsed.parser,
            language: input.language,
            rounds: parsed.rounds,
            ticks: parsed.totalTicks,
        },
        ranking: players,
        topEvents,
        warnings,
    };
}
function collectTopEvents(players) {
    return players
        .flatMap((player) => [
        ...player.metrics.flick.evidence,
        ...player.metrics.prefire.evidence,
        ...player.metrics.wallhack.evidence,
    ])
        .sort((a, b) => b.timeSec - a.timeSec)
        .slice(0, 5);
}
function localizeWarning(warning, language) {
    if (language !== "tr") {
        return warning;
    }
    if (warning === "Parser returned no players. Demo may be unsupported or incomplete.") {
        return "Parser oyuncu verisi çıkarmadı. Demo desteklenmiyor veya eksik olabilir.";
    }
    if (warning ===
        "No frame samples available. Flick metric confidence will be reduced.") {
        return "Frame örnekleri bulunamadı. Flick metriği güveni düşürülecek.";
    }
    if (warning.startsWith("[verbose] Parsed events:")) {
        return warning.replace("[verbose] Parsed events:", "[verbose] Çözümlenen eventler:");
    }
    return warning;
}
