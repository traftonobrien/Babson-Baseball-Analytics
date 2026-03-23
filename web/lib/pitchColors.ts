/**
 * Universal pitch-type color mapping by abbreviation.
 * Single source of truth for all UI components.
 */

import type { CSSProperties } from "react";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.trim().replace("#", "");
  if (raw.length === 3) {
    const [a, b, c] = raw.split("");
    return {
      r: parseInt(a + a, 16),
      g: parseInt(b + b, 16),
      b: parseInt(c + c, 16),
    };
  }
  if (raw.length !== 6) {
    return { r: 113, g: 113, b: 122 };
  }
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

/** Filter panel toggled-on chips — stronger tint. */
export type PitchChipSurfaceVariant = "filterActive" | "tableSoft";

/**
 * Inline styles for pitch-type pills. Gradients use the same RGB at each stop (varying alpha only)
 * so the browser never interpolates through white — important for dark mode.
 */
export function pitchChipSurfaceStyle(
  hex: string,
  variant: PitchChipSurfaceVariant,
  siteDark: boolean,
): CSSProperties {
  const { r, g, b } = hexToRgb(hex);
  if (variant === "filterActive") {
    const aTop = siteDark ? 0.34 : 0.2;
    const aMid = siteDark ? 0.14 : 0.08;
    const aBorder = siteDark ? 0.52 : 0.38;
    const aRing = siteDark ? 0.28 : 0.16;
    return {
      borderColor: `rgba(${r}, ${g}, ${b}, ${aBorder})`,
      backgroundImage: `linear-gradient(135deg, rgba(${r},${g},${b},${aTop}) 0%, rgba(${r},${g},${b},${aMid}) 48%, rgba(${r},${g},${b},0) 100%)`,
      boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, ${aRing}), inset 0 1px 0 rgba(255,255,255,${siteDark ? 0.05 : 0.1})`,
    };
  }
  const aTop = siteDark ? 0.26 : 0.16;
  const aMid = siteDark ? 0.1 : 0.05;
  const aBorder = siteDark ? 0.45 : 0.33;
  const aRing = siteDark ? 0.18 : 0.1;
  return {
    borderColor: `rgba(${r}, ${g}, ${b}, ${aBorder})`,
    backgroundImage: `linear-gradient(135deg, rgba(${r},${g},${b},${aTop}) 0%, rgba(${r},${g},${b},${aMid}) 50%, rgba(${r},${g},${b},0) 100%)`,
    boxShadow: `0 0 0 1px rgba(${r}, ${g}, ${b}, ${aRing})`,
  };
}

const PITCH_COLORS: Record<string, string> = {
  // Abbreviations
  FF: "#ef4444",   // red
  CU: "#6366f1",   // indigo
  FS: "#14b8a6",   // teal
  SL: "#a855f7",   // purple
  CH: "#22c55e",   // green
  SI: "#f97316",   // orange
  FC: "#f59e0b",   // amber
  KC: "#0ea5e9",   // sky
  CB: "#6366f1",   // indigo (alias for CU)
  CT: "#f59e0b",   // amber (alias for FC)
  FF_SI: "#f97316",
  CH_FS: "#10b981",
  SL_SW: "#d946ef",
  // Full names (PDF pipeline)
  Fastball: "#ef4444",
  Sinker: "#f97316",
  Slider: "#a855f7",
  Changeup: "#22c55e",
  Curveball: "#6366f1",
  Cutter: "#f59e0b",
  Splitter: "#14b8a6",
  Sweeper: "#ec4899",
  "Knuckle Curve": "#0ea5e9",
  SW: "#ec4899",
};

const OTHER_COLOR = "#71717a"; // zinc-500

export function pitchColor(abbreviation: string): string {
  return PITCH_COLORS[abbreviation] ?? OTHER_COLOR;
}

/** Tailwind-style bg class names for badges (static subset). */
export const PITCH_BG_CLASSES: Record<string, string> = {
  FF: "bg-red-500",
  CU: "bg-indigo-500",
  FS: "bg-teal-500",
  SL: "bg-purple-500",
  CH: "bg-green-500",
  SI: "bg-orange-500",
  FC: "bg-amber-500",
  KC: "bg-sky-500",
  CB: "bg-indigo-500",
  CT: "bg-amber-500",
  FF_SI: "bg-orange-500",
  CH_FS: "bg-emerald-500",
  SL_SW: "bg-fuchsia-500",
};

export const OTHER_BG_CLASS = "bg-zinc-500";

export function pitchBgClass(abbreviation: string): string {
  return PITCH_BG_CLASSES[abbreviation] ?? OTHER_BG_CLASS;
}
