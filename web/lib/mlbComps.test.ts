import { describe, expect, it } from "vitest";

import { findPitchComps, type MLBPitcher } from "./mlbComps";

const PITCHERS: MLBPitcher[] = [
  {
    pitcherId: "1",
    name: "Variant Righty",
    hand: "R",
    pitches: [
      {
        pitchType: "Slider",
        pitchFamily: "Slider",
        pitchTypeCode: "SL",
        pitchTypeName: "Slider",
        n: 400,
        avgVelo: 85.1,
        avgIvb: 2.0,
        avgHb: -8.0,
      },
      {
        pitchType: "Slider",
        pitchFamily: "Slider",
        pitchTypeCode: "SV",
        pitchTypeName: "Slurve",
        n: 180,
        avgVelo: 81.8,
        avgIvb: -5.0,
        avgHb: -14.5,
      },
    ],
  },
  {
    pitcherId: "2",
    name: "Forkball Righty",
    hand: "R",
    pitches: [
      {
        pitchType: "Splitter",
        pitchFamily: "Splitter",
        pitchTypeCode: "FO",
        pitchTypeName: "Forkball",
        n: 120,
        avgVelo: 83.5,
        avgIvb: 0.8,
        avgHb: 9.9,
      },
    ],
  },
];

describe("findPitchComps", () => {
  it("chooses the closest variant inside the same canonical family", () => {
    const results = findPitchComps(
      {
        pitchType: "Slider",
        ivb: -4.8,
        hb: -14.2,
        velo: 82.0,
      },
      "R",
      PITCHERS,
      5,
    );

    expect(results).toHaveLength(1);
    expect(results[0].pitch.pitchType).toBe("Slider");
    expect(results[0].pitch.pitchTypeCode).toBe("SV");
    expect(results[0].pitch.pitchTypeName).toBe("Slurve");
  });

  it("matches canonical families even when the preserved public label differs", () => {
    const results = findPitchComps(
      {
        pitchType: "Splitter",
        ivb: 1.0,
        hb: 10.1,
        velo: 83.0,
      },
      "R",
      PITCHERS,
      5,
    );

    expect(results).toHaveLength(1);
    expect(results[0].pitch.pitchType).toBe("Splitter");
    expect(results[0].pitch.pitchTypeCode).toBe("FO");
    expect(results[0].pitch.pitchTypeName).toBe("Forkball");
  });
});
