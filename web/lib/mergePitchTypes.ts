/**
 * Merge pitch type rows when movement analysis shows they are the same pitch.
 *
 * Two-pass approach:
 *   Pass 1 — Auto-rename: relabel breaking balls to their closest MLB bucket.
 *   Pass 2 — Proximity merge: if any two remaining pitch types have movement
 *            within SIMILARITY_THRESHOLD inches, merge them under the label
 *            whose MLB average is closest to their combined centroid.
 */

import type { TrackmanPitchTypeSummary } from "./trackman/metrics";
import { evaluateAutoRename } from "./autoRenamePitch";
import {
  normalizePitchTypeName,
  getMlbAvg,
  type CanonPitch,
  type MlbMovement,
} from "./mlbPitchAverages";

/** Two pitches within this distance (inches) are treated as the same pitch. */
const SIMILARITY_THRESHOLD = 5.0;

const ALL_CANON: CanonPitch[] = [
  "Fastball", "Sinker", "Splitter",
  "Changeup", "Curveball", "Slider", "Sweeper",
];

/**
 * Pitch families for proximity merge. When two pitches in the same family
 * have similar movement, they merge under the closest MLB label *within
 * that family* — so Fastball + Sinker can only become FB/SI/CT, never CH.
 */
const FAMILIES: CanonPitch[][] = [
  ["Fastball", "Sinker"],
  ["Changeup", "Splitter"],
  ["Curveball", "Slider", "Sweeper"],
];

/** Also allow cross-family merge for secondary pitches (offspeed + breaking). */
const SECONDARY: Set<CanonPitch> = new Set([
  "Changeup", "Splitter", "Curveball", "Slider", "Sweeper",
]);

function mergeFamily(a: string, b: string): CanonPitch[] | null {
  const canonA = normalizePitchTypeName(a);
  const canonB = normalizePitchTypeName(b);
  if (!canonA || !canonB) return null;

  // Same explicit family
  for (const fam of FAMILIES) {
    if (fam.includes(canonA) && fam.includes(canonB)) return fam;
  }
  // Cross-family for secondary pitches (offspeed + breaking)
  if (SECONDARY.has(canonA) && SECONDARY.has(canonB)) {
    return [...SECONDARY] as CanonPitch[];
  }
  return null;
}

function movementDist(
  aIvb: number, aHb: number,
  bIvb: number, bHb: number,
): number {
  return Math.sqrt((aIvb - bIvb) ** 2 + (aHb - bHb) ** 2);
}

/** Find the canonical pitch whose MLB average is closest to the given point.
 *  When `candidates` is provided, only those pitch types are considered. */
function closestMlbLabel(
  ivb: number,
  hb: number,
  hand: "R" | "L",
  candidates?: CanonPitch[],
): CanonPitch {
  const pool = candidates ?? ALL_CANON;
  let best: CanonPitch = pool[0] ?? "Fastball";
  let bestDist = Infinity;
  for (const canon of pool) {
    const mlb = getMlbAvg(hand, canon);
    if (!mlb) continue;
    const d = movementDist(ivb, hb, mlb.ivb, mlb.hb);
    if (d < bestDist) {
      bestDist = d;
      best = canon;
    }
  }
  return best;
}

