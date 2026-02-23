import test from "node:test";
import assert from "node:assert/strict";
import { computeVerdict } from "../scoring/verdict";
import type { MetricScore } from "../domain/types";

function metric(value: number): MetricScore {
  return {
    value,
    samples: 10,
    confidence: 1,
    evidence: [],
  };
}

test("verdict marks low-score player as clean", () => {
  const verdict = computeVerdict(
    {
      scoreFinal: 37,
      confidence: 1,
      wallhack: metric(0.038),
    },
    "tr",
  );

  assert.equal(verdict.code, "clean");
  assert.equal(verdict.label, "Temiz");
});

test("verdict keeps low-score wallhack spikes at watch level", () => {
  const verdict = computeVerdict(
    {
      scoreFinal: 43,
      confidence: 0.92,
      wallhack: metric(0.24),
    },
    "tr",
  );

  assert.equal(verdict.code, "watch");
});

test("verdict marks high wallhack signal as suspicious with stronger score", () => {
  const verdict = computeVerdict(
    {
      scoreFinal: 49,
      confidence: 0.92,
      wallhack: metric(0.24),
    },
    "tr",
  );

  assert.equal(verdict.code, "suspicious");
});

test("verdict marks repeated wall evidence as suspicious even with low total score", () => {
  const verdict = computeVerdict(
    {
      scoreFinal: 22,
      confidence: 0.9,
      wallhack: {
        value: 0.16,
        samples: 20,
        confidence: 0.6,
        evidence: [
          {
            round: 3,
            tickStart: 10,
            tickEnd: 12,
            timeSec: 1,
            reason: "Visibility proxy hit",
            tags: ["info", "wallhack"],
          },
          {
            round: 7,
            tickStart: 20,
            tickEnd: 22,
            timeSec: 2,
            reason: "Visibility proxy hit",
            tags: ["info", "wallhack"],
          },
          {
            round: 11,
            tickStart: 30,
            tickEnd: 32,
            timeSec: 3,
            reason: "Visibility proxy hit",
            tags: ["info", "wallhack"],
          },
        ],
      },
    },
    "tr",
  );

  assert.equal(verdict.code, "suspicious");
});

test("verdict marks strong wall-only profile as suspicious", () => {
  const verdict = computeVerdict(
    {
      scoreFinal: 18,
      confidence: 0.9,
      wallhack: metric(0.32),
    },
    "tr",
  );

  assert.equal(verdict.code, "suspicious");
});
