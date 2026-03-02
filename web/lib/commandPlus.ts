import type { Pitch } from "@/app/types";

export interface CommandPlusBaseline {
  avgMiss: number;
  count: number;
}

export type CommandPlusBaselines = Record<string, CommandPlusBaseline>;

export interface CommandPlusPitchTypeScore {
  pitchType: string;
  subjectCount: number;
  subjectAvgMiss: number;
  baselineCount: number;
  baselineAvgMiss: number | null;
  score: number | null;
  eligible: boolean;
  reason: "sample_too_small" | "missing_baseline" | "zero_miss" | null;
}

export interface CommandPlusResult {
  overall: number | null;
  qualifiedPitchCount: number;
  pitchTypeScores: CommandPlusPitchTypeScore[];
}

export interface CommandPlusBaselineRow {
  pitchType: string;
  avgMiss: number;
  count: number;
}

export const COMMAND_PLUS_MIN_PITCH_COUNT = 3;

const COMMAND_PLUS_UNKNOWN_VALUES = new Set([
  "",
  "UN",
  "UNK",
  "UNKNOWN",
  "OTHER",
  "N/A",
  "NA",
  "?",
  "-",
]);

type PitchWithRawType = Pitch & { raw_pitch_type?: string };

function normalizePitchTypeValue(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function getCommandPlusPitchType(pitch: Pitch): string | null {
  const rawType = normalizePitchTypeValue((pitch as PitchWithRawType).raw_pitch_type);
  if (!rawType || COMMAND_PLUS_UNKNOWN_VALUES.has(rawType)) {
    return null;
  }

  const normalizedType = normalizePitchTypeValue(pitch.pitch_type);
  if (!normalizedType || COMMAND_PLUS_UNKNOWN_VALUES.has(normalizedType)) {
    return null;
  }

  return normalizedType;
}

export function buildCommandPlusBaselines(pitches: Pitch[]): CommandPlusBaselines {
  const aggregates = new Map<string, { missSum: number; count: number }>();

  for (const pitch of pitches) {
    const pitchType = getCommandPlusPitchType(pitch);
    if (!pitchType || !Number.isFinite(pitch.total_miss_inches)) {
      continue;
    }

    const next = aggregates.get(pitchType) ?? { missSum: 0, count: 0 };
    next.missSum += pitch.total_miss_inches;
    next.count += 1;
    aggregates.set(pitchType, next);
  }

  const baselines: CommandPlusBaselines = {};
  for (const [pitchType, aggregate] of aggregates.entries()) {
    if (aggregate.count === 0) {
      continue;
    }
    baselines[pitchType] = {
      avgMiss: aggregate.missSum / aggregate.count,
      count: aggregate.count,
    };
  }

  return baselines;
}

export function listCommandPlusBaselines(
  baselines: CommandPlusBaselines,
): CommandPlusBaselineRow[] {
  return Object.entries(baselines)
    .map(([pitchType, baseline]) => ({
      pitchType,
      avgMiss: baseline.avgMiss,
      count: baseline.count,
    }))
    .sort((a, b) => b.count - a.count || a.pitchType.localeCompare(b.pitchType));
}

export interface ComputeCommandPlusOptions {
  minPitchTypeCount?: number;
}

export function computeCommandPlus(
  pitches: Pitch[],
  baselines: CommandPlusBaselines,
  options?: ComputeCommandPlusOptions,
): CommandPlusResult {
  const minPitchTypeCount = options?.minPitchTypeCount ?? COMMAND_PLUS_MIN_PITCH_COUNT;
  const aggregates = new Map<string, { missSum: number; count: number }>();

  for (const pitch of pitches) {
    const pitchType = getCommandPlusPitchType(pitch);
    if (!pitchType || !Number.isFinite(pitch.total_miss_inches)) {
      continue;
    }

    const next = aggregates.get(pitchType) ?? { missSum: 0, count: 0 };
    next.missSum += pitch.total_miss_inches;
    next.count += 1;
    aggregates.set(pitchType, next);
  }

  const pitchTypeScores: CommandPlusPitchTypeScore[] = [];
  let weightedScoreSum = 0;
  let qualifiedPitchCount = 0;

  for (const [pitchType, aggregate] of aggregates.entries()) {
    const subjectAvgMiss = aggregate.missSum / aggregate.count;
    const baseline = baselines[pitchType];
    let score: number | null = null;
    let eligible = true;
    let reason: CommandPlusPitchTypeScore["reason"] = null;

    if (aggregate.count < minPitchTypeCount) {
      eligible = false;
      reason = "sample_too_small";
    } else if (!baseline || baseline.count <= 0 || baseline.avgMiss <= 0) {
      eligible = false;
      reason = "missing_baseline";
    } else if (subjectAvgMiss <= 0) {
      eligible = false;
      reason = "zero_miss";
    } else {
      score = (baseline.avgMiss / subjectAvgMiss) * 100;
      weightedScoreSum += score * aggregate.count;
      qualifiedPitchCount += aggregate.count;
    }

    pitchTypeScores.push({
      pitchType,
      subjectCount: aggregate.count,
      subjectAvgMiss,
      baselineCount: baseline?.count ?? 0,
      baselineAvgMiss: baseline?.avgMiss ?? null,
      score,
      eligible,
      reason,
    });
  }

  pitchTypeScores.sort(
    (a, b) => b.subjectCount - a.subjectCount || a.pitchType.localeCompare(b.pitchType),
  );

  return {
    overall: qualifiedPitchCount > 0 ? weightedScoreSum / qualifiedPitchCount : null,
    qualifiedPitchCount,
    pitchTypeScores,
  };
}
