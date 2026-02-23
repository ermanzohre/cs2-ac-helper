"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDemoWithDemofile = parseDemoWithDemofile;
const fs_1 = __importDefault(require("fs"));
const parser_adapter_1 = require("./parser-adapter");
async function parseDemoWithDemofile(demoPath, verbose) {
    (0, parser_adapter_1.validateDemoExtension)(demoPath);
    const parserModule = loadDemofileModule();
    const DemoFileCtor = parserModule.DemoFile;
    const demoFile = new DemoFileCtor();
    const players = new Map();
    const kills = [];
    const shots = [];
    const damages = [];
    const frames = [];
    const warnings = [];
    let rounds = 0;
    if (typeof demoFile.on === "function") {
        demoFile.on("round_end", () => {
            rounds += 1;
        });
    }
    if (demoFile.gameEvents?.on) {
        demoFile.gameEvents.on("player_death", (event) => {
            const attacker = safeGetPlayerByUserId(demoFile, event.attacker);
            const victim = safeGetPlayerByUserId(demoFile, event.userid);
            if (!attacker || !victim) {
                return;
            }
            upsertPlayer(players, attacker);
            upsertPlayer(players, victim);
            kills.push({
                tick: Number(demoFile.currentTick ?? 0),
                round: rounds,
                attackerSlot: Number(attacker.slot ?? 0),
                victimSlot: Number(victim.slot ?? 0),
                weapon: String(event.weapon ?? "unknown"),
                weaponClass: classifyWeapon(String(event.weapon ?? "unknown")),
                throughSmoke: Boolean(event.thrusmoke),
                penetrated: Number(event.penetrated ?? 0),
                attackerBlind: Boolean(event.attackerblind),
                headshot: Boolean(event.headshot),
                attackerYaw: safeNumber(attacker.eyeAngles?.yaw),
                attackerPitch: safeNumber(attacker.eyeAngles?.pitch),
            });
        });
        demoFile.gameEvents.on("weapon_fire", (event) => {
            const shooter = safeGetPlayerByUserId(demoFile, event.userid);
            if (!shooter) {
                return;
            }
            upsertPlayer(players, shooter);
            shots.push({
                tick: Number(demoFile.currentTick ?? 0),
                round: rounds,
                shooterSlot: Number(shooter.slot ?? 0),
                weapon: String(event.weapon ?? "unknown"),
            });
        });
        demoFile.gameEvents.on("player_hurt", (event) => {
            const attacker = safeGetPlayerByUserId(demoFile, event.attacker);
            const victim = safeGetPlayerByUserId(demoFile, event.userid);
            if (!attacker || !victim) {
                return;
            }
            const damageHealth = safeInt(event.dmg_health ?? event.health_damage ?? event.damage_health);
            const damageArmor = safeInt(event.dmg_armor ?? event.armor_damage ?? event.damage_armor);
            if (damageHealth === undefined || damageHealth <= 0) {
                return;
            }
            upsertPlayer(players, attacker);
            upsertPlayer(players, victim);
            damages.push({
                tick: Number(demoFile.currentTick ?? 0),
                round: rounds,
                attackerSlot: Number(attacker.slot ?? 0),
                victimSlot: Number(victim.slot ?? 0),
                damageHealth,
                damageArmor: Math.max(0, damageArmor ?? 0),
                hitgroup: safeInt(event.hitgroup),
                throughSmoke: Boolean(event.thrusmoke),
                attackerBlind: Boolean(event.attackerblind),
            });
        });
    }
    if (typeof demoFile.on === "function") {
        demoFile.on("tickend", () => {
            const currentTick = Number(demoFile.currentTick ?? 0);
            const currentRound = rounds;
            const livePlayers = demoFile.players ?? [];
            for (const player of livePlayers) {
                if (!player) {
                    continue;
                }
                upsertPlayer(players, player);
                const yaw = safeNumber(player.eyeAngles?.yaw);
                const pitch = safeNumber(player.eyeAngles?.pitch);
                if (yaw === undefined || pitch === undefined) {
                    continue;
                }
                const x = safeNumber(player.position?.x);
                const y = safeNumber(player.position?.y);
                const z = safeNumber(player.position?.z);
                frames.push({
                    tick: currentTick,
                    round: currentRound,
                    playerSlot: Number(player.slot ?? 0),
                    yaw,
                    pitch,
                    steamId: player.steamId ? String(player.steamId) : undefined,
                    x,
                    y,
                    z,
                });
            }
        });
    }
    const buffer = fs_1.default.readFileSync(demoPath);
    try {
        demoFile.parse(buffer);
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`demofile parser failed: ${detail}`);
    }
    if (players.size === 0) {
        warnings.push("Parser returned no players. Demo may be unsupported or incomplete.");
    }
    if (frames.length === 0) {
        warnings.push("No frame samples available. Flick metric confidence will be reduced.");
    }
    if (verbose) {
        warnings.push(`[verbose] Parsed events: players=${players.size}, kills=${kills.length}, shots=${shots.length}, damages=${damages.length}, frames=${frames.length}`);
    }
    return {
        parser: "demofile",
        players: [...players.values()],
        rounds,
        totalTicks: Number(demoFile.currentTick ?? 0),
        tickRate: Number(demoFile.tickRate ?? 64),
        kills,
        shots,
        damages,
        frames,
        warnings,
    };
}
function loadDemofileModule() {
    try {
        // Dynamic require keeps build working if dependency is not yet installed.
        return require("demofile");
    }
    catch {
        throw new Error("Parser dependency 'demofile' is not installed. Run: npm install demofile");
    }
}
function safeGetPlayerByUserId(demoFile, userId) {
    if (userId === undefined || userId === null) {
        return undefined;
    }
    if (typeof demoFile.entities?.getByUserId === "function") {
        return demoFile.entities.getByUserId(userId);
    }
    if (typeof demoFile.players?.find === "function") {
        return demoFile.players.find((player) => Number(player.userId) === Number(userId));
    }
    return undefined;
}
function upsertPlayer(target, rawPlayer) {
    const slot = Number(rawPlayer.slot ?? 0);
    if (!Number.isFinite(slot)) {
        return;
    }
    const existing = target.get(slot);
    const updated = {
        slot,
        name: String(rawPlayer.name ?? existing?.name ?? `player_${slot}`),
        steamId: rawPlayer.steamId ? String(rawPlayer.steamId) : existing?.steamId,
        team: normalizeTeam(rawPlayer.teamNumber, existing?.team),
    };
    target.set(slot, updated);
}
function normalizeTeam(teamNumber, fallback) {
    const value = Number(teamNumber);
    if (value === 2) {
        return "T";
    }
    if (value === 3) {
        return "CT";
    }
    return fallback ?? "SPEC";
}
function classifyWeapon(weapon) {
    const w = weapon.toLowerCase();
    if (["awp", "ssg08", "g3sg1", "scar20"].includes(w)) {
        return "awp";
    }
    if (["ak47", "m4a1", "m4a1_silencer", "aug", "sg556", "famas", "galilar"].includes(w)) {
        return "rifle";
    }
    if ([
        "deagle",
        "usp_silencer",
        "glock",
        "p250",
        "five7",
        "tec9",
        "cz75a",
    ].includes(w)) {
        return "pistol";
    }
    if (["mac10", "mp9", "mp7", "ump45", "p90", "bizon"].includes(w)) {
        return "smg";
    }
    if (["nova", "xm1014", "mag7", "m249", "negev"].includes(w)) {
        return "heavy";
    }
    return "unknown";
}
function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function safeInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : undefined;
}
