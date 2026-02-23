import type { PlayerIdentity } from "../domain/types";
import type {
  FrameSample,
  ParsedKill,
  ParsedMatch,
  ParsedShot,
  WeaponClass,
} from "./types";
import { validateDemoExtension } from "./parser-adapter";

const DEFAULT_TICK_RATE = 64;
const FLICK_WINDOW_BEFORE_MS = 250;
const FLICK_WINDOW_AFTER_MS = 50;

export async function parseDemoWithDemoparser2(
  demoPath: string,
  verbose: boolean,
): Promise<ParsedMatch> {
  validateDemoExtension(demoPath);

  const parserModule = loadDemoparser2Module();
  const warnings: string[] = [];

  const playersBySlot = new Map<number, PlayerIdentity>();
  const steamIdToSlot = new Map<string, number>();

  const kills: ParsedKill[] = [];
  const shots: ParsedShot[] = [];
  const frames: FrameSample[] = [];

  const roundEndEvents = toArray(
    parserModule.parseEvent(demoPath, "round_end", [], ["tick", "round", "total_rounds_played"]),
  );
  const deathEvents = toArray(
    parserModule.parseEvent(
      demoPath,
      "player_death",
      ["name", "steamid", "team_num", "user_id"],
      ["tick", "round", "total_rounds_played"],
    ),
  );
  const weaponFireEvents = toArray(
    parserModule.parseEvent(
      demoPath,
      "weapon_fire",
      ["name", "steamid", "team_num", "user_id"],
      ["tick", "round", "total_rounds_played"],
    ),
  );

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

    const weapon = normalizeWeaponName(
      safeString(event.weapon)?.toLowerCase() ?? "unknown",
    );

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
      weapon: normalizeWeaponName(
        safeString(event.weapon)?.toLowerCase() ?? "unknown",
      ),
    });
  }

  const wantedTicks = buildWantedTicks(kills, DEFAULT_TICK_RATE);
  const wantedPlayers = [...steamIdToSlot.keys()];
  const roundBoundaries = buildRoundBoundaries(roundEndEvents);

  if (wantedTicks.length > 0 && wantedPlayers.length > 0) {
    const tickRows = toArray(
      parserModule.parseTicks(
        demoPath,
        ["tick", "yaw", "pitch", "steamid"],
        wantedTicks,
        wantedPlayers,
        false,
        false,
      ),
    );

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

      frames.push({
        tick,
        round: resolveRoundFromTick(tick, roundBoundaries),
        playerSlot: slot,
        yaw,
        pitch,
      });
    }
  }

  if (playersBySlot.size === 0) {
    warnings.push(
      "Parser returned no players. Demo may be unsupported or incomplete.",
    );
  }

  if (frames.length === 0) {
    warnings.push(
      "No frame samples available. Flick metric confidence will be reduced.",
    );
  }

  if (verbose) {
    warnings.push(
      `[verbose] Parsed events: players=${playersBySlot.size}, kills=${kills.length}, shots=${shots.length}, frames=${frames.length}, roundEnds=${roundEndEvents.length}`,
    );
  }

  return {
    parser: "demoparser2",
    players: [...playersBySlot.values()],
    rounds: deriveRoundCount(roundEndEvents, kills, shots),
    totalTicks: deriveTotalTicks(roundEndEvents, kills, shots, frames),
    tickRate: DEFAULT_TICK_RATE,
    kills,
    shots,
    frames,
    warnings,
  };
}

function loadDemoparser2Module(): any {
  try {
    return require("@laihoe/demoparser2");
  } catch {
    throw new Error(
      "Parser dependency '@laihoe/demoparser2' is not installed. Run: npm install @laihoe/demoparser2",
    );
  }
}

function toArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeRound(event: any): number {
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

function deriveRoundCount(
  roundEnds: any[],
  kills: ParsedKill[],
  shots: ParsedShot[],
): number {
  const roundEndMax = roundEnds.reduce((max, event) => {
    const round = normalizeRound(event);
    return Math.max(max, round);
  }, 0);

  if (roundEndMax > 0) {
    return roundEndMax;
  }

  const killMax = kills.reduce((max, kill) => Math.max(max, kill.round), 0);
  const shotMax = shots.reduce((max, shot) => Math.max(max, shot.round), 0);
  return Math.max(killMax, shotMax);
}

function deriveTotalTicks(
  roundEnds: any[],
  kills: ParsedKill[],
  shots: ParsedShot[],
  frames: FrameSample[],
): number {
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

  for (const frame of frames) {
    maxTick = Math.max(maxTick, frame.tick);
  }

  return maxTick;
}

function buildRoundBoundaries(
  roundEnds: any[],
): Array<{ tick: number; round: number }> {
  return roundEnds
    .map((event) => {
      const tick = safeInt(event.tick);
      const round = normalizeRound(event);
      if (tick === undefined || round <= 0) {
        return undefined;
      }

      return { tick, round };
    })
    .filter((item): item is { tick: number; round: number } => item !== undefined)
    .sort((a, b) => a.tick - b.tick);
}

function resolveRoundFromTick(
  tick: number,
  boundaries: Array<{ tick: number; round: number }>,
): number {
  let round = 1;
  for (const boundary of boundaries) {
    if (tick > boundary.tick) {
      round = boundary.round + 1;
    } else {
      break;
    }
  }

  return round;
}

function buildWantedTicks(kills: ParsedKill[], tickRate: number): number[] {
  const ticks = new Set<number>();
  const beforeTicks = Math.max(
    1,
    Math.floor((FLICK_WINDOW_BEFORE_MS / 1000) * tickRate),
  );
  const afterTicks = Math.max(
    1,
    Math.floor((FLICK_WINDOW_AFTER_MS / 1000) * tickRate),
  );

  for (const kill of kills) {
    for (
      let tick = Math.max(0, kill.tick - beforeTicks);
      tick <= kill.tick + afterTicks;
      tick += 1
    ) {
      ticks.add(tick);
    }
  }

  return [...ticks].sort((a, b) => a - b);
}

function upsertPlayer(
  target: Map<number, PlayerIdentity>,
  steamIdToSlot: Map<string, number>,
  candidate: {
    slot: number;
    name: string;
    steamId?: string;
    teamNum?: number;
  },
): void {
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

function normalizeTeam(
  teamNumber: unknown,
  fallback?: PlayerIdentity["team"],
): PlayerIdentity["team"] {
  const value = safeInt(teamNumber);
  if (value === 2) {
    return "T";
  }

  if (value === 3) {
    return "CT";
  }

  return fallback ?? "SPEC";
}

function normalizeWeaponName(weapon: string): string {
  return weapon.startsWith("weapon_") ? weapon.slice(7) : weapon;
}

function classifyWeapon(weapon: string): WeaponClass {
  const w = weapon.toLowerCase();

  if (["awp", "ssg08", "g3sg1", "scar20"].includes(w)) {
    return "awp";
  }

  if (
    ["ak47", "m4a1", "m4a1_silencer", "aug", "sg556", "famas", "galilar"].includes(
      w,
    )
  ) {
    return "rifle";
  }

  if (
    [
      "deagle",
      "usp_silencer",
      "glock",
      "p250",
      "five7",
      "tec9",
      "cz75a",
    ].includes(w)
  ) {
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

function safeString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = String(value).trim();
  return parsed.length > 0 ? parsed : undefined;
}

function safeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function safeInt(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
