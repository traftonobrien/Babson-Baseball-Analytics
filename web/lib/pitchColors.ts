/**
 * Universal pitch-type color mapping by abbreviation.
 * Single source of truth for all UI components.
 */

const PITCH_COLORS: Record<string, string> = {
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
};

export const OTHER_BG_CLASS = "bg-zinc-500";

export function pitchBgClass(abbreviation: string): string {
  return PITCH_BG_CLASSES[abbreviation] ?? OTHER_BG_CLASS;
}
