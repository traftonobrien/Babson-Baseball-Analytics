import type { Pitch } from "@/app/types";
import type { Outing } from "@/lib/dataIndex";
import {
  type Report,
  type PitchTypeSummary,
  type LaneDetailed,
  isOutlier,
  buildReport,
} from "@/lib/reportModel";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface PitchSelection {
  playerId: string;
  outingId: string | null;
  pitchNumberMin?: number;
  pitchNumberMax?: number;
  pitchTypes?: string[];
  lanes?: string[];
}

export interface ComparisonReport {
  reportA: Report;
  reportB: Report;
  delta: {
    avgMiss: number;
    medianMiss: number;
    onTargetPct: number;
    outlierCount: number;
    includedCount: number;
    totalCount: number;
  };
  pitchTypeComparison: Array<{
    pitchType: string;
    sideA: PitchTypeSummary | null;
    sideB: PitchTypeSummary | null;
    deltaAvgMiss: number | null;
  }>;
  laneComparison: Array<{
    lane: string;
    sideA: LaneDetailed | null;
    sideB: LaneDetailed | null;
    deltaAvgMiss: number | null;
    deltaOnTargetPct: number | null;
  }>;
  pitcherHand: string;
  selectionA: PitchSelection;
  selectionB: PitchSelection;
}

/* ------------------------------------------------------------------ */
/*  applyPitchSelection                                                */
/* ------------------------------------------------------------------ */

export function applyPitchSelection(
  pitches: Pitch[],
  _selection: PitchSelection,
  excludeOutliers: boolean,
): { selected: Pitch[]; outlierCount: number; totalCount: number } {
  const totalCount = pitches.length;
  // MVP: only excludeOutliers is processed. pitchNumberMin/max, pitchTypes,
  // lanes are Phase 2 and intentionally ignored.
  const selected = excludeOutliers
    ? pitches.filter((p) => !isOutlier(p))
    : pitches;
  const outlierCount = totalCount - selected.length;
  return { selected, outlierCount, totalCount };
}

/* ------------------------------------------------------------------ */
/*  buildComparisonReport                                              */
/* ------------------------------------------------------------------ */

export function buildComparisonReport(
  reportA: Report,
  reportB: Report,
  selectionA: PitchSelection,
  selectionB: PitchSelection,
): ComparisonReport {
  // Validate pitcher hand: only block if both sides have pitches and hands differ
  const handA = reportA.meta.pitcherHand;
  const handB = reportB.meta.pitcherHand;
  if (
    reportA.meta.totalPitches > 0 &&
    reportB.meta.totalPitches > 0 &&
    handA && handB &&
    handA !== handB
  ) {
    throw new Error("Pitcher hand mismatch");
  }

  // Delta summary (A - B)
  const delta = {
    avgMiss: reportA.kpis.avgMiss - reportB.kpis.avgMiss,
    medianMiss: reportA.kpis.medianMiss - reportB.kpis.medianMiss,
    onTargetPct: reportA.kpis.hitSpotPct - reportB.kpis.hitSpotPct,
    outlierCount: reportA.meta.outlierCount - reportB.meta.outlierCount,
    includedCount: reportA.meta.includedPitchCount - reportB.meta.includedPitchCount,
    totalCount: reportA.meta.totalPitches - reportB.meta.totalPitches,
  };

  // Pitch type comparison: union of both sides
  const allTypes = new Set<string>();
  for (const pt of reportA.perPitchType) allTypes.add(pt.pitchType);
  for (const pt of reportB.perPitchType) allTypes.add(pt.pitchType);

  const ptMapA = new Map(reportA.perPitchType.map((pt) => [pt.pitchType, pt]));
  const ptMapB = new Map(reportB.perPitchType.map((pt) => [pt.pitchType, pt]));

  // Sort by total count descending
  const pitchTypeComparison = [...allTypes]
    .map((pitchType) => {
      const sideA = ptMapA.get(pitchType) ?? null;
      const sideB = ptMapB.get(pitchType) ?? null;
      const deltaAvgMiss =
        sideA && sideB ? sideA.avgMiss - sideB.avgMiss : null;
      return { pitchType, sideA, sideB, deltaAvgMiss };
    })
    .sort((a, b) => {
      const countA = (a.sideA?.count ?? 0) + (a.sideB?.count ?? 0);
      const countB = (b.sideA?.count ?? 0) + (b.sideB?.count ?? 0);
      return countB - countA;
    });

  // Lane comparison: always Glove, Middle, Arm
  const laneMapA = new Map(reportA.lanesDetailed.map((l) => [l.lane, l]));
  const laneMapB = new Map(reportB.lanesDetailed.map((l) => [l.lane, l]));

  const laneComparison = ["Glove", "Middle", "Arm"].map((lane) => {
    const sideA = laneMapA.get(lane) ?? null;
    const sideB = laneMapB.get(lane) ?? null;
    const deltaAvgMiss =
      sideA && sideB ? sideA.avgMiss - sideB.avgMiss : null;
    const deltaOnTargetPct =
      sideA && sideB ? sideA.onTargetPct - sideB.onTargetPct : null;
    return { lane, sideA, sideB, deltaAvgMiss, deltaOnTargetPct };
  });

  const pitcherHand = handA || handB || "R";

  return {
    reportA,
    reportB,
    delta,
    pitchTypeComparison,
    laneComparison,
    pitcherHand,
    selectionA,
    selectionB,
  };
}

/* ------------------------------------------------------------------ */
/*  Query param parsing / serialization                                */
/* ------------------------------------------------------------------ */

export function parseComparisonQueryParams(
  searchParams: URLSearchParams,
  playerId: string,
  availableOutings: Outing[],
): {
  selectionA: PitchSelection;
  selectionB: PitchSelection;
  excludeOutliers: boolean;
} {
  const outingIds = new Set(availableOutings.map((o) => o.id));

  const rawA = searchParams.get("outingA");
  const rawB = searchParams.get("outingB");

  const outingA = rawA && outingIds.has(rawA) ? rawA : (availableOutings[0]?.id ?? null);
  const outingB = rawB && outingIds.has(rawB) ? rawB : (availableOutings[1]?.id ?? null);

  const excludeOutliers = searchParams.get("excludeOutliers") === "true";

  return {
    selectionA: { playerId, outingId: outingA },
    selectionB: { playerId, outingId: outingB },
    excludeOutliers,
  };
}

export function serializeComparisonQueryParams(
  selectionA: PitchSelection,
  selectionB: PitchSelection,
  excludeOutliers: boolean,
): URLSearchParams {
  const params = new URLSearchParams();
  if (selectionA.outingId) params.set("outingA", selectionA.outingId);
  if (selectionB.outingId) params.set("outingB", selectionB.outingId);
  if (excludeOutliers) params.set("excludeOutliers", "true");
  return params;
}
