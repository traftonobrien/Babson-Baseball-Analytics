/**
 * Universal RHP/LHP badge styling.
 * RHP: emerald (green)
 * LHP: blue (matches command leaderboard)
 */

/** Pill style with border (e.g. Pitching Hub cards) */
export function handBadgeClasses(hand: "R" | "L"): string {
  return hand === "R"
    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
    : "bg-blue-500/20 text-blue-400 border border-blue-500/30";
}

/** Compact style without border (e.g. leaderboards, command page) */
export function handBadgeClassesCompact(hand: "R" | "L"): string {
  return hand === "R"
    ? "bg-emerald-900/40 text-emerald-400"
    : "bg-blue-900/40 text-blue-400";
}

/** Parse "RHP"/"LHP" or "R"/"L" to "R" | "L" */
export function parseHand(handedness: string | null | undefined): "R" | "L" | null {
  if (!handedness) return null;
  const h = handedness.toUpperCase();
  if (h.startsWith("L") || h === "LHP") return "L";
  if (h.startsWith("R") || h === "RHP") return "R";
  return null;
}
