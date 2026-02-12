import { describe, it, expect } from "vitest";
import { computeOutingKpis, mergeKpis } from "./metrics";
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
    v_miss_signed: -2,
    target_quadrant: "MM",
    result_quadrant: "MM",
    target_zone: "",
    timestamp: 0,
    ...overrides,
  };
}

describe("computeOutingKpis", () => {
  it("returns zeros for empty pitch array", () => {
    const kpis = computeOutingKpis([], "R");
    expect(kpis.pitchCount).toBe(0);
    expect(kpis.onTargetPct).toBe(0);
    expect(kpis.avgMissIn).toBe(0);
  });

  it("computes correct on-target percentage", () => {
    // 3 on-target (<=8), 2 off-target (>8)
    const pitches = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 7 }),
      makePitch({ total_miss_inches: 8 }), // exactly 8 = on target
      makePitch({ total_miss_inches: 10 }),
      makePitch({ total_miss_inches: 12 }),
    ];
    const kpis = computeOutingKpis(pitches, "R");
    expect(kpis.pitchCount).toBe(5);
    expect(kpis.onTargetPct).toBeCloseTo(60, 1);
    expect(kpis.onTargetCount).toBe(3);
  });

  it("computes correct outlier percentage", () => {
    // 1 outlier (>20), 4 normal
    const pitches = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 7 }),
      makePitch({ total_miss_inches: 10 }),
      makePitch({ total_miss_inches: 15 }),
      makePitch({ total_miss_inches: 25 }), // outlier
    ];
    const kpis = computeOutingKpis(pitches, "R");
    expect(kpis.outlierPct).toBeCloseTo(20, 1);
    expect(kpis.outlierCount).toBe(1);
  });

  it("computes correct average miss", () => {
    const pitches = [
      makePitch({ total_miss_inches: 4 }),
      makePitch({ total_miss_inches: 6 }),
      makePitch({ total_miss_inches: 10 }),
    ];
    const kpis = computeOutingKpis(pitches, "R");
    // avg = (4+6+10)/3 = 6.667
    expect(kpis.avgMissIn).toBeCloseTo(6.667, 2);
  });

  it("computes avgVAbsIn from absolute v_miss_signed", () => {
    const pitches = [
      makePitch({ v_miss_signed: -3 }), // abs = 3
      makePitch({ v_miss_signed: 5 }),   // abs = 5
    ];
    const kpis = computeOutingKpis(pitches, "R");
    expect(kpis.avgVAbsIn).toBeCloseTo(4, 1);
  });

  it("computes avgHAbsIn using pitchArmSideX", () => {
    // RHP, ball to the right of target (dx > 0) → arm-side-positive
    const pitches = [
      makePitch({ ball_x: 530, target_x: 500, h_miss_inches: 6 }),
      makePitch({ ball_x: 530, target_x: 500, h_miss_inches: 4 }),
    ];
    const kpis = computeOutingKpis(pitches, "R");
    // pitchArmSideX: sign(30)*|6|*1 = 6, sign(30)*|4|*1 = 4
    // avgHAbsIn = (6+4)/2 = 5
    expect(kpis.avgHAbsIn).toBeCloseTo(5, 1);
  });

  it("flips arm-side for LHP", () => {
    // LHP, ball to the right of target (dx > 0) → glove-side-negative
    const pitches = [
      makePitch({ ball_x: 530, target_x: 500, h_miss_inches: 6 }),
    ];
    const kpisR = computeOutingKpis(pitches, "R");
    const kpisL = computeOutingKpis(pitches, "L");
    // Abs should be same magnitude
    expect(kpisR.avgHAbsIn).toBeCloseTo(kpisL.avgHAbsIn, 1);
  });

  it("computes consistency (stddev) from total_miss_inches", () => {
    // All same miss → stddev = 0
    const uniform = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 5 }),
    ];
    expect(computeOutingKpis(uniform, "R").consistencyStdIn).toBeCloseTo(0, 5);

    // Varied: stddev of [2, 4, 6] with sample correction
    const varied = [
      makePitch({ total_miss_inches: 2 }),
      makePitch({ total_miss_inches: 4 }),
      makePitch({ total_miss_inches: 6 }),
    ];
    // mean=4, variance = ((4+0+4)/2) = 4, stddev = 2
    expect(computeOutingKpis(varied, "R").consistencyStdIn).toBeCloseTo(2, 1);
  });
});

describe("computeOutingKpis with pitchGroup filter", () => {
  const mixed = [
    makePitch({ pitch_type: "FF", total_miss_inches: 4 }),
    makePitch({ pitch_type: "FF", total_miss_inches: 6 }),
    makePitch({ pitch_type: "SL", total_miss_inches: 10 }),
    makePitch({ pitch_type: "SL", total_miss_inches: 12 }),
    makePitch({ pitch_type: "CH", total_miss_inches: 8 }),
  ];

  it("ALL includes every pitch", () => {
    const kpis = computeOutingKpis(mixed, "R", { pitchGroup: "ALL" });
    expect(kpis.pitchCount).toBe(5);
  });

  it("FASTBALL filters to only fastball types", () => {
    const kpis = computeOutingKpis(mixed, "R", { pitchGroup: "FASTBALL" });
    expect(kpis.pitchCount).toBe(2);
    // avg miss = (4+6)/2 = 5
    expect(kpis.avgMissIn).toBeCloseTo(5, 1);
  });

  it("BREAKING filters to only breaking types", () => {
    const kpis = computeOutingKpis(mixed, "R", { pitchGroup: "BREAKING" });
    expect(kpis.pitchCount).toBe(2);
    // avg miss = (10+12)/2 = 11
    expect(kpis.avgMissIn).toBeCloseTo(11, 1);
  });

  it("unknown pitch types excluded from FASTBALL and BREAKING", () => {
    const kpisF = computeOutingKpis(mixed, "R", { pitchGroup: "FASTBALL" });
    const kpisB = computeOutingKpis(mixed, "R", { pitchGroup: "BREAKING" });
    // CH is in neither group, so total = 2+2 = 4, not 5
    expect(kpisF.pitchCount + kpisB.pitchCount).toBe(4);
  });

  it("returns zeros when no pitches match group", () => {
    const allFF = [makePitch({ pitch_type: "FF", total_miss_inches: 5 })];
    const kpis = computeOutingKpis(allFF, "R", { pitchGroup: "BREAKING" });
    expect(kpis.pitchCount).toBe(0);
    expect(kpis.onTargetPct).toBe(0);
  });

  it("no options defaults to ALL", () => {
    const kpis = computeOutingKpis(mixed, "R");
    expect(kpis.pitchCount).toBe(5);
  });
});

