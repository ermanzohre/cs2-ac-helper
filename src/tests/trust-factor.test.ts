import test from "node:test";
import assert from "node:assert/strict";
import type { PlayerSuspicion } from "../domain/types";
import { buildTeamTrustSnapshot } from "../scoring/trust-factor";

let nextSlot = 1;

function metric(value: number, evidenceCount = 0) {
  return {
    value,
    samples: 12,
    confidence: 1,
    evidence: Array.from({ length: evidenceCount }, (_, index) => ({
      round: index + 1,
      tickStart: 100 + index,
      tickEnd: 101 + index,
      timeSec: 2 + index,
      reason: "signal",
      tags: ["test"],
    })),
  };
}

function player(
  name: string,
  team: "T" | "CT",
  scoreFinal: number,
  confidence: number,
  overrides?: Partial<PlayerSuspicion>,
): PlayerSuspicion {
  return {
    player: { name, team, slot: nextSlot++ },
    metrics: {
      flick: metric(0.1),
      prefire: metric(0.1),
      wallhack: metric(0.1),
    },
    verdict: { code: "clean", label: "Temiz" },
    guardrails: { samplePenalty: 0, weaponAdjustment: 0 },
    combat: {
      kills: 10,
      deaths: 8,
      kdRatio: 1.25,
      headshotKills: 4,
      headshotRate: 0.4,
      damageGiven: 900,
      damageTaken: 780,
      adr: 85,
    },
    scoreRaw: scoreFinal / 100,
    scoreFinal,
    confidence,
    explanation: [],
    ...overrides,
  };
}

test("team trust snapshot includes only focus player and teammates", () => {
  const ranking: PlayerSuspicion[] = [
    player("Morpheus", "T", 10, 0.9),
    player("aKs--", "T", 6, 0.95),
    player("EnemyCT", "CT", 3, 0.9),
  ];

  const snapshot = buildTeamTrustSnapshot(ranking, "Morpheus", "tr");

  assert.equal(snapshot.focusPlayer, "Morpheus");
  assert.equal(snapshot.focusTeam, "T");
  assert.equal(snapshot.rows.length, 2);
  assert.ok(snapshot.rows.every((entry) => entry.team === "T"));
});

test("team trust snapshot generates improvement plan for risky patterns", () => {
  const risky = player("Morpheus", "T", 48, 0.92, {
    metrics: {
      flick: metric(0.28),
      prefire: metric(0.31),
      wallhack: metric(0.27, 3),
    },
    combat: {
      kills: 15,
      deaths: 9,
      kdRatio: 1.66,
      headshotKills: 12,
      headshotRate: 0.8,
      damageGiven: 1400,
      damageTaken: 900,
      adr: 110,
    },
  });

  const snapshot = buildTeamTrustSnapshot([risky], "Morpheus", "tr");

  assert.equal(snapshot.rows.length, 1);
  assert.ok(snapshot.rows[0].improvementPlan.length > 0);
  assert.ok(snapshot.rows[0].trustFactor < 70);
});

test("team trust snapshot is empty when focus player is missing", () => {
  const ranking: PlayerSuspicion[] = [player("aKs--", "T", 7, 0.9)];
  const snapshot = buildTeamTrustSnapshot(ranking, "Morpheus", "tr");

  assert.equal(snapshot.rows.length, 0);
  assert.equal(snapshot.focusPlayer, "Morpheus");
});
