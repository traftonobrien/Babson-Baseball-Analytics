/**
 * Leaderboard data types.
 */

export interface OutingLeaderboardRow {
  playerId: string;
  playerName: string;
  outingId: string; // playerId/dateId
  dateId: string;
  season: number | null; // null = unknown
  label: string;
  pitcherHand: "R" | "L";
  handUnknown: boolean; // true if Arsenals had no entry and we fell back to "R"
  pitchCount: number;
  onTargetPct: number;
  outlierPct: number;
  avgMissIn: number;
  avgVAbsIn: number;
  avgHAbsIn: number;
  consistencyStdIn: number;
  commandPlus: number;
}

export interface PitcherSeasonRow {
  playerId: string;
  playerName: string;
  season: number;
  pitcherHand: "R" | "L";
  pitchCount: number;
  onTargetPct: number;
  outlierPct: number;
  avgMissIn: number;
  avgVAbsIn: number;
  avgHAbsIn: number;
  consistencyStdIn: number;
  outingCount: number;
  commandPlus: number;
}

/** Intermediate KPI bag produced by metrics engine. */
export interface OutingKpis {
  pitchCount: number;
  onTargetCount: number;
  outlierCount: number;
  totalMissSum: number;
  totalVAbsSum: number;
  totalHAbsSum: number;
  misses: number[]; // individual total_miss_inches for stddev
  onTargetPct: number;
  outlierPct: number;
  avgMissIn: number;
  avgVAbsIn: number;
  avgHAbsIn: number;
  consistencyStdIn: number;
  commandPlus: number;
}

export interface PlayerAggregateRow {
  playerId: string;
  playerName: string;
  pitcherHand: "R" | "L";
  handUnknown: boolean;
  outingCount: number;
  pitchCount: number;
  onTargetPct: number;
  outlierPct: number;
  avgMissIn: number;
  avgVAbsIn: number;
  avgHAbsIn: number;
  consistencyStdIn: number;
  commandPlus: number;
}

export type LeaderboardMode = "outings" | "players";

export type SeasonFilter = 2025 | 2026 | "both";
