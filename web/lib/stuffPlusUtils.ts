/**
 * Shared Stuff+ utilities used by player dashboard and leaderboards.
 */

import type { CSSProperties } from "react";

export interface StuffPlusBadgeTone {
  bg: string;
  text: string;
  glowAlpha: number;
  hazeAlpha: number;
}

export interface PlusMetricSurfaceClassSet {
  borderClass: string;
  bgClass: string;
  pillClass: string;
}

export type PlusMetricTier = "elite" | "aboveAverage" | "average" | "belowAverage";

type PlusMetricStep = 0 | 1 | 2;
type RGB = [number, number, number];

const ELITE_PLUS_THRESHOLD = 106;
const ABOVE_AVERAGE_PLUS_THRESHOLD = 100;
const AVERAGE_PLUS_THRESHOLD = 95;

const PLUS_METRIC_BADGE_TONES: Record<
  PlusMetricTier,
  {
    shades: [string, string, string];
    glowAlpha: number;
    hazeAlpha: number;
  }
> = {
  elite: {
    shades: ["#fb7185", "#f43f5e", "#d91f49"],
    glowAlpha: 0.34,
    hazeAlpha: 0.16,
  },
  aboveAverage: {
    shades: ["#fb9c47", "#f97316", "#d85b11"],
    glowAlpha: 0.24,
    hazeAlpha: 0.11,
  },
  average: {
    shades: ["#5d6b7e", "#718094", "#8794a6"],
    glowAlpha: 0.1,
    hazeAlpha: 0.04,
  },
  belowAverage: {
    shades: ["#2aaef0", "#118cda", "#0a6fae"],
    glowAlpha: 0.16,
    hazeAlpha: 0.06,
  },
};

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

