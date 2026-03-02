import type { CommandPlusResult } from "@/lib/commandPlus";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";

export interface PitchingPlusStuffPitch {
  pitchType: string;
  meanStuffPlus: number | null;
}

export type PitchingPlusNotReadyReason =
  | "missing_live_command"
  | "missing_stuff"
  | "no_overlap";

export type PitchingPlusPitchTypeReason =
  | "missing_stuff"
  | "ambiguous_stuff_match"
  | null;

export interface PitchingPlusPitchTypeRow {
  commandPitchType: string;
  stuffPitchTypes: string[];
  commandCount: number;
  usageShare: number;
  hybridWeight: number;
  stuffPlus: number | null;
  commandPlus: number | null;
  pitchingPlus: number | null;
  included: boolean;
  reason: PitchingPlusPitchTypeReason;
}

export interface PitchingPlusResult {
  ready: boolean;
  overall: number | null;
  reason: PitchingPlusNotReadyReason | null;
  overlapPitchCount: number;
  overlapPitchTypeCount: number;
  eligibleCommandPitchTypeCount: number;
  excludedPitchTypeCount: number;
  stuffComponent: number | null;
  commandComponent: number | null;
  pitchTypeRows: PitchingPlusPitchTypeRow[];
}

export interface ComputePitchingPlusOptions {
  stuffWeight?: number;
  commandWeight?: number;
  equalShareWeight?: number;
  usageWeight?: number;
}

export const PITCHING_PLUS_STUFF_WEIGHT = 0.6;
export const PITCHING_PLUS_COMMAND_WEIGHT = 0.4;
export const PITCHING_PLUS_EQUAL_SHARE_WEIGHT = 0.5;
export const PITCHING_PLUS_USAGE_WEIGHT = 0.5;

interface PendingPitchingPlusRow {
  commandPitchType: string;
  stuffPitchTypes: string[];
  commandCount: number;
  stuffPlus: number | null;
  commandPlus: number;
  included: boolean;
  reason: PitchingPlusPitchTypeReason;
}

