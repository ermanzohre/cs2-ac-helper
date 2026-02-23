import fs from "fs";
import path from "path";
import type { ParsedMatch } from "./types";
import { parseDemoWithDemofile } from "./parser-demofile";
import { parseDemoWithDemoparser2 } from "./parser-demoparser2";

export async function parseDemo(
  demoPath: string,
  parserPreference: string,
  verbose: boolean,
): Promise<ParsedMatch> {
  if (!fs.existsSync(demoPath)) {
    throw new Error(`Demo path not found: ${demoPath}`);
  }

  const selected = resolveParser(parserPreference, detectDemoMagic(demoPath));

  if (selected === "demofile") {
    return parseDemoWithDemofile(demoPath, verbose);
  }

  if (selected === "demoparser2") {
    return parseDemoWithDemoparser2(demoPath, verbose);
  }

  throw new Error(`Unsupported parser: ${selected}`);
}

function resolveParser(
  value: string,
  demoMagic: string,
): "demofile" | "demoparser2" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "auto") {
    if (demoMagic === "PBDEMS2") {
      return "demoparser2";
    }

    return "demofile";
  }

  if (normalized === "demofile") {
    if (demoMagic === "PBDEMS2") {
      throw new Error(
        "Parser 'demofile' does not support CS2 demo header PBDEMS2. Use --parser demoparser2 or --parser auto.",
      );
    }

    return "demofile";
  }

  if (normalized === "demoparser2") {
    return "demoparser2";
  }

  throw new Error(`Unknown parser preference: ${value}`);
}

export function validateDemoExtension(demoPath: string): void {
  const extension = path.extname(demoPath).toLowerCase();
  if (extension !== ".dem") {
    throw new Error(`Expected a .dem file, received: ${extension || "<none>"}`);
  }
}

function detectDemoMagic(demoPath: string): string {
  const fd = fs.openSync(demoPath, "r");
  try {
    const header = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, header, 0, 8, 0);
    return header.toString("ascii", 0, bytesRead).replace(/\0+$/, "");
  } finally {
    fs.closeSync(fd);
  }
}
