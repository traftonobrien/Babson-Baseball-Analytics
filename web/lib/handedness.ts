/**
 * Centralized arm-side / glove-side helper.
 *
 * Convention (after conversion):
 *   positive  = arm-side
 *   negative  = glove-side
 *   zero      = middle
 *
 * The CSV `h_miss_signed` is pre-normalized by the Python backend:
 *   negative = arm-side, positive = glove-side
 * so this function simply negates the value.
 *
 * If we later discover the sign is reversed in our dataset, change it
 * ONLY here — every consumer imports this function.
 */
export function toArmSideX(
  hMissSigned: number,
  _throwsHand: "R" | "L",
): number {
  return -hMissSigned;
}

/** Lane thresholds in inches */
const LANE_THRESHOLD = 4;

export type Lane = "Arm" | "Middle" | "Glove";

/**
 * Classify a pitch into a horizontal lane using the arm-side-positive
 * convention. Accepts the ALREADY-CONVERTED arm-side-positive value
 * (i.e. the output of toArmSideX, or -h_miss_signed).
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