describe("mergeKpis", () => {
  it("returns zeros for empty list", () => {
    const merged = mergeKpis([]);
    expect(merged.pitchCount).toBe(0);
    expect(merged.onTargetPct).toBe(0);
  });

  it("merges two outings by weighted average", () => {
    const pitchesA = [
      makePitch({ total_miss_inches: 4, v_miss_signed: -1, ball_x: 510, target_x: 500, h_miss_inches: 2 }),
      makePitch({ total_miss_inches: 6, v_miss_signed: -3, ball_x: 510, target_x: 500, h_miss_inches: 2 }),
    ];
    const pitchesB = [
      makePitch({ total_miss_inches: 8, v_miss_signed: 2, ball_x: 510, target_x: 500, h_miss_inches: 2 }),
    ];

    const kpiA = computeOutingKpis(pitchesA, "R");
    const kpiB = computeOutingKpis(pitchesB, "R");
    const merged = mergeKpis([kpiA, kpiB]);

    expect(merged.pitchCount).toBe(3);
    // on-target: 4<=8 yes, 6<=8 yes, 8<=8 yes → 3/3 = 100%
    expect(merged.onTargetPct).toBeCloseTo(100, 1);
    // avg miss: (4+6+8)/3 = 6
    expect(merged.avgMissIn).toBeCloseTo(6, 1);
  });

  it("identity: merging a single kpi returns equivalent values", () => {
    const pitches = [
      makePitch({ total_miss_inches: 5, v_miss_signed: -2, ball_x: 520, target_x: 500, h_miss_inches: 4 }),
      makePitch({ total_miss_inches: 7, v_miss_signed: 3, ball_x: 520, target_x: 500, h_miss_inches: 4 }),
    ];
    const kpi = computeOutingKpis(pitches, "R");
    const merged = mergeKpis([kpi]);

    expect(merged.pitchCount).toBe(kpi.pitchCount);
    expect(merged.onTargetPct).toBeCloseTo(kpi.onTargetPct, 5);
    expect(merged.avgMissIn).toBeCloseTo(kpi.avgMissIn, 5);
    expect(merged.consistencyStdIn).toBeCloseTo(kpi.consistencyStdIn, 5);
  });
});

describe("mergeKpis for player aggregation", () => {
  it("aggregates two outings with different sizes into correct weighted averages", () => {
    // Outing A: 3 pitches, 2 on-target, 0 outliers
    const pitchesA = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 7 }),
      makePitch({ total_miss_inches: 10 }),
    ];
    // Outing B: 2 pitches, 1 on-target, 0 outliers
    const pitchesB = [
      makePitch({ total_miss_inches: 6 }),
      makePitch({ total_miss_inches: 12 }),
    ];

    const kpiA = computeOutingKpis(pitchesA, "R");
    const kpiB = computeOutingKpis(pitchesB, "R");
    const merged = mergeKpis([kpiA, kpiB]);

    // Total pitches
    expect(merged.pitchCount).toBe(5);

    // On-target: A has 5,7 on-target (<=8), B has 6 on-target → 3/5 = 60%
    expect(merged.onTargetCount).toBe(3);
    expect(merged.onTargetPct).toBeCloseTo(60, 1);

    // Avg miss: (5+7+10+6+12)/5 = 8.0
    expect(merged.avgMissIn).toBeCloseTo(8.0, 2);

    // Consistency: exact stddev of [5,7,10,6,12]
    // mean=8, diffs=[-3,-1,2,-2,4], sq=[9,1,4,4,16]=34, var=34/4=8.5, sd=2.915
    expect(merged.consistencyStdIn).toBeCloseTo(2.915, 2);
  });

  it("produces exact stddev, not weighted approximation of per-outing stddevs", () => {
    // Two outings with very different distributions
    const tight = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 5 }),
    ];
    const spread = [
      makePitch({ total_miss_inches: 2 }),
      makePitch({ total_miss_inches: 14 }),
    ];

    const kpiTight = computeOutingKpis(tight, "R");
    const kpiSpread = computeOutingKpis(spread, "R");
    const merged = mergeKpis([kpiTight, kpiSpread]);

    // Exact stddev of [5,5,2,14]
    // mean = 6.5, diffs=[-1.5,-1.5,-4.5,7.5], sq=[2.25,2.25,20.25,56.25]=81
    // var = 81/3 = 27, sd = 5.196
    expect(merged.consistencyStdIn).toBeCloseTo(5.196, 2);

    // A naive weighted average of stddevs would give (0 + 8.485)/2 = 4.243
    // which is wrong - verify our result is different
    const naiveAvg = (kpiTight.consistencyStdIn + kpiSpread.consistencyStdIn) / 2;
    expect(merged.consistencyStdIn).not.toBeCloseTo(naiveAvg, 1);
  });
});
