import { describe, it, expect } from "vitest";
import { laneOf, buildReport, isOutlier, isOnTarget } from "./reportModel";
import type { Pitch } from "@/app/types";

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
    total_miss_inches: 4,
    h_miss_px: 0,
    h_miss_inches: 3,
    h_direction: "",
    h_miss_signed: 0,
    v_miss_px: 0,
    v_miss_inches: 2,
    v_direction: "",
    v_miss_signed: 0,
    target_quadrant: "MM",
    result_quadrant: "MM",
    target_zone: "",
    timestamp: 0,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  laneOf (now requires explicit pitcherHand)                         */
/* ------------------------------------------------------------------ */

describe("laneOf", () => {
  it("never reads pitch.pitcher_hand — uses explicit param", () => {
    // CSV says R but we pass L. The function should use L.
    // dx > 0 (ball right of target) with hand=L => glove-side => Glove
    const p = makePitch({
      pitcher_hand: "R", // CSV says R — should be ignored
      ball_x: 530,
      target_x: 500,
      h_miss_inches: 6,
    });
    expect(laneOf(p, "L")).toBe("Glove"); // not Arm
    expect(laneOf(p, "R")).toBe("Arm");
  });

  it("classifies Middle for small dx", () => {
    const p = makePitch({ ball_x: 505, target_x: 500, h_miss_inches: 2 });
    expect(laneOf(p, "R")).toBe("Middle");
  });
});

/* ------------------------------------------------------------------ */
/*  buildReport: pitcherHand threading                                 */
/* ------------------------------------------------------------------ */

describe("buildReport pitcherHand", () => {
  // Create pitches where ball is consistently to the RIGHT of target (dx > 0)
  const pitches: Pitch[] = Array.from({ length: 10 }, (_, i) =>
    makePitch({
      pitch_number: i + 1,
      ball_x: 530,
      target_x: 500,
      h_miss_inches: 6,
      total_miss_inches: 7,
      v_miss_signed: -1,
    }),
  );

  it("RHP: dx > 0 pitches are all Arm lane", () => {
    const report = buildReport(pitches, "Test", "Test Outing", "R");
    const armLane = report.lanesDetailed.find((l) => l.lane === "Arm");
    expect(armLane?.count).toBe(10);
  });

  it("LHP: same pitches are all Glove lane", () => {
    const report = buildReport(pitches, "Test", "Test Outing", "L");
    const gloveLane = report.lanesDetailed.find((l) => l.lane === "Glove");
    expect(gloveLane?.count).toBe(10);
  });

  it("meta.pitcherHand reflects the explicit param", () => {
    const reportR = buildReport(pitches, "Test", "Test Outing", "R");
    const reportL = buildReport(pitches, "Test", "Test Outing", "L");
    expect(reportR.meta.pitcherHand).toBe("R");
    expect(reportL.meta.pitcherHand).toBe("L");
  });

  it("never reads pitch.pitcher_hand for lane classification", () => {
    // All pitches say pitcher_hand: "R" in CSV, but we call with "L"
    const report = buildReport(pitches, "Test", "Test Outing", "L");
    // With hand=L and dx>0, pitches go to Glove, not Arm
    const armLane = report.lanesDetailed.find((l) => l.lane === "Arm");
    expect(armLane?.count).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  isOutlier / isOnTarget                                             */
/* ------------------------------------------------------------------ */

describe("isOutlier", () => {
  it("returns true for > 20 inches", () => {
    expect(isOutlier(makePitch({ total_miss_inches: 21 }))).toBe(true);
  });

  it("returns false for <= 20 inches", () => {
    expect(isOutlier(makePitch({ total_miss_inches: 20 }))).toBe(false);
  });
});

describe("isOnTarget", () => {
  it("returns true for <= 8 inches", () => {
    expect(isOnTarget(makePitch({ total_miss_inches: 8 }))).toBe(true);
  });

  it("returns false for > 8 inches", () => {
    expect(isOnTarget(makePitch({ total_miss_inches: 9 }))).toBe(false);
  });
});
