import type { PlayerIdentity } from "../domain/types";

export type WeaponClass =
  | "awp"
  | "rifle"
  | "pistol"
  | "smg"
  | "heavy"
  | "unknown";

export interface ParsedKill {
  tick: number;
  round: number;
  attackerSlot: number;
  victimSlot: number;
  weapon: string;
  weaponClass: WeaponClass;
  throughSmoke: boolean;
  penetrated: number;
  attackerBlind: boolean;
  headshot: boolean;
  victimSpottedByAttacker?: boolean;
  attackerVictimDistance?: number;
  attackerYaw?: number;
  attackerPitch?: number;
}

export interface ParsedShot {
  tick: number;
  round: number;
  shooterSlot: number;
  weapon: string;
}

export interface ParsedDamage {
  tick: number;
  round: number;
  attackerSlot: number;
  victimSlot: number;
  damageHealth: number;
  damageArmor: number;
  hitgroup?: number;
  throughSmoke: boolean;
  attackerBlind: boolean;
}

export interface FrameSample {
  tick: number;
  round: number;
  playerSlot: number;
  yaw: number;
  pitch: number;
  steamId?: string;
  x?: number;
  y?: number;
  z?: number;
  spottedByMask?: string[];
}

export interface ParsedMatch {
  parser: string;
  players: PlayerIdentity[];
  rounds: number;
  totalTicks: number;
  tickRate: number;
  kills: ParsedKill[];
  shots: ParsedShot[];
  damages: ParsedDamage[];
  frames: FrameSample[];
  warnings: string[];
}
