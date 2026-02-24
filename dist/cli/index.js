#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const analyze_1 = require("../core/analyze");
const fs_2 = require("../utils/fs");
const json_writer_1 = require("../report/json-writer");
const html_writer_1 = require("../report/html-writer");
const csv_writer_1 = require("../report/csv-writer");
const EXIT_SUCCESS = 0;
const EXIT_USER_ERROR = 1;
const EXIT_PIPELINE_ERROR = 2;
const program = new commander_1.Command();
program.name("cs2ac").description("CS2 Anti-Cheat Helper").version("0.2.0");
program
    .command("analyze")
    .description("Analyze a CS2 demo file and generate suspicion reports")
    .argument("<demo>", "Path to demo file")
    .option("--out <dir>", "Output directory", "./reports")
    .option("--format <list>", "Output formats: json,html,csv", "json,html")
    .option("--csv", "Enable timeline.csv output")
    .option("--min-samples <n>", "Minimum samples for confidence gates", parsePositiveInt, 8)
    .option("--min-rounds <n>", "Minimum rounds for confidence gates", parsePositiveInt, 10)
    .option("--parser <name>", "Parser backend: auto|demofile|demoparser2", "auto")
    .option("--lang <code>", "Report language: tr|en", parseLocale, "tr")
    .option("--known-clean <list>", "Comma-separated known clean player names", parseNameList, [])
    .option("--known-suspicious <list>", "Comma-separated known suspicious player names", parseNameList, [])
    .option("--known-cheat <list>", "Alias of --known-suspicious", parseNameList, [])
    .option("--known-low-trust <list>", "Comma-separated players known to receive low Trust warnings", parseNameList, [])
    .option("--focus-player <name>", "Build Trust Factor table for this player and teammates", "Morpheus")
    .option("--focus-steam-id <id>", "Focus SteamID64 used for Steam/FACEIT API enrichment", "76561197994583429")
    .option("--steam-api-key <key>", "Steam Web API key (or use STEAM_API_KEY env)", process.env.STEAM_API_KEY ?? "")
    .option("--faceit-api-key <key>", "FACEIT Data API key (or use FACEIT_API_KEY env)", process.env.FACEIT_API_KEY ?? "")
    .option("--faceit-player-id <id>", "Optional FACEIT player_id override for enrichment")
    .option("--faceit-nickname <name>", "Optional FACEIT nickname override for enrichment")
    .option("--pretty", "Pretty print JSON output", true)
    .option("--no-pretty", "Disable JSON pretty printing")
    .option("--verbose", "Verbose logs", false)
    .action(async (demoPath, options) => {
    const absoluteDemo = path_1.default.resolve(demoPath);
    if (!fs_1.default.existsSync(absoluteDemo)) {
        console.error(`[ERROR] Demo file not found: ${absoluteDemo}`);
        process.exit(EXIT_USER_ERROR);
    }
    const outDir = path_1.default.resolve(options.out);
    const formatSet = parseFormats(options.format, Boolean(options.csv));
    const knownSuspiciousNames = [
        ...options.knownSuspicious,
        ...options.knownCheat,
    ];
    try {
        (0, fs_2.ensureDirectory)(outDir);
        const report = await (0, analyze_1.analyzeDemo)({
            demoPath: absoluteDemo,
            minSamples: options.minSamples,
            minRounds: options.minRounds,
            parser: options.parser,
            language: options.lang,
            verbose: Boolean(options.verbose),
            knownCleanNames: options.knownClean,
            knownSuspiciousNames,
            knownLowTrustNames: options.knownLowTrust,
            focusPlayer: String(options.focusPlayer ?? "Morpheus"),
            focusSteamId: String(options.focusSteamId ?? "76561197994583429"),
            steamApiKey: optionalString(options.steamApiKey),
            faceitApiKey: optionalString(options.faceitApiKey),
            faceitPlayerId: optionalString(options.faceitPlayerId),
            faceitNickname: optionalString(options.faceitNickname),
        });
        if (formatSet.has("json")) {
            (0, json_writer_1.writeJsonReport)(outDir, report, Boolean(options.pretty));
        }
        if (formatSet.has("html")) {
            (0, html_writer_1.writeHtmlReport)(outDir, report);
        }
        if (formatSet.has("csv")) {
            (0, csv_writer_1.writeTimelineCsv)(outDir, report);
        }
        if (options.lang === "tr") {
            console.log(`[OK] Analiz tamamlandı: ${absoluteDemo}`);
            console.log(`[OK] Çıktılar yazıldı: ${outDir}`);
        }
        else {
            console.log(`[OK] Analysis completed: ${absoluteDemo}`);
            console.log(`[OK] Outputs written to: ${outDir}`);
        }
        process.exit(EXIT_SUCCESS);
    }
    catch (error) {
        if (error instanceof commander_1.InvalidArgumentError) {
            console.error(`[ERROR] ${error.message}`);
            process.exit(EXIT_USER_ERROR);
        }
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[ERROR] Analysis failed: ${message}`);
        process.exit(EXIT_PIPELINE_ERROR);
    }
});
program.parse(process.argv);
function parsePositiveInt(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new commander_1.InvalidArgumentError(`Expected a positive integer, received: ${value}`);
    }
    return parsed;
}
function parseLocale(value) {
    const normalized = value.trim().toLowerCase();
    if (normalized === "tr" || normalized === "en") {
        return normalized;
    }
    throw new commander_1.InvalidArgumentError(`Unsupported language: ${value}. Use tr or en.`);
}
function parseFormats(raw, csvFlag) {
    const values = raw
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean);
    if (csvFlag && !values.includes("csv")) {
        values.push("csv");
    }
    if (values.length === 0) {
        throw new commander_1.InvalidArgumentError("At least one format is required.");
    }
    const allowed = new Set(["json", "html", "csv"]);
    for (const value of values) {
        if (!allowed.has(value)) {
            throw new commander_1.InvalidArgumentError(`Unsupported format: ${value}`);
        }
    }
    return new Set(values);
}
function parseNameList(raw, previous = []) {
    const names = raw
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
    return [...previous, ...names];
}
function optionalString(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
}
