/**
 * RE Matrix — pure aggregation and computation helpers.
 *
 * All logic that was previously inlined in web/scripts/build_re_matrix.ts is
 * extracted here so it can be unit tested independently.
 */

import type {
  BaseStateCode,
  CountProgressionBranchSummary,
  CountProgressionStateMixEntry,
  CountProgressionSummary,
  CountLabel,
  MatrixCellAccumulator,
  OutsCount,
  ParsedPbpHalfInning,
  ParsedPbpPlay,
  RE24Cell,
  RE288Cell,
  SeasonRunExpectancyCorpus,
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MIN_OBSERVATIONS_DEFAULT = 5;

export const ALL_BASE_STATES: readonly BaseStateCode[] = [
  "000",
  "100",
  "010",
  "001",
  "110",
  "101",
  "011",
  "111",
] as const;

export const ALL_OUTS: readonly OutsCount[] = [0, 1, 2] as const;

export const ALL_COUNTS: readonly CountLabel[] = [
  "0-0",
  "0-1",
  "0-2",
  "1-0",
  "1-1",
  "1-2",
  "2-0",
  "2-1",
  "2-2",
  "3-0",
  "3-1",
  "3-2",
] as const;

const BALL_PITCH_CODES = new Set(["B", "I", "P"]);
const STRIKE_PITCH_CODES = new Set(["K", "S", "C", "T", "L", "M", "Q"]);
const FOUL_PITCH_CODES = new Set(["F"]);
const IN_PLAY_PITCH_CODES = new Set(["X"]);
const PRESET_COUNTERFACTUAL_PCTS = [25, 50, 75] as const;

// ---------------------------------------------------------------------------
// Key helpers (exported for tests)
// ---------------------------------------------------------------------------

export function baseStateCode(
  first: boolean,
  second: boolean,
  third: boolean,
): BaseStateCode {
  return `${first ? "1" : "0"}${second ? "1" : "0"}${
    third ? "1" : "0"
  }` as BaseStateCode;
}

export function re24Key(baseState: BaseStateCode, outs: OutsCount): string {
  return `${baseState}-${outs}`;
}

export function re288Key(
  count: CountLabel,
  baseState: BaseStateCode,
  outs: OutsCount,
): string {
  return `${count}|${baseState}|${outs}`;
}

export function isValidCount(label: string): label is CountLabel {
  return (ALL_COUNTS as readonly string[]).includes(label);
}

export function isValidOuts(n: number): n is OutsCount {
  return n === 0 || n === 1 || n === 2;
}

// ---------------------------------------------------------------------------
// Accumulator helpers
// ---------------------------------------------------------------------------

function makeAccumulator(): MatrixCellAccumulator {
  return { n: 0, sumRe: 0, sumOutOccurred: 0 };
}

function getOrInit(
  map: Map<string, MatrixCellAccumulator>,
  key: string,
): MatrixCellAccumulator {
  let cell = map.get(key);
  if (!cell) {
    cell = makeAccumulator();
    map.set(key, cell);
  }
  return cell;
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

export interface AggregationResult {
  re24Map: Map<string, MatrixCellAccumulator>;
  re288Map: Map<string, MatrixCellAccumulator>;
  obsRe24: number;
  obsRe288: number;
  skippedIgnored: number;
  skippedNoCount: number;
  skippedInvalidOuts: number;
}

interface PitchStateObservation {
  baseState: BaseStateCode;
  outs: OutsCount;
}

/**
 * Aggregates raw observations from a list of usable half-innings.
 *
 * For RE24: one observation per play (plate appearance), keyed by
 * (baseStateBefore, outsBefore).
 *
 * For RE288: one observation per pitch (via countSnapshots), keyed by
 * (countBefore, baseStateBefore, outsBefore). Falls back to
 * countBeforeTerminalPitch when no snapshots are available.
 *
 * The run-expectancy value for each observation is the sum of runsScored for
 * the current play plus all subsequent plays to end of half-inning.
 */
export function aggregateHalfInnings(
  halfInnings: ParsedPbpHalfInning[],
): AggregationResult {
  const re24Map = new Map<string, MatrixCellAccumulator>();
  const re288Map = new Map<string, MatrixCellAccumulator>();
  let obsRe24 = 0;
  let obsRe288 = 0;
  let skippedIgnored = 0;
  let skippedNoCount = 0;
  let skippedInvalidOuts = 0;

  for (const halfInning of halfInnings) {
    const plays = halfInning.plays.filter((p) => !p.ignored);
    skippedIgnored += halfInning.plays.length - plays.length;

    // Compute cumulative runs-to-end-of-inning for each play index.
    const runsToEnd: number[] = new Array(plays.length).fill(0);
    for (let i = plays.length - 1; i >= 0; i--) {
      runsToEnd[i] =
        plays[i].runsScored + (i + 1 < plays.length ? runsToEnd[i + 1] : 0);
    }

    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];
      const re = runsToEnd[i];

      if (!isValidOuts(play.outsBefore)) {
        skippedInvalidOuts++;
        continue;
      }

      const bsCode = baseStateCode(
        play.baseStateBefore.first,
        play.baseStateBefore.second,
        play.baseStateBefore.third,
      );
      const outs = play.outsBefore as OutsCount;
      const didOut = play.outsAfter > play.outsBefore ? 1 : 0;

      // RE24: one observation per play
      const r24Cell = getOrInit(re24Map, re24Key(bsCode, outs));
      r24Cell.n++;
      r24Cell.sumRe += re;
      r24Cell.sumOutOccurred += didOut;
      obsRe24++;

      // RE288: one observation per pitch
      if (play.countSnapshots.length > 0) {
        for (const snapshot of play.countSnapshots) {
          const label = snapshot.countBefore.label;
          if (!isValidCount(label)) {
            skippedNoCount++;
            continue;
          }
          const r288Cell = getOrInit(
            re288Map,
            re288Key(label, bsCode, outs),
          );
          r288Cell.n++;
          r288Cell.sumRe += re;
          r288Cell.sumOutOccurred += didOut;
          obsRe288++;
        }
      } else if (play.countBeforeTerminalPitch) {
        const label = play.countBeforeTerminalPitch.label;
        if (isValidCount(label)) {
          const r288Cell = getOrInit(
            re288Map,
            re288Key(label, bsCode, outs),
          );
          r288Cell.n++;
          r288Cell.sumRe += re;
          r288Cell.sumOutOccurred += didOut;
          obsRe288++;
        } else {
          skippedNoCount++;
        }
      } else {
        skippedNoCount++;
      }
    }
  }

  return {
    re24Map,
    re288Map,
    obsRe24,
    obsRe288,
    skippedIgnored,
    skippedNoCount,
    skippedInvalidOuts,
  };
}

