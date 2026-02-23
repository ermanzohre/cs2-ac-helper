import fs from "fs";
import path from "path";
import type { MatchReport } from "../domain/types";

export function writeTimelineCsv(outDir: string, report: MatchReport): void {
  const targetPath = path.join(outDir, "timeline.csv");
  const lines: string[] = ["round,tick_start,tick_end,time_sec,reason,tags"];

  for (const event of report.topEvents) {
    const reason = csvEscape(event.reason);
    const tags = csvEscape(event.tags.join("|"));
    lines.push(
      `${event.round},${event.tickStart},${event.tickEnd},${event.timeSec.toFixed(3)},${reason},${tags}`,
    );
  }

  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf8");
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}
