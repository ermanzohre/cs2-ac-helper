"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const feedback_1 = require("../scoring/feedback");
(0, node_test_1.default)("normalizePlayerName handles punctuation and accents", () => {
    strict_1.default.equal((0, feedback_1.normalizePlayerName)("aKs--"), "aks");
    strict_1.default.equal((0, feedback_1.normalizePlayerName)(" Mórpheus "), "morpheus");
});
(0, node_test_1.default)("known suspicious label wins on overlap", () => {
    const feedback = (0, feedback_1.buildKnownPlayerFeedback)(["MAG"], ["mag"], "en");
    const label = (0, feedback_1.resolveKnownPlayerLabel)("MAG", feedback);
    strict_1.default.equal(label, "known_suspicious");
    strict_1.default.equal(feedback.warnings.length, 1);
});
(0, node_test_1.default)("buildUnmatchedKnownNameWarnings reports names not in parsed players", () => {
    const feedback = (0, feedback_1.buildKnownPlayerFeedback)(["Morpheus"], ["INSPIRING"], "en");
    const warnings = (0, feedback_1.buildUnmatchedKnownNameWarnings)(["MAG", "aKs--"], feedback, "en");
    strict_1.default.equal(warnings.length, 2);
    strict_1.default.match(warnings[0], /Known clean player was not found in demo/);
    strict_1.default.match(warnings[1], /Known suspicious player was not found in demo/);
});
