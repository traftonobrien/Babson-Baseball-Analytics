import { resolvePlateAppearanceInitialCount } from "@/lib/charting/live";
import type {
  ChartingGameSnapshot,
  ChartingInitialCount,
  PitchResult,
  PitchType,
} from "@/lib/charting/types";

import type {
  LiveABCountPreset,
  SaveState,
} from "./types";

export const deriveEditorCountPresetFromPA = (
  snapshot: ChartingGameSnapshot,
  plateAppearanceId: string,
): LiveABCountPreset => {
  const plateAppearance =
    snapshot.plateAppearances.find((entry) => entry.id === plateAppearanceId) ?? null;
  if (!plateAppearance) {
    return "0-0";
  }

  const initialCount = resolvePlateAppearanceInitialCount(
    plateAppearance,
    snapshot.pitches.filter((pitch) => pitch.paId === plateAppearanceId),
  );

  switch (initialCount) {
    case "2-1":
      return "2-1";
    case "Bunt":
      return "bunt";
    case "0-0":
    default:
      return "0-0";
  }
};

export const deriveCountPresetForUndo = (
  previousSnapshot: ChartingGameSnapshot,
  nextSnapshot: ChartingGameSnapshot,
): LiveABCountPreset | null => {
  const removedPlateAppearanceIds = new Set(
    previousSnapshot.plateAppearances.map((plateAppearance) => plateAppearance.id),
  );
  for (const plateAppearance of nextSnapshot.plateAppearances) {
    removedPlateAppearanceIds.delete(plateAppearance.id);
  }

  const removedPlateAppearanceId = removedPlateAppearanceIds.values().next().value;
  if (!removedPlateAppearanceId) {
    return null;
  }

  const removedPlateAppearance =
    previousSnapshot.plateAppearances.find(
      (plateAppearance) => plateAppearance.id === removedPlateAppearanceId,
    ) ?? null;
  if (!removedPlateAppearance || removedPlateAppearance.resultCode) {
    return null;
  }

  const removedPitches = previousSnapshot.pitches
    .filter((pitch) => pitch.paId === removedPlateAppearance.id)
    .sort((left, right) => left.pitchOrder - right.pitchOrder);
  if (removedPitches.length !== 1) {
    return null;
  }

  switch (resolvePlateAppearanceInitialCount(removedPlateAppearance, removedPitches)) {
    case "2-1":
      return "2-1";
    case "Bunt":
      return "bunt";
    case "0-0":
    default:
      return "0-0";
  }
};

export const countPresetFromInitialCount = (
  initialCount: ChartingInitialCount,
): LiveABCountPreset => {
  switch (initialCount) {
    case "2-1":
      return "2-1";
    case "Bunt":
      return "bunt";
    case "0-0":
    default:
      return "0-0";
  }
};

export const initialCountFromPreset = (
  initialCount: LiveABCountPreset,
): ChartingInitialCount => {
  switch (initialCount) {
    case "2-1":
      return "2-1";
    case "bunt":
      return "Bunt";
    case "0-0":
    default:
      return "0-0";
  }
};

interface BuildPendingPitchSummaryArgs {
  selectedPitchType: PitchType | null;
  selectedLocation: number | null;
  selectedPitchResult: PitchResult | null;
  pendingVelocity: string;
  buntMode: boolean;
}

export const buildPendingPitchSummary = ({
  selectedPitchType,
  selectedLocation,
  selectedPitchResult,
  pendingVelocity,
  buntMode,
}: BuildPendingPitchSummaryArgs): string => {
  const pieces = [
    selectedPitchType ?? "Pitch type",
    selectedPitchResult === "hit_by_pitch"
      ? "No zone"
      : selectedLocation
        ? `Cell ${selectedLocation}`
        : "Zone",
    selectedPitchResult ? pitchResultLabel(selectedPitchResult, buntMode) : "Action",
  ];

  if (pendingVelocity) {
    pieces.push(`${pendingVelocity} mph`);
  }

  return `${buntMode ? "Bunt • " : ""}${pieces.join(" • ")}`;
};

export const detailTextForClosure = (closureState: string): string => {
  switch (closureState) {
    case "strikeout":
      return "Strike Three Logged";
    case "walk":
      return "Ball Four Logged";
    case "hit_by_pitch":
      return "Hit By Pitch Logged";
    case "in_play":
      return "Ball In Play";
    default:
      return "Close Plate Appearance";
  }
};

export const parseVelocity = (value: string): number | null => {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const safeReadText = async (response: Response): Promise<string | null> => {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? null;
  } catch {
    return null;
  }
};

export const getSaveStatusLabel = (
  saveState: SaveState,
  statusMessage: string | null,
  errorMessage: string | null,
): string => {
  if (saveState === "saving") {
    return "Saving live snapshot";
  }
  if (saveState === "saved") {
    return statusMessage ?? "All changes synced";
  }
  if (saveState === "error") {
    return errorMessage ?? "Save failed";
  }
  return "Ready";
};

export const pitchTypeDescription = (type: PitchType): string => {
  switch (type) {
    case "Fastball":
      return "Primary heater, sinker, or ride profile.";
    case "Slider":
      return "Sweeper or lateral breaker.";
    case "Curveball":
      return "Vertical breaking ball.";
    case "Changeup":
      return "Offspeed separation pitch.";
    case "Split/Cut":
      return "Splitter, cutter, or hybrid offshoot.";
    case "Other":
      return "Unclassified or custom pitch type.";
  }
};

export const pitchResultLabel = (
  result: PitchResult,
  isBuntMode = false,
): string => {
  switch (result) {
    case "ball":
      return "Ball";
    case "called_strike":
      return "Called Strike";
    case "swinging_strike":
      return "Swinging Strike";
    case "foul":
      return isBuntMode ? "Foul Bunt" : "Foul";
    case "bunt_foul":
      return isBuntMode ? "Foul Bunt" : "Bunt Foul";
    case "in_play":
      return isBuntMode ? "Fair Bunt" : "In Play";
    case "hit_by_pitch":
      return "HBP";
  }
};

export const pitchResultDescription = (
  result: PitchResult,
  isBuntMode = false,
): string => {
  switch (result) {
    case "ball":
      return "Advances the count toward a walk.";
    case "called_strike":
      return "Taken strike without a swing.";
    case "swinging_strike":
      return "Swing and miss.";
    case "foul":
      return isBuntMode
        ? "Foul bunt, strikeout on two strikes."
        : "Foul ball, capped at two strikes.";
    case "bunt_foul":
      return "Bunt attempt foul, strikeout on two strikes.";
    case "in_play":
      return isBuntMode
        ? "Triggers bunt-result closeout selection."
        : "Triggers PA closeout selection.";
    case "hit_by_pitch":
      return "No zone required for commit.";
  }
};

export type SelectionTone = "emerald" | "rose" | "amber" | "sky" | "violet" | "slate";

export const pitchTypeTone = (type: PitchType): SelectionTone => {
  switch (type) {
    case "Fastball":
      return "rose";
    case "Slider":
      return "amber";
    case "Curveball":
      return "sky";
    case "Changeup":
      return "emerald";
    case "Split/Cut":
      return "violet";
    case "Other":
      return "slate";
  }
};

export const pitchResultTone = (result: PitchResult): SelectionTone => {
  switch (result) {
    case "ball":
      return "emerald";
    case "called_strike":
      return "rose";
    case "swinging_strike":
      return "amber";
    case "foul":
    case "bunt_foul":
      return "slate";
    case "in_play":
      return "sky";
    case "hit_by_pitch":
      return "violet";
  }
};
