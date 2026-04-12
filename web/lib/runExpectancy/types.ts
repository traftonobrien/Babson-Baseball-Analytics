export type HalfInningSide = "top" | "bottom";

export interface RawPbpPlay {
  inning: number;
  halfInning: HalfInningSide;
  playIndex: number;
  playText: string;
  dedupKey: string;
}

export interface RawPbpTotals {
  runs: number | null;
  hits: number | null;
  errors: number | null;
  leftOnBase: number | null;
}

export interface RawPbpHalfInning {
  key: string;
  caption: string;
  inning: number;
  halfInning: HalfInningSide;
  offenseTeam: string;
  playLines: string[];
  plays: RawPbpPlay[];
  totals: RawPbpTotals;
}

export interface RawPbpGame {
  gameId: string | null;
  sourceUrl: string | null;
  halfInnings: RawPbpHalfInning[];
}

export interface ParsedBaseState {
  first: boolean;
  second: boolean;
  third: boolean;
}

export interface PitchCountState {
  balls: number;
  strikes: number;
  label: string;
}

export interface PitchCountSnapshot {
  pitchNumber: number;
  pitchCode: string;
  countBefore: PitchCountState;
  countAfter: PitchCountState;
}

export interface ParsedPbpPlay {
  rawPlay: RawPbpPlay;
  outsBefore: number;
  outsAfter: number;
  baseStateBefore: ParsedBaseState;
  baseStateAfter: ParsedBaseState;
  count: string | null;
  pitchSequence: string | null;
  countSnapshots: PitchCountSnapshot[];
  finalCount: PitchCountState | null;
  countBeforeTerminalPitch: PitchCountState | null;
  terminalPitchRecorded: boolean;
  runsScored: number;
  ignored: boolean;
}

export interface HalfInningValidation {
  passed: boolean;
  expectedRuns: number | null;
  parsedRuns: number;
  reason: string | null;
}

export interface ParsedPbpHalfInning {
  rawHalfInning: RawPbpHalfInning;
  plays: ParsedPbpPlay[];
  parsedRuns: number;
  validation: HalfInningValidation;
  usableForMatrix: boolean;
}

export interface ParsedPbpGame {
  rawGame: RawPbpGame;
  metadata: RunExpectancyGameMapEntry | null;
  halfInnings: ParsedPbpHalfInning[];
  usableHalfInnings: ParsedPbpHalfInning[];
  failedHalfInnings: ParsedPbpHalfInning[];
}

export interface RunExpectancyGameMapEntry {
  gameId: string;
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  suffix: string | null;
  url: string;
}

export interface SeasonRunExpectancyGameResult {
  gameId: string | null;
  sourceUrl: string;
  metadata: RunExpectancyGameMapEntry | null;
  parsedGame: ParsedPbpGame | null;
  passed: boolean;
  usableHalfInnings: number;
  failedHalfInnings: number;
  usableRatio: number;
  failureReasons: string[];
}

export interface SeasonRunExpectancyCorpus {
  games: SeasonRunExpectancyGameResult[];
  totalGames: number;
  passingGames: number;
  failedGames: number;
  totalUsableHalfInnings: number;
  totalFailedHalfInnings: number;
  failureReasons: Record<string, number>;
}

// ---------------------------------------------------------------------------
// RE Matrix types (Phase 22)
// ---------------------------------------------------------------------------

/**
 * Base-state code: three-character string where each position (1B, 2B, 3B)
 * is "1" if occupied, "0" if empty. E.g., "000" = bases empty, "111" = loaded.
 */
export type BaseStateCode =
  | "000"
  | "100"
  | "010"
  | "001"
  | "110"
  | "101"
  | "011"
  | "111";

export type OutsCount = 0 | 1 | 2;

export type CountLabel =
  | "0-0"
  | "0-1"
  | "0-2"
  | "1-0"
  | "1-1"
  | "1-2"
  | "2-0"
  | "2-1"
  | "2-2"
  | "3-0"
  | "3-1"
  | "3-2";

/** Accumulator used during aggregation before computing means. */
export interface MatrixCellAccumulator {
  n: number;
  sumRe: number;
  /** Number of plays where outs increased (for out-probability computation). */
  sumOutOccurred: number;
}

/** A single RE24 cell (8 base states × 3 out values = 24 cells). */
export interface RE24Cell {
  baseState: BaseStateCode;
  outs: OutsCount;
  n: number;
  /** Mean expected runs to end of half-inning. null when n < MIN_OBSERVATIONS. */
  meanRe: number | null;
}

/** A single RE288 cell (12 counts × 8 base states × 3 out values = 288 cells). */
export interface RE288Cell extends RE24Cell {
  count: CountLabel;
  /** Probability the current play results in at least one out. null when n < MIN_OBSERVATIONS. */
  outProb: number | null;
}

export interface CountProgressionBranchSummary {
  branch: "strikeout" | "ball" | "inPlay";
  label: string;
  nextStateLabel: string;
  /** Branch sample count when the branch is observed directly in PBP. */
  n: number;
  preRe: number | null;
  postRe: number | null;
  reDelta: number | null;
  preOutProb: number | null;
  postOutProb: number | null;
  outProbDelta: number | null;
}

export interface CountProgressionScenarioSummary {
  conversionPct: number;
  ballsConverted: number;
  runsImprovement: number | null;
}

export interface CountProgressionStateMixEntry {
  baseState: BaseStateCode;
  outs: OutsCount;
  n: number;
  share: number;
}

export interface CountProgressionSummary {
  count: CountLabel;
  totalObserved: number;
  baselineRe: number | null;
  baselineOutProb: number | null;
  stateMix: CountProgressionStateMixEntry[];
  branches: CountProgressionBranchSummary[];
  counterfactual: {
    totalBalls: number;
    valuePerConversion: number | null;
    scenarios: CountProgressionScenarioSummary[];
  };
}

/** The full serialized matrix file written by `npm run re:rebuild`. */
export interface ReMatrixFile {
  generatedAt: string;
  season: number;
  totalObservationsRe24: number;
  totalObservationsRe288: number;
  minObservations: number;
  re24: RE24Cell[];
  re288: RE288Cell[];
  countProgression?: {
    ohTwo: CountProgressionSummary | null;
  };
}

// ---------------------------------------------------------------------------
// Game base-state index types (Phase 23)
// ---------------------------------------------------------------------------

/**
 * One record per plate appearance (non-ignored play) from the PBP corpus.
 * Used to join charted PAs to a base-state context for delta-RE computation.
 */
export interface PaBaseStateRecord {
  // Game identification (from re_game_map.json)
  gameId: string;
  date: string;
  opponent: string;
  homeAway: "home" | "away";
  suffix: string | null;

  // PA location within the game
  inning: number;
  halfInning: HalfInningSide;
  /** 0-based index among non-ignored plays in this half-inning. */
  paIndex: number;

  // State at start of PA
  baseStateBefore: BaseStateCode;
  outsBefore: OutsCount;

  // State after PA
  baseStateAfter: BaseStateCode;
  outsAfter: OutsCount;
  runsScored: number;

  // Count context captured from the play line
  count: string | null;
  pitchSequence: string | null;
}

/** The serialized index file written by `npm run re:base-states`. */
export interface GameBaseStatesIndex {
  generatedAt: string;
  season: number;
  totalGames: number;
  totalPas: number;
  pas: PaBaseStateRecord[];
}
