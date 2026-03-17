import { describe, expect, it } from "vitest";
import { buildHitterPerformanceInsightsData } from "./hitterInsights";
import {
  buildChartingPlayerComparisonDirectory,
  buildChartingPlayerComparisonPitchMix,
  buildChartingPlayerComparisonZoneBuckets,
  filterChartingPlayerComparisonPitches,
  hiddenChartingPlayerComparisonZonePitchCount,
  summarizeChartingPlayerComparisonPitches,
  zoneBucketForLocationCell,
} from "./playerComparison";
import type { ChartingPitch, ChartingPlateAppearance } from "./types";

const games = [{ id: "game-1", gameDate: "2026-03-01", opponent: "MIT" }];

const plateAppearances: ChartingPlateAppearance[] = [
  {
    id: "pa-1",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 0,
    inning: 1,
    isTopInning: true,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    teamSide: "opponent",
    resultCode: "1B",
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  },
  {
    id: "pa-2",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 1,
    inning: 2,
    isTopInning: true,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    teamSide: "opponent",
    resultCode: "K",
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  },
  {
    id: "pa-3",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 2,
    inning: 4,
    isTopInning: true,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    teamSide: "opponent",
    resultCode: "BB",
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  },
  {
    id: "pa-4",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 3,
    inning: 6,
    isTopInning: true,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    teamSide: "opponent",
    resultCode: null,
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  },
];

const pitches: ChartingPitch[] = [
  {
    id: "pitch-1",
    gameId: "game-1",
    paId: "pa-1",
    pitchOrder: 0,
    pitchType: "Fastball",
    locationCell: 5,
    pitchResult: "in_play",
    ballsBefore: 1,
    strikesBefore: 1,
    velocity: 92,
  },
  {
    id: "pitch-2",
    gameId: "game-1",
    paId: "pa-2",
    pitchOrder: 0,
    pitchType: "Slider",
    locationCell: 3,
    pitchResult: "foul",
    ballsBefore: 0,
    strikesBefore: 1,
    velocity: 84,
  },
  {
    id: "pitch-3",
    gameId: "game-1",
    paId: "pa-2",
    pitchOrder: 1,
    pitchType: "Slider",
    locationCell: 12,
    pitchResult: "swinging_strike",
    ballsBefore: 1,
    strikesBefore: 2,
    velocity: 85,
  },
  {
    id: "pitch-4",
    gameId: "game-1",
    paId: "pa-3",
    pitchOrder: 0,
    pitchType: "Changeup",
    locationCell: 13,
    pitchResult: "ball",
    ballsBefore: 3,
    strikesBefore: 2,
    velocity: 79,
  },
  {
    id: "pitch-5",
    gameId: "game-1",
    paId: "pa-4",
    pitchOrder: 0,
    pitchType: "Fastball",
    locationCell: 15,
    pitchResult: "ball",
    ballsBefore: 2,
    strikesBefore: 1,
    velocity: 94,
  },
];

function makeEntry() {
  const insights = buildHitterPerformanceInsightsData({
    hitterId: "DDrazka1",
    hitterName: "Dylan Drazka",
    batterHand: "R",
    matchedHitterNames: ["Dylan Drazka"],
    games,
    plateAppearances,
    pitches,
    pitcherHandBySegmentId: new Map([["seg-1", "R"]]),
  });

  if (!insights) {
    throw new Error("Expected comparison fixture insights");
  }

  return buildChartingPlayerComparisonDirectory([
    {
      playerSlug: "drazka_dylan",
      playerId: "DDrazka1",
      displayName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      sessionCount: 1,
      pitchCount: insights.pitches.length,
      insights,
    },
  ])[0]!;
}

describe("playerComparison", () => {
  it("builds a dedicated comparison directory entry from hitter insights", () => {
    const entry = makeEntry();

    expect(entry.playerSlug).toBe("drazka_dylan");
    expect(entry.seasons).toEqual(["2026"]);
    expect(entry.pitchTypes).toEqual(["Fastball", "Slider", "Changeup"]);
    expect(entry.counts).toEqual(["0-1", "1-1", "1-2", "2-1", "3-2"]);
    expect(entry.velocityRange).toEqual({ min: 79, max: 94 });
    expect(entry.summary.totalPitches).toBe(5);
  });

  it("filters comparison pitches by event, count, and velocity bounds", () => {
    const entry = makeEntry();

    const filtered = filterChartingPlayerComparisonPitches(entry.pitches, {
      season: "2026",
      pitcherHand: "R",
      pitchType: "Slider",
      count: "1-2",
      event: "whiffs",
      veloMin: 84,
      veloMax: 90,
    });

    expect(filtered.map((pitch) => pitch.id)).toEqual(["pitch-3"]);
  });

  it("filters comparison pitches by pitcher handedness", () => {
    const entry = makeEntry();

    expect(
      filterChartingPlayerComparisonPitches(entry.pitches, {
        season: null,
        pitcherHand: "R",
        pitchType: null,
        count: null,
        event: "all",
        veloMin: null,
        veloMax: null,
      }).map((pitch) => pitch.id)
    ).toEqual(["pitch-1", "pitch-2", "pitch-3", "pitch-4", "pitch-5"]);

    expect(
      filterChartingPlayerComparisonPitches(entry.pitches, {
        season: null,
        pitcherHand: "L",
        pitchType: null,
        count: null,
        event: "all",
        veloMin: null,
        veloMax: null,
      })
    ).toEqual([]);
  });

  it("maps rough zone buckets and reports hidden out-of-schema locations", () => {
    const entry = makeEntry();
    const buckets = buildChartingPlayerComparisonZoneBuckets(entry.pitches);

    expect(zoneBucketForLocationCell(5)).toBe("heart");
    expect(zoneBucketForLocationCell(12)).toBe("chaseUpperRight");
    expect(zoneBucketForLocationCell(15)).toBeNull();
    expect(buckets.find((bucket) => bucket.id === "heart")?.summary.totalPitches).toBe(1);
    expect(
      buckets.find((bucket) => bucket.id === "chaseLowerLeft")?.summary.totalPitches
    ).toBe(1);
    expect(hiddenChartingPlayerComparisonZonePitchCount(entry.pitches)).toBe(1);
  });

  it("summarizes the filtered sample and builds pitch mix shares", () => {
    const entry = makeEntry();
    const summary = summarizeChartingPlayerComparisonPitches(entry.pitches);
    const mix = buildChartingPlayerComparisonPitchMix(entry.pitches);

    expect(summary.plateAppearances).toBe(3);
    expect(summary.atBats).toBe(2);
    expect(summary.hits).toBe(1);
    expect(summary.walks).toBe(1);
    expect(summary.battingAverage).toBeCloseTo(0.5, 4);
    expect(summary.strikeoutRate).toBeCloseTo(100 / 3, 4);
    expect(summary.woba).toBeCloseTo((0.89 + 0.69) / 3, 4);
    expect(mix.map((item) => item.pitchType)).toEqual(["Fastball", "Slider", "Changeup"]);
    expect(mix[0]?.share).toBeCloseTo(40, 4);
  });
});
