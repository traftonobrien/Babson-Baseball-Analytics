import type {
  ChartingInitialCount,
  ChartingPitch,
  ChartingPlateAppearance,
} from "./types";

function sortPitchesByOrder(pitches: ChartingPitch[]): ChartingPitch[] {
  return [...pitches].sort((lhs, rhs) => {
    if (lhs.pitchOrder === rhs.pitchOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.pitchOrder - rhs.pitchOrder;
  });
}

export function inferInitialCountFromPitches(
  pitches: ChartingPitch[],
  buntContext = false,
): ChartingInitialCount {
  if (buntContext) {
    return "Bunt";
  }

  const firstPitch = sortPitchesByOrder(pitches)[0];
  if (firstPitch?.ballsBefore === 2 && firstPitch.strikesBefore === 1) {
    return "2-1";
  }

  return "0-0";
}

export function resolvePlateAppearanceInitialCount(
  plateAppearance: Pick<
    ChartingPlateAppearance,
    "initialCount" | "buntContext"
  >,
  pitches: ChartingPitch[],
): ChartingInitialCount {
  return (
    plateAppearance.initialCount ??
    inferInitialCountFromPitches(pitches, plateAppearance.buntContext)
  );
}