export function mergeRenamedPitchTypes(
  pitchTypes: TrackmanPitchTypeSummary[],
  hand: "R" | "L",
): TrackmanPitchTypeSummary[] {
  // ---------------------------------------------------------------
  // Pass 1: Auto-rename breaking balls to closest MLB bucket
  // ---------------------------------------------------------------
  const labeled: { row: TrackmanPitchTypeSummary; effectiveLabel: string }[] = [];

  for (const row of pitchTypes) {
    if (row.pitchType === "Other") continue;

    const rename = evaluateAutoRename(row.pitchType, row.avgIvb, row.avgHb, hand);
    const effectiveLabel = rename.wasRenamed
      ? rename.reason!.bestPitch
      : (normalizePitchTypeName(row.pitchType) ?? row.pitchType);

    labeled.push({ row, effectiveLabel });
  }

  // Group by effective label (handles cases where auto-rename maps two → same)
  const groups = new Map<string, TrackmanPitchTypeSummary[]>();
  for (const { row, effectiveLabel } of labeled) {
    if (!groups.has(effectiveLabel)) groups.set(effectiveLabel, []);
    groups.get(effectiveLabel)!.push(row);
  }

  // Merge pass-1 groups into interim rows
  let interim: TrackmanPitchTypeSummary[] = [];
  for (const [label, rows] of groups) {
    if (rows.length === 1) {
      interim.push({ ...rows[0], pitchType: label });
    } else {
      interim.push(mergeRows(label, rows));
    }
  }

  // ---------------------------------------------------------------
  // Pass 2: Proximity merge — any two pitches with similar movement
  // ---------------------------------------------------------------
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < interim.length; i++) {
      for (let j = i + 1; j < interim.length; j++) {
        const a = interim[i];
        const b = interim[j];
        if (a.avgIvb == null || a.avgHb == null) continue;
        if (b.avgIvb == null || b.avgHb == null) continue;

        // Only merge pitches in the same family or both secondary
        const family = mergeFamily(a.pitchType, b.pitchType);
        if (!family) continue;

        const dist = movementDist(a.avgIvb, a.avgHb, b.avgIvb, b.avgHb);
        if (dist > SIMILARITY_THRESHOLD) continue;

        // Merge under closest MLB label within the family
        const centroidIvb = (a.avgIvb + b.avgIvb) / 2;
        const centroidHb = (a.avgHb + b.avgHb) / 2;
        const bestLabel = closestMlbLabel(centroidIvb, centroidHb, hand, family);
        const merged = mergeRows(bestLabel, [a, b]);

        // Replace pair with merged row
        interim = [
          ...interim.slice(0, i),
          merged,
          ...interim.slice(i + 1, j),
          ...interim.slice(j + 1),
        ];
        changed = true;
        break;
      }
      if (changed) break;
    }
  }

  // Sort by avg velo descending (fastballs first)
  interim.sort((a, b) => (b.avgVelo ?? 0) - (a.avgVelo ?? 0));
  return interim;
}

function mergeRows(
  label: string,
  rows: TrackmanPitchTypeSummary[],
): TrackmanPitchTypeSummary {
  const hasWeights = rows.every((r) => r.count != null && r.count > 0);

  function wavg(key: keyof TrackmanPitchTypeSummary): number | null {
    const pairs: { val: number; weight: number }[] = [];
    for (const r of rows) {
      const v = r[key];
      if (typeof v !== "number" || v == null) continue;
      const w = hasWeights ? (r.count ?? 1) : 1;
      pairs.push({ val: v, weight: w });
    }
    if (pairs.length === 0) return null;
    const totalW = pairs.reduce((s, p) => s + p.weight, 0);
    const sum = pairs.reduce((s, p) => s + p.val * p.weight, 0);
    return Math.round((sum / totalW) * 100) / 100;
  }

  function maxOf(key: keyof TrackmanPitchTypeSummary): number | null {
    const vals = rows
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number" && v != null);
    return vals.length > 0 ? Math.max(...vals) : null;
  }

  const totalCount = rows.reduce((s, r) => s + (r.count ?? 0), 0);

  return {
    pitchType: label,
    count: totalCount > 0 ? totalCount : null,
    avgVelo: wavg("avgVelo"),
    maxVelo: maxOf("maxVelo"),
    avgSpin: wavg("avgSpin"),
    maxSpin: maxOf("maxSpin"),
    avgIvb: wavg("avgIvb"),
    avgHb: wavg("avgHb"),
    avgExtension: wavg("avgExtension"),
    avgRelHeight: wavg("avgRelHeight"),
    avgRelSide: wavg("avgRelSide"),
    avgSpinAxis2d: wavg("avgSpinAxis2d"),
    avgSpinAxis3d: wavg("avgSpinAxis3d"),
    avgGyro: wavg("avgGyro"),
  };
}
