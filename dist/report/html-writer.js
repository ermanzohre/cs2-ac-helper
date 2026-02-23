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
    const language = report.meta.language ?? "en";
    const labels = getLabels(language);
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
        : `<p>${labels.noWarnings}</p>`;
    return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${labels.pageTitle}</title>
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
  <h1>${labels.title}</h1>
  <p><strong>${labels.demo}:</strong> ${escapeHtml(report.meta.inputDemo)}</p>
  <p><strong>${labels.parser}:</strong> ${escapeHtml(report.meta.parser)} | <strong>${labels.rounds}:</strong> ${report.meta.rounds} | <strong>${labels.ticks}:</strong> ${report.meta.ticks}</p>
  <p><strong>${labels.generated}:</strong> ${escapeHtml(report.meta.generatedAt)}</p>
</section>
<section>
  <h2>${labels.topPlayers}</h2>
  <table>
    <thead>
      <tr>
        <th>${labels.player}</th>
        <th>${labels.verdict}</th>
        <th>${labels.score}</th>
        <th>${labels.confidence}</th>
        <th>Flick</th>
        <th>Prefire</th>
        <th>Wallhack</th>
        <th>${labels.samples}</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</section>
<section>
  <h2>${labels.why}</h2>
  <ul>${reasons || `<li>${labels.noSuspicious}</li>`}</ul>
</section>
<section>
  <h2>${labels.topEvents}</h2>
  <table>
    <thead>
      <tr>
        <th>${labels.round}</th>
        <th>${labels.tickRange}</th>
        <th>${labels.time}</th>
        <th>${labels.reason}</th>
      </tr>
    </thead>
    <tbody>
      ${events || `<tr><td colspan="4">${labels.noEvents}</td></tr>`}
    </tbody>
  </table>
</section>
<section>
  <h2>${labels.warnings}</h2>
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
<td>${escapeHtml(player.verdict.label)}</td>
<td><span class="badge">${player.scoreFinal}</span></td>
<td>${(player.confidence * 100).toFixed(0)}%</td>
<td>${(player.metrics.flick.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.prefire.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.wallhack.value * 100).toFixed(1)}%</td>
<td>${sampleCount}</td>
</tr>`;
}
function getLabels(language) {
    if (language === "tr") {
        return {
            pageTitle: "CS2 AC Yardimci Raporu",
            title: "CS2 Anti-Cheat Yardimci Raporu",
            demo: "Demo",
            parser: "Parser",
            rounds: "Round",
            ticks: "Tick",
            generated: "Olusturulma",
            topPlayers: "En Supheli Oyuncular",
            player: "Oyuncu",
            verdict: "Yorum",
            score: "Skor",
            confidence: "Guven",
            samples: "Ornek",
            why: "Neden Supheli?",
            noSuspicious: "Yuksek guvenli supheli oyuncu bulunamadi.",
            topEvents: "Ilk 5 Kanit Ani",
            round: "Round",
            tickRange: "Tick Araligi",
            time: "Zaman",
            reason: "Neden",
            noEvents: "Kanit ani yok.",
            warnings: "Uyarilar",
            noWarnings: "Uyari yok.",
        };
    }
    return {
        pageTitle: "CS2 AC Helper Report",
        title: "CS2 Anti-Cheat Helper Report",
        demo: "Demo",
        parser: "Parser",
        rounds: "Rounds",
        ticks: "Ticks",
        generated: "Generated",
        topPlayers: "Top Suspicious Players",
        player: "Player",
        verdict: "Verdict",
        score: "Score",
        confidence: "Confidence",
        samples: "Samples",
        why: "Why Suspicious?",
        noSuspicious: "No high-confidence suspicious players detected.",
        topEvents: "Top 5 Evidence Moments",
        round: "Round",
        tickRange: "Tick Range",
        time: "Time",
        reason: "Reason",
        noEvents: "No evidence moments.",
        warnings: "Warnings",
        noWarnings: "No warnings.",
    };
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
