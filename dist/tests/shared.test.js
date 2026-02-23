"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const shared_1 = require("../features/shared");
(0, node_test_1.default)("angleDelta wraps from 179 to -179 correctly", () => {
    const delta = (0, shared_1.angleDelta)(-179, 179);
    strict_1.default.equal(delta, 2);
});
(0, node_test_1.default)("clamp01 bounds values", () => {
    strict_1.default.equal((0, shared_1.clamp01)(-1), 0);
    strict_1.default.equal((0, shared_1.clamp01)(2), 1);
    strict_1.default.equal((0, shared_1.clamp01)(0.42), 0.42);
});
