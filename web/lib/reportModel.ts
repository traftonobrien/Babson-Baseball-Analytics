import type { Pitch } from "@/app/types";
import { pitchArmSideX, laneOf as classifyLane, laneDisplayName, hDirectionLabel } from "./handedness";

/** Minimum pitch count to qualify for best/worst/tendency analysis. */
const MIN_SAMPLE = 5;

/** Distance threshold (inches) for "on target". */
export const ON_TARGET_THRESHOLD_IN = 8;

/** Pitches with total_miss_inches above this are considered outliers. */
export const OUTLIER_MISS_THRESHOLD_IN = 20;

export function isOutlier(p: Pitch): boolean {
  return Number.isFinite(p.total_miss_inches) && p.total_miss_inches > OUTLIER_MISS_THRESHOLD_IN;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ReportScope = "outing" | "overall";

export interface ReportMeta {
  scope: ReportScope;
  playerName: string;
  pitcherHand: string;
  outingLabel: string;
  totalPitches: number;
  allPitchCount: number;
  includedPitchCount: number;
  outlierCount: number;
  generatedAt: string;
}

export interface KPIs {
  avgMiss: number;
  medianMiss: number;
  stdDev: number;
  hitSpotPct: number;
  bestPitchType: string | null;
  bestPitchAvgMiss: number;
  worstPitchType: string | null;
  worstPitchAvgMiss: number;
}

export interface PitchTypeSummary {
  pitchType: string;
  count: number;
  pct: number;
  avgMiss: number;
  medianMiss: number;
  stdDev: number;
  avgH: number;
  avgV: number;
  avgHAbs: number;
  avgVAbs: number;
  hitSpotPct: number;
  lowSample: boolean;
}

export interface LaneDetailed {
  lane: string;
  count: number;
  usagePct: number;
  onTargetPct: number;
  avgMiss: number;
  avgHAbs: number;
  avgVAbs: number;
  avgHSigned: number;
  avgVSigned: number;
}

export interface HorizontalThirdSummary {
  lane: string; // "Glove" | "Middle" | "Arm"
  count: number;
  pct: number;
  avgMiss: number;
  onTargetPct: number;
  avgHAbs: number;
  avgVAbs: number;
  avgHSigned: number;
  avgVSigned: number;
}

export interface PitchGroupHorizontalCommand {
  label: string; // "Fastball" | "Breaking Ball"
  totalPitches: number;
  lanes: HorizontalThirdSummary[];
  takeaway: string | null;
}

export interface Report {
  meta: ReportMeta;
  kpis: KPIs;
  perPitchType: PitchTypeSummary[];
  lanesDetailed: LaneDetailed[];
  laneTakeaways: string[];
  fastballHorizontalThirds: PitchGroupHorizontalCommand;
  breakingHorizontalThirds: PitchGroupHorizontalCommand;
  trendDirection: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function median(vals: number[]): number {
  if (vals.length === 0) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function avg(vals: number[]): number {
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = avg(vals);
  const sqDiffs = vals.map((v) => (v - m) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (vals.length - 1));
}

export function isOnTarget(p: Pitch): boolean {
  const miss = p.total_miss_inches;
  if (miss == null || isNaN(miss)) return false;
  return miss <= ON_TARGET_THRESHOLD_IN;
}

/**
 * Classify a pitch into a horizontal lane using Arsenals-resolved hand.
 * Derives arm-side-positive value from dx (ball_x - target_x) and
 * pitcherHand. Never reads pitch CSV pitcher_hand.
 */
export function laneOf(p: Pitch, pitcherHand: "R" | "L"): string {
  return classifyLane(pitchArmSideX(p, pitcherHand));
}

const FASTBALL_TYPES = new Set(["FF", "SI", "FC", "FS", "FT"]);
const BREAKING_TYPES = new Set(["SL", "CU", "KC", "SV", "CB"]);

export { laneDisplayName } from "./handedness";

function buildHorizontalThirds(
  pitches: Pitch[],
  label: string,
  pitcherHand: "R" | "L",
): PitchGroupHorizontalCommand {
  const totalPitches = pitches.length;
  const laneMap = new Map<string, Pitch[]>();
  for (const p of pitches) {
    const l = laneOf(p, pitcherHand);
    if (!laneMap.has(l)) laneMap.set(l, []);
    laneMap.get(l)!.push(p);
  }

  const lanes: HorizontalThirdSummary[] = ["Glove", "Middle", "Arm"].map(
    (lane) => {
      const group = laneMap.get(lane) ?? [];
      const hits = group.filter(isOnTarget).length;
      return {
        lane,
        count: group.length,
        pct: totalPitches > 0 ? (group.length / totalPitches) * 100 : 0,
        avgMiss: avg(group.map((p) => p.total_miss_inches)),
        onTargetPct: group.length > 0 ? (hits / group.length) * 100 : 0,
        avgHAbs: avg(group.map((p) => Math.abs(pitchArmSideX(p, pitcherHand)))),
        avgVAbs: avg(group.map((p) => Math.abs(p.v_miss_signed))),
        avgHSigned: avg(group.map((p) => pitchArmSideX(p, pitcherHand))),
        avgVSigned: avg(group.map((p) => p.v_miss_signed)),
      };
    },
  );

  // Takeaway: best/worst by on-target%, tie-break avgMiss; require n>=3
  let takeaway: string | null = null;
  const qual = lanes.filter((l) => l.count >= 3);
  if (qual.length >= 2) {
    const best = [...qual].sort(
      (a, b) => b.onTargetPct - a.onTargetPct || a.avgMiss - b.avgMiss,
    )[0];
    const worst = [...qual].sort(
      (a, b) => a.onTargetPct - b.onTargetPct || b.avgMiss - a.avgMiss,
    )[0];
    if (best.lane !== worst.lane) {
      const wParts: string[] = [];
      if (Math.abs(worst.avgHSigned) > 1.0)
        wParts.push(hDirectionLabel(worst.avgHSigned));
      if (Math.abs(worst.avgVSigned) > 1.0)
        wParts.push(worst.avgVSigned < 0 ? "high" : "low");
      const bestDisplay = laneDisplayName(best.lane, pitcherHand).toLowerCase();
      const worstDisplay = laneDisplayName(worst.lane, pitcherHand).toLowerCase();
      const trendNote = wParts.length > 0
        ? ` Misses trend ${wParts.join(" and ")} when targeting ${worstDisplay}.`
        : "";
      takeaway = `Best ${label.toLowerCase()} command: ${bestDisplay} (${best.avgMiss.toFixed(1)}″, ${best.onTargetPct.toFixed(0)}% on target). Worst: ${worstDisplay} (${worst.avgMiss.toFixed(1)}″, ${worst.onTargetPct.toFixed(0)}%).${trendNote}`;
    }
  }

  return { label, totalPitches, lanes, takeaway };
}

/* ------------------------------------------------------------------ */
/*  Main builder                                                       */
/* ------------------------------------------------------------------ */

export interface BuildReportOptions {
  excludeOutliers?: boolean;
}

export function buildReport(
  pitches: Pitch[],
  playerName: string,
  outingLabel: string,
  pitcherHand: "R" | "L",
  scope: ReportScope = "outing",
  options?: BuildReportOptions,
): Report {
  const allPitches = pitches;
  const allPitchCount = allPitches.length;
  const excludeOutliers = options?.excludeOutliers ?? false;
  const includedPitches = excludeOutliers
    ? allPitches.filter((p) => !isOutlier(p))
    : allPitches;
  const includedPitchCount = includedPitches.length;
  const outlierCount = allPitchCount - includedPitchCount;

  // All downstream computations use includedPitches
  const pitchesForCalc = includedPitches;
  const totalPitches = pitchesForCalc.length;
  const misses = pitchesForCalc.map((p) => p.total_miss_inches);
  const avgMiss = avg(misses);
  const medianMiss = median(misses);
  const missStdDev = stdDev(misses);

  const hitCount = pitchesForCalc.filter(isOnTarget).length;
  const hitSpotPct = totalPitches > 0 ? (hitCount / totalPitches) * 100 : 0;

  /* ---- Per pitch type ---- */
  const typeMap = new Map<string, Pitch[]>();
  for (const p of pitchesForCalc) {
    const t = p.pitch_type || "Unknown";
    if (!typeMap.has(t)) typeMap.set(t, []);
    typeMap.get(t)!.push(p);
  }

  const perPitchType: PitchTypeSummary[] = [...typeMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([pitchType, group]) => {
      const m = group.map((p) => p.total_miss_inches);
      const hits = group.filter(isOnTarget).length;
      return {
        pitchType,
        count: group.length,
        pct: totalPitches > 0 ? (group.length / totalPitches) * 100 : 0,
        avgMiss: avg(m),
        medianMiss: median(m),
        stdDev: stdDev(m),
        avgH: avg(group.map((p) => pitchArmSideX(p, pitcherHand))),
        avgV: avg(group.map((p) => p.v_miss_signed)),
        avgHAbs: avg(group.map((p) => Math.abs(pitchArmSideX(p, pitcherHand)))),
        avgVAbs: avg(group.map((p) => Math.abs(p.v_miss_signed))),
        hitSpotPct: group.length > 0 ? (hits / group.length) * 100 : 0,
        lowSample: group.length < MIN_SAMPLE,
      };
    });

  // Best/worst by avg miss (need >= MIN_SAMPLE)
  const qualified = perPitchType.filter((pt) => !pt.lowSample);
  const sorted = [...qualified].sort((a, b) => a.avgMiss - b.avgMiss);
  const bestPt = sorted[0] ?? null;
  const worstPt = sorted.length > 1 ? sorted[sorted.length - 1] : null;

  /* ---- Lanes (detailed) ---- */
  const laneMap = new Map<string, Pitch[]>();
  for (const p of pitchesForCalc) {
    const l = laneOf(p, pitcherHand);
    if (!laneMap.has(l)) laneMap.set(l, []);
    laneMap.get(l)!.push(p);
  }

  const lanesDetailed: LaneDetailed[] = ["Glove", "Middle", "Arm"].map(
    (lane) => {
      const group = laneMap.get(lane) ?? [];
      const hits = group.filter(isOnTarget).length;
      return {
        lane,
        count: group.length,
        usagePct: totalPitches > 0 ? (group.length / totalPitches) * 100 : 0,
        onTargetPct: group.length > 0 ? (hits / group.length) * 100 : 0,
        avgMiss: avg(group.map((p) => p.total_miss_inches)),
        avgHAbs: avg(group.map((p) => Math.abs(pitchArmSideX(p, pitcherHand)))),
        avgVAbs: avg(group.map((p) => Math.abs(p.v_miss_signed))),
        avgHSigned: avg(group.map((p) => pitchArmSideX(p, pitcherHand))),
        avgVSigned: avg(group.map((p) => p.v_miss_signed)),
      };
    },
  );

  // Lane takeaways — coaching language with arm-side-positive averages
  const laneTakeaways: string[] = [];

  const overallHArmSide = avg(pitchesForCalc.map((p) => pitchArmSideX(p, pitcherHand)));
  const overallVSigned = avg(pitchesForCalc.map((p) => p.v_miss_signed));

  // Best/worst lane: prioritize low avgMiss, then high onTarget; require n>=5
  const qualifiedLanes = lanesDetailed.filter((l) => l.count >= MIN_SAMPLE);
  if (qualifiedLanes.length >= 2) {
    const bestLane = [...qualifiedLanes].sort(
      (a, b) => a.avgMiss - b.avgMiss || b.onTargetPct - a.onTargetPct,
    )[0];
    const worstLane = [...qualifiedLanes].sort(
      (a, b) => b.avgMiss - a.avgMiss || a.onTargetPct - b.onTargetPct,
    )[0];
    if (bestLane.lane !== worstLane.lane) {
      const bestLaneDisplay = laneDisplayName(bestLane.lane, pitcherHand).toLowerCase();
      const worstLaneDisplay = laneDisplayName(worstLane.lane, pitcherHand).toLowerCase();
      laneTakeaways.push(
        `Best command occurs in the ${bestLaneDisplay} lane (${bestLane.avgMiss.toFixed(1)}″ avg miss, ${bestLane.onTargetPct.toFixed(0)}% on target). Significant command loss when working ${worstLaneDisplay} (${worstLane.avgMiss.toFixed(1)}″ avg miss, ${worstLane.onTargetPct.toFixed(0)}% on target).`,
      );
      // Add directional tendency for worst lane (avgHSigned is arm-side-positive)
      const wH = worstLane.avgHSigned;
      const wV = worstLane.avgVSigned;
      const wParts: string[] = [];
      if (Math.abs(wH) > 1.0) wParts.push(hDirectionLabel(wH));
      if (Math.abs(wV) > 1.0) wParts.push(wV < 0 ? "high" : "low");
      if (wParts.length > 0) {
        laneTakeaways.push(
          `Misses trend ${wParts.join(" and ")} when targeting ${worstLaneDisplay}.`,
        );
      }
    }
  }

  /* ---- Fastball / Breaking ball horizontal thirds ---- */
  const fastballs = pitchesForCalc.filter((p) => FASTBALL_TYPES.has((p.pitch_type ?? "").toUpperCase()));
  const breakingBalls = pitchesForCalc.filter((p) => BREAKING_TYPES.has((p.pitch_type ?? "").toUpperCase()));

  const fastballHorizontalThirds = buildHorizontalThirds(fastballs, "Fastball", pitcherHand);
  const breakingHorizontalThirds = buildHorizontalThirds(breakingBalls, "Breaking Ball", pitcherHand);

  /* ---- Trend direction ---- */
  let trendDirection: string | null = null;
  if (totalPitches >= 5) {
    const parts: string[] = [];
    if (Math.abs(overallHArmSide) > 1.0) parts.push(hDirectionLabel(overallHArmSide));
    if (Math.abs(overallVSigned) > 1.0) parts.push(overallVSigned < 0 ? "high" : "low");
    if (parts.length > 0) trendDirection = parts.join(" ");
  }

  return {
    meta: {
      scope,
      playerName,
      pitcherHand,
      outingLabel,
      totalPitches,
      allPitchCount,
      includedPitchCount,
      outlierCount,
      generatedAt: new Date().toISOString(),
    },
    kpis: {
      avgMiss,
      medianMiss,
      stdDev: missStdDev,
      hitSpotPct,
      bestPitchType: bestPt?.pitchType ?? null,
      bestPitchAvgMiss: bestPt?.avgMiss ?? 0,
      worstPitchType: worstPt?.pitchType ?? null,
      worstPitchAvgMiss: worstPt?.avgMiss ?? 0,
    },
    perPitchType,
    lanesDetailed,
    laneTakeaways,
    fastballHorizontalThirds,
    breakingHorizontalThirds,
    trendDirection,
  };
}
