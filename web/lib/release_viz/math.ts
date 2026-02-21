/**
 * DO NOT remove computeLabelPlacement without updating:
 * - ArmAngleOverlay.tsx
 * - Associated tests
 * This function is required for chart stability.
 */

import type { Handedness, SlotTier } from "./types";
import type { TrackmanPitchTypeSummary } from "../trackman/metrics";

export const ARM_ANGLE_DECIMALS = 0;
export const FT_DECIMALS = 1;

// Constants
export const SHOULDER_BASELINE_FT = 5.5; 
export const BIOMECHANICAL_OFFSET_DEG = 40; // Correction to align shoulder-local angle with global consensus buckets

// -- Pure Math Helpers --

export function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(Math.max(val, min), max);
}

export function isFiniteNumber(val: unknown): val is number {
  return typeof val === "number" && Number.isFinite(val);
}

// -- Domain Logic --

export function computeArmAngleDeg(
  releaseHeightFt: number | null,
  releaseSideFt: number | null
): number | null {
  if (!isFiniteNumber(releaseHeightFt) || !isFiniteNumber(releaseSideFt)) {
    return null;
  }
  
  if (Math.abs(releaseSideFt) < 1e-6 && Math.abs(releaseHeightFt) < 1e-6) {
    return 0;
  }
  
  if (Math.abs(releaseSideFt) < 1e-6) {
    return 90; 
  }

  const angleRad = Math.atan2(releaseHeightFt - SHOULDER_BASELINE_FT, Math.abs(releaseSideFt));
  let deg = (angleRad * 180) / Math.PI;
  
  deg += BIOMECHANICAL_OFFSET_DEG;
  
  return clamp(deg, 0, 90);
}

export interface SlotClassification {
  angle: number;
  label: string;
  tier: SlotTier;
}

export function classifyArmSlot(angleDeg: number | null): SlotClassification | null {
  if (angleDeg === null) return null;
  
  let label = "";
  let tier: SlotTier = "mid";

  if (angleDeg < 15) {
    label = "Submarine";
    tier = "extreme";
  } else if (angleDeg < 30) {
    label = "Low Sidearm";
    tier = "low";
  } else if (angleDeg < 45) {
    label = "Sidearm";
    tier = "low";
  } else if (angleDeg < 60) {
    label = "3/4";
    tier = "mid";
  } else if (angleDeg < 75) {
    label = "High 3/4";
    tier = "high";
  } else {
    label = "Over-the-top";
    tier = "extreme";
  }

  return { angle: angleDeg, label, tier };
}

