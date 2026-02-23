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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tester", slot: 1, team: "CT" }, kills, [], 64);
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tester", slot: 1, team: "CT" }, kills, [], 64);
    strict_1.default.ok(score.value < 0.3);
    strict_1.default.equal(score.evidence.length, 0);
});
(0, node_test_1.default)("wallhack metric boosts unspotted occluded kills", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tester", slot: 1, team: "CT" }, kills, [], 64);
    strict_1.default.ok(score.value >= 0.8);
    strict_1.default.equal(score.evidence.length, 1);
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "clean", slot: 4, team: "T" }, kills, [], 64);
    strict_1.default.equal(score.value, 0);
    strict_1.default.equal(score.evidence.length, 0);
});
(0, node_test_1.default)("wallhack metric downweights close-range unspotted-only kills", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "clean-ish", slot: 4, team: "T" }, kills, [], 64);
    strict_1.default.ok(score.value <= 0.1);
    strict_1.default.equal(score.evidence.length, 0);
});
(0, node_test_1.default)("wallhack metric detects unspotted aim tracking before kill", () => {
    const kills = [
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
    const score = (0, wallhack_1.computeWallhackMetric)({ name: "tracker", slot: 1, team: "T", steamId: "attacker" }, kills, frames, 64);
    strict_1.default.ok(score.value >= 0.33);
});
