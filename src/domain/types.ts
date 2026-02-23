export type TeamSide = "T" | "CT" | "SPEC";

export interface PlayerIdentity {
  steamId?: string;
  name: string;
  slot: number;
  team?: TeamSide;
}

export interface EvidenceMoment {
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

export interface PlayerSuspicion {
  player: PlayerIdentity;
  metrics: {
    flick: MetricScore;
    prefire: MetricScore;
    wallhack: MetricScore;
  };
  guardrails: {
    samplePenalty: number;
    weaponAdjustment: number;
  };
  scoreRaw: number;
  scoreFinal: number;
  confidence: number;
  explanation: string[];
}

export interface MatchReport {
  meta: {
    inputDemo: string;
    generatedAt: string;
    parser: string;
    rounds: number;
    ticks: number;
  };
  ranking: PlayerSuspicion[];
  topEvents: EvidenceMoment[];
  warnings: string[];
}

export interface AnalyzeInput {
  demoPath: string;
  minSamples: number;
  minRounds: number;
  parser: string;
  verbose: boolean;
}
