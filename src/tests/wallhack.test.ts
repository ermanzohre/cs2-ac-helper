import test from "node:test";
import assert from "node:assert/strict";
import { computeWallhackMetric } from "../features/wallhack";
import type { ParsedKill } from "../ingest/types";

test("wallhack metric increases on smoke and wallbang kills", () => {
  const kills: ParsedKill[] = [
    {
      tick: 1000,
      round: 3,
      attackerSlot: 1,
      victimSlot: 2,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: true,
      penetrated: 0,
      attackerBlind: false,
    },
    {
      tick: 1100,
      round: 3,
      attackerSlot: 1,
      victimSlot: 3,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 1,
      attackerBlind: false,
    },
  ];

  const score = computeWallhackMetric(
    { name: "tester", slot: 1, team: "CT" },
    kills,
    64,
  );

  assert.ok(score.value > 0.3);
  assert.equal(score.samples, 2);
  assert.ok(score.evidence.length >= 1);
});

test("wallhack metric remains low with clean kills", () => {
  const kills: ParsedKill[] = [
    {
      tick: 2000,
      round: 5,
      attackerSlot: 4,
      victimSlot: 8,
      weapon: "m4a1",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 0,
      attackerBlind: false,
    },
  ];

  const score = computeWallhackMetric(
    { name: "clean", slot: 4, team: "T" },
    kills,
    64,
  );

  assert.equal(score.value, 0);
  assert.equal(score.evidence.length, 0);
});
