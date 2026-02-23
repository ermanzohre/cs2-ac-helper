import fs from "fs";
import type { PlayerIdentity } from "../domain/types";
import type {
  FrameSample,
  ParsedKill,
  ParsedMatch,
  ParsedShot,
  WeaponClass,
} from "./types";
import { validateDemoExtension } from "./parser-adapter";

export async function parseDemoWithDemofile(
  demoPath: string,
  verbose: boolean,
): Promise<ParsedMatch> {
  validateDemoExtension(demoPath);

  const parserModule = loadDemofileModule();
  const DemoFileCtor = parserModule.DemoFile;
  const demoFile = new DemoFileCtor();

  const players = new Map<number, PlayerIdentity>();
  const kills: ParsedKill[] = [];
  const shots: ParsedShot[] = [];
  const frames: FrameSample[] = [];
  const warnings: string[] = [];

  let rounds = 0;

  if (typeof demoFile.on === "function") {
    demoFile.on("round_end", () => {
      rounds += 1;
    });
  }

  if (demoFile.gameEvents?.on) {
    demoFile.gameEvents.on("player_death", (event: any) => {
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

    demoFile.gameEvents.on("weapon_fire", (event: any) => {
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

        frames.push({
          tick: currentTick,
          round: currentRound,
          playerSlot: Number(player.slot ?? 0),
          yaw,
          pitch,
        });
      }
    });
  }

  const buffer = fs.readFileSync(demoPath);

  try {
    demoFile.parse(buffer);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`demofile parser failed: ${detail}`);
  }

  if (players.size === 0) {
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
      `[verbose] Parsed events: players=${players.size}, kills=${kills.length}, shots=${shots.length}, frames=${frames.length}`,
    );
  }

  return {
    parser: "demofile",
    players: [...players.values()],
    rounds,
    totalTicks: Number(demoFile.currentTick ?? 0),
    tickRate: Number(demoFile.tickRate ?? 64),
    kills,
    shots,
    frames,
    warnings,
  };
}

function loadDemofileModule(): any {
  try {
    // Dynamic require keeps build working if dependency is not yet installed.
    return require("demofile");
  } catch {
    throw new Error(
      "Parser dependency 'demofile' is not installed. Run: npm install demofile",
    );
  }
}

function safeGetPlayerByUserId(demoFile: any, userId: number): any | undefined {
  if (userId === undefined || userId === null) {
    return undefined;
  }

  if (typeof demoFile.entities?.getByUserId === "function") {
    return demoFile.entities.getByUserId(userId);
  }

  if (typeof demoFile.players?.find === "function") {
    return demoFile.players.find(
      (player: any) => Number(player.userId) === Number(userId),
    );
  }

  return undefined;
}

function upsertPlayer(target: Map<number, PlayerIdentity>, rawPlayer: any): void {
  const slot = Number(rawPlayer.slot ?? 0);
  if (!Number.isFinite(slot)) {
    return;
  }

  const existing = target.get(slot);
  const updated: PlayerIdentity = {
    slot,
    name: String(rawPlayer.name ?? existing?.name ?? `player_${slot}`),
    steamId: rawPlayer.steamId ? String(rawPlayer.steamId) : existing?.steamId,
    team: normalizeTeam(rawPlayer.teamNumber, existing?.team),
  };

  target.set(slot, updated);
}

function normalizeTeam(
  teamNumber: unknown,
  fallback?: PlayerIdentity["team"],
): PlayerIdentity["team"] {
  const value = Number(teamNumber);
  if (value === 2) {
    return "T";
  }

  if (value === 3) {
    return "CT";
  }

  return fallback ?? "SPEC";
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

function safeNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
