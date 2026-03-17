import { describe, expect, it } from "vitest";
import { countPitcherInnings } from "./innings";
import type { ChartingPitcherSegment, ChartingPlateAppearance } from "./types";

function makeSegment(
  overrides: Partial<ChartingPitcherSegment> = {}
): ChartingPitcherSegment {
  return {
    id: "segment-1",
    gameId: "game-1",
    playerId: "Pitcher1",
    displayName: "Pitcher One",
    teamSide: "our",
    segmentOrder: 0,
    enteredInning: 1,
    exitedInning: null,
    runsOverride: null,
    earnedRunsOverride: null,
    ...overrides,
  };
}

function makePa(overrides: Partial<ChartingPlateAppearance> = {}): ChartingPlateAppearance {
  return {
    id: "pa-1",
    gameId: "game-1",
    segmentId: "segment-1",
    paOrder: 0,
    inning: 1,
    isTopInning: true,
    hitterName: "Hitter One",
    lineupSlot: 1,
    teamSide: "opponent",
    resultCode: "6-3",
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
    ...overrides,
  };
}

describe("countPitcherInnings", () => {
  it("counts distinct inning labels from plate appearances", () => {
    const segments = [makeSegment()];
    const plateAppearances = [
      makePa({ id: "pa-1", inning: 1 }),
      makePa({ id: "pa-2", inning: 1, paOrder: 1 }),
      makePa({ id: "pa-3", inning: 2, paOrder: 2 }),
    ];

    expect(countPitcherInnings(segments, plateAppearances)).toBe(2);
  });

  it("falls back to the segment inning range when no plate appearances exist", () => {
    const segments = [makeSegment({ enteredInning: 3, exitedInning: 5 })];

    expect(countPitcherInnings(segments, [])).toBe(3);
  });

  it("deduplicates overlapping inning spans across multiple segments", () => {
    const segments = [
      makeSegment({ id: "segment-1", enteredInning: 1, exitedInning: 2 }),
      makeSegment({ id: "segment-2", segmentOrder: 1, enteredInning: 2, exitedInning: 4 }),
    ];

    expect(countPitcherInnings(segments, [])).toBe(4);
  });
});
