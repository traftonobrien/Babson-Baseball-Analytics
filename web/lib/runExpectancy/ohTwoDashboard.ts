/**
 * 0-2 Run Expectancy Dashboard — Phase 24
 *
 * Reads the static RE matrix (if it exists) and extracts the PBP-driven
 * season summary used by the /charting/ohtwo coaching dashboard:
 *   - State-weighted 0-2 RE tree across all mapped 2026 PBP games
 *   - Out-probability deltas where the post-state is still in-count
 *   - Counterfactual scenarios using real 0-2 ball counts from PBP
 *
 * All reads are wrapped in try/catch so the dashboard degrades gracefully
 * when the matrix file has not been generated yet.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CountProgressionSummary,
  OhTwoBallComparisonFile,
  ReMatrixFile,
} from "./types";

// ---------------------------------------------------------------------------
// Static file paths
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), "public/data/run-expectancy");
const MATRIX_PATH = join(DATA_DIR, "re-matrix-newmac-2026.json");
const BALL_COMPARISON_PATH = join(DATA_DIR, "ohtwo-ball-comparison-2026.json");

// ---------------------------------------------------------------------------
// RE tree output types
// ---------------------------------------------------------------------------

export type OhTwoBranch = "strikeout" | "ball" | "inPlay";

export interface OhTwoReBranch {
  branch: OhTwoBranch;
  label: string;
  n: number;
  /** State label shown in the tree node (e.g., "Outs +1, same bases") */
  nextStateLabel: string;
  /** RE288 value at the state before this outcome (the 0-2 pre-state) */
  preRe: number | null;
  /** RE value at the state after this outcome */
  postRe: number | null;
  /** postRe - preRe (negative = pitcher helped) */
  reDelta: number | null;
  deltaRangeMin: number | null;
  deltaRangeMax: number | null;
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
  count: "0-2";
  totalObserved: number;
  baselineRe: number | null;
  baselineOutProb: number | null;
  branches: OhTwoReBranch[];
  stateMix: CountProgressionSummary["stateMix"];
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
  /** Number of Babson 0-2 balls being graded by the reference matrix */
  totalBalls: number;
  /** RE delta for the strikeout branch */
  deltaReK: number | null;
  /** RE delta for the ball branch */
  deltaReBall: number | null;
  valuePerConversion: number | null;
  referenceDeltaOnBabsonStates: number | null;
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

function loadBallComparisonSafe(): OhTwoBallComparisonFile | null {
  try {
    const raw = readFileSync(BALL_COMPARISON_PATH, "utf-8");
    return JSON.parse(raw) as OhTwoBallComparisonFile;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Summary adapter
// ---------------------------------------------------------------------------

function adaptTree(summary: CountProgressionSummary): OhTwoReTree {
  return {
    count: "0-2",
    totalObserved: summary.totalObserved,
    baselineRe: summary.baselineRe,
    baselineOutProb: summary.baselineOutProb,
    stateMix: summary.stateMix,
    branches: summary.branches.map((branch) => ({
      branch: branch.branch,
      label: branch.label,
      n: branch.n,
      nextStateLabel: branch.nextStateLabel,
      preRe: branch.preRe,
      postRe: branch.postRe,
      reDelta: branch.reDelta,
      deltaRangeMin: branch.deltaRangeMin,
      deltaRangeMax: branch.deltaRangeMax,
      preOutProb: branch.preOutProb,
      postOutProb: branch.postOutProb,
      outProbDelta: branch.outProbDelta,
      limitedSample: branch.n < 5 || branch.preRe === null || branch.postRe === null,
    })),
  };
}

function adaptCounterfactual(summary: CountProgressionSummary): OhTwoCounterfactual {
  const kBranch = summary.branches.find((branch) => branch.branch === "strikeout");
  const ballBranch = summary.branches.find((branch) => branch.branch === "ball");
  return {
    totalBalls: summary.counterfactual.totalBalls,
    deltaReK: kBranch?.reDelta ?? null,
    deltaReBall: ballBranch?.reDelta ?? null,
    valuePerConversion: summary.counterfactual.valuePerConversion,
    referenceDeltaOnBabsonStates: null,
    scenarios: summary.counterfactual.scenarios.map((scenario) => ({
      ...scenario,
      limitedSample: summary.counterfactual.totalBalls < 5,
    })),
  };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Loads the RE matrix and computes dashboard data for the 0-2 report.
 *
 */
export function loadOhTwoReModel(): OhTwoReModelData {
  const matrix = loadMatrixSafe();
  const comparison = loadBallComparisonSafe();
  const summary = matrix?.countProgression?.ohTwo;

  if (!matrix || !summary || !comparison) {
    return { available: false, tree: null, counterfactual: null };
  }

  const tree = adaptTree(summary);
  const counterfactual = {
    ...adaptCounterfactual(summary),
    totalBalls: comparison.totalBabsonBalls,
    valuePerConversion: comparison.newmacValuePerConversionOnBabsonStates,
    referenceDeltaOnBabsonStates: comparison.newmacWeightedDeltaOnBabsonStates,
    scenarios: adaptCounterfactual(summary).scenarios.map((scenario) => ({
      ...scenario,
      ballsConverted: Math.round((scenario.conversionPct / 100) * comparison.totalBabsonBalls),
      runsImprovement:
        comparison.newmacValuePerConversionOnBabsonStates !== null
          ? comparison.newmacValuePerConversionOnBabsonStates *
            Math.round((scenario.conversionPct / 100) * comparison.totalBabsonBalls)
          : null,
      limitedSample: comparison.totalBabsonBalls < 5,
    })),
  };

  return { available: true, tree, counterfactual };
}
