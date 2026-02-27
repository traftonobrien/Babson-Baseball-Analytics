/**
 * Shared Stuff+ utilities used by player dashboard and leaderboards.
 */

/** Simple average of all non-null meanStuffPlus values. Returns null if none. */
export function computeTotalStuffPlus(
  pitches: { meanStuffPlus: number | null }[],
): number | null {
  const valid = pitches
    .map((p) => p.meanStuffPlus)
    .filter((v): v is number => v != null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

/** Color-coded badge class for a Stuff+ value. */
export function stuffPlusBadgeClass(v: number): string {
  if (v >= 110) return "bg-rose-600 text-white";
  if (v >= 100) return "bg-orange-500/80 text-white";
  if (v >= 90) return "bg-zinc-400 text-zinc-900";
  return "bg-sky-500/80 text-white";
}

/** Accent border class for Stuff+ grade (left border, etc.). */
export function stuffPlusAccentClass(v: number): string {
  if (v >= 110) return "border-l-rose-500";
  if (v >= 100) return "border-l-orange-500";
  if (v >= 90) return "border-l-zinc-400";
  return "border-l-sky-500";
}
