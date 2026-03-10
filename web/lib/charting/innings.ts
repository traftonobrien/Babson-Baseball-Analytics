import type { ChartingPitcherSegment, ChartingPlateAppearance } from "./types";

export function countPitcherInnings(
  segments: Pick<ChartingPitcherSegment, "enteredInning" | "exitedInning">[],
  plateAppearances: Pick<ChartingPlateAppearance, "inning">[]
): number {
  const inningsFromPas = new Set<number>();

  for (const plateAppearance of plateAppearances) {
    if (Number.isInteger(plateAppearance.inning) && plateAppearance.inning > 0) {
      inningsFromPas.add(plateAppearance.inning);
    }
  }

  if (inningsFromPas.size > 0) {
    return inningsFromPas.size;
  }

  const inningsFromSegments = new Set<number>();

  for (const segment of segments) {
    if (segment.enteredInning === null) {
      continue;
    }

    const start = segment.enteredInning;
    const end = segment.exitedInning ?? segment.enteredInning;
    const lower = Math.min(start, end);
    const upper = Math.max(start, end);

    for (let inning = lower; inning <= upper; inning += 1) {
      inningsFromSegments.add(inning);
    }
  }

  return inningsFromSegments.size;
}
