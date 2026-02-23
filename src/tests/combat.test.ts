import test from "node:test";
import assert from "node:assert/strict";
import { computePlayerCombatSummary } from "../core/combat";
import type { ParsedDamage, ParsedKill } from "../ingest/types";

test("combat summary computes K/D and damage totals", () => {
  const kills: ParsedKill[] = [
    {
      tick: 100,
      round: 1,
      attackerSlot: 1,
      victimSlot: 2,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 0,
      attackerBlind: false,
      headshot: true,
    },
    {
      tick: 200,
      round: 2,
      attackerSlot: 2,
      victimSlot: 1,
      weapon: "m4a1",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 0,
      attackerBlind: false,
      headshot: false,
    },
  ];

  const damages: ParsedDamage[] = [
    {
      tick: 90,
      round: 1,
      attackerSlot: 1,
      victimSlot: 2,
      damageHealth: 44,
      damageArmor: 10,
      throughSmoke: false,
      attackerBlind: false,
    },
    {
      tick: 100,
      round: 1,
      attackerSlot: 1,
      victimSlot: 2,
      damageHealth: 56,
      damageArmor: 0,
      throughSmoke: false,
      attackerBlind: false,
    },
    {
      tick: 200,
      round: 2,
      attackerSlot: 2,
      victimSlot: 1,
      damageHealth: 100,
      damageArmor: 0,
      throughSmoke: false,
      attackerBlind: false,
    },
  ];

  const result = computePlayerCombatSummary(1, kills, damages, 2);

  assert.equal(result.kills, 1);
  assert.equal(result.deaths, 1);
  assert.equal(result.kdRatio, 1);
  assert.equal(result.headshotKills, 1);
  assert.equal(result.headshotRate, 1);
  assert.equal(result.damageGiven, 100);
  assert.equal(result.damageTaken, 100);
  assert.equal(result.adr, 50);
});
