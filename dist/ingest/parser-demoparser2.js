"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDemoWithDemoparser2 = parseDemoWithDemoparser2;
const parser_adapter_1 = require("./parser-adapter");
const DEFAULT_TICK_RATE = 64;
const FLICK_WINDOW_BEFORE_MS = 1000;
const FLICK_WINDOW_AFTER_MS = 50;
async function parseDemoWithDemoparser2(demoPath, verbose) {
    (0, parser_adapter_1.validateDemoExtension)(demoPath);
    const parserModule = loadDemoparser2Module();
    const warnings = [];
    const playersBySlot = new Map();
    const steamIdToSlot = new Map();
    const kills = [];
    const shots = [];
    const damages = [];
    const frames = [];
    const roundEndEvents = toArray(parserModule.parseEvent(demoPath, "round_end", [], ["tick", "round", "total_rounds_played"]));
    const deathEvents = toArray(parserModule.parseEvent(demoPath, "player_death", ["name", "steamid", "team_num", "user_id"], ["tick", "round", "total_rounds_played", "headshot"]));
    const weaponFireEvents = toArray(parserModule.parseEvent(demoPath, "weapon_fire", ["name", "steamid", "team_num", "user_id"], ["tick", "round", "total_rounds_played"]));
    const hurtEvents = toArray(parserModule.parseEvent(demoPath, "player_hurt", ["name", "steamid", "team_num", "user_id"], [
        "tick",
        "round",
        "total_rounds_played",
        "dmg_health",
        "health_damage",
        "dmg_health_real",
        "dmg_armor",
        "armor_damage",
        "hitgroup",
        "thrusmoke",
        "attackerblind",
    ]));
    for (const event of deathEvents) {
        const attackerSlot = safeInt(event.attacker_user_id);
        const victimSlot = safeInt(event.user_user_id);
        if (attackerSlot === undefined || victimSlot === undefined) {
            continue;
        }
        upsertPlayer(playersBySlot, steamIdToSlot, {
            slot: attackerSlot,
            name: safeString(event.attacker_name) ?? `player_${attackerSlot}`,
            steamId: safeString(event.attacker_steamid),
            teamNum: safeInt(event.attacker_team_num),
        });
        upsertPlayer(playersBySlot, steamIdToSlot, {
            slot: victimSlot,
            name: safeString(event.user_name) ?? `player_${victimSlot}`,
            steamId: safeString(event.user_steamid),
            teamNum: safeInt(event.user_team_num),
        });
        const weapon = normalizeWeaponName(safeString(event.weapon)?.toLowerCase() ?? "unknown");
        const tick = safeInt(event.tick) ?? 0;
        kills.push({
            tick,
            round: normalizeRound(event),
            attackerSlot,
            victimSlot,
            weapon,
            weaponClass: classifyWeapon(weapon),
            throughSmoke: Boolean(event.thrusmoke),
            penetrated: safeInt(event.penetrated) ?? 0,
            attackerBlind: Boolean(event.attackerblind),
            headshot: Boolean(event.headshot),
        });
    }
    for (const event of weaponFireEvents) {
        const shooterSlot = safeInt(event.user_user_id);
        if (shooterSlot === undefined) {
            continue;
        }
        upsertPlayer(playersBySlot, steamIdToSlot, {
            slot: shooterSlot,
            name: safeString(event.user_name) ?? `player_${shooterSlot}`,
            steamId: safeString(event.user_steamid),
            teamNum: safeInt(event.user_team_num),
        });
        shots.push({
            tick: safeInt(event.tick) ?? 0,
            round: normalizeRound(event),
            shooterSlot,
            weapon: normalizeWeaponName(safeString(event.weapon)?.toLowerCase() ?? "unknown"),
        });
    }
    for (const event of hurtEvents) {
        const attackerSlot = safeInt(event.attacker_user_id);
        const victimSlot = safeInt(event.user_user_id);
        if (attackerSlot === undefined || victimSlot === undefined) {
            continue;
        }
        const damageHealth = readDamageHealth(event);
        if (damageHealth <= 0) {
            continue;
        }
        upsertPlayer(playersBySlot, steamIdToSlot, {
            slot: attackerSlot,
            name: safeString(event.attacker_name) ?? `player_${attackerSlot}`,
            steamId: safeString(event.attacker_steamid),
            teamNum: safeInt(event.attacker_team_num),
        });
        upsertPlayer(playersBySlot, steamIdToSlot, {
            slot: victimSlot,
            name: safeString(event.user_name) ?? `player_${victimSlot}`,
            steamId: safeString(event.user_steamid),
            teamNum: safeInt(event.user_team_num),
        });
        damages.push({
            tick: safeInt(event.tick) ?? 0,
            round: normalizeRound(event),
            attackerSlot,
            victimSlot,
            damageHealth,
            damageArmor: Math.max(0, readDamageArmor(event)),
            hitgroup: safeInt(event.hitgroup),
            throughSmoke: Boolean(event.thrusmoke),
            attackerBlind: Boolean(event.attackerblind),
        });
    }
    const wantedTicks = buildWantedTicks(kills, DEFAULT_TICK_RATE);
    const wantedPlayers = [...steamIdToSlot.keys()];
    const roundBoundaries = buildRoundBoundaries(roundEndEvents);
    if (wantedTicks.length > 0 && wantedPlayers.length > 0) {
        const tickRows = toArray(parserModule.parseTicks(demoPath, [
            "tick",
            "yaw",
            "pitch",
            "steamid",
            "CCSPlayerPawn.m_vecX",
            "CCSPlayerPawn.m_vecY",
            "CCSPlayerPawn.m_vecZ",
            "CCSPlayerPawn.m_bSpottedByMask",
        ], wantedTicks, wantedPlayers, false, false));
        const tickPlayerStates = new Map();
        for (const row of tickRows) {
            const steamId = safeString(row.steamid);
            if (!steamId) {
                continue;
            }
            const slot = steamIdToSlot.get(steamId);
            if (slot === undefined) {
                continue;
            }
            const tick = safeInt(row.tick);
            const yaw = safeNumber(row.yaw);
            const pitch = safeNumber(row.pitch);
            if (tick === undefined || yaw === undefined || pitch === undefined) {
                continue;
            }
            const px = safeNumber(row["CCSPlayerPawn.m_vecX"]);
            const py = safeNumber(row["CCSPlayerPawn.m_vecY"]);
            const pz = safeNumber(row["CCSPlayerPawn.m_vecZ"]);
            const spottedByMask = toSteamIdArray(row["CCSPlayerPawn.m_bSpottedByMask"]);
            upsertTickPlayerState(tickPlayerStates, tick, slot, {
                x: px,
                y: py,
                z: pz,
                spottedByMask,
            });
            frames.push({
                tick,
                round: resolveRoundFromTick(tick, roundBoundaries),
                playerSlot: slot,
                yaw,
                pitch,
                steamId,
                x: px,
                y: py,
                z: pz,
                spottedByMask,
            });
        }
        augmentKillContext(kills, playersBySlot, tickPlayerStates);
    }
    if (playersBySlot.size === 0) {
        warnings.push("Parser returned no players. Demo may be unsupported or incomplete.");
    }
    if (frames.length === 0) {
        warnings.push("No frame samples available. Flick metric confidence will be reduced.");
    }
    if (verbose) {
        warnings.push(`[verbose] Parsed events: players=${playersBySlot.size}, kills=${kills.length}, shots=${shots.length}, damages=${damages.length}, frames=${frames.length}, roundEnds=${roundEndEvents.length}`);
    }
    return {
        parser: "demoparser2",
        players: [...playersBySlot.values()],
        rounds: deriveRoundCount(roundEndEvents, kills, shots, damages),
        totalTicks: deriveTotalTicks(roundEndEvents, kills, shots, damages, frames),
        tickRate: DEFAULT_TICK_RATE,
        kills,
        shots,
        damages,
        frames,
        warnings,
    };
}
function loadDemoparser2Module() {
    try {
        return require("@laihoe/demoparser2");
    }
    catch {
        throw new Error("Parser dependency '@laihoe/demoparser2' is not installed. Run: npm install @laihoe/demoparser2");
    }
}
function toArray(value) {
    return Array.isArray(value) ? value : [];
}
function normalizeRound(event) {
    const round = safeInt(event.round);
    if (round !== undefined && round > 0) {
        return round;
    }
    const roundsPlayed = safeInt(event.total_rounds_played);
    if (roundsPlayed !== undefined) {
        return roundsPlayed + 1;
    }
    return 0;
}
function deriveRoundCount(roundEnds, kills, shots, damages) {
    const roundEndMax = roundEnds.reduce((max, event) => {
        const round = normalizeRound(event);
        return Math.max(max, round);
    }, 0);
    if (roundEndMax > 0) {
        return roundEndMax;
    }
    const killMax = kills.reduce((max, kill) => Math.max(max, kill.round), 0);
    const shotMax = shots.reduce((max, shot) => Math.max(max, shot.round), 0);
    const damageMax = damages.reduce((max, damage) => Math.max(max, damage.round), 0);
    return Math.max(killMax, shotMax, damageMax);
}
function deriveTotalTicks(roundEnds, kills, shots, damages, frames) {
    let maxTick = -1;
    for (const event of roundEnds) {
        const tick = safeInt(event.tick);
        if (tick !== undefined) {
            maxTick = Math.max(maxTick, tick);
        }
    }
    for (const kill of kills) {
        maxTick = Math.max(maxTick, kill.tick);
    }
    for (const shot of shots) {
        maxTick = Math.max(maxTick, shot.tick);
    }
    for (const damage of damages) {
        maxTick = Math.max(maxTick, damage.tick);
    }
    for (const frame of frames) {
        maxTick = Math.max(maxTick, frame.tick);
    }
    return maxTick;
}
function buildRoundBoundaries(roundEnds) {
    return roundEnds
        .map((event) => {
        const tick = safeInt(event.tick);
        const round = normalizeRound(event);
        if (tick === undefined || round <= 0) {
            return undefined;
        }
        return { tick, round };
    })
        .filter((item) => item !== undefined)
        .sort((a, b) => a.tick - b.tick);
}
function resolveRoundFromTick(tick, boundaries) {
    let round = 1;
    for (const boundary of boundaries) {
        if (tick > boundary.tick) {
            round = boundary.round + 1;
        }
        else {
            break;
        }
    }
    return round;
}
function buildWantedTicks(kills, tickRate) {
    const ticks = new Set();
    const beforeTicks = Math.max(1, Math.floor((FLICK_WINDOW_BEFORE_MS / 1000) * tickRate));
    const afterTicks = Math.max(1, Math.floor((FLICK_WINDOW_AFTER_MS / 1000) * tickRate));
    for (const kill of kills) {
        for (let tick = Math.max(0, kill.tick - beforeTicks); tick <= kill.tick + afterTicks; tick += 1) {
            ticks.add(tick);
        }
    }
    return [...ticks].sort((a, b) => a - b);
}
function upsertPlayer(target, steamIdToSlot, candidate) {
    const existing = target.get(candidate.slot);
    const steamId = candidate.steamId ?? existing?.steamId;
    if (steamId) {
        steamIdToSlot.set(steamId, candidate.slot);
    }
    target.set(candidate.slot, {
        slot: candidate.slot,
        name: candidate.name || existing?.name || `player_${candidate.slot}`,
        steamId,
        team: normalizeTeam(candidate.teamNum, existing?.team),
    });
}
function normalizeTeam(teamNumber, fallback) {
    const value = safeInt(teamNumber);
    if (value === 2) {
        return "T";
    }
    if (value === 3) {
        return "CT";
    }
    return fallback ?? "SPEC";
}
function normalizeWeaponName(weapon) {
    return weapon.startsWith("weapon_") ? weapon.slice(7) : weapon;
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
function safeString(value) {
    if (value === undefined || value === null) {
        return undefined;
    }
    const parsed = String(value).trim();
    return parsed.length > 0 ? parsed : undefined;
}
function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
function safeInt(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : undefined;
}
function readDamageHealth(event) {
    return Math.max(0, safeInt(event.dmg_health) ??
        safeInt(event.health_damage) ??
        safeInt(event.dmg_health_real) ??
        0);
}
function readDamageArmor(event) {
    return Math.max(0, safeInt(event.dmg_armor) ?? safeInt(event.armor_damage) ?? 0);
}
function toSteamIdArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.map((item) => String(item));
}
function upsertTickPlayerState(states, tick, slot, state) {
    let bySlot = states.get(tick);
    if (!bySlot) {
        bySlot = new Map();
        states.set(tick, bySlot);
    }
    bySlot.set(slot, state);
}
function augmentKillContext(kills, playersBySlot, tickPlayerStates) {
    for (const kill of kills) {
        const bySlot = tickPlayerStates.get(kill.tick);
        if (!bySlot) {
            continue;
        }
        const attackerState = bySlot.get(kill.attackerSlot);
        const victimState = bySlot.get(kill.victimSlot);
        const attackerSteamId = playersBySlot.get(kill.attackerSlot)?.steamId;
        if (victimState && attackerSteamId) {
            kill.victimSpottedByAttacker = victimState.spottedByMask.includes(attackerSteamId);
        }
        if (attackerState &&
            victimState &&
            attackerState.x !== undefined &&
            attackerState.y !== undefined &&
            attackerState.z !== undefined &&
            victimState.x !== undefined &&
            victimState.y !== undefined &&
            victimState.z !== undefined) {
            const dx = attackerState.x - victimState.x;
            const dy = attackerState.y - victimState.y;
            const dz = attackerState.z - victimState.z;
            kill.attackerVictimDistance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
    }
}
