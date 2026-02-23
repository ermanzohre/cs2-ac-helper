"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeHtmlReport = writeHtmlReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function writeHtmlReport(outDir, report) {
    const targetPath = path_1.default.join(outDir, "report.html");
    const html = renderHtml(report);
    fs_1.default.writeFileSync(targetPath, html, "utf8");
}
function renderHtml(report) {
    const rows = report.ranking.map(renderPlayerRow).join("\n");
    const reasons = report.ranking
        .slice(0, 5)
        .map((entry) => `<li><strong>${escapeHtml(entry.player.name)}:</strong> ${escapeHtml(entry.explanation.join(" "))}</li>`)
        .join("\n");
    const events = report.topEvents
        .map((event) => `<tr><td>${event.round}</td><td>${event.tickStart}-${event.tickEnd}</td><td>${formatTime(event.timeSec)}</td><td>${escapeHtml(event.reason)}</td></tr>`)
        .join("\n");
    const warnings = report.warnings.length
        ? `<ul>${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("\n")}</ul>`
        : "<p>No warnings.</p>";
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>CS2 AC Helper Report</title>
<style>
:root {
  color-scheme: light;
  --bg: #f5f7fb;
  --panel: #ffffff;
  --ink: #172033;
  --muted: #5c6b85;
  --accent: #0f67d3;
  --warn: #a34400;
  --border: #d6dde9;
}
body {
  margin: 0;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background: radial-gradient(circle at top right, #dce9ff 0%, var(--bg) 60%);
  color: var(--ink);
}
main {
  max-width: 1100px;
  margin: 24px auto;
  padding: 0 16px 24px;
}
section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(12, 32, 66, 0.06);
}
h1, h2 { margin: 0 0 12px; }
p, li { color: var(--muted); }
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  border: 1px solid var(--border);
  padding: 8px;
  text-align: left;
  font-size: 14px;
}
th {
  background: #edf3ff;
  color: var(--ink);
}
.badge {
  display: inline-block;
  min-width: 42px;
  text-align: center;
  border-radius: 999px;
  padding: 4px 10px;
  background: #e8f1ff;
  color: var(--accent);
  font-weight: 600;
}
.warn {
  color: var(--warn);
}
</style>
</head>
<body>
<main>
<section>
  <h1>CS2 Anti-Cheat Helper Report</h1>
  <p><strong>Demo:</strong> ${escapeHtml(report.meta.inputDemo)}</p>
  <p><strong>Parser:</strong> ${escapeHtml(report.meta.parser)} | <strong>Rounds:</strong> ${report.meta.rounds} | <strong>Ticks:</strong> ${report.meta.ticks}</p>
  <p><strong>Generated:</strong> ${escapeHtml(report.meta.generatedAt)}</p>
</section>
<section>
  <h2>Top Suspicious Players</h2>
  <table>
    <thead>
      <tr>
        <th>Player</th>
        <th>Score</th>
        <th>Confidence</th>
        <th>Flick</th>
        <th>Prefire</th>
        <th>Wallhack</th>
        <th>Samples</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</section>
<section>
  <h2>Why Suspicious?</h2>
  <ul>${reasons || "<li>No high-confidence suspicious players detected.</li>"}</ul>
</section>
<section>
  <h2>Top 5 Evidence Moments</h2>
  <table>
    <thead>
      <tr>
        <th>Round</th>
        <th>Tick Range</th>
        <th>Time</th>
        <th>Reason</th>
      </tr>
    </thead>
    <tbody>
      ${events || '<tr><td colspan="4">No evidence moments.</td></tr>'}
    </tbody>
  </table>
</section>
<section>
  <h2>Warnings</h2>
  <div class="warn">${warnings}</div>
</section>
</main>
</body>
</html>`;
}
function renderPlayerRow(player) {
    const sampleCount = player.metrics.flick.samples +
        player.metrics.prefire.samples +
        player.metrics.wallhack.samples;
    return `<tr>
<td>${escapeHtml(player.player.name)}</td>
<td><span class="badge">${player.scoreFinal}</span></td>
<td>${(player.confidence * 100).toFixed(0)}%</td>
<td>${(player.metrics.flick.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.prefire.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.wallhack.value * 100).toFixed(1)}%</td>
<td>${sampleCount}</td>
</tr>`;
}
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "00:00";
    }
    const whole = Math.floor(seconds);
    const mins = Math.floor(whole / 60)
        .toString()
        .padStart(2, "0");
    const secs = Math.floor(whole % 60)
        .toString()
        .padStart(2, "0");
    return `${mins}:${secs}`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
