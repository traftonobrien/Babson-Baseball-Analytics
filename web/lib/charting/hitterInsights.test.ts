import { describe, expect, it } from "vitest";
import {
  buildHitterPerformanceInsightsData,
  filterHitterInsightPitches,
  selectHitterInsightPitches,
  selectionLabel,
  summarizeHitterInsightPitches,
  type HitterInsightGameContext,
} from "./hitterInsights";
import type { ChartingPitch, ChartingPlateAppearance } from "./types";

const games: HitterInsightGameContext[] = [
  { id: "game-1", gameDate: "2026-03-01", opponent: "MIT" },
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
    inning: 3,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    resultCode: "K",
    buntContext: false,
  },
  {
    id: "pa-3",
    gameId: "game-1",
    segmentId: "seg-1",
    paOrder: 2,
    inning: 5,
    hitterName: "Dylan Drazka",
    lineupSlot: 3,
    resultCode: "BB",
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
];

describe("hitterInsights", () => {
  it("builds a hitter insights model from charted pitch data", () => {
    const data = buildHitterPerformanceInsightsData({
      hitterId: "DDrazka1",
      hitterName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      games,
      plateAppearances,
      pitches,
      pitcherHandBySegmentId: new Map([["seg-1", "R"]]),
    });

    expect(data).not.toBeNull();
    expect(data?.summary.totalPitchesSeen).toBe(4);
    expect(data?.summary.totalPlateAppearances).toBe(3);
    expect(data?.summary.avg).toBeCloseTo(0.5, 4);
    expect(data?.summary.obp).toBeCloseTo(2 / 3, 4);
    expect(data?.summary.slg).toBeCloseTo(0.5, 4);

    const singlePitch = data?.pitches.find((pitch) => pitch.id === "pitch-1");
    expect(singlePitch?.zoneRow).toBe(1);
    expect(singlePitch?.zoneColumn).toBe(1);
    expect(singlePitch?.velocityBand).toBe("90_94");
    expect(singlePitch?.outcomeLabel).toBe("Single");
    expect(singlePitch?.terminalHit).toBe(true);
    expect(singlePitch?.pitcherHand).toBe("R");
    expect(data?.capabilities.pitcherHand).toBe(true);

    const strikeoutPitch = data?.pitches.find((pitch) => pitch.id === "pitch-3");
    expect(strikeoutPitch?.countCategory).toBe("twoStrike");
    expect(strikeoutPitch?.outcomeLabel).toBe("Strikeout");
    expect(strikeoutPitch?.isInZone).toBe(false);
  });

  it("filters pitch records by count, velocity, and zone scope", () => {
    const data = buildHitterPerformanceInsightsData({
      hitterId: "DDrazka1",
      hitterName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      games,
      plateAppearances,
      pitches,
    });

    expect(data).not.toBeNull();

    const filtered = filterHitterInsightPitches(data!.pitches, {
      dateFrom: null,
      dateTo: null,
      pitchTypes: [],
      velocityBands: ["80_84", "85_89", "lt80"],
      countCategory: "twoStrike",
      zoneScope: "outOfZone",
    });

    expect(filtered.map((pitch) => pitch.id)).toEqual(["pitch-3", "pitch-4"]);
  });

  it("selects zone subsets and summarizes the resulting performance", () => {
    const data = buildHitterPerformanceInsightsData({
      hitterId: "DDrazka1",
      hitterName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      games,
      plateAppearances,
      pitches,
    });

    expect(data).not.toBeNull();

    const lowChasePitches = selectHitterInsightPitches(data!.pitches, { kind: "outOfZone" });
    const chaseSummary = summarizeHitterInsightPitches(lowChasePitches);

    expect(chaseSummary.pitches).toBe(2);
    expect(chaseSummary.whiffs).toBe(1);
    expect(chaseSummary.walks).toBe(1);
    expect(chaseSummary.chasePct).toBeCloseTo(50, 4);
    expect(selectionLabel({ kind: "column", column: 0 }, "R")).toBe("Inner lane");
    expect(selectionLabel({ kind: "cell", cell: 5 }, "R")).toBe("Heart");
  });
});