function meanFromAccumulator(
  map: Map<string, MatrixCellAccumulator>,
  key: string,
): number | null {
  const acc = map.get(key);
  return acc && acc.n > 0 ? acc.sumRe / acc.n : null;
}

function outProbFromAccumulator(
  map: Map<string, MatrixCellAccumulator>,
  key: string,
): number | null {
  const acc = map.get(key);
  return acc && acc.n > 0 ? acc.sumOutOccurred / acc.n : null;
}

function stateObservationFromPlay(play: ParsedPbpPlay): PitchStateObservation | null {
  if (!isValidOuts(play.outsBefore)) {
    return null;
  }

  return {
    baseState: baseStateCode(
      play.baseStateBefore.first,
      play.baseStateBefore.second,
      play.baseStateBefore.third,
    ),
    outs: play.outsBefore as OutsCount,
  };
}

function strikeoutPostReForState(
  re24Map: Map<string, MatrixCellAccumulator>,
  state: PitchStateObservation,
): number | null {
  if (state.outs >= 2) {
    return 0;
  }

  return meanFromAccumulator(
    re24Map,
    re24Key(state.baseState, (state.outs + 1) as OutsCount),
  );
}

function classifyOhTwoPitchOutcome(
  play: ParsedPbpPlay,
  snapshotIndex: number,
): "ball" | "strikeout" | "inPlay" | "foul" | "other" {
  const snapshot = play.countSnapshots[snapshotIndex];
  const pitchCode = snapshot?.pitchCode.toUpperCase();
  const isLastPitch = snapshotIndex === play.countSnapshots.length - 1;

  if (!pitchCode) {
    return "other";
  }

  if (BALL_PITCH_CODES.has(pitchCode)) {
    return "ball";
  }

  if (
    isLastPitch &&
    !play.terminalPitchRecorded &&
    play.countBeforeTerminalPitch?.label === "0-2" &&
    !/\b(struck out|walked|intentional walk|hit by pitch)\b/i.test(
      play.rawPlay.playText,
    )
  ) {
    return "inPlay";
  }

  if (FOUL_PITCH_CODES.has(pitchCode)) {
    return "foul";
  }

  if (IN_PLAY_PITCH_CODES.has(pitchCode)) {
    return "inPlay";
  }

  if (
    isLastPitch &&
    STRIKE_PITCH_CODES.has(pitchCode) &&
    /\bstruck out\b/i.test(play.rawPlay.playText)
  ) {
    return "strikeout";
  }

  return "other";
}

