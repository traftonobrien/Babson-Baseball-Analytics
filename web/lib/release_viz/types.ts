export type Handedness = "R" | "L";

export type SlotTier = "extreme" | "low" | "mid" | "high";

export interface ReleaseAverages {
  // Identifiers
  playerId?: string;
  slug?: string;
  handedness: Handedness;
  
  // Core Metrics (Feet)
  releaseHeightFt: number | null;
  releaseSideFt: number | null;
  extensionFt?: number | null;
  
  // Aggregation info
  sampleSize?: number | null; // pitchCount
  
  // Derived Biomechanical Metrics
  armAngleDeg: number | null;
  slotLabel: string | null;
  slotTier: SlotTier | null;
  slotPercentile: number | null;
  
  // Optional breakdown
  byPitchType?: Record<string, { 
    n: number; 
    releaseHeightFt?: number; 
    releaseSideFt?: number; 
    extensionFt?: number; 
    armAngleDeg?: number 
  }>;
}

export type ArmAngleRay = {
  pitchType: string;
  count: number;
  releaseHeightFt: number;
  releaseSideFt: number;
  armAngleDeg: number;
  slotClass: { label: string; tier: SlotTier } | null;
  color: string;
  isPrimary: boolean;
};

export interface ReleaseVizConfig {
  width: number;
  height: number;
  groundY: number;
  centerX: number;
  maxHeightFt: number;
  maxSideFt: number;
}
