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
