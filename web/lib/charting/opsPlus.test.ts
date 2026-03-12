import { describe, expect, it } from "vitest";
import {
  buildLiveAbOpsPlusBaseline,
  computeOpsPlus,
  withOpsPlus,
  type LiveAbOpsPlusBaseline,
} from "./opsPlus";

describe("buildLiveAbOpsPlusBaseline", () => {
  it("computes pooled Live AB baseline rates from closed plate appearances", () => {
    const baseline = buildLiveAbOpsPlusBaseline([
      { resultCode: "1B" },
      { resultCode: "BB" },
      { resultCode: "2B" },
      { resultCode: "6-3" },
      { resultCode: null },
    ]);

    expect(baseline).toEqual({
      plateAppearances: 4,
      atBats: 3,
      hits: 2,
      walks: 1,
      hitByPitch: 0,
      totalBases: 3,
      obp: 0.75,
      slg: 1,
    });
  });
});

describe("computeOpsPlus", () => {
  const baseline: LiveAbOpsPlusBaseline = {
    plateAppearances: 100,
    atBats: 85,
    hits: 28,
    walks: 12,
    hitByPitch: 3,
    totalBases: 42,
    obp: 0.43,
    slg: 0.49411764705882355,
  };

  it("computes MLB-style OPS+ from row and baseline rates", () => {
    const opsPlus = computeOpsPlus(0.52, 0.64, baseline);

    expect(opsPlus).toBeCloseTo(150.454, 3);
  });

  it("returns null when the row or baseline is incomplete", () => {
    expect(computeOpsPlus(null, 0.64, baseline)).toBeNull();
    expect(computeOpsPlus(0.52, null, baseline)).toBeNull();
    expect(computeOpsPlus(0.52, 0.64, null)).toBeNull();
    expect(computeOpsPlus(0.52, 0.64, { ...baseline, obp: null })).toBeNull();
    expect(computeOpsPlus(0.52, 0.64, { ...baseline, slg: 0 })).toBeNull();
  });
});

describe("withOpsPlus", () => {
  it("adds opsPlus while preserving the rest of the hitter row", () => {
    const row = withOpsPlus(
      {
        hitterName: "Test Hitter",
        obp: 0.4,
        slg: 0.6,
      },
      {
        plateAppearances: 50,
        atBats: 42,
        hits: 14,
        walks: 6,
        hitByPitch: 2,
        totalBases: 21,
        obp: 0.44,
        slg: 0.5,
      }
    );

    expect(row.hitterName).toBe("Test Hitter");
    expect(row.opsPlus).toBeCloseTo(110.9091, 3);
  });
});
