/**
 * Leaderboard metrics engine.
 *
 * Pure functions that compute KPIs directly from pitch arrays.
 * Does NOT call buildReport() — uses only constants and small helpers
 * from reportModel and handedness.
 */

import type { Pitch } from "@/app/types";
import {
  isOnTarget,
  isOutlier,
} from "@/lib/reportModel";
import { pitchArmSideX } from "@/lib/handedness";
import {
  computeCommandPlus,
  type CommandPlusBaselines,
} from "@/lib/commandPlus";
import type { OutingKpis } from "./types";
import type { PitchGroup } from "./pitchGroups";
import { pitchMatchesGroup } from "./pitchGroups";

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sqDiffs = vals.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (vals.length - 1));
}

export interface ComputeOptions {
  pitchGroup?: PitchGroup;
}

export function filterPitchesForKpis(
  pitches: Pitch[],
  options?: ComputeOptions,
): Pitch[] {
  const group = options?.pitchGroup ?? "ALL";
  return (group === "ALL"
    ? pitches
    : pitches.filter((p) => pitchMatchesGroup(p.pitch_type, group))
  ).filter((p) => Number.isFinite(p.total_miss_inches));
}

/**
 * Compute leaderboard KPIs for a set of pitches.
 * Optionally filters by pitch group before computing.
 * Includes ALL pitches (outliers are counted, not excluded).
 */
export function computeOutingKpis(
  pitches: Pitch[],
  pitcherHand: "R" | "L",
  baselines: CommandPlusBaselines | null,
  options?: ComputeOptions,
): OutingKpis {
  const filtered = filterPitchesForKpis(pitches, options);

  const n = filtered.length;
  if (n === 0) {
    return {
      pitchCount: 0,
      onTargetCount: 0,
      outlierCount: 0,
      totalMissSum: 0,
      totalVAbsSum: 0,
      totalHAbsSum: 0,
      misses: [],
      onTargetPct: 0,
      outlierPct: 0,
      avgMissIn: 0,
      avgVAbsIn: 0,
      avgHAbsIn: 0,
      consistencyStdIn: 0,
      commandPlus: null,
    };
  }

  let onTargetCount = 0;
  let outlierCount = 0;
  let totalMissSum = 0;
  let totalVAbsSum = 0;
  let totalHAbsSum = 0;
  const misses: number[] = [];

  for (const p of filtered) {
    const miss = p.total_miss_inches;
    misses.push(miss);
    totalMissSum += miss;
    totalVAbsSum += Math.abs(p.v_miss_signed);
    totalHAbsSum += Math.abs(pitchArmSideX(p, pitcherHand));
    if (isOnTarget(p)) onTargetCount++;
    if (isOutlier(p)) outlierCount++;
  }

  const commandPlus = baselines
    ? computeCommandPlus(filtered, baselines).overall
    : null;

  return {
    pitchCount: n,
    onTargetCount,
    outlierCount,
    totalMissSum,
    totalVAbsSum,
    totalHAbsSum,
    misses,
    onTargetPct: (onTargetCount / n) * 100,
    outlierPct: (outlierCount / n) * 100,
    avgMissIn: totalMissSum / n,
    avgVAbsIn: totalVAbsSum / n,
    avgHAbsIn: totalHAbsSum / n,
    consistencyStdIn: stdDev(misses),
    commandPlus,
  };
}

/**
 * Merge multiple OutingKpis into a single weighted-average row
 * (for pitcher-season aggregation). Weights by pitch count.
 */
export function mergeKpis(kpisList: OutingKpis[]): OutingKpis {
  const allMisses: number[] = [];
  let totalPitches = 0;
  let totalOnTarget = 0;
  let totalOutlier = 0;
  let totalMissSum = 0;
  let totalVAbsSum = 0;
  let totalHAbsSum = 0;

  for (const k of kpisList) {
    totalPitches += k.pitchCount;
    totalOnTarget += k.onTargetCount;
    totalOutlier += k.outlierCount;
    totalMissSum += k.totalMissSum;
    totalVAbsSum += k.totalVAbsSum;
    totalHAbsSum += k.totalHAbsSum;
    allMisses.push(...k.misses);
  }

  if (totalPitches === 0) {
    return {
      pitchCount: 0,
      onTargetCount: 0,
      outlierCount: 0,
      totalMissSum: 0,
      totalVAbsSum: 0,
      totalHAbsSum: 0,
      misses: [],
      onTargetPct: 0,
      outlierPct: 0,
      avgMissIn: 0,
      avgVAbsIn: 0,
      avgHAbsIn: 0,
      consistencyStdIn: 0,
      commandPlus: null,
    };
  }

  return {
    pitchCount: totalPitches,
    onTargetCount: totalOnTarget,
    outlierCount: totalOutlier,
    totalMissSum,
    totalVAbsSum,
    totalHAbsSum,
    misses: allMisses,
    onTargetPct: (totalOnTarget / totalPitches) * 100,
    outlierPct: (totalOutlier / totalPitches) * 100,
    avgMissIn: totalMissSum / totalPitches,
    avgVAbsIn: totalVAbsSum / totalPitches,
    avgHAbsIn: totalHAbsSum / totalPitches,
    consistencyStdIn: stdDev(allMisses),
    commandPlus: kpisList.length === 1 ? kpisList[0].commandPlus : null,
  };
}