function weightedAverage(
  observations: PitchStateObservation[],
  valueForState: (state: PitchStateObservation) => number | null,
): number | null {
  let sum = 0;
  let count = 0;

  for (const observation of observations) {
    const value = valueForState(observation);
    if (value === null) {
      continue;
    }
    sum += value;
    count++;
  }

  return count > 0 ? sum / count : null;
}

function collectValues<T>(
  observations: T[],
  valueForObservation: (observation: T) => number | null,
): number[] {
  const values: number[] = [];

  for (const observation of observations) {
    const value = valueForObservation(observation);
    if (value !== null) {
      values.push(value);
    }
  }

  return values;
}

function buildStateMix(
  observations: PitchStateObservation[],
  limit = 6,
): CountProgressionSummary["stateMix"] {
  const totals = new Map<string, number>();

  for (const observation of observations) {
    const key = `${observation.baseState}|${observation.outs}`;
    totals.set(key, (totals.get(key) ?? 0) + 1);
  }

  return [...totals.entries()]
    .map(([key, n]) => {
      const [baseState, outs] = key.split("|");
      return {
        baseState: baseState as BaseStateCode,
        outs: Number.parseInt(outs ?? "0", 10) as OutsCount,
        n,
        share: observations.length > 0 ? n / observations.length : 0,
      };
    })
    .sort((left, right) => right.n - left.n)
    .slice(0, limit);
}

