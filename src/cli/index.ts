#!/usr/bin/env node

import { Command, InvalidArgumentError } from "commander";
import path from "path";
import fs from "fs";
import type { Locale } from "../domain/types";
import { analyzeDemo } from "../core/analyze";
import { ensureDirectory } from "../utils/fs";
import { writeJsonReport } from "../report/json-writer";
import { writeHtmlReport } from "../report/html-writer";
import { writeTimelineCsv } from "../report/csv-writer";

const EXIT_SUCCESS = 0;
const EXIT_USER_ERROR = 1;
const EXIT_PIPELINE_ERROR = 2;

const program = new Command();

program.name("cs2ac").description("CS2 Anti-Cheat Helper").version("0.2.0");

program
  .command("analyze")
  .description("Analyze a CS2 demo file and generate suspicion reports")
  .argument("<demo>", "Path to demo file")
  .option("--out <dir>", "Output directory", "./reports")
  .option("--format <list>", "Output formats: json,html,csv", "json,html")
  .option("--csv", "Enable timeline.csv output")
  .option(
    "--min-samples <n>",
    "Minimum samples for confidence gates",
    parsePositiveInt,
    8,
  )
  .option(
    "--min-rounds <n>",
    "Minimum rounds for confidence gates",
    parsePositiveInt,
    10,
  )
  .option("--parser <name>", "Parser backend: auto|demofile|demoparser2", "auto")
  .option("--lang <code>", "Report language: tr|en", parseLocale, "tr")
  .option(
    "--known-clean <list>",
    "Comma-separated known clean player names",
    parseNameList,
    [],
  )
  .option(
    "--known-suspicious <list>",
    "Comma-separated known suspicious player names",
    parseNameList,
    [],
  )
  .option(
    "--known-cheat <list>",
    "Alias of --known-suspicious",
    parseNameList,
    [],
  )
  .option(
    "--known-low-trust <list>",
    "Comma-separated players known to receive low Trust warnings",
    parseNameList,
    [],
  )
  .option(
    "--focus-player <name>",
    "Build Trust Factor table for this player and teammates",
    "Morpheus",
  )
  .option(
    "--focus-steam-id <id>",
    "Focus SteamID64 used for Steam/FACEIT API enrichment",
    "76561197994583429",
  )
  .option(
    "--steam-api-key <key>",
    "Steam Web API key (or use STEAM_API_KEY env)",
    process.env.STEAM_API_KEY ?? "",
  )
  .option(
    "--faceit-api-key <key>",
    "FACEIT Data API key (or use FACEIT_API_KEY env)",
    process.env.FACEIT_API_KEY ?? "",
  )
  .option(
    "--faceit-player-id <id>",
    "Optional FACEIT player_id override for enrichment",
  )
  .option(
    "--faceit-nickname <name>",
    "Optional FACEIT nickname override for enrichment",
  )
  .option("--pretty", "Pretty print JSON output", true)
  .option("--no-pretty", "Disable JSON pretty printing")
  .option("--verbose", "Verbose logs", false)
  .action(async (demoPath: string, options) => {
    const absoluteDemo = path.resolve(demoPath);

    if (!fs.existsSync(absoluteDemo)) {
      console.error(`[ERROR] Demo file not found: ${absoluteDemo}`);
      process.exit(EXIT_USER_ERROR);
    }

    const outDir = path.resolve(options.out);
    const formatSet = parseFormats(options.format as string, Boolean(options.csv));
    const knownSuspiciousNames = [
      ...(options.knownSuspicious as string[]),
      ...(options.knownCheat as string[]),
    ];

    try {
      ensureDirectory(outDir);

      const report = await analyzeDemo({
        demoPath: absoluteDemo,
        minSamples: options.minSamples as number,
        minRounds: options.minRounds as number,
        parser: options.parser as string,
        language: options.lang as Locale,
        verbose: Boolean(options.verbose),
        knownCleanNames: options.knownClean as string[],
        knownSuspiciousNames,
        knownLowTrustNames: options.knownLowTrust as string[],
        focusPlayer: String(options.focusPlayer ?? "Morpheus"),
        focusSteamId: String(options.focusSteamId ?? "76561197994583429"),
        steamApiKey: optionalString(options.steamApiKey),
        faceitApiKey: optionalString(options.faceitApiKey),
        faceitPlayerId: optionalString(options.faceitPlayerId),
        faceitNickname: optionalString(options.faceitNickname),
      });

      if (formatSet.has("json")) {
        writeJsonReport(outDir, report, Boolean(options.pretty));
      }

      if (formatSet.has("html")) {
        writeHtmlReport(outDir, report);
      }

      if (formatSet.has("csv")) {
        writeTimelineCsv(outDir, report);
      }

      if ((options.lang as Locale) === "tr") {
        console.log(`[OK] Analiz tamamlandı: ${absoluteDemo}`);
        console.log(`[OK] Çıktılar yazıldı: ${outDir}`);
      } else {
        console.log(`[OK] Analysis completed: ${absoluteDemo}`);
        console.log(`[OK] Outputs written to: ${outDir}`);
      }
      process.exit(EXIT_SUCCESS);
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        console.error(`[ERROR] ${error.message}`);
        process.exit(EXIT_USER_ERROR);
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error(`[ERROR] Analysis failed: ${message}`);
      process.exit(EXIT_PIPELINE_ERROR);
    }
  });

program.parse(process.argv);

function parsePositiveInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new InvalidArgumentError(
      `Expected a positive integer, received: ${value}`,
    );
  }

  return parsed;
}

function parseLocale(value: string): Locale {
  const normalized = value.trim().toLowerCase();
  if (normalized === "tr" || normalized === "en") {
    return normalized;
  }

  throw new InvalidArgumentError(
    `Unsupported language: ${value}. Use tr or en.`,
  );
}

function parseFormats(raw: string, csvFlag: boolean): Set<string> {
  const values = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (csvFlag && !values.includes("csv")) {
    values.push("csv");
  }

  if (values.length === 0) {
    throw new InvalidArgumentError("At least one format is required.");
  }

  const allowed = new Set(["json", "html", "csv"]);
  for (const value of values) {
    if (!allowed.has(value)) {
      throw new InvalidArgumentError(`Unsupported format: ${value}`);
    }
  }

  return new Set(values);
}

function parseNameList(raw: string, previous: string[] = []): string[] {
  const names = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...previous, ...names];
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
