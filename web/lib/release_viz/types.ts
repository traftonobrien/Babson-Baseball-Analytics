export type Handedness = "R" | "L";

export interface ReleaseAverages {
  playerId?: string;
  slug?: string;
  handedness: Handedness;
  releaseHeightFt: number | null;
  releaseSideFt: number | null;
  extensionFt?: number | null;
  sampleSize?: number | null;
  armAngleDeg?: number | null;
  byPitchType?: Record<string, {
    n: number;
    releaseHeightFt: number;
    releaseSideFt: number;
    extensionFt?: number;
    armAngleDeg?: number;
  }>;
}

export interface ReleaseVizConfig {
  width: number;
  height: number;
  groundY: number;
  centerX: number;
  // Scale factors (px per foot)
  scaleX: number;
  scaleY: number;
}
