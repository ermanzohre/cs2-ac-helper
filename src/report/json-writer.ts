import fs from "fs";
import path from "path";
import type { MatchReport } from "../domain/types";

export function writeJsonReport(
  outDir: string,
  report: MatchReport,
  pretty: boolean,
): void {
  const targetPath = path.join(outDir, "report.json");
  const spacing = pretty ? 2 : 0;
  fs.writeFileSync(targetPath, JSON.stringify(report, null, spacing), "utf8");
}
