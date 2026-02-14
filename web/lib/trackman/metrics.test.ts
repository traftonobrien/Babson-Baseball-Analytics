import { describe, it, expect } from "vitest";
import {
  detectField,
  readNum,
  readStr,
  normalizePitch,
  deriveMetrics,
  uniquePitchTypes,
  FIELD_CANDIDATES,
  type TrackmanPitch,
} from "./metrics";

describe("detectField", () => {
  it("finds exact snake_case match", () => {
    const pitch = { pitch_type: "FF", velocity: 95 };
    expect(detectField(pitch, FIELD_CANDIDATES.pitchType)).toBe("pitch_type");
  });

  it("finds case-insensitive match", () => {
    const pitch = { PitchType: "SL", Velocity: 82 };
    expect(detectField(pitch, FIELD_CANDIDATES.pitchType)).toBe("PitchType");
  });

  it("returns undefined when no match", () => {
    const pitch = { foo: "bar" };
    expect(detectField(pitch, FIELD_CANDIDATES.pitchType)).toBeUndefined();
  });

  it("skips null values", () => {
    const pitch = { pitch_type: null, pitchname: "FF" };
    expect(detectField(pitch, FIELD_CANDIDATES.pitchType)).toBe("pitchname");
  });
});

describe("readNum / readStr", () => {
  it("reads a numeric field", () => {
    expect(readNum({ velocity: 94.5 }, FIELD_CANDIDATES.mph)).toBe(94.5);
  });

  it("returns null for missing numeric field", () => {
    expect(readNum({ foo: 1 }, FIELD_CANDIDATES.mph)).toBeNull();
  });

  it("returns null for non-finite numeric field", () => {
    expect(readNum({ velocity: "N/A" }, FIELD_CANDIDATES.mph)).toBeNull();
  });

  it("reads a string field", () => {
    expect(readStr({ pitch_type: "CU" }, FIELD_CANDIDATES.pitchType)).toBe("CU");
  });
});

describe("normalizePitch", () => {
  it("normalizes a full row", () => {
    const raw = {
      pitch_type: "FF",
      mph: 95.2,
      rpm: 2300,
      ivb: 17.5,
      hb: -8.2,
      extension: 6.1,
      rel_height: 5.8,
      rel_side: 1.2,
      pitch_no: 3,
      spin_axis_2d: 210,
    };
    const p = normalizePitch(raw, 0);
    expect(p.pitchType).toBe("FF");
    expect(p.mph).toBe(95.2);
    expect(p.rpm).toBe(2300);
    expect(p.ivb).toBe(17.5);
    expect(p.hb).toBe(-8.2);
    expect(p.extension).toBe(6.1);
    expect(p.relHeight).toBe(5.8);
    expect(p.relSide).toBe(1.2);
    expect(p.pitchNo).toBe(3);
    expect(p.spinAxis2d).toBe(210);
  });

  it("uses index+1 as pitchNo when missing", () => {
    const p = normalizePitch({ pitch_type: "SL" }, 4);
    expect(p.pitchNo).toBe(5);
  });

  it("defaults pitchType to UN when missing", () => {
    const p = normalizePitch({}, 0);
    expect(p.pitchType).toBe("UN");
  });
});

describe("deriveMetrics", () => {
  const pitches: TrackmanPitch[] = [
    { pitchNo: 1, pitchType: "FF", mph: 94, rpm: 2200, ivb: 16, hb: -8, extension: 6.2, relHeight: 5.8, relSide: 1.2, spinAxis2d: 210 },
    { pitchNo: 2, pitchType: "FF", mph: 96, rpm: 2400, ivb: 18, hb: -6, extension: 6.4, relHeight: 5.9, relSide: 1.1, spinAxis2d: 200 },
    { pitchNo: 3, pitchType: "SL", mph: 82, rpm: 2600, ivb: 2, hb: 4, extension: 5.8, relHeight: 5.7, relSide: 1.3, spinAxis2d: 330 },
  ];

  it("computes count", () => {
    expect(deriveMetrics(pitches).count).toBe(3);
  });

  it("computes avgVelo", () => {
    const kpis = deriveMetrics(pitches);
    expect(kpis.avgVelo).toBeCloseTo((94 + 96 + 82) / 3, 5);
  });

  it("computes maxVelo", () => {
    expect(deriveMetrics(pitches).maxVelo).toBe(96);
  });

  it("handles empty array", () => {
    const kpis = deriveMetrics([]);
    expect(kpis.count).toBe(0);
    expect(kpis.avgVelo).toBeNull();
    expect(kpis.maxVelo).toBeNull();
  });

  it("skips null values in averages", () => {
    const partial: TrackmanPitch[] = [
      { pitchNo: 1, pitchType: "FF", mph: 90, rpm: null, ivb: null, hb: null, extension: null, relHeight: null, relSide: null, spinAxis2d: null },
      { pitchNo: 2, pitchType: "FF", mph: 92, rpm: 2300, ivb: null, hb: null, extension: null, relHeight: null, relSide: null, spinAxis2d: null },
    ];
    const kpis = deriveMetrics(partial);
    expect(kpis.avgVelo).toBeCloseTo(91, 5);
    expect(kpis.avgSpin).toBe(2300);
    expect(kpis.avgIvb).toBeNull();
  });
});

describe("uniquePitchTypes", () => {
  it("returns sorted unique types", () => {
    const pitches: TrackmanPitch[] = [
      { pitchNo: 1, pitchType: "SL", mph: null, rpm: null, ivb: null, hb: null, extension: null, relHeight: null, relSide: null, spinAxis2d: null },
      { pitchNo: 2, pitchType: "FF", mph: null, rpm: null, ivb: null, hb: null, extension: null, relHeight: null, relSide: null, spinAxis2d: null },
      { pitchNo: 3, pitchType: "FF", mph: null, rpm: null, ivb: null, hb: null, extension: null, relHeight: null, relSide: null, spinAxis2d: null },
    ];
    expect(uniquePitchTypes(pitches)).toEqual(["FF", "SL"]);
  });
});
