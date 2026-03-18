/**
 * Canonical pitch type → Savant pitch_type abbreviation(s).
 *
 * Used when constructing statcast_search queries: we need to search all
 * abbreviations a canonical pitch type might appear under on Savant.
 * E.g. "Curveball" appears as both CU and KC in Savant data.
 */

export const CANONICAL_TO_SAVANT: Record<string, string[]> = {
  Fastball: ["FF"],
  Sinker: ["SI"],
  Cutter: ["FC"],
  Splitter: ["FS", "FO"],
  Changeup: ["CH"],
  Curveball: ["CU", "KC", "CS"],
  Slider: ["SL", "SV"],
  Sweeper: ["ST"],
};

/** Flat set of all Savant abbreviations we recognize. */
export const ALL_SAVANT_ABBREVS = new Set(
  Object.values(CANONICAL_TO_SAVANT).flat(),
);
