/**
 * Season / dateId parsing utilities.
 *
 * Canonical dateId: yyyy_mm_dd (e.g. "2025_03_26")
 * Optional suffix:  yyyy_mm_dd_01 (same-day disambiguation)
 * Legacy:           mm_dd_yy      (normalize before use)
 */

/**
 * Parse a canonical dateId into a Date, or null if unparseable.
 *
 * Accepts:
 *   "yyyy_mm_dd"    → Date(yyyy, mm-1, dd)
 *   "yyyy_mm_dd_NN" → Date(yyyy, mm-1, dd)  (suffix ignored)
 *   "mm_dd_yy"      → Date(20yy, mm-1, dd)  (legacy fallback)
 */
export function parseDateId(dateId: string): Date | null {
  if (!dateId) return null;
  const parts = dateId.split("_");
  if (parts.length < 3) return null;

  // Canonical: first part is 4 digits (year)
  if (parts[0].length === 4) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(y, m - 1, d);
  }

  // Legacy: mm_dd_yy (all 2-digit parts, exactly 3 parts)
  if (parts.length === 3 && parts.every((p) => p.length === 2)) {
    const m = parseInt(parts[0], 10);
    const d = parseInt(parts[1], 10);
    const y = 2000 + parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(y, m - 1, d);
  }

  return null;
}

/**
 * Extract the season year from a dateId, or null if unparseable.
 */
export function seasonFromDateId(dateId: string): number | null {
  const d = parseDateId(dateId);
  return d ? d.getFullYear() : null;
}
