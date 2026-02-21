import type { ReleaseAverages, Handedness, ArmAngleRay } from "./types";
import type { TrackmanPitchTypeSummary } from "../trackman/metrics";
import {
  computeArmAngleDeg,
  classifyArmSlot,
  computeMLBArmSlotPercentile
} from "./math";
import { pitchColor } from "../pitchColors";

/**
 * Compute aggregated release averages from a list of pitch type summaries.
 * Weighted by pitch count if available.
 */
export function computeArsenalReleaseAverages(
  pitchTypes: TrackmanPitchTypeSummary[],
  handedness: Handedness,
  playerId?: string,
  slug?: string
): ReleaseAverages | null {
  const valid = pitchTypes.filter(
    (p) => 
      p.avgRelHeight != null && 
      p.avgRelSide != null && 
      p.avgRelHeight >= 0 && p.avgRelHeight <= 10 &&
      Math.abs(p.avgRelSide!) <= 10
  );

  if (valid.length === 0) return null;

  let totalCount = 0;
  let wHeight = 0;
  let wSide = 0;
  let wExt = 0;
  let extCount = 0;

  const useWeights = valid.some((p) => p.count != null && p.count > 0);

  for (const p of valid) {
    const weight = useWeights ? (p.count ?? 0) : 1;
    if (weight <= 0) continue;

    wHeight += p.avgRelHeight! * weight;
    wSide += p.avgRelSide! * weight;
    totalCount += weight;

    if (p.avgExtension != null) {
      wExt += p.avgExtension * weight;
      extCount += weight;
    }
  }

  if (totalCount === 0) return null;

  const avgHeight = wHeight / totalCount;
  const avgSide = wSide / totalCount;
  const avgExt = extCount > 0 ? wExt / extCount : null;

  const angle = computeArmAngleDeg(avgHeight, avgSide);
  const classification = classifyArmSlot(angle);
  const percentile = computeMLBArmSlotPercentile(angle);

  const byPitchType: ReleaseAverages["byPitchType"] = {};
  for (const p of valid) {
    byPitchType[p.pitchType] = {
      n: p.count ?? 0,
      releaseHeightFt: p.avgRelHeight!,
      releaseSideFt: p.avgRelSide!,
      extensionFt: p.avgExtension ?? undefined,
      armAngleDeg: computeArmAngleDeg(p.avgRelHeight, p.avgRelSide!) ?? undefined
    };
  }

  return {
    playerId: playerId,
    slug: slug,
    handedness,
    releaseHeightFt: avgHeight,
    releaseSideFt: avgSide,
    extensionFt: avgExt,
    sampleSize: totalCount,
    armAngleDeg: angle,
    slotLabel: classification?.label ?? null,
    slotTier: classification?.tier ?? null,
    slotPercentile: percentile,
    byPitchType
  };
}

const PRIMARY_ORDER = ["Fastball", "Sinker"];

/**
 * Compute one ArmAngleRay per pitch type for multi-beam overlay.
 */
export function computeReleaseRaysByPitchType(
  pitchTypes: TrackmanPitchTypeSummary[],
  hand: Handedness
): ArmAngleRay[] {
  const valid = pitchTypes.filter(
    (p) =>
      p.pitchType !== "Other" &&
      p.avgRelHeight != null &&
      p.avgRelSide != null &&
      p.avgRelHeight >= 0 &&
      p.avgRelHeight <= 10 &&
      Math.abs(p.avgRelSide!) <= 10
  );

  if (valid.length === 0) return [];

  // Determine primary pitch type
  let primaryType: string | null = null;
  for (const name of PRIMARY_ORDER) {
    if (valid.some((p) => p.pitchType === name)) {
      primaryType = name;
      break;
    }
  }
  if (!primaryType) {
    // Highest count
    const sorted = [...valid].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
    primaryType = sorted[0].pitchType;
  }

  const rays: ArmAngleRay[] = [];
  for (const p of valid) {
    const angle = computeArmAngleDeg(p.avgRelHeight, p.avgRelSide);
    if (angle === null) continue;

    const slot = classifyArmSlot(angle);
    rays.push({
      pitchType: p.pitchType,
      count: p.count ?? 0,
      releaseHeightFt: p.avgRelHeight!,
      releaseSideFt: p.avgRelSide!,
      armAngleDeg: angle,
      slotClass: slot ? { label: slot.label, tier: slot.tier } : null,
      color: pitchColor(p.pitchType),
      isPrimary: p.pitchType === primaryType,
    });
  }

  // Sort: primary first, then descending count
  rays.sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return b.count - a.count;
  });

  return rays;
}
