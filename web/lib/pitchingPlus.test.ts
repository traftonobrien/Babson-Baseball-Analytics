import { describe, expect, it } from "vitest";
import type { CommandPlusResult } from "@/lib/commandPlus";
import {
  computePitchingPlus,
  PITCHING_PLUS_COMMAND_WEIGHT,
  PITCHING_PLUS_STUFF_WEIGHT,
} from "./pitchingPlus";

function makeCommandResult(
  pitchTypeScores: CommandPlusResult["pitchTypeScores"],
): CommandPlusResult {
  return {
    overall: null,
    qualifiedPitchCount: 0,
    pitchTypeScores,
  };
}

describe("computePitchingPlus", () => {
  it("blends Stuff+ and Command+ per pitch type, then rolls up with hybrid weights", () => {
    const command = makeCommandResult([
      {
        pitchType: "FF",
        subjectCount: 6,
        subjectAvgMiss: 10,
        baselineCount: 20,
        baselineAvgMiss: 12,
        score: 120,
        eligible: true,
        reason: null,
      },
      {
        pitchType: "SL",
        subjectCount: 4,
        subjectAvgMiss: 12,
        baselineCount: 20,
        baselineAvgMiss: 12,
        score: 100,
        eligible: true,
        reason: null,
      },
    ]);

    const result = computePitchingPlus("JClark1", command, [
      { pitchType: "Fastball", meanStuffPlus: 110 },
      { pitchType: "Slider", meanStuffPlus: 90 },
    ]);

    const ffPitching =
      100 *
      Math.pow(110 / 100, PITCHING_PLUS_STUFF_WEIGHT) *
      Math.pow(120 / 100, PITCHING_PLUS_COMMAND_WEIGHT);
    const slPitching =
      100 *
      Math.pow(90 / 100, PITCHING_PLUS_STUFF_WEIGHT) *
      Math.pow(100 / 100, PITCHING_PLUS_COMMAND_WEIGHT);
    const expected = ffPitching * 0.55 + slPitching * 0.45;

    expect(result.ready).toBe(true);
    expect(result.overlapPitchTypeCount).toBe(2);
    expect(result.overlapPitchCount).toBe(10);
    expect(result.pitchTypeRows[0]?.hybridWeight).toBeCloseTo(0.55, 5);
    expect(result.pitchTypeRows[1]?.hybridWeight).toBeCloseTo(0.45, 5);
    expect(
      result.pitchTypeRows.reduce((sum, row) => sum + row.hybridWeight, 0),
    ).toBeCloseTo(1, 5);
    expect(result.stuffComponent).toBeCloseTo(101, 5);
    expect(result.commandComponent).toBeCloseTo(111, 5);
    expect(result.overall).toBeCloseTo(expected, 5);
  });

  it("averages duplicate Stuff matches that collapse into the same command pitch type", () => {
    const command = makeCommandResult([
      {
        pitchType: "SL",
        subjectCount: 5,
        subjectAvgMiss: 11,
        baselineCount: 20,
        baselineAvgMiss: 12,
        score: 110,
        eligible: true,
        reason: null,
      },
    ]);

    const result = computePitchingPlus("SLangan1", command, [
      { pitchType: "Slider", meanStuffPlus: 112 },
      { pitchType: "Sweeper", meanStuffPlus: 96 },
    ]);

    expect(result.ready).toBe(true);
    expect(result.pitchTypeRows[0]?.stuffPlus).toBeCloseTo(104, 5);
    expect(result.pitchTypeRows[0]?.stuffPitchTypes).toEqual(["Sweeper"]);
  });

  it("returns not ready when there is no eligible live command sample", () => {
    const result = computePitchingPlus(
      "JClark1",
      makeCommandResult([
        {
          pitchType: "FF",
          subjectCount: 2,
          subjectAvgMiss: 10,
          baselineCount: 20,
          baselineAvgMiss: 12,
          score: null,
          eligible: false,
          reason: "sample_too_small",
        },
      ]),
      [{ pitchType: "Fastball", meanStuffPlus: 110 }],
    );

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("missing_live_command");
    expect(result.overall).toBeNull();
  });

  it("returns not ready when Stuff+ is missing", () => {
    const result = computePitchingPlus(
      "JClark1",
      makeCommandResult([
        {
          pitchType: "FF",
          subjectCount: 6,
          subjectAvgMiss: 10,
          baselineCount: 20,
          baselineAvgMiss: 12,
          score: 120,
          eligible: true,
          reason: null,
        },
      ]),
      [],
    );

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("missing_stuff");
  });

  it("refuses ambiguous crosswalks when one Stuff pitch could map to multiple live command pitches", () => {
    const result = computePitchingPlus(
      "JClark1",
      makeCommandResult([
        {
          pitchType: "CB",
          subjectCount: 4,
          subjectAvgMiss: 10,
          baselineCount: 20,
          baselineAvgMiss: 12,
          score: 105,
          eligible: true,
          reason: null,
        },
        {
          pitchType: "CU",
          subjectCount: 4,
          subjectAvgMiss: 10,
          baselineCount: 20,
          baselineAvgMiss: 12,
          score: 108,
          eligible: true,
          reason: null,
        },
      ]),
      [{ pitchType: "Curveball", meanStuffPlus: 112 }],
    );

    expect(result.ready).toBe(false);
    expect(result.reason).toBe("no_overlap");
    expect(result.pitchTypeRows.every((row) => row.reason === "ambiguous_stuff_match")).toBe(
      true,
    );
  });
});
