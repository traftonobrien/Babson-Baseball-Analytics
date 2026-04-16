import type { PitchResult } from "./types";

/** Pitch results shown as buttons in the charting UI. Excludes bunt_foul (handled by backend/PDF but not exposed in UI). */
export const GAME_PITCH_RESULTS = [
  "ball",
  "called_strike",
  "swinging_strike",
  "foul",
  "in_play",
  "hit_by_pitch",
] as const satisfies readonly PitchResult[];

export const HIT_OPTIONS = ["1B", "2B", "3B", "HR"] as const;
/** Hit variants (single + error, etc.) — same “hit” family as `HIT_OPTIONS` for lineup advancement. */
export const HIT_ERROR_OPTIONS = ["1B+E"] as const;
/** Sacrifice outs — one out, no hit credited to batter. */
export const SAC_OPTIONS = ["SAC", "SF"] as const;
export const FLY_OUT_OPTIONS = [
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
] as const;
export const LINE_OUT_OPTIONS = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
] as const;
export const POP_OUT_OPTIONS = [
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
] as const;
/** Scorebook ground outs; `3-1` = first baseman to pitcher (not a 3-1 count). */
export const GROUND_OUT_OPTIONS = ["1-3", "2-3", "3-1", "4-3", "5-3", "6-3"] as const;
export const UNASSISTED_OUT_OPTIONS = [
  "1U",
  "2U",
  "3U",
  "4U",
  "5U",
  "6U",
  "7U",
  "8U",
  "9U",
] as const;
export const DOUBLE_PLAY_OPTIONS = [
  "DP",
  "1-6-3 DP",
  "2-4-3 DP",
  "2-6-3 DP",
  "3-6-3 DP",
  "4-6-3 DP",
  "5-4-3 DP",
  "6-4-3 DP",
] as const;
export const ERROR_OPTIONS = [
  "E1",
  "E2",
  "E3",
  "E4",
  "E5",
  "E6",
  "E7",
  "E8",
  "E9",
] as const;
export const FIELDERS_CHOICE_OPTIONS = [
  "FC",
  "FC 1-2",
  "FC 1-6",
  "FC 2-4",
  "FC 2-5",
  "FC 3-6",
  "FC 4-6",
  "FC 5-2",
  "FC 5-4",
  "FC 6-4",
  "FC 6-5",
] as const;

/** Catcher / throwdown interference scored as one out (charter shorthand). */
export const SPECIAL_PLAY_OPTIONS = ["ITD"] as const;

export const BASERUNNER_OUT_OPTIONS = ["CS", "PO"] as const;

export const PA_RESULT_OPTIONS = [
  "K",
  "BB",
  "HBP",
  "IBB",
  ...HIT_OPTIONS,
  ...HIT_ERROR_OPTIONS,
  ...SAC_OPTIONS,
  ...FLY_OUT_OPTIONS,
  ...LINE_OUT_OPTIONS,
  ...POP_OUT_OPTIONS,
  ...GROUND_OUT_OPTIONS,
  ...UNASSISTED_OUT_OPTIONS,
  ...DOUBLE_PLAY_OPTIONS,
  ...ERROR_OPTIONS,
  ...FIELDERS_CHOICE_OPTIONS,
  ...SPECIAL_PLAY_OPTIONS,
  ...BASERUNNER_OUT_OPTIONS,
] as const;

export type PAResultType = (typeof PA_RESULT_OPTIONS)[number];
