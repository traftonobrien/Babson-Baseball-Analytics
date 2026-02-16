/**
 * Auto-relabel breaking balls (Curveball, Slider, Sweeper) when movement
 * is closer to a different MLB average bucket.
 *
 * Applied at render time only. Never modifies raw Trackman data.
 */

import {
  type CanonPitch,
  normalizePitchTypeName,
  getMlbAvg,
} from "./mlbPitchAverages";

const RELABEL_CANDIDATES: CanonPitch[] = ["Curveball", "Slider", "Sweeper"];

/** Threshold: best distance must be <= this to relabel. */
const MAX_BEST_DIST = 3.0;

/** Threshold: gap between current and best must be >= this. */
const MIN_IMPROVEMENT = 1.5;

export interface AutoRenameResult {
  /** Display label (may differ from original). */
  displayType: string;
  /** True if the pitch was relabeled. */
  wasRenamed: boolean;
  /** Original pitch type from Trackman. */
  originalType: string;
  /** Reason metadata (only set if renamed). */
  reason: {
    bestPitch: CanonPitch;
    bestDist: number;
    currentLabel: CanonPitch;
    currentDist: number;
  } | null;
}

/**
 * Evaluate whether a pitch type should be auto-relabeled based on
 * its IVB/HB vs MLB averages.
 *
 * @param pitchType  Raw pitch type string from Trackman
 * @param avgIvb     Player average IVB (inches)
 * @param avgHb      Player average HB (inches, signed)
 * @param hand       Pitcher handedness
 */
export function evaluateAutoRename(
  pitchType: string,
  avgIvb: number | null,
  avgHb: number | null,
  hand: "R" | "L",
): AutoRenameResult {
  const base: AutoRenameResult = {
    displayType: pitchType,
    wasRenamed: false,
    originalType: pitchType,
    reason: null,
  };

  if (avgIvb === null || avgHb === null) return base;

  const canon = normalizePitchTypeName(pitchType);
  if (!canon || !RELABEL_CANDIDATES.includes(canon)) return base;

  // Compute distance to each candidate's MLB average
  const absHb = Math.abs(avgHb);
  const distances: { pitch: CanonPitch; dist: number }[] = [];

  for (const candidate of RELABEL_CANDIDATES) {
    const mlb = getMlbAvg(hand, candidate);
    if (!mlb) continue;
    const dist = Math.sqrt(
      (avgIvb - mlb.ivb) ** 2 + (absHb - Math.abs(mlb.hb)) ** 2,
    );
    distances.push({ pitch: candidate, dist });
  }

  if (distances.length === 0) return base;

  const currentEntry = distances.find((d) => d.pitch === canon);
  const best = distances.reduce((a, b) => (a.dist < b.dist ? a : b));

  if (!currentEntry) return base;

  // Only relabel if all thresholds met
  if (
    best.pitch !== canon &&
    best.dist <= MAX_BEST_DIST &&
    currentEntry.dist - best.dist >= MIN_IMPROVEMENT
  ) {
    return {
      displayType: `${best.pitch} (auto)`,
      wasRenamed: true,
      originalType: pitchType,
      reason: {
        bestPitch: best.pitch,
        bestDist: Math.round(best.dist * 100) / 100,
        currentLabel: canon,
        currentDist: Math.round(currentEntry.dist * 100) / 100,
      },
    };
  }

  return base;
}
