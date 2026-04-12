/**
 * 0-2 Fastball Run Expectancy Dashboard — Phase 24
 *
 * Reads the static RE matrix (if it exists) and computes RE-model values for
 * the /charting/ohtwo coaching dashboard:
 *   - Count-progression RE tree: K / ball / in-play branches after 0-2
 *   - Out-probability delta for each branch
 *   - Counterfactual scenarios: "X% of balls become Ks → Y runs saved"
 *
 * All reads are wrapped in try/catch so the dashboard degrades gracefully
 * when the matrix file has not been generated yet.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  BaseStateCode,
  CountLabel,
  OutsCount,
  RE288Cell,
  RE24Cell,
  ReMatrixFile,
} from "./types";
import { buildMatrixLookups, lookupRe288, lookupRe24 } from "./deltaRe";

// ---------------------------------------------------------------------------
// Static file paths
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), "public/data/run-expectancy");
const MATRIX_PATH = join(DATA_DIR, "re-matrix-2026.json");

// ---------------------------------------------------------------------------
// RE tree output types
// ---------------------------------------------------------------------------

export type OhTwoBranch = "strikeout" | "ball" | "inPlay";

export interface OhTwoReBranch {
  branch: OhTwoBranch;
  label: string;
  /** State label shown in the tree node (e.g., "Outs +1, same bases") */
  nextStateLabel: string;
  /** RE288 value at the state before this outcome (the 0-2 pre-state) */
  preRe: number | null;
  /** RE value at the state after this outcome */
  postRe: number | null;
  /** postRe - preRe (negative = pitcher helped) */
  reDelta: number | null;
  /** Out probability at the 0-2 state */
  preOutProb: number | null;
  /** Out probability after this outcome (null for in-play — no clean post-state) */
  postOutProb: number | null;
  /** outProb post - outProb pre */
  outProbDelta: number | null;
  /** true when any cell driving this value had n < minObs */
  limitedSample: boolean;
}

export interface OhTwoReTree {
  /** The reference base state used for the tree computation */
  referenceBaseState: BaseStateCode;
  referenceOuts: OutsCount;
  /** RE288 at (0-2, referenceBaseState, referenceOuts) */
  baselineRe: number | null;
  baselineOutProb: number | null;
  branches: OhTwoReBranch[];
}

// ---------------------------------------------------------------------------
// Counterfactual scenario
// ---------------------------------------------------------------------------

export interface OhTwoCounterfactualScenario {
  /** Percentage of balls that are hypothetically converted to strikeouts */
  conversionPct: number;
  /** Number of balls that would be converted */
  ballsConverted: number;
  /** Estimated run-value improvement (positive = runs prevented) */
  runsImprovement: number | null;
  limitedSample: boolean;
}

export interface OhTwoCounterfactual {
  /** Number of ball outcomes in the charting data */
  totalBalls: number;
  /** delta_re_K (strikeout branch, reference state) */
  deltaReK: number | null;
  /** delta_re_ball (ball branch, 1-2 count reference) */
  deltaReBall: number | null;
  /**
   * Run value saved per converted ball = delta_re_ball - delta_re_K
   * Positive means each K converted from a ball saves this many expected runs.
   */
  valuePerConversion: number | null;
  scenarios: OhTwoCounterfactualScenario[];
}

// ---------------------------------------------------------------------------
// Full dashboard data shape
// ---------------------------------------------------------------------------

export interface OhTwoReModelData {
  /** false when the matrix file does not exist or cannot be read */
  available: boolean;
  tree: OhTwoReTree | null;
  counterfactual: OhTwoCounterfactual | null;
}

// ---------------------------------------------------------------------------
// Matrix loader (safe — returns null on any failure)
// ---------------------------------------------------------------------------

