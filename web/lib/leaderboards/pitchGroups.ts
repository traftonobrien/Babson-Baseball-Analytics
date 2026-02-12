/**
 * Pitch group classification for leaderboard filtering.
 *
 * Single source of truth for which pitch types belong to
 * FASTBALL vs BREAKING groups. Case-insensitive matching.
 */

export type PitchGroup = "ALL" | "FASTBALL" | "BREAKING";

const FASTBALL_TYPES = new Set(["FF", "FT", "SI", "FC", "FS", "FB"]);
const BREAKING_TYPES = new Set(["SL", "CU", "KC", "CS", "SV", "CB"]);

/**
 * Classify a pitch type abbreviation into a pitch group.
 * Returns "UNKNOWN" for unrecognized types (e.g. CH, EP).
 */
export function pitchGroupOf(pitchType: string): PitchGroup | "UNKNOWN" {
  const upper = (pitchType ?? "").toUpperCase().trim();
  if (FASTBALL_TYPES.has(upper)) return "FASTBALL";
  if (BREAKING_TYPES.has(upper)) return "BREAKING";
  return "UNKNOWN";
}

/**
 * Check if a pitch type matches a group filter.
 * "ALL" matches every pitch type (including unknown).
 * FASTBALL/BREAKING only match their respective sets.
 */
export function pitchMatchesGroup(pitchType: string, group: PitchGroup): boolean {
  if (group === "ALL") return true;
  return pitchGroupOf(pitchType) === group;
}