export function buildOhTwoCountProgressionSummary(
  halfInnings: ParsedPbpHalfInning[],
  re24Map: Map<string, MatrixCellAccumulator>,
  re288Map: Map<string, MatrixCellAccumulator>,
): CountProgressionSummary | null {
  const allOhTwoStates: PitchStateObservation[] = [];
  const ballStates: PitchStateObservation[] = [];
  const strikeoutStates: PitchStateObservation[] = [];
  const inPlayStates: PitchStateObservation[] = [];
  const inPlayPostRes: number[] = [];
  const inPlayDeltas: number[] = [];
  let inPlayCount = 0;

  for (const halfInning of halfInnings) {
    const plays = halfInning.plays.filter((play) => !play.ignored);

    for (const play of plays) {
      const state = stateObservationFromPlay(play);
      if (!state) {
        continue;
      }

      for (const [snapshotIndex, snapshot] of play.countSnapshots.entries()) {
        if (snapshot.countBefore.label !== "0-2") {
          continue;
        }

        allOhTwoStates.push(state);

        const outcome = classifyOhTwoPitchOutcome(play, snapshotIndex);
        if (outcome === "ball") {
          ballStates.push(state);
        } else if (outcome === "strikeout") {
          strikeoutStates.push(state);
        } else if (outcome === "inPlay") {
          inPlayStates.push(state);
          const postRe =
            play.outsAfter >= 3
              ? 0
              : meanFromAccumulator(
                  re24Map,
                  re24Key(
                    baseStateCode(
                      play.baseStateAfter.first,
                      play.baseStateAfter.second,
                      play.baseStateAfter.third,
                    ),
                    play.outsAfter as OutsCount,
                  ),
                );
          if (postRe !== null) {
            inPlayPostRes.push(postRe);
            const preRe = meanFromAccumulator(
              re288Map,
              re288Key("0-2", state.baseState, state.outs),
            );
            if (preRe !== null) {
              inPlayDeltas.push(postRe - preRe);
            }
          }
          inPlayCount++;
        }
      }
    }
  }

  if (allOhTwoStates.length === 0) {
    return null;
  }

  const baselineRe = weightedAverage(allOhTwoStates, (state) =>
    meanFromAccumulator(re288Map, re288Key("0-2", state.baseState, state.outs)),
  );
  const baselineOutProb = weightedAverage(allOhTwoStates, (state) =>
    outProbFromAccumulator(re288Map, re288Key("0-2", state.baseState, state.outs)),
  );

  const branchPreRe = (states: PitchStateObservation[]) =>
    weightedAverage(states, (state) =>
      meanFromAccumulator(re288Map, re288Key("0-2", state.baseState, state.outs)),
    );
  const branchPreOutProb = (states: PitchStateObservation[]) =>
    weightedAverage(states, (state) =>
      outProbFromAccumulator(re288Map, re288Key("0-2", state.baseState, state.outs)),
    );

  const strikeoutPreRe = branchPreRe(strikeoutStates);
  const strikeoutPreOutProb = branchPreOutProb(strikeoutStates);
  const strikeoutPostRe = weightedAverage(strikeoutStates, (state) =>
    strikeoutPostReForState(re24Map, state),
  );
  const strikeoutDeltas = collectValues(strikeoutStates, (state) => {
    const pre = meanFromAccumulator(
      re288Map,
      re288Key("0-2", state.baseState, state.outs),
    );
    const post = strikeoutPostReForState(re24Map, state);
    return pre !== null && post !== null ? post - pre : null;
  });
  const ballPreRe = branchPreRe(ballStates);
  const ballPreOutProb = branchPreOutProb(ballStates);
  const ballPostRe = weightedAverage(ballStates, (state) =>
    meanFromAccumulator(re288Map, re288Key("1-2", state.baseState, state.outs)),
  );
  const ballPostOutProb = weightedAverage(ballStates, (state) =>
    outProbFromAccumulator(re288Map, re288Key("1-2", state.baseState, state.outs)),
  );
  const ballDeltas = collectValues(ballStates, (state) => {
    const pre = meanFromAccumulator(
      re288Map,
      re288Key("0-2", state.baseState, state.outs),
    );
    const post = meanFromAccumulator(
      re288Map,
      re288Key("1-2", state.baseState, state.outs),
    );
    return pre !== null && post !== null ? post - pre : null;
  });
  const inPlayPreRe = branchPreRe(inPlayStates);
  const inPlayPreOutProb = branchPreOutProb(inPlayStates);
  const inPlayPostRe =
    inPlayPostRes.length > 0
      ? inPlayPostRes.reduce((sum, value) => sum + value, 0) / inPlayPostRes.length
      : null;

  const makeBranch = (
    branch: CountProgressionBranchSummary["branch"],
    label: string,
    nextStateLabel: string,
    n: number,
    preRe: number | null,
    postRe: number | null,
    deltas: number[],
    preOutProb: number | null,
    postOutProb: number | null,
  ): CountProgressionBranchSummary => ({
    branch,
    label,
    nextStateLabel,
    n,
    preRe,
    postRe,
    reDelta:
      preRe !== null && postRe !== null ? postRe - preRe : null,
    deltaRangeMin: deltas.length > 0 ? Math.min(...deltas) : null,
    deltaRangeMax: deltas.length > 0 ? Math.max(...deltas) : null,
    preOutProb,
    postOutProb,
    outProbDelta:
      preOutProb !== null && postOutProb !== null
        ? postOutProb - preOutProb
        : null,
  });

  const counterfactualBallPostRe = weightedAverage(ballStates, (state) =>
    meanFromAccumulator(re288Map, re288Key("1-2", state.baseState, state.outs)),
  );
  const counterfactualKPostRe = weightedAverage(ballStates, (state) =>
    strikeoutPostReForState(re24Map, state),
  );
  const valuePerConversion =
    counterfactualBallPostRe !== null && counterfactualKPostRe !== null
      ? counterfactualBallPostRe - counterfactualKPostRe
      : null;

  return {
    count: "0-2",
    totalObserved: allOhTwoStates.length,
    baselineRe,
    baselineOutProb,
    stateMix: buildStateMix(allOhTwoStates, 6),
    branches: [
      makeBranch(
        "strikeout",
        "Strikeout",
        "Next PA after strikeout",
        strikeoutStates.length,
        strikeoutPreRe,
        strikeoutPostRe,
        strikeoutDeltas,
        strikeoutPreOutProb,
        null,
      ),
      makeBranch(
        "ball",
        "Ball (→ 1-2)",
        "Count 1-2, same bases/outs",
        ballStates.length,
        ballPreRe,
        ballPostRe,
        ballDeltas,
        ballPreOutProb,
        ballPostOutProb,
      ),
      makeBranch(
        "inPlay",
        "In Play (actual outcomes)",
        "Actual contact outcomes from 0-2",
        inPlayCount,
        inPlayPreRe,
        inPlayPostRe,
        inPlayDeltas,
        inPlayPreOutProb,
        null,
      ),
    ],
    counterfactual: {
      totalBalls: ballStates.length,
      valuePerConversion,
      scenarios: PRESET_COUNTERFACTUAL_PCTS.map((conversionPct) => {
        const ballsConverted = Math.round((conversionPct / 100) * ballStates.length);
        return {
          conversionPct,
          ballsConverted,
          runsImprovement:
            valuePerConversion !== null
              ? valuePerConversion * ballsConverted
              : null,
        };
      }),
    },
  };
}

