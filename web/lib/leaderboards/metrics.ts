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
import type { OutingKpis } from "./types";
import type { PitchGroup } from "./pitchGroups";
import { pitchMatchesGroup } from "./pitchGroups";
import { globalTeamAvgMiss } from "./load";

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const sqDiffs = vals.map((v) => (v - mean) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (vals.length - 1));
}

export interface ComputeOptions {
  pitchGroup?: PitchGroup;
}

/**
 * Compute leaderboard KPIs for a set of pitches.
 * Optionally filters by pitch group before computing.
 * Includes ALL pitches (outliers are counted, not excluded).
 */
export function computeOutingKpis(
  pitches: Pitch[],
  pitcherHand: "R" | "L",
  season: number,
  options?: ComputeOptions,
): OutingKpis {
  const group = options?.pitchGroup ?? "ALL";
  const filtered = (group === "ALL"
    ? pitches
    : pitches.filter((p) => pitchMatchesGroup(p.pitch_type, group))
  ).filter((p) => Number.isFinite(p.total_miss_inches));

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
      commandPlus: 100,
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

  // Calculate weighted Command+ for the outing
  // Overall_Command+ = Sum(Pitch_Command+ * Pitch_Usage_%)
  let commandPlusSum = 0;
  const commandPlusScores: number[] = [];

  // Group by pitch type for Command+
  const pitchTypes = Array.from(new Set(filtered.map(p => p.pitch_type).filter(Boolean))) as string[];
  for (const pt of pitchTypes) {
    const ptPitches = filtered.filter(p => p.pitch_type === pt);
    if (ptPitches.length === 0) continue;

    // Team avg miss for this pitch type derived from the season, fallback to 15.0 if unknown
    const teamAvg = globalTeamAvgMiss[season]?.[pt] || 15.0;

    // Player avg miss for this pitch type
    const ptAvgMiss = ptPitches.reduce((sum, p) => sum + p.total_miss_inches, 0) / ptPitches.length;

    if (ptAvgMiss > 0) {
      const pCommandPlus = (teamAvg / ptAvgMiss) * 100;
      const usagePct = ptPitches.length / n;
      commandPlusSum += pCommandPlus * usagePct;
    }
  }

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
    commandPlus: commandPlusSum || 100,
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
      commandPlus: 100,
    };
  }

  // Calculate weighted Command+ for the aggregated player row
  // For aggregate, we must rebuild the pitch types array to get usage% over all outings,
  // but we aren't storing pitch_types in OutingKpis. For a true usage-weighted calc,
  // we would need all pitches, which breaks the pre-computed KPI model.
  // Approximation: average the Outing 'commandPlus' weighted by pitch count.
  let commandPlusSum = 0;
  for (const k of kpisList) {
    commandPlusSum += k.commandPlus * k.pitchCount;
  }
  const aggCommandPlus = commandPlusSum / totalPitches;

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
    commandPlus: aggCommandPlus || 100,
  };
}
