"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const combat_1 = require("../core/combat");
(0, node_test_1.default)("combat summary computes K/D and damage totals", () => {
    const kills = [
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
            headshot: true,
        },
        {
            tick: 200,
            round: 2,
            attackerSlot: 2,
            victimSlot: 1,
            weapon: "m4a1",
            weaponClass: "rifle",
            throughSmoke: false,
            penetrated: 0,
            attackerBlind: false,
            headshot: false,
        },
    ];
    const damages = [
        {
            tick: 90,
            round: 1,
            attackerSlot: 1,
            victimSlot: 2,
            damageHealth: 44,
            damageArmor: 10,
            throughSmoke: false,
            attackerBlind: false,
        },
        {
            tick: 100,
            round: 1,
            attackerSlot: 1,
            victimSlot: 2,
            damageHealth: 56,
            damageArmor: 0,
            throughSmoke: false,
            attackerBlind: false,
        },
        {
            tick: 200,
            round: 2,
            attackerSlot: 2,
            victimSlot: 1,
            damageHealth: 100,
            damageArmor: 0,
            throughSmoke: false,
            attackerBlind: false,
        },
    ];
    const result = (0, combat_1.computePlayerCombatSummary)(1, kills, damages, 2);
    strict_1.default.equal(result.kills, 1);
    strict_1.default.equal(result.deaths, 1);
    strict_1.default.equal(result.kdRatio, 1);
    strict_1.default.equal(result.headshotKills, 1);
    strict_1.default.equal(result.headshotRate, 1);
    strict_1.default.equal(result.damageGiven, 100);
    strict_1.default.equal(result.damageTaken, 100);
    strict_1.default.equal(result.adr, 50);
});
