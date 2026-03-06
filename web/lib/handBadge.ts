/**
 * Universal RHP/LHP badge styling.
 * RHP: warm amber
 * LHP: cool sky
 */

/** Pill style with border (e.g. Pitching Hub cards) */
export function handBadgeClasses(hand: "R" | "L"): string {
  return hand === "R"
    ? "border border-amber-500/35 bg-amber-500/10 text-amber-300"
    : "border border-sky-500/35 bg-sky-500/10 text-sky-300";
}

/** Compact style without border (e.g. leaderboards, command page) */
export function handBadgeClassesCompact(hand: "R" | "L"): string {
  return hand === "R"
    ? "bg-amber-500/12 text-amber-300 ring-1 ring-inset ring-amber-500/25"
    : "bg-sky-500/12 text-sky-300 ring-1 ring-inset ring-sky-500/25";
}

/** Parse "RHP"/"LHP" or "R"/"L" to "R" | "L" */
export function parseHand(handedness: string | null | undefined): "R" | "L" | null {
  if (!handedness) return null;
  const h = handedness.toUpperCase();
  if (h.startsWith("L") || h === "LHP") return "L";
  if (h.startsWith("R") || h === "RHP") return "R";
  return null;
}
