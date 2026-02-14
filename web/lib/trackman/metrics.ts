/**
 * Pure utility functions for Trackman pitch data.
 * No React — easy to unit test.
 */

// ---------------------------------------------------------------------------
// Field name detection
// ---------------------------------------------------------------------------

/** Maps of canonical field → possible raw key names (lower-cased for matching). */
export const FIELD_CANDIDATES: Record<string, string[]> = {
  pitchType: ["pitch_type", "pitchtype", "pitch type", "pitchname", "pitch_name", "type"],
  mph: ["mph", "velocity", "velo", "release_speed", "speed", "pitch_speed"],
  rpm: ["rpm", "spin_rate", "spinrate", "spin", "spin_rpm"],
  ivb: ["ivb", "induced_vertical_break", "vert_break", "vertical_break", "v_break"],
  hb: ["hb", "horizontal_break", "horiz_break", "h_break"],
  extension: ["extension", "ext", "release_extension", "rel_ext"],
  relHeight: ["rel_height", "release_height", "relheight", "release_pos_z"],
  relSide: ["rel_side", "release_side", "relside", "release_pos_x"],
  spinAxis2d: ["spin_axis_2d", "spin_axis", "spinaxis", "spin_direction"],
  pitchNo: ["pitch_no", "pitchno", "pitch_number", "pitch_num", "no", "#"],
};

/**
 * Given a pitch object and a list of candidate key names, return the first
 * matching key that exists and has a non-null value, or undefined.
 */
export function detectField(pitch: Record<string, unknown>, candidates: string[]): string | undefined {
  const keys = Object.keys(pitch);
  const keyMap = new Map(keys.map((k) => [k.toLowerCase().replace(/\s+/g, "_"), k]));

  for (const candidate of candidates) {
    const norm = candidate.toLowerCase().replace(/\s+/g, "_");
    const realKey = keyMap.get(norm);
    if (realKey !== undefined && pitch[realKey] != null) {
      return realKey;
    }
  }
  return undefined;
}

/** Read a numeric field from a pitch, trying multiple candidate names. */
export function readNum(pitch: Record<string, unknown>, candidates: string[]): number | null {
  const key = detectField(pitch, candidates);
  if (!key) return null;
  const v = Number(pitch[key]);
  return Number.isFinite(v) ? v : null;
}

/** Read a string field from a pitch, trying multiple candidate names. */
export function readStr(pitch: Record<string, unknown>, candidates: string[]): string | null {
  const key = detectField(pitch, candidates);
  if (!key) return null;
  const v = pitch[key];
  return typeof v === "string" ? v : v != null ? String(v) : null;
}

// ---------------------------------------------------------------------------
// Normalized pitch type
// ---------------------------------------------------------------------------

export interface TrackmanPitch {
  pitchNo: number;
  pitchType: string;
  mph: number | null;
  rpm: number | null;
  extension: number | null;
  relHeight: number | null;
  relSide: number | null;
  ivb: number | null;
  hb: number | null;
  spinAxis2d: number | null;
}

/** Normalize a raw row into a TrackmanPitch. */
export function normalizePitch(raw: Record<string, unknown>, index: number): TrackmanPitch {
  return {
    pitchNo: readNum(raw, FIELD_CANDIDATES.pitchNo) ?? index + 1,
    pitchType: readStr(raw, FIELD_CANDIDATES.pitchType) ?? "UN",
    mph: readNum(raw, FIELD_CANDIDATES.mph),
    rpm: readNum(raw, FIELD_CANDIDATES.rpm),
    extension: readNum(raw, FIELD_CANDIDATES.extension),
    relHeight: readNum(raw, FIELD_CANDIDATES.relHeight),
    relSide: readNum(raw, FIELD_CANDIDATES.relSide),
    ivb: readNum(raw, FIELD_CANDIDATES.ivb),
    hb: readNum(raw, FIELD_CANDIDATES.hb),
    spinAxis2d: readNum(raw, FIELD_CANDIDATES.spinAxis2d),
  };
}

// ---------------------------------------------------------------------------
// KPI derivation
// ---------------------------------------------------------------------------

export interface TrackmanKpis {
  count: number;
  avgVelo: number | null;
  maxVelo: number | null;
  avgSpin: number | null;
  avgIvb: number | null;
  avgHb: number | null;
  avgExtension: number | null;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function deriveMetrics(pitches: TrackmanPitch[]): TrackmanKpis {
  const velos = pitches.map((p) => p.mph).filter((v): v is number => v !== null);
  const spins = pitches.map((p) => p.rpm).filter((v): v is number => v !== null);
  const ivbs = pitches.map((p) => p.ivb).filter((v): v is number => v !== null);
  const hbs = pitches.map((p) => p.hb).filter((v): v is number => v !== null);
  const exts = pitches.map((p) => p.extension).filter((v): v is number => v !== null);

  return {
    count: pitches.length,
    avgVelo: avg(velos),
    maxVelo: velos.length > 0 ? Math.max(...velos) : null,
    avgSpin: avg(spins),
    avgIvb: avg(ivbs),
    avgHb: avg(hbs),
    avgExtension: avg(exts),
  };
}

/** Get unique pitch types from a list. */
export function uniquePitchTypes(pitches: TrackmanPitch[]): string[] {
  return Array.from(new Set(pitches.map((p) => p.pitchType))).sort();
}
