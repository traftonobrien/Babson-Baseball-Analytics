export type GameStatus = "draft" | "active" | "final";

export type PitchType =
  | "Fastball"
  | "Curveball"
  | "Slider"
  | "Changeup"
  | "Split/Cut"
  | "Other";

export type PitchResult =
  | "ball"
  | "called_strike"
  | "swinging_strike"
  | "foul"
  | "bunt_foul"
  | "in_play"
  | "hit_by_pitch";

export type ChartingInitialCount = "0-0" | "2-1" | "Bunt";

/** Open-ended string for PA result codes like "K", "BB", "HBP", "1B", "F8", "6-3". */
export type PAResultCode = string;

export interface ChartingGame {
  id: string;
  opponent: string;
  /** ISO date string yyyy-mm-dd */
  gameDate: string;
  status: GameStatus;
  /** Monotonically increasing integer used for optimistic locking on PATCH. */
  revision: number;
  charter: string | null;
  weather: string | null;
  homeCatcher: string | null;
  awayCatcher: string | null;
  babsonRecord: string | null;
  standing: string | null;
  tomorrowStarter: string | null;
  tomorrowOpponent: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChartingPitcherSegment {
  id: string;
  gameId: string;
  /** Canonical Babson player ID, e.g. "DJames1" */
  playerId: string;
  displayName: string;
  /** 0-indexed appearance order within the game */
  segmentOrder: number;
  enteredInning: number | null;
  exitedInning: number | null;
  /** Manual override set before export */
  runsOverride: number | null;
  earnedRunsOverride: number | null;
}

export interface ChartingPlateAppearance {
  id: string;
  gameId: string;
  segmentId: string;
  paOrder: number;
  inning: number;
  hitterName: string;
  /** 1-9 */
  lineupSlot: number;
  resultCode: PAResultCode | null;
  initialCount?: ChartingInitialCount | null;
  buntContext: boolean;
}

export interface ChartingPitch {
  id: string;
  gameId: string;
  paId: string;
  pitchOrder: number;
  pitchType: PitchType;
  /** 1-17 catcher-view zone cell, null if not recorded */
  locationCell: number | null;
  pitchResult: PitchResult;
  ballsBefore: number;
  strikesBefore: number;
  /** Gun reading in mph; null if not recorded */
  velocity: number | null;
}

/** One slot in the pre-game opponent lineup (1-9). */
export interface ChartingLineupEntry {
  id: string;
  gameId: string;
  /** 1-9 */
  lineupSlot: number;
  hitterName: string;
}

/** Canonical Babson pitcher as returned by the bootstrap endpoint. */
export interface ChartingBootstrapPitcher {
  playerId: string;
  name: string;
  throws: "R" | "L";
  arsenalPitchTypes: PitchType[];
}

/** Full Babson roster player used for hitter selection and live AB setup. */
export interface ChartingBootstrapRosterPlayer {
  slug: string;
  playerId: string | null;
  name: string;
  positions: string[];
  bats: string | null;
  throws: string | null;
  academicYear: string | null;
  isPitcher: boolean;
  isHitter: boolean;
}

/** Payload returned by GET /api/charting/bootstrap */
export interface ChartingBootstrapResponse {
  pitchers: ChartingBootstrapPitcher[];
  rosterPlayers: ChartingBootstrapRosterPlayer[];
  recentGames: ChartingGame[];
}

/** Full game snapshot returned by GET /api/charting/games/[id] */
export interface ChartingGameSnapshot {
  game: ChartingGame;
  segments: ChartingPitcherSegment[];
  lineup: ChartingLineupEntry[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
}