function normalizeStuffLabel(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function candidateCommandPitchTypes(stuffPitchType: string): string[] {
  const label = normalizeStuffLabel(stuffPitchType);

  switch (label) {
    case "FASTBALL":
    case "4SEAM":
    case "FOURSEAM":
    case "FOURSEAMFASTBALL":
      return ["FF"];
    case "SINKER":
    case "2SEAM":
    case "TWOSEAM":
    case "TWOSEAMFASTBALL":
      return ["SI"];
    case "SLIDER":
    case "SWEEPER":
      return ["SL"];
    case "CURVEBALL":
    case "CURVE":
    case "KNUCKLECURVE":
      return ["CB", "CU"];
    case "CHANGEUP":
    case "CHANGEUPS":
      return ["CH"];
    case "SPLITTER":
    case "SPLITFINGER":
    case "SPLITFINGERFASTBALL":
      return ["FS"];
    case "CUTTER":
      return ["FC", "CT"];
    default:
      return [];
  }
}

function emptyResult(reason: PitchingPlusNotReadyReason): PitchingPlusResult {
  return {
    ready: false,
    overall: null,
    reason,
    overlapPitchCount: 0,
    overlapPitchTypeCount: 0,
    eligibleCommandPitchTypeCount: 0,
    excludedPitchTypeCount: 0,
    stuffComponent: null,
    commandComponent: null,
    pitchTypeRows: [],
  };
}

export function computePitchingPlus(
  playerId: string,
  commandResult: CommandPlusResult,
  stuffPitches: PitchingPlusStuffPitch[],
  options?: ComputePitchingPlusOptions,
): PitchingPlusResult {
  const rawStuffWeight = options?.stuffWeight ?? PITCHING_PLUS_STUFF_WEIGHT;
  const rawCommandWeight =
    options?.commandWeight ?? PITCHING_PLUS_COMMAND_WEIGHT;
  const rawEqualShareWeight =
    options?.equalShareWeight ?? PITCHING_PLUS_EQUAL_SHARE_WEIGHT;
  const rawUsageWeight = options?.usageWeight ?? PITCHING_PLUS_USAGE_WEIGHT;

  const componentWeightTotal = rawStuffWeight + rawCommandWeight;
  const rollupWeightTotal = rawEqualShareWeight + rawUsageWeight;

  const stuffWeight =
    componentWeightTotal > 0
      ? rawStuffWeight / componentWeightTotal
      : PITCHING_PLUS_STUFF_WEIGHT;
  const commandWeight =
    componentWeightTotal > 0
      ? rawCommandWeight / componentWeightTotal
      : PITCHING_PLUS_COMMAND_WEIGHT;
  const equalShareWeight =
    rollupWeightTotal > 0
      ? rawEqualShareWeight / rollupWeightTotal
      : PITCHING_PLUS_EQUAL_SHARE_WEIGHT;
  const usageWeight =
    rollupWeightTotal > 0
      ? rawUsageWeight / rollupWeightTotal
      : PITCHING_PLUS_USAGE_WEIGHT;

  const eligibleCommandRows = commandResult.pitchTypeScores.filter(
    (row) => row.eligible && row.score !== null && row.subjectCount > 0,
  );
  if (eligibleCommandRows.length === 0) {
    return emptyResult("missing_live_command");
  }

  const commandRowsByType = new Map(
    eligibleCommandRows.map((row) => [row.pitchType, row] as const),
  );

  const aggregatedStuff = new Map<
    string,
    { stuffSum: number; count: number; labels: Set<string> }
  >();
  const ambiguousTypes = new Set<string>();
  let validStuffCount = 0;

  for (const stuffPitch of stuffPitches) {
    if (
      !Number.isFinite(stuffPitch.meanStuffPlus) ||
      (stuffPitch.meanStuffPlus as number) <= 0
    ) {
      continue;
    }

    validStuffCount += 1;
    const displayPitchType = getStuffPlusDisplayPitchType(
      playerId,
      stuffPitch.pitchType,
    );
    const candidates = candidateCommandPitchTypes(displayPitchType);
    const matches = candidates.filter((candidate) =>
      commandRowsByType.has(candidate),
    );

    if (matches.length === 1) {
      const commandPitchType = matches[0];
      if (ambiguousTypes.has(commandPitchType)) {
        continue;
      }

      const next = aggregatedStuff.get(commandPitchType) ?? {
        stuffSum: 0,
        count: 0,
        labels: new Set<string>(),
      };
      next.stuffSum += stuffPitch.meanStuffPlus as number;
      next.count += 1;
      next.labels.add(displayPitchType);
      aggregatedStuff.set(commandPitchType, next);
      continue;
    }

    if (matches.length > 1) {
      for (const commandPitchType of matches) {
        ambiguousTypes.add(commandPitchType);
        aggregatedStuff.delete(commandPitchType);
      }
    }
  }

  if (validStuffCount === 0) {
    return {
      ...emptyResult("missing_stuff"),
      eligibleCommandPitchTypeCount: eligibleCommandRows.length,
    };
  }

  const pendingRows: PendingPitchingPlusRow[] = eligibleCommandRows.map((row) => {
    if (ambiguousTypes.has(row.pitchType)) {
      return {
        commandPitchType: row.pitchType,
        stuffPitchTypes: [],
        commandCount: row.subjectCount,
        stuffPlus: null,
        commandPlus: row.score as number,
        included: false,
        reason: "ambiguous_stuff_match",
      };
    }

    const stuffAggregate = aggregatedStuff.get(row.pitchType);
    if (!stuffAggregate || stuffAggregate.count === 0) {
      return {
        commandPitchType: row.pitchType,
        stuffPitchTypes: [],
        commandCount: row.subjectCount,
        stuffPlus: null,
        commandPlus: row.score as number,
        included: false,
        reason: "missing_stuff",
      };
    }

    return {
      commandPitchType: row.pitchType,
      stuffPitchTypes: Array.from(stuffAggregate.labels).sort(),
      commandCount: row.subjectCount,
      // Trackman arsenal exports do not include pitch counts here, so duplicate
      // matches are averaged evenly rather than pitch-weighted.
      stuffPlus: stuffAggregate.stuffSum / stuffAggregate.count,
      commandPlus: row.score as number,
      included: true,
      reason: null,
    };
  });

  const includedRows = pendingRows.filter((row) => row.included);
  if (includedRows.length === 0) {
    return {
      ...emptyResult("no_overlap"),
      eligibleCommandPitchTypeCount: eligibleCommandRows.length,
      excludedPitchTypeCount: eligibleCommandRows.length,
      pitchTypeRows: pendingRows
        .map((row) => ({
          ...row,
          usageShare: 0,
          hybridWeight: 0,
          pitchingPlus: null,
        }))
        .sort(
          (a, b) =>
            b.commandCount - a.commandCount ||
            a.commandPitchType.localeCompare(b.commandPitchType),
        ),
    };
  }

  const overlapPitchCount = includedRows.reduce(
    (sum, row) => sum + row.commandCount,
    0,
  );
  const overlapPitchTypeCount = includedRows.length;
  const equalShare = 1 / overlapPitchTypeCount;

  let overall = 0;
  let stuffComponent = 0;
  let commandComponent = 0;

  const pitchTypeRows: PitchingPlusPitchTypeRow[] = pendingRows.map((row) => {
    if (!row.included || row.stuffPlus === null) {
      return {
        ...row,
        usageShare: 0,
        hybridWeight: 0,
        pitchingPlus: null,
      };
    }

    const usageShare =
      overlapPitchCount > 0 ? row.commandCount / overlapPitchCount : 0;
    const hybridWeight =
      equalShareWeight * equalShare + usageWeight * usageShare;
    const pitchingPlus =
      100 *
      Math.pow(row.stuffPlus / 100, stuffWeight) *
      Math.pow(row.commandPlus / 100, commandWeight);

    overall += pitchingPlus * hybridWeight;
    stuffComponent += row.stuffPlus * hybridWeight;
    commandComponent += row.commandPlus * hybridWeight;

    return {
      ...row,
      usageShare,
      hybridWeight,
      pitchingPlus,
    };
  });

  pitchTypeRows.sort((a, b) => {
    if (a.included !== b.included) return a.included ? -1 : 1;
    return (
      b.commandCount - a.commandCount ||
      a.commandPitchType.localeCompare(b.commandPitchType)
    );
  });

  return {
    ready: true,
    overall,
    reason: null,
    overlapPitchCount,
    overlapPitchTypeCount,
    eligibleCommandPitchTypeCount: eligibleCommandRows.length,
    excludedPitchTypeCount: eligibleCommandRows.length - overlapPitchTypeCount,
    stuffComponent,
    commandComponent,
    pitchTypeRows,
  };
}