export function computeMLBArmSlotPercentile(angleDeg: number | null): number | null {
  if (angleDeg === null) return null;
  const mean = 55;
  const sd = 10;
  
  const z = (angleDeg - mean) / (sd * Math.sqrt(2));
  const t = 1.0 / (1.0 + 0.5 * Math.abs(z));
  const ans = t * Math.exp(-z*z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  
  const cdf = z >= 0 ? 1 - ans / 2 : ans / 2;
  return Math.round(cdf * 100);
}

// -- Vector Math for Visuals --

export function computeArmDirectionVector(
  angleDeg: number,
  radiusInches: number,
  hand: "R" | "L"
): { dx: number; dy: number } {
  const theta = (angleDeg * Math.PI) / 180;
  
  const rawDx = radiusInches * Math.cos(theta);
  const rawDy = radiusInches * Math.sin(theta);

  const dx = hand === "R" ? rawDx : -rawDx;
  const dy = rawDy;

  return { dx, dy };
}

export function computeLabelPlacement(
  rayEnd: { x: number; y: number },
  boundsRadius: number,
  labelDim: { w: number; h: number } = { w: 48, h: 22 }
): { x: number; y: number; anchor: "start" | "end" | "middle" } {
  const EXTENSION_FACTOR = 1.15;
  let x = rayEnd.x * EXTENSION_FACTOR;
  let y = rayEnd.y * EXTENSION_FACTOR;

  const halfW = labelDim.w / 2 + 4; 
  const halfH = labelDim.h / 2 + 4;
  
  const maxX = boundsRadius - halfW;
  const maxY = boundsRadius - halfH;
  
  x = clamp(x, -maxX, maxX);
  y = clamp(y, -maxY, maxY);
  
  return { 
    x, 
    y,
    anchor: "middle"
  };
}

export function computeMovementCentroid(
  pitchTypes: TrackmanPitchTypeSummary[],
  hand: Handedness
): { ivb: number; hb: number } | null {
  let totalW = 0;
  let totalIVB = 0;
  let totalHB = 0;

  for (const p of pitchTypes) {
    if (p.avgIvb == null || p.avgHb == null) continue;
    const w = p.count || 1; // Default to 1 if no count
    totalW += w;
    totalIVB += p.avgIvb * w;
    totalHB += p.avgHb * w;
  }

  if (totalW === 0) return null;

  return {
    ivb: totalIVB / totalW,
    hb: totalHB / totalW
  };
}

// -- Front View Graphic Logic --

export interface FrontViewLayout {
  width: number;
  height: number;
  centerX: number;
  groundY: number;
  ftToPxX: number;
  ftToPxY: number;
}

export function mapReleaseToFrontSVG(
  releaseHeightFt: number,
  releaseSideFt: number,
  layout: FrontViewLayout
): { x: number; y: number } {
  const x = layout.centerX + releaseSideFt * layout.ftToPxX;
  const y = layout.groundY - releaseHeightFt * layout.ftToPxY;
  return { x, y };
}

export function computeShoulderAnchor(
  layout: FrontViewLayout,
  handedness: Handedness,
  releaseHeightFt?: number,
  angleDeg?: number | null
): { x: number; y: number } {
  const offsetPx = 25; 
  const x = handedness === "R" 
    ? layout.centerX - offsetPx 
    : layout.centerX + offsetPx;

  // New Biomechanical Logic: Shoulder shifts with slot
  // If we have release height and angle, we can solve for shoulder Y
  // shoulderY = releaseY + armLen * sin(angle) (in SVG coords, Y increases down)
  // Wait, angle 90 (OTT) -> arm vertical. Shoulder is below release.
  // releaseY is top (small Y). shoulderY is bigger Y.
  // dy = armLen * sin(angle).
  // shoulderY = releaseY + dy.
  
  if (releaseHeightFt !== undefined && angleDeg != null) {
    const ARM_LEN_PX = 90; // Must match usage in component
    const theta = (angleDeg * Math.PI) / 180;
    const releaseY = layout.groundY - releaseHeightFt * layout.ftToPxY;
    const dy = ARM_LEN_PX * Math.sin(theta);
    return { x, y: releaseY + dy };
  }

  // Fallback to fixed baseline
  const shoulderY = layout.groundY - (SHOULDER_BASELINE_FT * layout.ftToPxY);
  return { x, y: shoulderY };
}

export function computeArmPath(
  shoulder: { x: number; y: number },
  release: { x: number; y: number },
  handedness: Handedness,
  angleDeg?: number | null
): { shoulder: { x: number, y: number }, elbow: { x: number, y: number }, hand: { x: number, y: number } } {
  const dx = release.x - shoulder.x;
  const dy = release.y - shoulder.y; 
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  const midX = (shoulder.x + release.x) / 2;
  const midY = (shoulder.y + release.y) / 2;
  
  // Non-linear bend factor
  // 60 deg = minimal bend
  // < 30 deg = aggressive
  // > 75 deg = straight
  let bendStrength = 0.15; // Default
  
  if (angleDeg != null) {
    const deviation = Math.abs(angleDeg - 60);
    // Normalized 0-60 roughly
    // deviation 0 -> bend 0
    // deviation 30 (angle 30 or 90) -> bend high?
    // Actually OTT should be straight.
    
    if (angleDeg > 70) {
      bendStrength = 0.02; // Very straight
    } else {
      // 60 -> 0. 30 -> 0.2. 
      bendStrength = (60 - angleDeg) / 60 * 0.25;
      if (bendStrength < 0) bendStrength = 0.05; // 60-70 range
    }
  }
  
  const bendFactor = Math.max(0.02, bendStrength) * dist;
  
  let nx = -dy;
  let ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny);
  if (len > 0) { nx /= len; ny /= len; }
  
  if (handedness === "R" && nx > 0) { nx = -nx; ny = -ny; }
  if (handedness === "L" && nx < 0) { nx = -nx; ny = -ny; }
  
  return {
    shoulder,
    elbow: { x: midX + nx * bendFactor, y: midY + ny * bendFactor },
    hand: release
  };
}

// -- Formatting --

export function formatFt(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "-";
  return val.toFixed(FT_DECIMALS);
}

export function formatDeg(val: number | null | undefined): string {
  if (val == null || !Number.isFinite(val)) return "-";
  return Math.round(val).toFixed(0) + "°";
}
