/**
 * MLB pitch movement averages (induced break) by pitch type and handedness.
 * Data source: Baseball Savant aggregates.
 */

import mlbData from "@/data/mlb_pitch_movement_averages.json";

export type CanonPitch =
  | "Fastball"
  | "Sinker"
  | "Cutter"
  | "Splitter"
  | "Changeup"
  | "Curveball"
  | "Slider"
  | "Sweeper";

const CANON_PITCHES: CanonPitch[] = [
  "Fastball",
  "Sinker",
  "Cutter",
  "Splitter",
  "Changeup",
  "Curveball",
  "Slider",
  "Sweeper",
];

/** Map of raw names/abbreviations to canonical pitch type. */
const ALIAS_MAP: Record<string, CanonPitch> = {
  // Full names (case-insensitive handled by caller)
  fastball: "Fastball",
  sinker: "Sinker",
  cutter: "Cutter",
  splitter: "Splitter",
  changeup: "Changeup",
  curveball: "Curveball",
  slider: "Slider",
  sweeper: "Sweeper",
  // Common abbreviations
  fb: "Fastball",
  ff: "Fastball",
  si: "Sinker",
  ct: "Cutter",
  fc: "Cutter",
  spl: "Splitter",
  fs: "Splitter",
  ch: "Changeup",
  cb: "Curveball",
  cu: "Curveball",
  sl: "Slider",
  sw: "Sweeper",
  // Trackman labels
  "four-seam": "Fastball",
  "four seam": "Fastball",
  "two-seam": "Sinker",
  "two seam": "Sinker",
  "knuckle curve": "Curveball",
  kc: "Curveball",
};

/**
 * Normalize a raw pitch type string to a canonical name.
 * Returns null for unrecognized or "Other" types.
 */
export function normalizePitchTypeName(raw: string): CanonPitch | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (lower === "other") return null;

  // Direct match on canonical names
  const directMatch = CANON_PITCHES.find((c) => c.toLowerCase() === lower);
  if (directMatch) return directMatch;

  return ALIAS_MAP[lower] ?? null;
}

export type MlbMovement = { ivb: number; hb: number };
type MlbHand = Record<string, MlbMovement>;

const data = mlbData as Record<string, MlbHand>;

/**
 * Pitches that break glove-side (HB should be negative for RHP, positive for LHP).
 * The CSV stores all HB as positive magnitudes — we sign them for the chart.
 */
const GLOVE_SIDE_PITCHES: Set<CanonPitch> = new Set([
  "Curveball",
  "Slider",
  "Sweeper",
]);

/**
 * Return signed HB for a given pitch type and hand.
 *
 * Trackman signed HB convention:
 *   positive = toward 1B  (arm side for RHP, glove side for LHP)
 *   negative = toward 3B  (glove side for RHP, arm side for LHP)
 *
 * CSV stores magnitude only. We apply the sign:
 *   RHP arm-side pitches → +HB,  glove-side pitches → −HB
 *   LHP arm-side pitches → −HB,  glove-side pitches → +HB
 */
function signedHb(hand: "R" | "L", pitch: CanonPitch, hbMag: number): number {
  const armSign = hand === "R" ? 1 : -1;
  if (GLOVE_SIDE_PITCHES.has(pitch)) return -armSign * hbMag;
  return armSign * hbMag;
}

/**
 * Get MLB average movement for a specific pitch type and handedness.
 * Returns signed HB matching Trackman chart convention.
 */
export function getMlbAvg(
  hand: "R" | "L",
  pitch: CanonPitch,
): MlbMovement | null {
  const raw = data[hand]?.[pitch];
  if (!raw) return null;
  return { ivb: raw.ivb, hb: signedHb(hand, pitch, raw.hb) };
}

/**
 * Get all MLB averages for a handedness as a map.
 * HB values are signed to match Trackman chart convention.
 */
export function getMlbMap(
  hand: "R" | "L",
): Partial<Record<CanonPitch, MlbMovement>> {
  const raw = data[hand];
  if (!raw) return {};
  const result: Partial<Record<CanonPitch, MlbMovement>> = {};
  for (const key of CANON_PITCHES) {
    const entry = raw[key];
    if (entry) {
      result[key] = { ivb: entry.ivb, hb: signedHb(hand, key, entry.hb) };
    }
  }
  return result;
}