function hexToRgb(hex: string): RGB {
  const normalized = hex.replace("#", "");
  const full = normalized.length === 3
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function bandStep(value: number, start: number, end: number): PlusMetricStep {
  const normalized = clamp(value, start, end) - start;
  const span = Math.max(1, end - start + 1);
  const step = Math.floor((normalized * 3) / span);
  return Math.min(2, Math.max(0, step)) as PlusMetricStep;
}

function displayPlusMetricValue(v: number): number {
  return Math.round(v);
}

/** Treat values near 100 as neutral so the average band reads consistently. */
export function plusMetricTier(v: number): PlusMetricTier {
  const displayValue = displayPlusMetricValue(v);

  if (displayValue >= ELITE_PLUS_THRESHOLD) return "elite";
  if (displayValue >= ABOVE_AVERAGE_PLUS_THRESHOLD) return "aboveAverage";
  if (displayValue >= AVERAGE_PLUS_THRESHOLD) return "average";
  return "belowAverage";
}

/** Shared surface styling for plus-metric hero cards and summary panels. */
export function plusMetricSurfaceClasses(v: number | null): PlusMetricSurfaceClassSet {
  if (v === null) {
    return {
      borderClass: "border-zinc-800",
      bgClass: "bg-zinc-900/55",
      pillClass: "bg-zinc-800 text-zinc-300",
    };
  }

  switch (plusMetricTier(v)) {
    case "elite":
      return {
        borderClass: "border-rose-500/50",
        bgClass: "bg-rose-950/10",
        pillClass: "bg-rose-500/20 text-white",
      };
    case "aboveAverage":
      return {
        borderClass: "border-orange-500/50",
        bgClass: "bg-orange-950/10",
        pillClass: "bg-orange-500/20 text-white",
      };
    case "average":
      return {
        borderClass: "border-slate-600/80",
        bgClass: "bg-slate-950/45",
        pillClass: "bg-slate-700/90 text-white",
      };
    case "belowAverage":
      return {
        borderClass: "border-sky-500/50",
        bgClass: "bg-sky-950/10",
        pillClass: "bg-sky-500/20 text-white",
      };
  }
}

/** Light-theme surfaces for command outing / roster-style pages (slate + tinted tiers). */
export function plusMetricSurfaceClassesLight(v: number | null): PlusMetricSurfaceClassSet {
  if (v === null) {
    return {
      borderClass: "border-slate-200 dark:border-zinc-700",
      bgClass: "bg-slate-50/90 dark:bg-zinc-900/60",
      pillClass: "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    };
  }

  switch (plusMetricTier(v)) {
    case "elite":
      return {
        borderClass: "border-rose-200 dark:border-rose-800/40",
        bgClass: "bg-rose-50/90 dark:bg-rose-950/45",
        pillClass: "bg-rose-100 text-rose-800 dark:bg-rose-950/55 dark:text-rose-200",
      };
    case "aboveAverage":
      return {
        borderClass: "border-orange-200 dark:border-orange-800/40",
        bgClass: "bg-orange-50/90 dark:bg-orange-950/45",
        pillClass: "bg-orange-100 text-orange-800 dark:bg-orange-950/55 dark:text-orange-200",
      };
    case "average":
      return {
        borderClass: "border-slate-200 dark:border-zinc-700",
        bgClass: "bg-slate-100/80 dark:bg-zinc-900/60",
        pillClass: "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
      };
    case "belowAverage":
      return {
        borderClass: "border-sky-200 dark:border-sky-800/45",
        bgClass: "bg-sky-50/90 dark:bg-sky-950/48",
        pillClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/55 dark:text-sky-200",
      };
  }
}

/** Four-band scale with a light-to-dark ramp inside each color family. */
export function stuffPlusBadgeTone(v: number): StuffPlusBadgeTone {
  const displayValue = displayPlusMetricValue(v);
  const tier = plusMetricTier(displayValue);
  const toneScale = PLUS_METRIC_BADGE_TONES[tier];
  let step: PlusMetricStep = 0;

  switch (tier) {
    case "belowAverage": {
      step = bandStep(displayValue, 70, AVERAGE_PLUS_THRESHOLD - 1);
      break;
    }
    case "average": {
      step = bandStep(displayValue, AVERAGE_PLUS_THRESHOLD, ABOVE_AVERAGE_PLUS_THRESHOLD - 1);
      break;
    }
    case "aboveAverage": {
      step = bandStep(displayValue, ABOVE_AVERAGE_PLUS_THRESHOLD, ELITE_PLUS_THRESHOLD - 1);
      break;
    }
    case "elite": {
      step = bandStep(displayValue, ELITE_PLUS_THRESHOLD, 130);
      break;
    }
  }

  return {
    bg: toneScale.shades[step],
    text: "#ffffff",
    glowAlpha: toneScale.glowAlpha,
    hazeAlpha: toneScale.hazeAlpha,
  };
}

function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Shared glowing badge style for 100-centered plus metrics (Stuff+, Command+). */
export function plusMetricBadgeStyle(v: number): CSSProperties {
  const tone = stuffPlusBadgeTone(v);
  return {
    color: tone.text,
    background: `linear-gradient(180deg, ${hexToRgba(tone.bg, 0.98)} 0%, ${hexToRgba(tone.bg, 0.84)} 100%)`,
    border: `1px solid ${hexToRgba(tone.bg, 0.6)}`,
    boxShadow: [
      `inset 0 1px 0 ${hexToRgba("#ffffff", 0.18)}`,
      `0 0 0 1px ${hexToRgba(tone.bg, 0.12)}`,
      `0 0 16px ${hexToRgba(tone.bg, tone.glowAlpha)}`,
      `0 0 28px ${hexToRgba(tone.bg, tone.hazeAlpha)}`,
    ].join(", "),
    textShadow: tone.text === "#ffffff" ? "0 1px 1px rgba(0, 0, 0, 0.28)" : "none",
  };
}

/** Color-coded badge class for a Stuff+ value. */
export function stuffPlusBadgeClass(v: number): string {
  switch (plusMetricTier(v)) {
    case "elite":
      return "bg-rose-600 text-white";
    case "aboveAverage":
      return "bg-orange-500/80 text-white";
    case "average":
      return "bg-slate-500 text-white";
    case "belowAverage":
      return "bg-sky-500/80 text-white";
  }
}

/** Accent border class for Stuff+ grade (left border, etc.). */
export function stuffPlusAccentClass(v: number): string {
  switch (plusMetricTier(v)) {
    case "elite":
      return "border-l-rose-500";
    case "aboveAverage":
      return "border-l-orange-500";
    case "average":
      return "border-l-slate-400";
    case "belowAverage":
      return "border-l-sky-500";
  }
}
