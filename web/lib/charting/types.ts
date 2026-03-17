export type GameStatus = "draft" | "active" | "final";

export type ChartingSessionType = "live_ab" | "game";

/**
 * Physical venue side for the game context.
 * Use this for home/away metadata only.
 */
export type ChartingVenueSide = "home" | "away";

/**
 * Matchup side inside a charted session.
 * Use this for who is batting / pitching / lineup ownership.
 */
export type ChartingMatchupSide = "our" | "opponent";

/**
 * Backward-compatible alias for older charting code that still references
 * `ChartingTeamSide`. In the current model, lineup/pitcher ownership maps to
 * matchup side semantics.
 */
export type ChartingTeamSide = ChartingMatchupSide;

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

export interface ChartingBaserunnerState {
  runnerOnFirst: string | null;
  runnerOnSecond: string | null;
  runnerOnThird: string | null;
}

export interface ChartingGame {
  id: string;
  opponent: string;
  /** ISO date string yyyy-mm-dd */
  gameDate: string;
  status: GameStatus;
  sessionType: ChartingSessionType;

  /** Physical venue designation for Babson in this game context. */
  babsonVenueSide: ChartingVenueSide;

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

  /** Free-text starting pitcher for Babson in game mode. */
  babsonStartingPitcher: string | null;

  /** Free-text starting pitcher for the opponent in game mode. */
  opponentStartingPitcher: string | null;

  /** Optional labels for the two sides in game mode. */
  ourTeamLabel: string | null;
  opponentTeamLabel: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface ChartingPitcherSegment {
  id: string;
  gameId: string;

  /** Canonical Babson player ID when available, e.g. "DJames1". */
  playerId: string | null;

  displayName: string;

  /** Which matchup side this pitcher belongs to. */
  teamSide: ChartingMatchupSide;

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
  isTopInning: boolean;
  hitterName: string;

  /** 1-9 */
  lineupSlot: number;

  /** Which matchup side the hitter belongs to. */
  teamSide: ChartingMatchupSide;

  resultCode: PAResultCode | null;
  initialCount?: ChartingInitialCount | null;
  buntContext: boolean;
  runnerOnFirst: string | null;
  runnerOnSecond: string | null;
  runnerOnThird: string | null;
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

export interface ChartingLineupEntry {
  id: string;
  gameId: string;

  /** Which matchup side this lineup slot belongs to. */
  teamSide: ChartingMatchupSide;

  /** 1-9 */
  lineupSlot: number;
  hitterName: string;
}

export interface ChartingTeamLineup {
  side: ChartingMatchupSide;
  entries: ChartingLineupEntry[];
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
