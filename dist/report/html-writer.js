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
        .map((event) => `<tr><td>${escapeHtml(event.playerName ?? "-")}</td><td>${event.round}</td><td>${event.tickStart}-${event.tickEnd}</td><td>${formatTime(event.timeSec)}</td><td>${escapeHtml(event.reason)}</td></tr>`)
        .join("\n");
    const warnings = report.warnings.length
        ? `<ul>${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("\n")}</ul>`
        : `<p>${labels.noWarnings}</p>`;
    const teamTrustRows = report.teamTrust?.rows.map(renderTeamTrustRow).join("\n") ?? "";
    const teamTrustInfo = report.teamTrust?.focusTeam && report.teamTrust.focusTeam !== "SPEC"
        ? `${escapeHtml(report.teamTrust.focusPlayer)} (${escapeHtml(report.teamTrust.focusTeam)})`
        : escapeHtml(report.teamTrust?.focusPlayer ?? "-");
    const steamInsightRow = report.externalInsights?.steam
        ? renderSteamInsightRow(report.externalInsights.steam)
        : "";
    const faceitInsightRow = report.externalInsights?.faceit
        ? renderFaceitInsightRow(report.externalInsights.faceit)
        : "";
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
  max-width: 1200px;
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
        <th>${labels.kills}</th>
        <th>${labels.deaths}</th>
        <th>${labels.kd}</th>
        <th>${labels.damageGiven}</th>
        <th>${labels.damageTaken}</th>
        <th>${labels.adr}</th>
        <th>${labels.hsRate}</th>
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
  <h2>${labels.teamTrust}</h2>
  <p>${labels.trustDisclaimer}</p>
  <p><strong>${labels.focusPlayer}:</strong> ${teamTrustInfo}</p>
  <table>
    <thead>
      <tr>
        <th>${labels.player}</th>
        <th>${labels.team}</th>
        <th>${labels.trustFactor}</th>
        <th>${labels.trustLevel}</th>
        <th>${labels.improvementPlan}</th>
      </tr>
    </thead>
    <tbody>
      ${teamTrustRows || `<tr><td colspan="5">${labels.noTeamTrustRows}</td></tr>`}
    </tbody>
  </table>
</section>
<section>
  <h2>${labels.steamApi}</h2>
  <p>${labels.steamApiDesc}</p>
  <table>
    <thead>
      <tr>
        <th>${labels.player}</th>
        <th>SteamID</th>
        <th>${labels.accountAgeYears}</th>
        <th>${labels.steamLevel}</th>
        <th>${labels.cs2Hours}</th>
        <th>VAC</th>
        <th>${labels.gameBans}</th>
        <th>${labels.communityBanned}</th>
        <th>${labels.economyBan}</th>
        <th>${labels.reputation}</th>
        <th>${labels.analysis}</th>
      </tr>
    </thead>
    <tbody>
      ${steamInsightRow || `<tr><td colspan="11">${labels.noSteamApiData}</td></tr>`}
    </tbody>
  </table>
</section>
<section>
  <h2>${labels.faceitApi}</h2>
  <p>${labels.faceitApiDesc}</p>
  <table>
    <thead>
      <tr>
        <th>${labels.player}</th>
        <th>${labels.nickname}</th>
        <th>${labels.faceitPlayerId}</th>
        <th>${labels.region}</th>
        <th>${labels.skillLevel}</th>
        <th>ELO</th>
        <th>${labels.matches}</th>
        <th>${labels.winRate}</th>
        <th>${labels.kd}</th>
        <th>${labels.hsRate}</th>
        <th>${labels.reputation}</th>
        <th>${labels.analysis}</th>
      </tr>
    </thead>
    <tbody>
      ${faceitInsightRow || `<tr><td colspan="12">${labels.noFaceitApiData}</td></tr>`}
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
        <th>${labels.player}</th>
        <th>${labels.round}</th>
        <th>${labels.tickRange}</th>
        <th>${labels.time}</th>
        <th>${labels.reason}</th>
      </tr>
    </thead>
    <tbody>
      ${events || `<tr><td colspan="5">${labels.noEvents}</td></tr>`}
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
<td>${player.combat.kills}</td>
<td>${player.combat.deaths}</td>
<td>${player.combat.kdRatio.toFixed(2)}</td>
<td>${player.combat.damageGiven}</td>
<td>${player.combat.damageTaken}</td>
<td>${player.combat.adr.toFixed(1)}</td>
<td>${(player.combat.headshotRate * 100).toFixed(0)}%</td>
<td>${(player.metrics.flick.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.prefire.value * 100).toFixed(1)}%</td>
<td>${(player.metrics.wallhack.value * 100).toFixed(1)}%</td>
<td>${sampleCount}</td>
</tr>`;
}
function renderTeamTrustRow(entry) {
    return `<tr>
<td>${escapeHtml(entry.playerName)}</td>
<td>${escapeHtml(entry.team ?? "-")}</td>
<td><span class="badge">${entry.trustFactor}</span></td>
<td>${escapeHtml(entry.trustLabel)}</td>
<td>${escapeHtml(entry.improvementPlan.join(" "))}</td>
</tr>`;
}
function renderSteamInsightRow(entry) {
    return `<tr>
