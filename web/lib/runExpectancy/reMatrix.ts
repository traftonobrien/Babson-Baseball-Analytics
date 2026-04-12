/**
 * RE Matrix — pure aggregation and computation helpers.
 *
 * All logic that was previously inlined in web/scripts/build_re_matrix.ts is
 * extracted here so it can be unit tested independently.
 */

import type {
  BaseStateCode,
  CountLabel,
  MatrixCellAccumulator,
  OutsCount,
  ParsedPbpHalfInning,
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
  };
}
