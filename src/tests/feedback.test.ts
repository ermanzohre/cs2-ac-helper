import test from "node:test";
import assert from "node:assert/strict";
import {
  buildKnownPlayerFeedback,
  buildUnmatchedKnownNameWarnings,
  normalizePlayerName,
  resolveKnownPlayerLabel,
} from "../scoring/feedback";

test("normalizePlayerName handles punctuation and accents", () => {
  assert.equal(normalizePlayerName("aKs--"), "aks");
  assert.equal(normalizePlayerName(" Mórpheus "), "morpheus");
});

test("known suspicious label wins on overlap", () => {
  const feedback = buildKnownPlayerFeedback(["MAG"], ["mag"], "en");
  const label = resolveKnownPlayerLabel("MAG", feedback);
  assert.equal(label, "known_suspicious");
  assert.equal(feedback.warnings.length, 1);
});

test("buildUnmatchedKnownNameWarnings reports names not in parsed players", () => {
  const feedback = buildKnownPlayerFeedback(["Morpheus"], ["INSPIRING"], "en");
  const warnings = buildUnmatchedKnownNameWarnings(["MAG", "aKs--"], feedback, "en");

  assert.equal(warnings.length, 2);
  assert.match(warnings[0], /Known clean player was not found in demo/);
  assert.match(warnings[1], /Known suspicious player was not found in demo/);
});
