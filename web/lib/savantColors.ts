/**
 * Savant-style blue→gray→red gradient for percentile/percent displays.
 * Higher = better (elite/red). 0% = poor (blue), 50% = avg (gray), 100% = elite (red).
 */

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]: RGB): string {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

function lerpRgb(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Luminance-based contrast: dark text on light badges, white on dark. */
function textColor(rgb: RGB): string {
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? "#18181b" : "#ffffff";
}

const STOPS: { pct: number; rgb: RGB }[] = [
  { pct: 0, rgb: hexToRgb("#1e40af") },
  { pct: 18, rgb: hexToRgb("#3b82f6") },
  { pct: 50, rgb: hexToRgb("#94a3b8") },
  { pct: 82, rgb: hexToRgb("#f87171") },
  { pct: 100, rgb: hexToRgb("#dc2626") },
];

/**
 * Sample the Savant gradient at a given percentile (0–100).
 * Returns bg (hex) and text (hex) for badge/pill styling.
 */
export function savantColorAt(pct: number): { bg: string; text: string } {
  const p = Math.min(100, Math.max(0, pct));
  let lo = STOPS[0];
  let hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (p >= STOPS[i].pct && p <= STOPS[i + 1].pct) {
      lo = STOPS[i];
      hi = STOPS[i + 1];
      break;
    }
  }
  const t = hi.pct === lo.pct ? 0 : (p - lo.pct) / (hi.pct - lo.pct);
  const rgb = lerpRgb(lo.rgb, hi.rgb, t);
  return {
    bg: rgbToHex(rgb),
    text: textColor(rgb),
  };
}
