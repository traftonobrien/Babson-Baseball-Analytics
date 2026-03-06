import { describe, it, expect } from "vitest";
import type { Pitch } from "@/app/types";
import {
  buildCommandPlusBaselines,
  computeCommandPlus,
  COMMAND_PLUS_FAMILY_FASTBALL,
  COMMAND_PLUS_FAMILY_SLIDER,
  getCommandPlusPitchType,
  listCommandPlusBaselines,
} from "./commandPlus";

function makePitch(overrides: Partial<Pitch>): Pitch {
  return {
    pitch_number: 1,
    pitcher_name: "Test",
    pitcher_hand: "R",
    pitch_type: "FF",
    raw_pitch_type: "FF",
    target_frame: 0,
    arrival_frame: 0,
    target_x: 0,
    target_y: 0,
    ball_x: 0,
    ball_y: 0,
    total_miss_px: 0,
    total_miss_inches: 10,
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

describe("getCommandPlusPitchType", () => {
  it("uses the normalized pitch_type when the raw tag is valid", () => {
    const pitch = makePitch({ raw_pitch_type: "Fastball", pitch_type: "FF" });
    expect(getCommandPlusPitchType(pitch)).toBe("FF");
  });

  it("excludes blank, unknown, and OTHER raw pitch tags", () => {
    expect(getCommandPlusPitchType(makePitch({ raw_pitch_type: "", pitch_type: "FF" }))).toBeNull();
    expect(getCommandPlusPitchType(makePitch({ raw_pitch_type: "OTHER", pitch_type: "FF" }))).toBeNull();
    expect(getCommandPlusPitchType(makePitch({ raw_pitch_type: "UNK", pitch_type: "SL" }))).toBeNull();
  });
});

describe("buildCommandPlusBaselines", () => {
  it("builds live baselines from valid pitches only", () => {
    const baselines = buildCommandPlusBaselines([
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 10 }),
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 14 }),
      makePitch({ raw_pitch_type: "OTHER", pitch_type: "FF", total_miss_inches: 2 }),
      makePitch({ raw_pitch_type: "", pitch_type: "SL", total_miss_inches: 1 }),
    ]);

    expect(baselines.FF.avgMiss).toBeCloseTo(12, 5);
    expect(baselines.FF.count).toBe(2);
    expect(baselines.SL).toBeUndefined();
  });

  it("shares family miss averages across related pitch names", () => {
    const baselines = buildCommandPlusBaselines([
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 10 }),
      makePitch({ raw_pitch_type: "SI", pitch_type: "SI", total_miss_inches: 14 }),
      makePitch({ raw_pitch_type: "SL", pitch_type: "SL", total_miss_inches: 18 }),
      makePitch({ raw_pitch_type: "SW", pitch_type: "SW", total_miss_inches: 12 }),
    ]);

    expect(baselines[COMMAND_PLUS_FAMILY_FASTBALL]?.avgMiss).toBeCloseTo(12, 5);
    expect(baselines.FF?.avgMiss).toBeCloseTo(12, 5);
    expect(baselines.SI?.avgMiss).toBeCloseTo(12, 5);

    expect(baselines[COMMAND_PLUS_FAMILY_SLIDER]?.avgMiss).toBeCloseTo(15, 5);
    expect(baselines.SL?.avgMiss).toBeCloseTo(15, 5);
    expect(baselines.SW?.avgMiss).toBeCloseTo(15, 5);
  });
});

describe("listCommandPlusBaselines", () => {
  it("sorts visible baseline rows by sample count, then pitch type", () => {
    const rows = listCommandPlusBaselines({
      [COMMAND_PLUS_FAMILY_FASTBALL]: { avgMiss: 12.2, count: 30 },
      SL: { avgMiss: 12.9, count: 18 },
      FF: { avgMiss: 13.5, count: 42 },
      CH: { avgMiss: 11.5, count: 18 },
    });

    expect(rows).toEqual([
      { pitchType: "FF", avgMiss: 13.5, count: 42 },
      { pitchType: "CH", avgMiss: 11.5, count: 18 },
      { pitchType: "SL", avgMiss: 12.9, count: 18 },
    ]);
  });
});

describe("computeCommandPlus", () => {
  it("computes exact weighted overall Command+", () => {
    const baselines = {
      FF: { avgMiss: 12, count: 20 },
      SL: { avgMiss: 18, count: 18 },
    };
    const result = computeCommandPlus([
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 9 }),
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 9 }),
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 9 }),
      makePitch({ raw_pitch_type: "SL", pitch_type: "SL", total_miss_inches: 12 }),
      makePitch({ raw_pitch_type: "SL", pitch_type: "SL", total_miss_inches: 12 }),
      makePitch({ raw_pitch_type: "SL", pitch_type: "SL", total_miss_inches: 12 }),
    ], baselines);

    // FF: 133.333..., SL: 150, equal count => 141.666...
    expect(result.overall).toBeCloseTo(141.6667, 4);
    expect(result.qualifiedPitchCount).toBe(6);
  });

  it("requires at least three pitches per type by default", () => {
    const baselines = {
      FF: { avgMiss: 10, count: 20 },
    };
    const result = computeCommandPlus([
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 8 }),
      makePitch({ raw_pitch_type: "FF", pitch_type: "FF", total_miss_inches: 8 }),
    ], baselines);

    expect(result.overall).toBeNull();
    expect(result.pitchTypeScores[0]?.eligible).toBe(false);
    expect(result.pitchTypeScores[0]?.reason).toBe("sample_too_small");
  });

  it("does not score pitch types without a season baseline", () => {
    const result = computeCommandPlus([
      makePitch({ raw_pitch_type: "FS", pitch_type: "FS", total_miss_inches: 7 }),
      makePitch({ raw_pitch_type: "FS", pitch_type: "FS", total_miss_inches: 7 }),
      makePitch({ raw_pitch_type: "FS", pitch_type: "FS", total_miss_inches: 7 }),
    ], {});

    expect(result.overall).toBeNull();
    expect(result.pitchTypeScores[0]?.reason).toBe("missing_baseline");
  });

  it("uses a family baseline while keeping the original pitch label in the row", () => {
    const result = computeCommandPlus([
      makePitch({ raw_pitch_type: "SW", pitch_type: "SW", total_miss_inches: 10 }),
      makePitch({ raw_pitch_type: "SW", pitch_type: "SW", total_miss_inches: 10 }),
      makePitch({ raw_pitch_type: "SW", pitch_type: "SW", total_miss_inches: 10 }),
    ], {
      [COMMAND_PLUS_FAMILY_SLIDER]: { avgMiss: 15, count: 30 },
    });

    expect(result.pitchTypeScores[0]?.pitchType).toBe("SW");
    expect(result.pitchTypeScores[0]?.baselineAvgMiss).toBeCloseTo(15, 5);
    expect(result.pitchTypeScores[0]?.score).toBeCloseTo(150, 5);
  });
});
