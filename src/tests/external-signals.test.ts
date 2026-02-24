import test from "node:test";
import assert from "node:assert/strict";
import { computeFaceitReputationScore } from "../enrichment/faceit";
import { computeSteamReputationScore } from "../enrichment/steam";

test("steam reputation score drops with ban history", () => {
  const clean = computeSteamReputationScore({
    accountAgeYears: 9,
    steamLevel: 25,
    cs2Hours: 1800,
    vacBans: 0,
    gameBans: 0,
    communityBanned: false,
    economyBan: "none",
  });

  const banned = computeSteamReputationScore({
    accountAgeYears: 1.5,
    steamLevel: 3,
    cs2Hours: 90,
    vacBans: 1,
    gameBans: 1,
    daysSinceLastBan: 120,
    communityBanned: true,
    economyBan: "probation",
  });

  assert.ok(clean > banned);
  assert.ok(banned < 45);
});

test("faceit reputation score rewards stronger competitive profile", () => {
  const low = computeFaceitReputationScore({
    skillLevel: 3,
    elo: 950,
    matches: 30,
    winRatePct: 42,
    kdRatio: 0.82,
    hsPct: 38,
  });

  const high = computeFaceitReputationScore({
    skillLevel: 8,
    elo: 1850,
    matches: 600,
    winRatePct: 58,
    kdRatio: 1.28,
    hsPct: 49,
  });

  assert.ok(high > low);
  assert.ok(high >= 70);
});
