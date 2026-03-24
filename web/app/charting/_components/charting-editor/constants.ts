import {
  DOUBLE_PLAY_OPTIONS,
  ERROR_OPTIONS,
  FIELDERS_CHOICE_OPTIONS,
  FLY_OUT_OPTIONS,
  GROUND_OUT_OPTIONS,
  HIT_OPTIONS,
  LINE_OUT_OPTIONS,
  POP_OUT_OPTIONS,
  UNASSISTED_OUT_OPTIONS,
  type PAResultType,
} from "@/lib/charting/live";
import type { PitchResult } from "@/lib/charting/types";

import type { InPlayOutType, LiveABCountPreset } from "./types";

export const INNING_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);

export const OUT_OPTIONS = [0, 1, 2] as const;

export const BUNT_MODE_PITCH_RESULTS: readonly PitchResult[] = [
  "ball",
  "foul",
  "in_play",
];

export const COUNT_PRESET_OPTIONS: {
  value: LiveABCountPreset;
  label: string;
  detail: string;
}[] = [
  { value: "0-0", label: "0-0", detail: "Fresh count" },
  { value: "2-1", label: "2-1", detail: "Start ahead in the rep" },
  { value: "bunt", label: "Bunt", detail: "Bunt-only actions" },
];

export const OUT_TYPE_LABELS: Record<string, string> = {
  ground: "ground out",
  line: "line out",
  fly: "fly out",
  pop: "pop out",
  unassisted: "unassisted out",
  dp: "double play",
  error: "error",
  fc: "fielder's choice",
};

export const WIZARD_BTN =
  "flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:border-[var(--brand-primary-border)] hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary-subtle-text)] dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:border-[rgba(var(--brand-primary-rgb),0.35)] dark:hover:bg-zinc-900 dark:hover:text-zinc-50";

export const OUT_TYPE_TO_OPTIONS: Record<InPlayOutType, readonly PAResultType[]> = {
  ground: GROUND_OUT_OPTIONS,
  line: LINE_OUT_OPTIONS,
  fly: FLY_OUT_OPTIONS,
  pop: POP_OUT_OPTIONS,
  unassisted: UNASSISTED_OUT_OPTIONS,
  dp: DOUBLE_PLAY_OPTIONS,
  error: ERROR_OPTIONS,
  fc: FIELDERS_CHOICE_OPTIONS,
};

export const OUT_TYPE_CHOICES: { type: InPlayOutType; label: string }[] = [
  { type: "ground", label: "Ground Out" },
  { type: "line", label: "Line Out" },
  { type: "fly", label: "Fly Out" },
  { type: "pop", label: "Pop Out" },
  { type: "unassisted", label: "Unassisted Out" },
  { type: "dp", label: "Double Play" },
  { type: "error", label: "Error" },
  { type: "fc", label: "Fielder's Choice" },
];

export const HIT_LABELS: Record<(typeof HIT_OPTIONS)[number], string> = {
  "1B": "Single",
  "2B": "Double",
  "3B": "Triple",
  HR: "Home Run",
};
