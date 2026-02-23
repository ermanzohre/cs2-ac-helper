"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeDemo = analyzeDemo;
const parser_adapter_1 = require("../ingest/parser-adapter");
const flick_1 = require("../features/flick");
const prefire_1 = require("../features/prefire");
const wallhack_1 = require("../features/wallhack");
const guardrails_1 = require("../scoring/guardrails");
const compute_score_1 = require("../scoring/compute-score");
const verdict_1 = require("../scoring/verdict");
const weights_1 = require("../scoring/weights");
const time_1 = require("../utils/time");
async function analyzeDemo(input) {
    (0, parser_adapter_1.validateDemoExtension)(input.demoPath);
    const parsed = await (0, parser_adapter_1.parseDemo)(input.demoPath, input.parser, input.verbose);
    const warnings = parsed.warnings.map((warning) => localizeWarning(warning, input.language));
    const players = [];
    for (const player of parsed.players) {
        const playerKills = parsed.kills.filter((kill) => kill.attackerSlot === player.slot);
        const playerShots = parsed.shots.filter((shot) => shot.shooterSlot === player.slot);
        const playerFrames = parsed.frames.filter((frame) => frame.playerSlot === player.slot);
        const flick = (0, flick_1.computeFlickMetric)(player, playerKills, playerFrames, parsed.tickRate);
        const prefire = (0, prefire_1.computePrefireMetric)(player, playerKills, playerShots, parsed.tickRate);
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
        const explanation = (0, weights_1.summarizeExplanation)(flick, prefire, wallhack, guardrail, score, input.language, parsed.tickRate);
        const verdict = (0, verdict_1.computeVerdict)({
            scoreFinal: score.scoreFinal,
            confidence: score.confidence,
            wallhack,
        }, input.language);
        players.push({
            player,
            metrics: { flick, prefire, wallhack },
            verdict,
            guardrails: {
                samplePenalty: guardrail.samplePenalty,
                weaponAdjustment: guardrail.weaponAdjustment,
            },
            scoreRaw: score.scoreRaw,
            scoreFinal: score.scoreFinal,
            confidence: score.confidence,
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
