import type { Pitch } from "@/app/types";

/**
 * Centralized arm-side / glove-side helpers.
 *
 * Convention (after conversion):
 *   positive  = arm-side
 *   negative  = glove-side
 *   zero      = middle
 */

/**
 * Compute arm-side-positive horizontal miss in inches from raw pitch
 * coordinates.  Uses ball_x / target_x for direction and h_miss_inches
 * for calibrated magnitude.  Never reads h_miss_signed or pitcher_hand
 * from the pitch row — handedness is an explicit param resolved from
 * Arsenals.csv.
 *
 * Formula:
 *   dx = ball_x - target_x   (positive = toward 1B)
 *   arm_sign = 1 (RHP) | -1 (LHP)
 *   result = sign(dx) * |h_miss_inches| * arm_sign
 *
 * Positive result = arm-side miss, negative = glove-side miss.
 */
export function pitchArmSideX(p: Pitch, pitcherHand: "R" | "L"): number {
  const dx = p.ball_x - p.target_x;
  if (!Number.isFinite(dx) || dx === 0) return 0;
  const mag = p.h_miss_inches;
  if (!Number.isFinite(mag)) return 0;
  const armSign = pitcherHand === "R" ? 1 : -1;
  return Math.sign(dx) * Math.abs(mag) * armSign;
}

/** Lane thresholds in inches */
const LANE_THRESHOLD = 4;

export type Lane = "Arm" | "Middle" | "Glove";

/**
 * Classify a pitch into a horizontal lane using the arm-side-positive
 * convention. Accepts the output of pitchArmSideX().
 */
export function laneOf(armSideX: number): Lane {
  if (armSideX >= LANE_THRESHOLD) return "Arm";
  if (armSideX <= -LANE_THRESHOLD) return "Glove";
  return "Middle";
}

/**
 * Human-readable lane label.
 * RHP: Arm = 1B side, Glove = 3B side
 * LHP: Arm = 3B side, Glove = 1B side
 */
export function laneDisplayName(lane: string, throwsHand: string = "R"): string {
  if (lane === "Middle") return "Middle";
  if (throwsHand === "R") {
    return lane === "Arm" ? "Arm (1B)" : "Glove (3B)";
  }
  return lane === "Arm" ? "Arm (3B)" : "Glove (1B)";
}

/**
 * Direction label from an arm-side-positive value.
 *   positive → "arm-side"
 *   negative → "glove-side"
 *   zero     → "middle"
 */
export function hDirectionLabel(armSideX: number): string {
  if (armSideX > 0) return "arm-side";
  if (armSideX < 0) return "glove-side";
  return "middle";
}
