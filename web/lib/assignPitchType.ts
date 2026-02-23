/**
 * Assign or normalize pitch_type for pitches based on player arsenal.
 *
 * - Pitches with empty/unknown type get the player's primary pitch (first in arsenal).
 * - Full names (e.g. "Fastball", "Curveball") are mapped to abbreviations via arsenal.
 * - Already-valid abbreviations pass through unchanged.
 */

import type { Pitch } from "@/app/types";
import { pitchGroupOf } from "@/lib/leaderboards/pitchGroups";

export interface ArsenalEntry {
  abbrev: string;
  pitchName: string;
}

const UNKNOWN_VALUES = new Set([
  "",
  "UN",
  "UNK",
  "UNKNOWN",
  "OTHER",
  "N/A",
  "NA",
  "?",
  "-",
]);

function isUnknownType(pt: string): boolean {
  const t = (pt ?? "").trim().toUpperCase();
  return !t || UNKNOWN_VALUES.has(t);
}

/**
 * Normalize pitch_type using the player's arsenal.
 * - If unknown/empty: return defaultAbbrev (e.g. first pitch from arsenal).
 * - If full name (e.g. "Fastball"): map to abbrev from arsenal.
 * - If already a known abbrev: return as-is.
 */
export function normalizePitchType(
  pitchType: string,
  arsenal: ArsenalEntry[],
  defaultAbbrev?: string,
): string {
  const raw = (pitchType ?? "").trim();
  if (!raw || isUnknownType(raw)) {
    return defaultAbbrev ?? arsenal[0]?.abbrev ?? "FF";
  }

  const upper = raw.toUpperCase();
  // Already a known abbreviation (2 chars, in our groups)
  if (raw.length <= 3 && pitchGroupOf(raw) !== "UNKNOWN") {
    return upper;
  }

  // Try to match full name to arsenal
  const lower = raw.toLowerCase();
  for (const a of arsenal) {
    if (a.pitchName.toLowerCase() === lower) return a.abbrev;
    if (a.abbrev.toUpperCase() === upper) return a.abbrev;
  }

  // Partial match (e.g. "4-Seam Fastball" contains "Fastball")
  for (const a of arsenal) {
    if (lower.includes(a.pitchName.toLowerCase())) return a.abbrev;
  }

  return raw;
}

/**
 * Assign pitch_type to pitches with missing/unknown type using the player's arsenal.
 * Mutates pitches in place and returns them.
 */
export function assignPitchTypes(
  pitches: Pitch[],
  _playerId: string,
  arsenal: ArsenalEntry[],
): Pitch[] {
  const defaultAbbrev = arsenal[0]?.abbrev ?? "FF";

  for (const p of pitches) {
    const pt = (p.pitch_type ?? "").trim();
    const normalized = normalizePitchType(pt, arsenal, defaultAbbrev);
    (p as unknown as Record<string, string>).pitch_type = normalized;
  }

  return pitches;
}
