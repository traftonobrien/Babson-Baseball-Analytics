import { pitchDisplayName } from "@/lib/pitchNames";

const PITCH_TYPE_ORDER: Record<string, number> = {
  Fastball: 0,
  Sinker: 1,
  Cutter: 2,
  "Fastball / Sinker": 3,
  Slider: 10,
  Sweeper: 11,
  Curveball: 12,
  "Knuckle Curve": 13,
  "Slider / Sweeper": 14,
  Changeup: 20,
  Splitter: 21,
  "Changeup / Splitter": 22,
};

function pitchTypeSortLabel(pitchType: string): string {
  return pitchDisplayName(pitchType).trim();
}

export function comparePitchTypes(a: string, b: string): number {
  const aLabel = pitchTypeSortLabel(a);
  const bLabel = pitchTypeSortLabel(b);
  const aRank = PITCH_TYPE_ORDER[aLabel] ?? 99;
  const bRank = PITCH_TYPE_ORDER[bLabel] ?? 99;

  if (aRank !== bRank) {
    return aRank - bRank;
  }

  return aLabel.localeCompare(bLabel);
}

export function sortPitchTypes<T>(
  items: readonly T[],
  getPitchType: (item: T) => string,
): T[] {
  return [...items].sort((a, b) =>
    comparePitchTypes(getPitchType(a), getPitchType(b)),
  );
}
