import test from "node:test";
import assert from "node:assert/strict";
import { computeGuardrails } from "../scoring/guardrails";
import { computeSuspicionScore } from "../scoring/compute-score";
import { computePrefireMetric } from "../features/prefire";
import type { MetricScore } from "../domain/types";

function metric(value: number, samples: number, confidence = 1): MetricScore {
  return {
    value,
    samples,
    confidence,
    evidence: [],
  };
}

test("guardrail penalty increases with small sample size", () => {
  const low = computeGuardrails({
    flick: metric(0.2, 1),
    prefire: metric(0.2, 1),
    wallhack: metric(0.2, 1),
    rounds: 12,
    minRounds: 10,
    minSamples: 8,
    killCount: 2,
    awpKillCount: 0,
  });

  const high = computeGuardrails({
    flick: metric(0.2, 20),
    prefire: metric(0.2, 20),
    wallhack: metric(0.2, 20),
    rounds: 12,
    minRounds: 10,
    minSamples: 8,
    killCount: 20,
    awpKillCount: 0,
  });

  assert.ok(low.samplePenalty > high.samplePenalty);
});

test("score is monotonic when metric values increase and penalty fixed", () => {
  const guardrail = computeGuardrails({
    flick: metric(0.2, 20),
    prefire: metric(0.2, 20),
    wallhack: metric(0.2, 20),
    rounds: 20,
    minRounds: 10,
    minSamples: 8,
    killCount: 20,
    awpKillCount: 0,
  });

  const low = computeSuspicionScore({
    flick: metric(0.2, 20),
    prefire: metric(0.2, 20),
    wallhack: metric(0.2, 20),
    guardrail,
    rounds: 20,
    minRounds: 10,
  });

  const high = computeSuspicionScore({
    flick: metric(0.8, 20),
    prefire: metric(0.8, 20),
    wallhack: metric(0.8, 20),
    guardrail,
    rounds: 20,
    minRounds: 10,
  });

  assert.ok(high.scoreFinal >= low.scoreFinal);
});

test("prefire metric detects short shot-to-kill windows", () => {
  const result = computePrefireMetric(
    { name: "tester", slot: 1, team: "CT" },
    [
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
        headshot: false,
      },
    ],
    [{ tick: 95, round: 1, shooterSlot: 1, weapon: "ak47" }],
    [],
    64,
  );

  assert.ok(result.value > 0);
});

test("prefire metric does not mark same-tick shot+kill as suspicious alone", () => {
  const result = computePrefireMetric(
    { name: "tester", slot: 1, team: "CT" },
    [
      {
        tick: 200,
        round: 2,
        attackerSlot: 1,
        victimSlot: 2,
        weapon: "ak47",
        weaponClass: "rifle",
        throughSmoke: false,
        penetrated: 0,
        attackerBlind: false,
        headshot: false,
      },
    ],
    [{ tick: 200, round: 2, shooterSlot: 1, weapon: "ak47" }],
    [],
    64,
  );

  assert.equal(result.value, 0);
  assert.equal(result.evidence.length, 0);
});

test("prefire metric increases on prepared peek pattern with smoke headshot", () => {
  const result = computePrefireMetric(
    { name: "tester", slot: 1, team: "CT" },
    [
      {
        tick: 500,
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
    ],
    [
      { tick: 390, round: 3, shooterSlot: 1, weapon: "ak47" },
      { tick: 430, round: 3, shooterSlot: 1, weapon: "ak47" },
      { tick: 460, round: 3, shooterSlot: 1, weapon: "ak47" },
      { tick: 494, round: 3, shooterSlot: 1, weapon: "ak47" },
    ],
    [
      { tick: 455, round: 3, playerSlot: 1, yaw: 12, pitch: 1 },
      { tick: 470, round: 3, playerSlot: 1, yaw: 13, pitch: 1.5 },
      { tick: 485, round: 3, playerSlot: 1, yaw: 11.5, pitch: 0.8 },
      { tick: 499, round: 3, playerSlot: 1, yaw: 12.2, pitch: 1.2 },
    ],
    64,
  );

  assert.ok(result.value >= 0.55);
  assert.ok(result.evidence.length >= 1);
});
