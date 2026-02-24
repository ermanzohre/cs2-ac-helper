export type TeamSide = "T" | "CT" | "SPEC";
export type Locale = "tr" | "en";
export type VerdictCode =
  | "inconclusive"
  | "clean"
  | "watch"
  | "suspicious"
  | "high_suspicion";

export interface PlayerIdentity {
  steamId?: string;
  name: string;
  slot: number;
  team?: TeamSide;
}

export interface EvidenceMoment {
  playerName?: string;
  round: number;
  tickStart: number;
  tickEnd: number;
  timeSec: number;
  reason: string;
  tags: string[];
}

export interface MetricStats {
  min?: number;
  avg?: number;
  p95?: number;
}

export interface MetricScore {
  value: number;
  samples: number;
  confidence: number;
  stats?: MetricStats;
  evidence: EvidenceMoment[];
}

export interface PlayerCombatSummary {
  kills: number;
  deaths: number;
  kdRatio: number;
  headshotKills: number;
  headshotRate: number;
  damageGiven: number;
  damageTaken: number;
  adr: number;
}

export interface PlayerSuspicion {
  player: PlayerIdentity;
  metrics: {
    flick: MetricScore;
    prefire: MetricScore;
    wallhack: MetricScore;
  };
  verdict: {
    code: VerdictCode;
    label: string;
  };
  guardrails: {
    samplePenalty: number;
    weaponAdjustment: number;
  };
  combat: PlayerCombatSummary;
  scoreRaw: number;
  scoreFinal: number;
  confidence: number;
  explanation: string[];
}

export interface TrustFactorEntry {
  playerName: string;
  team?: TeamSide;
  trustFactor: number;
  trustLabel: string;
  improvementPlan: string[];
}

export interface TeamTrustSnapshot {
  focusPlayer: string;
  focusTeam?: TeamSide;
  rows: TrustFactorEntry[];
}

export interface SteamAccountInsight {
  playerName: string;
  steamId: string;
  profileUrl?: string;
  accountAgeYears?: number;
  steamLevel?: number;
  cs2Hours?: number;
  vacBans?: number;
  gameBans?: number;
  daysSinceLastBan?: number;
  communityBanned?: boolean;
  economyBan?: string;
  reputationScore: number;
  reputationLabel: string;
  analysis: string[];
}

export interface FaceitAccountInsight {
  playerName: string;
  steamId?: string;
  playerId: string;
  nickname: string;
  region?: string;
  skillLevel?: number;
  elo?: number;
  matches?: number;
  winRatePct?: number;
  kdRatio?: number;
  hsPct?: number;
  reputationScore: number;
  reputationLabel: string;
  analysis: string[];
}

export interface ExternalInsights {
  focusPlayer: string;
  focusSteamId?: string;
  steam?: SteamAccountInsight;
  faceit?: FaceitAccountInsight;
}

export interface MatchReport {
  meta: {
    inputDemo: string;
    generatedAt: string;
    parser: string;
    language: Locale;
    rounds: number;
    ticks: number;
  };
  ranking: PlayerSuspicion[];
  teamTrust?: TeamTrustSnapshot;
  externalInsights?: ExternalInsights;
  topEvents: EvidenceMoment[];
  warnings: string[];
}

export interface AnalyzeInput {
  demoPath: string;
  minSamples: number;
  minRounds: number;
  parser: string;
  language: Locale;
  verbose: boolean;
  knownCleanNames: string[];
  knownSuspiciousNames: string[];
  knownLowTrustNames: string[];
  focusPlayer: string;
  focusSteamId: string;
  steamApiKey?: string;
  faceitApiKey?: string;
  faceitPlayerId?: string;
  faceitNickname?: string;
}
