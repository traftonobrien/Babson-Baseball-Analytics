/**
 * Delta-RE computation — Phase 23-02.
 *
 * Provides functions to:
 *   1. Load the RE288 matrix from the static JSON file.
 *   2. Look up RE values by (count, baseState, outs) cell.
 *   3. Compute delta_re = RE(post) - RE(pre) + runs_scored.
 *   4. Join charted 0-2 fastball PAs to the game-base-states index.
 *
 * Sign convention (hand-verified in 23-03):
 *   delta_re > 0  → pitcher hurt the team (allowed run expectancy to increase)
 *   delta_re < 0  → pitcher helped the team (reduced run expectancy)
 *
 * For a strikeout at 0-2 with bases empty and 0 outs:
 *   pre  = RE288("0-2", "000", 0)  — some positive value
 *   post = RE288 after 1 out, same bases, count resets — but outs_after = 1,
 *          and since the PA is over, we use RE24(base_after, outs_after) as
 *          the post value (no count context between PAs).
 *   delta_re = RE24(base_after, outs_after) - RE288(pre) + 0 runs
 *           = small value - larger value = negative → pitcher helped ✓
 */

import type {
  BaseStateCode,
  CountLabel,
  GameBaseStatesIndex,
  OutsCount,
  PaBaseStateRecord,
  RE288Cell,
  RE24Cell,
  ReMatrixFile,
} from "./types";
import { buildPaLookupMap, makePaLookupKey } from "./gameBaseStates";
import type { HalfInningSide } from "./types";

// ---------------------------------------------------------------------------
// Matrix lookup helpers
// ---------------------------------------------------------------------------

/**
 * Builds O(1) lookup maps for RE24 and RE288 cells from the matrix file.
 */
export function buildMatrixLookups(matrix: ReMatrixFile): {
  re24: Map<string, RE24Cell>;
  re288: Map<string, RE288Cell>;
} {
  const re24 = new Map<string, RE24Cell>();
  for (const cell of matrix.re24) {
    re24.set(`${cell.baseState}-${cell.outs}`, cell);
  }

  const re288 = new Map<string, RE288Cell>();
  for (const cell of matrix.re288) {
    re288.set(`${cell.count}|${cell.baseState}|${cell.outs}`, cell);
  }

  return { re24, re288 };
}

export function lookupRe24(
  map: Map<string, RE24Cell>,
  baseState: BaseStateCode,
  outs: OutsCount,
): number | null {
  return map.get(`${baseState}-${outs}`)?.meanRe ?? null;
}

export function lookupRe288(
  map: Map<string, RE288Cell>,
  count: CountLabel,
  baseState: BaseStateCode,
  outs: OutsCount,
): number | null {
  return map.get(`${count}|${baseState}|${outs}`)?.meanRe ?? null;
}

// ---------------------------------------------------------------------------
// PA match result
// ---------------------------------------------------------------------------

export type DeltaReMatchResult =
  | { matched: true; deltaRe: number; preRe: number; postRe: number; pa: PaBaseStateRecord }
  | { matched: false; reason: string };

/**
 * A charted 0-2 fastball PA that needs delta-RE resolution.
 * The charting system provides (gameId, inning, halfInning, paIndex) to
 * identify which PA in the base-states index this corresponds to.
 */
export interface ChartedPaLocator {
  /** Sidearm game ID from re_game_map.json. */
  gameId: string;
  inning: number;
  halfInning: HalfInningSide;
  /** 0-based PA index within the half-inning (matches paIndex in base-states index). */
  paIndex: number;
}

/**
 * Computes delta_re for a charted PA by joining to the base-states index and
 * the RE matrix.
 *
 * For the PRE state, we use RE288(preCount, baseStateBefore, outsBefore).
 * For the POST state, we use RE24(baseStateAfter, outsAfter) because the PA
 * is complete and the next count resets — there is no "between-PA count."
 *
 * If the PA resulted in 3 outs (end of half-inning), post RE = 0 by definition.
 *
 * @param locator - Chart-system PA identifier.
 * @param preCount - The count before the terminal pitch (e.g., "0-2" for a 0-2 fastball).
 * @param paLookup - Map built by buildPaLookupMap().
 * @param re24 - RE24 lookup map from buildMatrixLookups().
 * @param re288 - RE288 lookup map from buildMatrixLookups().
 */
