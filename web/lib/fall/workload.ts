import type { FallSessionType } from "@/lib/charting/fallSessionTypes";

export type FallWorkloadStressLevel = "low" | "watch" | "high";

export interface FallWorkloadStress {
  level: FallWorkloadStressLevel;
  label: string;
  detail: string;
}

const THRESHOLDS: Record<FallSessionType, { watch: number; high: number }> = {
  fall_bullpen: { watch: 36, high: 51 },
  fall_live_ab: { watch: 26, high: 41 },
  fall_intersquad: { watch: 46, high: 66 },
  fall_scrimmage: { watch: 46, high: 66 },
};

export function scoreFallWorkloadStress({
  sessionType,
  pitchCount,
}: {
  sessionType: FallSessionType;
  pitchCount: number;
}): FallWorkloadStress {
  const threshold = THRESHOLDS[sessionType];

  if (pitchCount >= threshold.high) {
    return {
      level: "high",
      label: "High stress",
      detail: `${pitchCount} pitches is above the ${threshold.high - 1}-pitch target for this session type.`,
    };
  }

  if (pitchCount >= threshold.watch) {
    return {
      level: "watch",
      label: "Workload watch",
      detail: `${pitchCount} pitches is inside the watch band for this session type.`,
    };
  }

  return {
    level: "low",
    label: "Normal load",
    detail: `${pitchCount} pitches is below the ${threshold.watch}-pitch watch band.`,
  };
}