function loadMatrixSafe(): ReMatrixFile | null {
  try {
    const raw = readFileSync(MATRIX_PATH, "utf-8");
    return JSON.parse(raw) as ReMatrixFile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// RE tree builder
// ---------------------------------------------------------------------------

const PRESET_COUNTERFACTUAL_PCTS = [25, 50, 75] as const;

function buildReTree(
  re24: Map<string, RE24Cell>,
  re288: Map<string, RE288Cell>,
): OhTwoReTree {
  // Use bases empty, 0 outs as the reference state — most common lead-off PA shape
  const refBs: BaseStateCode = "000";
  const refOuts: OutsCount = 0;

  const baselineRe = lookupRe288(re288, "0-2", refBs, refOuts);
  const baselineOutProb =
    re288.get(`0-2|${refBs}|${refOuts}`)?.outProb ?? null;

  // K branch: outs+1, same bases, PA over → use RE24
  const kPostRe = lookupRe24(re24, refBs, (refOuts + 1) as OutsCount);
  const kReDelta =
    kPostRe !== null && baselineRe !== null ? kPostRe - baselineRe : null;
  const kOutProb =
    re288.get(`0-2|${refBs}|${(refOuts + 1) as OutsCount}`)?.outProb ?? null;
  const kOutProbDelta =
    kOutProb !== null && baselineOutProb !== null
      ? kOutProb - baselineOutProb
      : null;

  // Ball branch: count goes to 1-2, same bases, same outs → use RE288("1-2")
  const ballPostRe = lookupRe288(re288, "1-2", refBs, refOuts);
  const ballReDelta =
    ballPostRe !== null && baselineRe !== null
      ? ballPostRe - baselineRe
      : null;
  const ballOutProb = re288.get(`1-2|${refBs}|${refOuts}`)?.outProb ?? null;
  const ballOutProbDelta =
    ballOutProb !== null && baselineOutProb !== null
      ? ballOutProb - baselineOutProb
      : null;

  // In-play branch: mixed outcome — use RE24 at same outs (avg across possible results)
  // A ball in play that doesn't result in an out leaves outs unchanged.
  // We show RE24(bases, outs) as the approximate continuation value.
  const inPlayPostRe = lookupRe24(re24, refBs, refOuts);
  const inPlayReDelta =
    inPlayPostRe !== null && baselineRe !== null
      ? inPlayPostRe - baselineRe
      : null;

  const branches: OhTwoReBranch[] = [
    {
      branch: "strikeout",
      label: "Strikeout",
      nextStateLabel: `Outs +1 (${refOuts + 1} out${refOuts + 1 !== 1 ? "s" : ""})`,
      preRe: baselineRe,
      postRe: kPostRe,
      reDelta: kReDelta,
      preOutProb: baselineOutProb,
      postOutProb: kOutProb,
      outProbDelta: kOutProbDelta,
      limitedSample: kPostRe === null || baselineRe === null,
    },
    {
      branch: "ball",
      label: "Ball (→ 1-2)",
      nextStateLabel: "Count 1-2, same bases/outs",
      preRe: baselineRe,
      postRe: ballPostRe,
      reDelta: ballReDelta,
      preOutProb: baselineOutProb,
      postOutProb: ballOutProb,
      outProbDelta: ballOutProbDelta,
      limitedSample: ballPostRe === null || baselineRe === null,
    },
    {
      branch: "inPlay",
      label: "In Play (average)",
      nextStateLabel: "Ball in play — mixed outcomes",
      preRe: baselineRe,
      postRe: inPlayPostRe,
      reDelta: inPlayReDelta,
      preOutProb: baselineOutProb,
      postOutProb: null,
      outProbDelta: null,
      limitedSample: inPlayPostRe === null || baselineRe === null,
    },
  ];

  return {
    referenceBaseState: refBs,
    referenceOuts: refOuts,
    baselineRe,
    baselineOutProb,
    branches,
  };
}

// ---------------------------------------------------------------------------
// Counterfactual builder
// ---------------------------------------------------------------------------

function buildCounterfactual(
  tree: OhTwoReTree,
  totalBalls: number,
): OhTwoCounterfactual {
  const kBranch = tree.branches.find((b) => b.branch === "strikeout");
  const ballBranch = tree.branches.find((b) => b.branch === "ball");

  const deltaReK = kBranch?.reDelta ?? null;
  const deltaReBall = ballBranch?.reDelta ?? null;

  // Per-conversion value: how much run expectancy is improved by converting one
  // ball to a strikeout. Using reference state (bases empty, 0 outs).
  const valuePerConversion =
    deltaReK !== null && deltaReBall !== null
      ? deltaReBall - deltaReK // ball adds runs, K reduces — positive = saves runs
      : null;

  const limitedSample = kBranch?.limitedSample || ballBranch?.limitedSample || false;

  const scenarios: OhTwoCounterfactualScenario[] = PRESET_COUNTERFACTUAL_PCTS.map(
    (pct) => {
      const ballsConverted = Math.round((pct / 100) * totalBalls);
      return {
        conversionPct: pct,
        ballsConverted,
        runsImprovement:
          valuePerConversion !== null
            ? valuePerConversion * ballsConverted
            : null,
        limitedSample,
      };
    },
  );

  return {
    totalBalls,
    deltaReK,
    deltaReBall,
    valuePerConversion,
    scenarios,
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Loads the RE matrix and computes dashboard data for the 0-2 report.
 *
 * @param totalBalls - Number of ball outcomes in the charting data (from pitchResults.ball).
 */
export function loadOhTwoReModel(totalBalls: number): OhTwoReModelData {
  const matrix = loadMatrixSafe();
  if (!matrix) {
    return { available: false, tree: null, counterfactual: null };
  }

  const { re24, re288 } = buildMatrixLookups(matrix);
  const tree = buildReTree(re24, re288);
  const counterfactual = buildCounterfactual(tree, totalBalls);

  return { available: true, tree, counterfactual };
}