export function computeDeltaRe(
  locator: ChartedPaLocator,
  preCount: CountLabel,
  paLookup: Map<string, PaBaseStateRecord>,
  re24: Map<string, RE24Cell>,
  re288: Map<string, RE288Cell>,
): DeltaReMatchResult {
  const key = makePaLookupKey(
    locator.gameId,
    locator.inning,
    locator.halfInning,
    locator.paIndex,
  );
  const pa = paLookup.get(key);

  if (!pa) {
    return { matched: false, reason: `No PA found for key ${key}` };
  }

  // Pre-state: RE288 at the count before the 0-2 pitch
  const preRe = lookupRe288(re288, preCount, pa.baseStateBefore, pa.outsBefore);
  if (preRe === null) {
    return {
      matched: false,
      reason: `RE288(${preCount}, ${pa.baseStateBefore}, ${pa.outsBefore}) is null (n < min)`,
    };
  }

  // Post-state: RE24 at the state after the PA
  // When outsAfter === 3, the half-inning ended — post RE = 0.
  let postRe: number;
  if (pa.outsAfter >= 3) {
    postRe = 0;
  } else {
    const looked = lookupRe24(re24, pa.baseStateAfter, pa.outsAfter as OutsCount);
    if (looked === null) {
      return {
        matched: false,
        reason: `RE24(${pa.baseStateAfter}, ${pa.outsAfter}) is null (n < min)`,
      };
    }
    postRe = looked;
  }

  const deltaRe = postRe - preRe + pa.runsScored;

  return { matched: true, deltaRe, preRe, postRe, pa };
}

// ---------------------------------------------------------------------------
// Batch join (used in dashboard and 23-03 match-rate validation)
// ---------------------------------------------------------------------------

export interface BatchJoinResult {
  matched: DeltaReMatchResult & { matched: true };
  locator: ChartedPaLocator;
}

export interface BatchJoinSummary {
  results: Array<{
    locator: ChartedPaLocator;
    result: DeltaReMatchResult;
  }>;
  matchedCount: number;
  unmatchedCount: number;
  matchRate: number;
  totalDeltaRe: number;
  averageDeltaRe: number | null;
  unmatchedReasons: Record<string, number>;
}

/**
 * Joins a list of charted PA locators to the base-states index and computes
 * delta-RE for each. Returns a summary with match rate and aggregate delta-RE.
 */
export function batchComputeDeltaRe(
  locators: ChartedPaLocator[],
  preCount: CountLabel,
  paLookup: Map<string, PaBaseStateRecord>,
  re24: Map<string, RE24Cell>,
  re288: Map<string, RE288Cell>,
): BatchJoinSummary {
  const results: BatchJoinSummary["results"] = [];
  const unmatchedReasons: Record<string, number> = {};
  let matchedCount = 0;
  let totalDeltaRe = 0;

  for (const locator of locators) {
    const result = computeDeltaRe(locator, preCount, paLookup, re24, re288);
    results.push({ locator, result });

    if (result.matched) {
      matchedCount++;
      totalDeltaRe += result.deltaRe;
    } else {
      unmatchedReasons[result.reason] = (unmatchedReasons[result.reason] ?? 0) + 1;
    }
  }

  const unmatchedCount = locators.length - matchedCount;
  const matchRate =
    locators.length > 0 ? matchedCount / locators.length : 0;

  return {
    results,
    matchedCount,
    unmatchedCount,
    matchRate,
    totalDeltaRe,
    averageDeltaRe: matchedCount > 0 ? totalDeltaRe / matchedCount : null,
    unmatchedReasons,
  };
}