<td>${escapeHtml(entry.playerName)}</td>
<td>${escapeHtml(entry.steamId)}</td>
<td>${formatOptionalNumber(entry.accountAgeYears, 1)}</td>
<td>${formatOptionalNumber(entry.steamLevel, 0)}</td>
<td>${formatOptionalNumber(entry.cs2Hours, 1)}</td>
<td>${formatOptionalNumber(entry.vacBans, 0)}</td>
<td>${formatOptionalNumber(entry.gameBans, 0)}</td>
<td>${entry.communityBanned ? "yes" : "no"}</td>
<td>${escapeHtml(entry.economyBan ?? "none")}</td>
<td><span class="badge">${entry.reputationScore}</span> ${escapeHtml(entry.reputationLabel)}</td>
<td>${escapeHtml(entry.analysis.join(" "))}</td>
</tr>`;
}
function renderFaceitInsightRow(entry) {
    return `<tr>
<td>${escapeHtml(entry.playerName)}</td>
<td>${escapeHtml(entry.nickname)}</td>
<td>${escapeHtml(entry.playerId)}</td>
<td>${escapeHtml(entry.region ?? "-")}</td>
<td>${formatOptionalNumber(entry.skillLevel, 0)}</td>
<td>${formatOptionalNumber(entry.elo, 0)}</td>
<td>${formatOptionalNumber(entry.matches, 0)}</td>
<td>${formatOptionalPercent(entry.winRatePct, 1)}</td>
<td>${formatOptionalNumber(entry.kdRatio, 2)}</td>
<td>${formatOptionalPercent(entry.hsPct, 1)}</td>
<td><span class="badge">${entry.reputationScore}</span> ${escapeHtml(entry.reputationLabel)}</td>
<td>${escapeHtml(entry.analysis.join(" "))}</td>
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
            topPlayers: "Suphe Siralamasi",
            player: "Oyuncu",
            verdict: "Yorum",
            score: "Skor",
            confidence: "Guven",
            team: "Takim",
            kills: "Kill",
            deaths: "Death",
            kd: "K/D",
            damageGiven: "Hasar+",
            damageTaken: "Hasar-",
            adr: "ADR",
            hsRate: "HS%",
            samples: "Ornek",
            teamTrust: "Takim Trust Factor (Odak Oyuncu + Takimi)",
            focusPlayer: "Odak Oyuncu",
            trustFactor: "Trust Factor",
            trustLevel: "Seviye",
            improvementPlan: "Puani Artirma Plani",
            noTeamTrustRows: "Odak oyuncu veya takim bilgisi bulunamadigi icin satir yok.",
            trustDisclaimer: "Not: Bu deger demo-olcumlu bir trust proxy skorudur; Valve'in gercek Trust Factor degeri degildir.",
            steamApi: "Steam API Guven Analizi",
            steamApiDesc: "Resmi Steam API sinyalleri (hesap olgunlugu, ban gecmisi, oyun saati) ile olusturulan ek tablo.",
            noSteamApiData: "Steam API verisi yok (key eksik veya endpoint ulasilamadi).",
            faceitApi: "FACEIT API Rekabet Analizi",
            faceitApiDesc: "FACEIT Data API uzerinden oyuncu seviyesi ve performans sinyalleri.",
            noFaceitApiData: "FACEIT API verisi yok (key eksik veya oyuncu eslesmedi).",
            accountAgeYears: "Hesap Yasi (yil)",
            steamLevel: "Steam Seviye",
            cs2Hours: "CS2 Saat",
            gameBans: "Game Ban",
            communityBanned: "Community Ban",
            economyBan: "Economy Ban",
            reputation: "Itibar Skoru",
            analysis: "Analiz",
            nickname: "Nickname",
            faceitPlayerId: "FACEIT ID",
            region: "Bolge",
            skillLevel: "Seviye",
            matches: "Mac",
            winRate: "Win Rate",
            why: "Ayrintili Aciklama",
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
        topPlayers: "Suspicion Ranking",
        player: "Player",
        verdict: "Verdict",
        score: "Score",
        confidence: "Confidence",
        team: "Team",
        kills: "Kills",
        deaths: "Deaths",
        kd: "K/D",
        damageGiven: "DMG+",
        damageTaken: "DMG-",
        adr: "ADR",
        hsRate: "HS%",
        samples: "Samples",
        teamTrust: "Team Trust Factor (Focus Player + Teammates)",
        focusPlayer: "Focus Player",
        trustFactor: "Trust Factor",
        trustLevel: "Level",
        improvementPlan: "How To Increase",
        noTeamTrustRows: "No rows because focus player/team information is unavailable.",
        trustDisclaimer: "Note: This is a demo-based trust proxy score, not Valve's real Trust Factor.",
        steamApi: "Steam API Trust Analysis",
        steamApiDesc: "Additional table built from official Steam API signals (account maturity, bans, playtime).",
        noSteamApiData: "No Steam API data (missing key or endpoint unavailable).",
        faceitApi: "FACEIT API Competitive Analysis",
        faceitApiDesc: "FACEIT Data API based competitive profile and performance signals.",
        noFaceitApiData: "No FACEIT API data (missing key or player not resolved).",
        accountAgeYears: "Account Age (Years)",
        steamLevel: "Steam Level",
        cs2Hours: "CS2 Hours",
        gameBans: "Game Bans",
        communityBanned: "Community Banned",
        economyBan: "Economy Ban",
        reputation: "Reputation Score",
        analysis: "Analysis",
        nickname: "Nickname",
        faceitPlayerId: "FACEIT ID",
        region: "Region",
        skillLevel: "Skill Level",
        matches: "Matches",
        winRate: "Win Rate",
        why: "Detailed Explanation",
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
function formatOptionalNumber(value, precision) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "-";
    }
    return value.toFixed(precision);
}
function formatOptionalPercent(value, precision) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "-";
    }
    return `${value.toFixed(precision)}%`;
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
