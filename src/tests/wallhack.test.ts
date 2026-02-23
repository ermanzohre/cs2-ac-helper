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
      headshot: true,
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
      headshot: true,
    },
  ];

  const score = computeWallhackMetric(
    { name: "tester", slot: 1, team: "CT" },
    kills,
    [],
    64,
  );

  assert.ok(score.value > 0.4);
  assert.equal(score.samples, 2);
  assert.ok(score.evidence.length >= 1);
});

test("wallhack metric keeps non-headshot smoke spam at lower signal", () => {
  const kills: ParsedKill[] = [
    {
      tick: 1400,
      round: 4,
      attackerSlot: 1,
      victimSlot: 2,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: true,
      penetrated: 0,
      attackerBlind: false,
      headshot: false,
    },
  ];

  const score = computeWallhackMetric(
    { name: "tester", slot: 1, team: "CT" },
    kills,
    [],
    64,
  );

  assert.ok(score.value < 0.3);
  assert.equal(score.evidence.length, 0);
});

test("wallhack metric boosts unspotted occluded kills", () => {
  const kills: ParsedKill[] = [
    {
      tick: 1500,
      round: 4,
      attackerSlot: 1,
      victimSlot: 2,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: true,
      penetrated: 1,
      attackerBlind: false,
      headshot: true,
      victimSpottedByAttacker: false,
      attackerVictimDistance: 1200,
    },
  ];

  const score = computeWallhackMetric(
    { name: "tester", slot: 1, team: "CT" },
    kills,
    [],
    64,
  );

  assert.ok(score.value >= 0.8);
  assert.equal(score.evidence.length, 1);
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
      headshot: false,
    },
  ];

  const score = computeWallhackMetric(
    { name: "clean", slot: 4, team: "T" },
    kills,
    [],
    64,
  );

  assert.equal(score.value, 0);
  assert.equal(score.evidence.length, 0);
});

test("wallhack metric downweights close-range unspotted-only kills", () => {
  const kills: ParsedKill[] = [
    {
      tick: 2300,
      round: 6,
      attackerSlot: 4,
      victimSlot: 8,
      weapon: "m4a1",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 0,
      attackerBlind: false,
      headshot: false,
      victimSpottedByAttacker: false,
      attackerVictimDistance: 260,
    },
  ];

  const score = computeWallhackMetric(
    { name: "clean-ish", slot: 4, team: "T" },
    kills,
    [],
    64,
  );

  assert.ok(score.value <= 0.1);
  assert.equal(score.evidence.length, 0);
});

test("wallhack metric detects unspotted aim tracking before kill", () => {
  const kills: ParsedKill[] = [
    {
      tick: 1000,
      round: 3,
      attackerSlot: 1,
      victimSlot: 2,
      weapon: "ak47",
      weaponClass: "rifle",
      throughSmoke: false,
      penetrated: 0,
      attackerBlind: false,
      headshot: false,
      victimSpottedByAttacker: false,
    },
  ];

  const frames = [];
  for (let tick = 940; tick <= 1000; tick += 1) {
    frames.push({
      tick,
      round: 3,
      playerSlot: 1,
      yaw: 0.8,
      pitch: 0.2,
      steamId: "attacker",
      x: 0,
      y: 0,
      z: 0,
    });
    frames.push({
      tick,
      round: 3,
      playerSlot: 2,
      yaw: 180,
      pitch: 0,
      steamId: "victim",
      x: 1200,
      y: 0,
      z: 0,
      spottedByMask: [],
    });
  }

  const score = computeWallhackMetric(
    { name: "tracker", slot: 1, team: "T", steamId: "attacker" },
    kills,
    frames,
    64,
  );

  assert.ok(score.value >= 0.33);
});