export function buildOhTwoBallStateMix(
  halfInnings: ParsedPbpHalfInning[],
): CountProgressionStateMixEntry[] {
  const ballStates: PitchStateObservation[] = [];

  for (const halfInning of halfInnings) {
    const plays = halfInning.plays.filter((play) => !play.ignored);

    for (const play of plays) {
      const state = stateObservationFromPlay(play);
      if (!state) {
        continue;
      }

      for (const [snapshotIndex, snapshot] of play.countSnapshots.entries()) {
        if (snapshot.countBefore.label !== "0-2") {
          continue;
        }

        if (classifyOhTwoPitchOutcome(play, snapshotIndex) === "ball") {
          ballStates.push(state);
        }
      }
    }
  }

  return buildStateMix(ballStates, Number.POSITIVE_INFINITY);
}

export function evaluateOhTwoBallStateMix(
  stateMix: CountProgressionStateMixEntry[],
  re24Map: Map<string, MatrixCellAccumulator>,
  re288Map: Map<string, MatrixCellAccumulator>,
): {
  totalObserved: number;
  preRe: number | null;
  postRe: number | null;
  reDelta: number | null;
} {
  const observations: PitchStateObservation[] = stateMix.flatMap((entry) =>
    Array.from({ length: entry.n }, () => ({
      baseState: entry.baseState,
      outs: entry.outs,
    })),
  );

  const preRe = weightedAverage(observations, (state) =>
    meanFromAccumulator(re288Map, re288Key("0-2", state.baseState, state.outs)),
  );
  const postRe = weightedAverage(observations, (state) =>
    meanFromAccumulator(re288Map, re288Key("1-2", state.baseState, state.outs)),
  );

  return {
    totalObserved: observations.length,
    preRe,
    postRe,
    reDelta:
      preRe !== null && postRe !== null
        ? postRe - preRe
        : null,
  };
}

/**
 * Builds the full 24-cell RE24 array (8 base states × 3 out values).
 * Cells with n < minObs get meanRe = null.
 */
export function buildRe24Cells(
  re24Map: Map<string, MatrixCellAccumulator>,
  minObs = MIN_OBSERVATIONS_DEFAULT,
): RE24Cell[] {
  const cells: RE24Cell[] = [];
  for (const baseState of ALL_BASE_STATES) {
    for (const outs of ALL_OUTS) {
      const acc = re24Map.get(re24Key(baseState, outs)) ?? makeAccumulator();
      cells.push({
        baseState,
        outs,
        n: acc.n,
        meanRe: acc.n >= minObs ? acc.sumRe / acc.n : null,
      });
    }
  }
  return cells;
}

/**
 * Builds the full 288-cell RE288 array (12 counts × 8 base states × 3 outs).
 * Cells with n < minObs get meanRe = null and outProb = null.
 */
export function buildRe288Cells(
  re288Map: Map<string, MatrixCellAccumulator>,
  minObs = MIN_OBSERVATIONS_DEFAULT,
): RE288Cell[] {
  const cells: RE288Cell[] = [];
  for (const count of ALL_COUNTS) {
    for (const baseState of ALL_BASE_STATES) {
      for (const outs of ALL_OUTS) {
        const acc =
          re288Map.get(re288Key(count, baseState, outs)) ?? makeAccumulator();
        cells.push({
          count,
          baseState,
          outs,
          n: acc.n,
          meanRe: acc.n >= minObs ? acc.sumRe / acc.n : null,
          outProb: acc.n >= minObs ? acc.sumOutOccurred / acc.n : null,
        });
      }
    }
  }
  return cells;
}

/**
 * Convenience: aggregate an entire corpus and return the built cell arrays.
 */
export function buildMatrixFromCorpus(
  corpus: SeasonRunExpectancyCorpus,
  minObs = MIN_OBSERVATIONS_DEFAULT,
): {
  re24: RE24Cell[];
  re288: RE288Cell[];
  obsRe24: number;
  obsRe288: number;
  countProgression: {
    ohTwo: CountProgressionSummary | null;
  };
} {
  const usableHalfInnings = corpus.games
    .filter((g) => g.parsedGame !== null)
    .flatMap((g) => g.parsedGame!.usableHalfInnings);

  const agg = aggregateHalfInnings(usableHalfInnings);
  return {
    re24: buildRe24Cells(agg.re24Map, minObs),
    re288: buildRe288Cells(agg.re288Map, minObs),
    obsRe24: agg.obsRe24,
    obsRe288: agg.obsRe288,
    countProgression: {
      ohTwo: buildOhTwoCountProgressionSummary(
        usableHalfInnings,
        agg.re24Map,
        agg.re288Map,
      ),
    },
  };
}
