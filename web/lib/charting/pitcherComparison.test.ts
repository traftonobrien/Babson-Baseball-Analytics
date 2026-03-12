import { describe, expect, it } from "vitest";
import {
  buildPitcherComparisonDirectory,
  buildPitcherComparisonPitchMix,
  buildPitcherComparisonZoneBuckets,
  filterPitcherComparisonPitches,
  hiddenPitcherComparisonZonePitchCount,
  summarizePitcherComparisonPitches,
  zoneBucketForLocationCell,
  type PitcherComparisonDirectorySource,
} from "./pitcherComparison";
import type {
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

const players: PitcherComparisonDirectorySource[] = [
  {
    slug: "lapierre_anthony",
    name: "Anthony LaPierre",
    throws: "R",
  },
  {
    slug: "burk_bobby",
    name: "Bobby Burk",
    throws: "R",
  },
];

const games = [
  { id: "game-1", gameDate: "2026-03-01", opponent: "MIT" },
  { id: "game-2", gameDate: "2025-10-15", opponent: "Tufts" },
];

const segments: ChartingPitcherSegment[] = [
  {
    id: "seg-1",
    gameId: "game-1",
    playerId: "ALaPierre1",
    displayName: "Anthony LaPierre",
    segmentOrder: 0,
    enteredInning: 1,
    exitedInning: 2,
    runsOverride: null,
    earnedRunsOverride: null,
  },
  {
    id: "seg-2",
    gameId: "game-2",
    playerId: "ALaPierre1",
    displayName: "Anthony LaPierre",
    segmentOrder: 0,
    enteredInning: 3,
    exitedInning: 4,
    runsOverride: null,
    earnedRunsOverride: null,
  },
];

const plateAppearances: ChartingPlateAppearance[] = [
  {
    id: "pa-1",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 0,
    inning: 1,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    resultCode: "1B",
    buntContext: false,
  },
  {
    id: "pa-2",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 1,
    inning: 2,
    hitterName: "Julian Herrera",
    lineupSlot: 4,
    resultCode: "K",
    buntContext: false,
  },
  {
    id: "pa-3",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 2,
    inning: 3,
    hitterName: "Joe Carrea",
    lineupSlot: 5,
    resultCode: "BB",
    buntContext: false,
  },
  {
    id: "pa-4",
    gameId: "game-2",
    segmentId: "seg-2",
    paOrder: 0,
    inning: 4,
    hitterName: "Connor Doan",
    lineupSlot: 6,
    resultCode: "HBP",
    buntContext: false,
  },
  {
    id: "pa-5",
    gameId: "game-2",
    segmentId: "seg-2",
    paOrder: 1,
    inning: 5,
    hitterName: "Gabe Harmon",
    lineupSlot: 7,
    resultCode: null,
    buntContext: false,
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
    gameId: "game-2",
    paId: "pa-4",
    pitchOrder: 0,
    pitchType: "Fastball",
    locationCell: 14,
    pitchResult: "hit_by_pitch",
    ballsBefore: 1,
    strikesBefore: 2,
    velocity: 88,
  },
  {
    id: "pitch-6",
    gameId: "game-2",
    paId: "pa-5",
    pitchOrder: 0,
    pitchType: "Fastball",
    locationCell: 2,
    pitchResult: "called_strike",
    ballsBefore: 0,
    strikesBefore: 0,
    velocity: 90,
  },
  {
    id: "pitch-7",
    gameId: "game-2",
    paId: "pa-5",
    pitchOrder: 1,
    pitchType: "Changeup",
    locationCell: 10,
    pitchResult: "ball",
    ballsBefore: 0,
    strikesBefore: 1,
    velocity: 78,
  },
];

function makeEntry() {
  return buildPitcherComparisonDirectory({
    players,
    games,
    segments,
    plateAppearances,
    pitches,
  })[0]!;
}

describe("pitcherComparison", () => {
  it("builds a pitcher comparison directory entry from charted sessions", () => {
    const entry = makeEntry();

    expect(entry.playerSlug).toBe("lapierre_anthony");
    expect(entry.displayName).toBe("Anthony LaPierre");
    expect(entry.throws).toBe("R");
    expect(entry.sessionCount).toBe(2);
    expect(entry.totalPitches).toBe(7);
    expect(entry.seasons).toEqual(["2026", "2025"]);
    expect(entry.pitchTypes).toEqual(["Fastball", "Slider", "Changeup"]);
    expect(entry.counts).toEqual(["0-0", "0-1", "1-1", "1-2", "3-2"]);
    expect(entry.velocityRange).toEqual({ min: 78, max: 92 });
  });

  it("filters comparison pitches by season, pitch type, count, event, and velocity", () => {
    const entry = makeEntry();

    const filtered = filterPitcherComparisonPitches(entry.pitches, {
      season: "2026",
      pitchType: "Slider",
      count: "1-2",
      event: "whiffs",
      veloMin: 84,
      veloMax: 90,
    });

    expect(filtered.map((pitch) => pitch.id)).toEqual(["pitch-3"]);
  });

  it("supports pitcher result event filters for called strikes and free passes", () => {
    const entry = makeEntry();

    expect(
      filterPitcherComparisonPitches(entry.pitches, {
        season: null,
        pitchType: null,
        count: null,
        event: "calledStrikes",
        veloMin: null,
        veloMax: null,
      }).map((pitch) => pitch.id)
    ).toEqual(["pitch-6"]);

    expect(
      filterPitcherComparisonPitches(entry.pitches, {
        season: null,
        pitchType: null,
        count: null,
        event: "freePass",
        veloMin: null,
        veloMax: null,
      })
        .map((pitch) => pitch.id)
        .sort()
    ).toEqual(["pitch-4", "pitch-5"]);
  });

  it("maps visible rough-zone buckets and reports hidden out-of-schema locations", () => {
    const entry = makeEntry();
    const buckets = buildPitcherComparisonZoneBuckets(entry.pitches);

    expect(zoneBucketForLocationCell(5)).toBe("heart");
    expect(zoneBucketForLocationCell(12)).toBe("chaseUpperRight");
    expect(zoneBucketForLocationCell(10)).toBeNull();
    expect(
      buckets.find((bucket) => bucket.id === "heart")?.summary.totalPitches
    ).toBe(1);
    expect(
      buckets.find((bucket) => bucket.id === "chaseLowerRight")?.summary.totalPitches
    ).toBe(1);
    expect(hiddenPitcherComparisonZonePitchCount(entry.pitches)).toBe(1);
  });

  it("summarizes the filtered sample and builds pitch mix shares", () => {
    const entry = makeEntry();
    const summary = summarizePitcherComparisonPitches(entry.pitches);
    const mix = buildPitcherComparisonPitchMix(entry.pitches);

    expect(summary.totalPitches).toBe(7);
    expect(summary.plateAppearances).toBe(4);
    expect(summary.atBats).toBe(2);
    expect(summary.hits).toBe(1);
    expect(summary.strikeouts).toBe(1);
    expect(summary.walks).toBe(1);
    expect(summary.hitByPitch).toBe(1);
    expect(summary.strikePct).toBeCloseTo((4 / 7) * 100, 4);
    expect(summary.zonePct).toBeCloseTo((3 / 7) * 100, 4);
    expect(summary.whiffPct).toBeCloseTo((1 / 3) * 100, 4);
    expect(summary.chasePct).toBeCloseTo(25, 4);
    expect(summary.baa).toBeCloseTo(0.5, 4);
    expect(summary.kPct).toBeCloseTo(25, 4);
    expect(summary.bbPct).toBeCloseTo(25, 4);
    expect(mix.map((item) => item.pitchType)).toEqual(["Fastball", "Slider", "Changeup"]);
    expect(mix[0]?.share).toBeCloseTo((3 / 7) * 100, 4);
  });
});
