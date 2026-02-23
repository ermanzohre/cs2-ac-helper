"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const wallhack_1 = require("../features/wallhack");
(0, node_test_1.default)("wallhack metric increases on smoke and wallbang kills", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tester", slot: 1, team: "CT" }, kills, 64);
    strict_1.default.ok(score.value > 0.4);
    strict_1.default.equal(score.samples, 2);
    strict_1.default.ok(score.evidence.length >= 1);
});
(0, node_test_1.default)("wallhack metric keeps non-headshot smoke spam at lower signal", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tester", slot: 1, team: "CT" }, kills, 64);
    strict_1.default.ok(score.value < 0.3);
    strict_1.default.equal(score.evidence.length, 0);
});
(0, node_test_1.default)("wallhack metric remains low with clean kills", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "clean", slot: 4, team: "T" }, kills, 64);
    strict_1.default.equal(score.value, 0);
    strict_1.default.equal(score.evidence.length, 0);
});
