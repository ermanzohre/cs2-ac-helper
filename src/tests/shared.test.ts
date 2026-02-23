import test from "node:test";
import assert from "node:assert/strict";
import { angleDelta, clamp01 } from "../features/shared";

test("angleDelta wraps from 179 to -179 correctly", () => {
  const delta = angleDelta(-179, 179);
  assert.equal(delta, 2);
});

test("clamp01 bounds values", () => {
  assert.equal(clamp01(-1), 0);
  assert.equal(clamp01(2), 1);
  assert.equal(clamp01(0.42), 0.42);
});
