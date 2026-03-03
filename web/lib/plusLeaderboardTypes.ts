export type PlusSeasonFilter = 2025 | 2026 | "both";

export type PlusNotReadyReason =
  | "missing_live_command"
  | "missing_stuff"
  | "no_overlap";

export interface PlusPlayerRow {
  playerId: string;
  playerName: string;
  throws: "R" | "L" | null;
  outingCount: number;
  trackedPitchCount: number;
  stuffSessionCount: number;
  stuffPlus: number | null;
  commandPlus: number | null;
  pitchingPlus: number | null;
  stuffComponent: number | null;
  commandComponent: number | null;
  overlapPitchCount: number;
  overlapPitchTypeCount: number;
  qualifiedCommandPitchTypeCount: number;
  qualifiedStuffPitchTypeCount: number;
  ready: boolean;
  notReadyReason: PlusNotReadyReason | null;
}

export interface PlusPitchTypeRow {
  playerId: string;
  playerName: string;
  throws: "R" | "L" | null;
  commandPitchType: string;
  pitchLabel: string;
  commandCount: number;
  usageShare: number;
  stuffPlus: number | null;
  commandPlus: number | null;
  pitchingPlus: number | null;
  includedInPitchingPlus: boolean;
  reason: "missing_stuff" | "ambiguous_stuff_match" | null;
}

export interface PlusSessionRow {
  playerId: string;
  playerName: string;
  throws: "R" | "L" | null;
  outingId: string;
  dateId: string;
  season: number;
  trackedPitchCount: number;
  stuffSessionPitchTypeCount: number;
  stuffPlus: number | null;
  commandPlus: number | null;
  pitchingPlus: number | null;
  overlapPitchCount: number;
  overlapPitchTypeCount: number;
  ready: boolean;
  notReadyReason: PlusNotReadyReason | null;
}

export interface PlusLeaderboardPayload {
  generatedAt: string;
  seasonFilter: PlusSeasonFilter;
  players: PlusPlayerRow[];
  pitchTypes: PlusPitchTypeRow[];
  sessions: PlusSessionRow[];
}
