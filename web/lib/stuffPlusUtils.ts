/**
 * Shared Stuff+ utilities used by player dashboard and leaderboards.
 */

import type { CSSProperties } from "react";

export interface StuffPlusBadgeTone {
  bg: string;
  text: string;
}

type RGB = [number, number, number];

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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function luminanceText(rgb: RGB): string {
  const [r, g, b] = rgb;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#18181b" : "#ffffff";
}

/** Dynamic threshold scale for 100-centered plus metrics. */
export function stuffPlusBadgeTone(v: number): StuffPlusBadgeTone {
  let rgb: RGB;

  if (v >= 110) {
    const t = clamp01((Math.min(v, 130) - 110) / 20);
    rgb = lerpRgb(hexToRgb("#fb7185"), hexToRgb("#be123c"), t);
  } else if (v >= 100) {
    const t = clamp01((Math.min(v, 109.9) - 100) / 10);
    rgb = lerpRgb(hexToRgb("#fb923c"), hexToRgb("#c2410c"), t);
  } else if (v >= 90) {
    const t = clamp01((Math.min(v, 99.9) - 90) / 10);
    rgb = lerpRgb(hexToRgb("#d4d4d8"), hexToRgb("#71717a"), t);
  } else {
    const t = clamp01((Math.max(Math.min(v, 89.9), 70) - 70) / 20);
    rgb = lerpRgb(hexToRgb("#1d4ed8"), hexToRgb("#38bdf8"), t);
  }

  return {
    bg: rgbToHex(rgb),
    text: luminanceText(rgb),
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
      `0 0 16px ${hexToRgba(tone.bg, 0.32)}`,
      `0 0 28px ${hexToRgba(tone.bg, 0.14)}`,
    ].join(", "),
    textShadow: tone.text === "#ffffff" ? "0 1px 1px rgba(0, 0, 0, 0.28)" : "none",
  };
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
