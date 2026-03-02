import { describe, it, expect } from "vitest";
import type { Pitch } from "@/app/types";
import { computeOutingKpis, filterPitchesForKpis, mergeKpis } from "./metrics";
import type { CommandPlusBaselines } from "@/lib/commandPlus";

function makePitch(overrides: Partial<Pitch>): Pitch {
  return {
    pitch_number: 1,
    pitcher_name: "Test",
    pitcher_hand: "R",
    pitch_type: "FF",
    raw_pitch_type: "FF",
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

describe("filterPitchesForKpis", () => {
  it("filters to numeric miss rows only", () => {
    const pitches = [
      makePitch({ total_miss_inches: 4 }),
      makePitch({ total_miss_inches: Number.NaN }),
    ];
    expect(filterPitchesForKpis(pitches)).toHaveLength(1);
  });

  it("applies pitch group filters", () => {
    const pitches = [
      makePitch({ pitch_type: "FF", raw_pitch_type: "FF" }),
      makePitch({ pitch_type: "SL", raw_pitch_type: "SL" }),
      makePitch({ pitch_type: "CH", raw_pitch_type: "CH" }),
    ];
    expect(filterPitchesForKpis(pitches, { pitchGroup: "FASTBALL" })).toHaveLength(1);
    expect(filterPitchesForKpis(pitches, { pitchGroup: "BREAKING" })).toHaveLength(1);
  });
});

describe("computeOutingKpis", () => {
  it("returns zeros for empty pitch arrays", () => {
    const kpis = computeOutingKpis([], "R", null);
    expect(kpis.pitchCount).toBe(0);
    expect(kpis.onTargetPct).toBe(0);
    expect(kpis.commandPlus).toBeNull();
  });

  it("computes standard KPI math", () => {
    const pitches = [
      makePitch({ total_miss_inches: 5 }),
      makePitch({ total_miss_inches: 7 }),
      makePitch({ total_miss_inches: 8 }),
      makePitch({ total_miss_inches: 10 }),
      makePitch({ total_miss_inches: 25 }),
    ];
    const kpis = computeOutingKpis(pitches, "R", null);
    expect(kpis.pitchCount).toBe(5);
    expect(kpis.onTargetCount).toBe(3);
    expect(kpis.onTargetPct).toBeCloseTo(60, 1);
    expect(kpis.outlierCount).toBe(1);
    expect(kpis.outlierPct).toBeCloseTo(20, 1);
    expect(kpis.avgMissIn).toBeCloseTo(11, 1);
  });

  it("computes Command+ from provided baselines with exact pitch-type weighting", () => {
    const baselines: CommandPlusBaselines = {
      FF: { avgMiss: 10, count: 20 },
      SL: { avgMiss: 20, count: 20 },
    };
    const pitches = [
      makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
      makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
      makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
      makePitch({ pitch_type: "SL", raw_pitch_type: "SL", total_miss_inches: 10 }),
      makePitch({ pitch_type: "SL", raw_pitch_type: "SL", total_miss_inches: 10 }),
      makePitch({ pitch_type: "SL", raw_pitch_type: "SL", total_miss_inches: 10 }),
    ];
    const kpis = computeOutingKpis(pitches, "R", baselines);
    // FF: 10/8 * 100 = 125, SL: 20/10 * 100 = 200, weighted equally by count => 162.5
    expect(kpis.commandPlus).toBeCloseTo(162.5, 5);
  });

  it("returns null Command+ when baselines are missing", () => {
    const kpis = computeOutingKpis([makePitch({ total_miss_inches: 5 })], "R", {});
    expect(kpis.commandPlus).toBeNull();
  });
});

describe("mergeKpis", () => {
  it("returns exact rollups for additive stats", () => {
    const kpiA = computeOutingKpis(
      [
        makePitch({ total_miss_inches: 4 }),
        makePitch({ total_miss_inches: 6 }),
      ],
      "R",
      null,
    );
    const kpiB = computeOutingKpis(
      [makePitch({ total_miss_inches: 8 })],
      "R",
      null,
    );
    const merged = mergeKpis([kpiA, kpiB]);

    expect(merged.pitchCount).toBe(3);
    expect(merged.onTargetPct).toBeCloseTo(100, 1);
    expect(merged.avgMissIn).toBeCloseTo(6, 5);
    expect(merged.consistencyStdIn).toBeGreaterThan(0);
  });

  it("does not fake a merged Command+ across multiple KPI bags", () => {
    const baselines: CommandPlusBaselines = {
      FF: { avgMiss: 10, count: 20 },
    };
    const kpiA = computeOutingKpis(
      [
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 8 }),
      ],
      "R",
      baselines,
    );
    const kpiB = computeOutingKpis(
      [
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 12 }),
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 12 }),
        makePitch({ pitch_type: "FF", raw_pitch_type: "FF", total_miss_inches: 12 }),
      ],
      "R",
      baselines,
    );
    const merged = mergeKpis([kpiA, kpiB]);
    expect(merged.commandPlus).toBeNull();
  });
});
