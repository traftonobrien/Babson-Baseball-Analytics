import { describe, it, expect } from "vitest";
import {
  pitchArmSideX,
  pitchPhysicalX,
  laneOf,
  laneDisplayName,
  hDirectionLabel,
} from "./handedness";
import type { Pitch } from "@/app/types";

/** Minimal pitch stub with only the fields pitchArmSideX reads. */
function makePitch(overrides: Partial<Pitch>): Pitch {
  return {
    pitch_number: 1,
    pitcher_name: "Test",
    pitcher_hand: "R",
    pitch_type: "FF",
    target_frame: 0,
    arrival_frame: 0,
    target_x: 500,
    target_y: 400,
    ball_x: 500,
    ball_y: 400,
    total_miss_px: 0,
    total_miss_inches: 0,
    h_miss_px: 0,
    h_miss_inches: 0,
    h_direction: "",
    h_miss_signed: 0,
    v_miss_px: 0,
    v_miss_inches: 0,
    v_direction: "",
    v_miss_signed: 0,
    target_quadrant: "",
    result_quadrant: "",
    target_zone: "",
    timestamp: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  pitchArmSideX                                                      */
/* ------------------------------------------------------------------ */

describe("pitchArmSideX", () => {
  it("RHP: ball right of target (dx > 0) => positive (arm-side)", () => {
    // dx = 520 - 500 = 20 (toward 1B)
    const p = makePitch({ ball_x: 520, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "R")).toBeCloseTo(5);
  });

  it("RHP: ball left of target (dx < 0) => negative (glove-side)", () => {
    // dx = 480 - 500 = -20 (toward 3B)
    const p = makePitch({ ball_x: 480, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "R")).toBeCloseTo(-5);
  });

  it("LHP: ball right of target (dx > 0) => negative (glove-side)", () => {
    // For LHP, toward 1B is glove-side
    const p = makePitch({ ball_x: 520, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "L")).toBeCloseTo(-5);
  });

  it("LHP: ball left of target (dx < 0) => positive (arm-side)", () => {
    // For LHP, toward 3B is arm-side
    const p = makePitch({ ball_x: 480, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "L")).toBeCloseTo(5);
  });

  it("dx = 0 => returns 0 regardless of hand", () => {
    const p = makePitch({ ball_x: 500, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "R")).toBe(0);
    expect(pitchArmSideX(p, "L")).toBe(0);
  });

  it("NaN ball_x => returns 0", () => {
    const p = makePitch({ ball_x: NaN, target_x: 500, h_miss_inches: 5 });
    expect(pitchArmSideX(p, "R")).toBe(0);
  });

  it("uses magnitude of h_miss_inches (handles negative h_miss_inches)", () => {
    const p = makePitch({ ball_x: 520, target_x: 500, h_miss_inches: -3 });
    expect(pitchArmSideX(p, "R")).toBeCloseTo(3);
  });
});

/* ------------------------------------------------------------------ */
/*  Lane classification (flip test)                                    */
/* ------------------------------------------------------------------ */

describe("lane classification flips correctly by hand", () => {
  // A pitch that goes to the 1B side (dx > 0) by 6 inches
  const pRight = makePitch({ ball_x: 530, target_x: 500, h_miss_inches: 6 });

  it("RHP: 1B-side miss (dx > 0, 6 in) => Arm lane", () => {
    expect(laneOf(pitchArmSideX(pRight, "R"))).toBe("Arm");
  });

  it("LHP: same 1B-side miss => Glove lane", () => {
    expect(laneOf(pitchArmSideX(pRight, "L"))).toBe("Glove");
  });

  // A pitch that goes to the 3B side (dx < 0) by 6 inches
  const pLeft = makePitch({ ball_x: 470, target_x: 500, h_miss_inches: 6 });

  it("RHP: 3B-side miss (dx < 0, 6 in) => Glove lane", () => {
    expect(laneOf(pitchArmSideX(pLeft, "R"))).toBe("Glove");
  });

  it("LHP: same 3B-side miss => Arm lane", () => {
    expect(laneOf(pitchArmSideX(pLeft, "L"))).toBe("Arm");
  });

  // A pitch right down the middle (small dx, 2 inches)
  const pMiddle = makePitch({ ball_x: 510, target_x: 500, h_miss_inches: 2 });

  it("Middle lane for small dx regardless of hand", () => {
    expect(laneOf(pitchArmSideX(pMiddle, "R"))).toBe("Middle");
    expect(laneOf(pitchArmSideX(pMiddle, "L"))).toBe("Middle");
  });
});

/* ------------------------------------------------------------------ */
/*  laneDisplayName                                                    */
/* ------------------------------------------------------------------ */

describe("laneDisplayName", () => {
  it("RHP: Arm => Arm (1B)", () => {
    expect(laneDisplayName("Arm", "R")).toBe("Arm (1B)");
  });

  it("RHP: Glove => Glove (3B)", () => {
    expect(laneDisplayName("Glove", "R")).toBe("Glove (3B)");
  });

  it("LHP: Arm => Arm (3B)", () => {
    expect(laneDisplayName("Arm", "L")).toBe("Arm (3B)");
  });

  it("LHP: Glove => Glove (1B)", () => {
    expect(laneDisplayName("Glove", "L")).toBe("Glove (1B)");
  });

  it("Middle is always Middle", () => {
    expect(laneDisplayName("Middle", "R")).toBe("Middle");
    expect(laneDisplayName("Middle", "L")).toBe("Middle");
  });
});

/* ------------------------------------------------------------------ */
/*  hDirectionLabel                                                    */
/* ------------------------------------------------------------------ */

describe("hDirectionLabel", () => {
  it("positive => arm-side", () => {
    expect(hDirectionLabel(3)).toBe("arm-side");
  });

  it("negative => glove-side", () => {
    expect(hDirectionLabel(-3)).toBe("glove-side");
  });

  it("zero => middle", () => {
    expect(hDirectionLabel(0)).toBe("middle");
  });
});

/* ------------------------------------------------------------------ */
/*  CBurrows1 real-data regression tests                               */
/* ------------------------------------------------------------------ */

describe("CBurrows1 (LHP) regression: CSV h_direction is wrong, computed is correct", () => {
  // Pitch #5 from CBurrows1 2025_03_26 CSV:
  //   ball_x=642.2, target_x=689.7 → dx = -47.5 (ball LEFT of target)
  //   h_miss_inches=8.17
  //   CSV says h_direction="glove-side" (computed assuming RHP — WRONG)
  //   Arsenals says CBurrows1 is LHP
  //   For LHP: dx<0 → arm-side (correct label)
  const pitch5 = makePitch({
    pitch_number: 5,
    pitcher_hand: "R", // CSV lie — ignored by pitchArmSideX
    ball_x: 642.2,
    target_x: 689.7,
    h_miss_inches: 8.17,
    h_direction: "glove-side", // wrong (from CSV)
  });

  it("pitchArmSideX with hand=L returns positive (arm-side)", () => {
    const armSideX = pitchArmSideX(pitch5, "L");
    expect(armSideX).toBeGreaterThan(0); // positive = arm-side
    expect(armSideX).toBeCloseTo(8.17);
  });

  it("hDirectionLabel returns arm-side (not the CSV glove-side)", () => {
    const label = hDirectionLabel(pitchArmSideX(pitch5, "L"));
    expect(label).toBe("arm-side");
    expect(label).not.toBe(pitch5.h_direction); // proves CSV is wrong
  });

  it("lane is Arm for LHP with dx<0 and 8+ inches", () => {
    expect(laneOf(pitchArmSideX(pitch5, "L"))).toBe("Arm");
  });

  // Pitch #1: ball_x=672.1, target_x=671.7 → dx = +0.4 (ball RIGHT)
  //   CSV says arm-side (assuming RHP), but for LHP dx>0 → glove-side
  const pitch1 = makePitch({
    pitch_number: 1,
    ball_x: 672.1,
    target_x: 671.7,
    h_miss_inches: 0.07,
    h_direction: "arm-side", // wrong for LHP
  });

  it("pitch #1 with dx>0 and hand=L => glove-side", () => {
    const label = hDirectionLabel(pitchArmSideX(pitch1, "L"));
    expect(label).toBe("glove-side");
  });
});

/* ------------------------------------------------------------------ */
/*  pitchPhysicalX (physical signed inches, handedness-agnostic)       */
/* ------------------------------------------------------------------ */

describe("pitchPhysicalX", () => {
  it("ball right of target (dx > 0) => positive regardless of hand", () => {
    const p = makePitch({ ball_x: 520, target_x: 500, h_miss_inches: 5 });
    expect(pitchPhysicalX(p)).toBeCloseTo(5);
  });

  it("ball left of target (dx < 0) => negative regardless of hand", () => {
    const p = makePitch({ ball_x: 480, target_x: 500, h_miss_inches: 5 });
    expect(pitchPhysicalX(p)).toBeCloseTo(-5);
  });

  it("dx = 0 => 0", () => {
    const p = makePitch({ ball_x: 500, target_x: 500, h_miss_inches: 5 });
    expect(pitchPhysicalX(p)).toBe(0);
  });

  it("CBurrows1 pitch #5 (dx<0) plots on the LEFT in physical space", () => {
    const p = makePitch({ ball_x: 642.2, target_x: 689.7, h_miss_inches: 8.17 });
    expect(pitchPhysicalX(p)).toBeCloseTo(-8.17);
  });

  it("CBurrows1 pitch #1 (dx>0) plots on the RIGHT in physical space", () => {
    const p = makePitch({ ball_x: 672.1, target_x: 671.7, h_miss_inches: 0.07 });
    expect(pitchPhysicalX(p)).toBeCloseTo(0.07);
  });
});
