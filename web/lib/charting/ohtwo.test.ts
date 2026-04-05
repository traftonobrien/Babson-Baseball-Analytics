import { describe, expect, it } from "vitest";
import { buildOhTwoReport } from "./ohtwo";
import type {
  ChartingGame,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

const games: Pick<ChartingGame, "id" | "gameDate" | "opponent" | "sessionType">[] = [
  {
    id: "g1",
    gameDate: "2026-04-01",
    opponent: "MIT",
    sessionType: "game",
  },
];

const segments: Pick<
  ChartingPitcherSegment,
  "id" | "gameId" | "teamSide" | "playerId" | "displayName"
>[] = [
  {
    id: "seg-1",
    gameId: "g1",
    teamSide: "our",
    playerId: "P1",
    displayName: "A. Pitcher",
  },
];

const plateAppearances: Pick<
  ChartingPlateAppearance,
  "id" | "gameId" | "segmentId" | "paOrder" | "inning" | "teamSide" | "hitterName" | "lineupSlot" | "resultCode"
>[] = [
  {
    id: "pa-1",
    gameId: "g1",
    segmentId: "seg-1",
    paOrder: 1,
    inning: 1,
    teamSide: "opponent",
    hitterName: "Hitter One",
    hitterHand: "R",
    lineupSlot: 1,
    resultCode: "1B",
  },
  {
    id: "pa-2",
    gameId: "g1",
    segmentId: "seg-1",
    paOrder: 2,
    inning: 1,
    teamSide: "opponent",
    hitterName: "Hitter Two",
    hitterHand: "R",
    lineupSlot: 2,
    resultCode: "K",
  },
  {
    id: "pa-3",
    gameId: "g1",
    segmentId: "seg-1",
    paOrder: 3,
    inning: 2,
    teamSide: "opponent",
    hitterName: "Hitter Three",
    hitterHand: "L",
    lineupSlot: 3,
    resultCode: "F8",
  },
  {
    id: "pa-4",
    gameId: "g1",
    segmentId: "seg-1",
    paOrder: 4,
    inning: 2,
    teamSide: "opponent",
    hitterName: "Hitter Four",
    hitterHand: null,
    lineupSlot: 4,
    resultCode: "BB",
  },
];

const pitches: ChartingPitch[] = [
  {
    id: "p1",
    gameId: "g1",
    paId: "pa-1",
    pitchOrder: 1,
    pitchType: "Fastball",
    locationCell: 12,
    pitchResult: "in_play",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 91,
  },
  {
    id: "p2",
    gameId: "g1",
    paId: "pa-2",
    pitchOrder: 1,
    pitchType: "Slider",
    locationCell: 5,
    pitchResult: "foul",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 83,
  },
  {
    id: "p3",
    gameId: "g1",
    paId: "pa-2",
    pitchOrder: 2,
    pitchType: "Fastball",
    locationCell: 14,
    pitchResult: "swinging_strike",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 92,
  },
  {
    id: "p4",
    gameId: "g1",
    paId: "pa-3",
    pitchOrder: 1,
    pitchType: "Fastball",
    locationCell: 11,
    pitchResult: "foul",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 90,
  },
  {
    id: "p5",
    gameId: "g1",
    paId: "pa-3",
    pitchOrder: 2,
    pitchType: "Slider",
    locationCell: 3,
    pitchResult: "in_play",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 82,
  },
  {
    id: "p6",
    gameId: "g1",
    paId: "pa-4",
    pitchOrder: 1,
    pitchType: "Fastball",
    locationCell: 17,
    pitchResult: "ball",
    ballsBefore: 0,
    strikesBefore: 2,
    velocity: 91,
  },
  {
    id: "p7",
    gameId: "g1",
    paId: "pa-4",
    pitchOrder: 2,
    pitchType: "Fastball",
    locationCell: 5,
    pitchResult: "ball",
    ballsBefore: 1,
    strikesBefore: 2,
    velocity: 92,
  },
];

describe("buildOhTwoReport", () => {
  it("uses only the first 0-2 pitch in each plate appearance", () => {
    const report = buildOhTwoReport({
      games,
      segments,
      plateAppearances,
      pitches,
    });

    expect(report.events).toHaveLength(3);
    expect(report.events.map((event) => event.paId)).toEqual(["pa-4", "pa-3", "pa-1"]);
    expect(report.events.some((event) => event.paId === "pa-2")).toBe(false);
  });

  it("tracks execution and next-pitch context", () => {
    const report = buildOhTwoReport({
      games,
      segments,
      plateAppearances,
      pitches,
    });

    const continuedPa = report.events.find((event) => event.paId === "pa-3");
    expect(continuedPa?.endedPlateAppearance).toBe(false);
    expect(continuedPa?.executionCategory).toBe("executedStrike");
    expect(continuedPa?.nextPitch).toMatchObject({
      pitchType: "Slider",
      countLabel: "0-2",
      locationCell: 3,
      pitchResult: "in_play",
      recordedOut: true,
    });

    expect(report.summary.qualifyingPitches).toBe(3);
    expect(report.summary.plateAppearancesEnded).toBe(1);
    expect(report.summary.continuedPlateAppearances).toBe(2);
    expect(report.summary.battingAverageAgainst).toBe(1);
    expect(report.locationCounts).toMatchObject({ 11: 1, 12: 1, 17: 1 });
    expect(report.execution.unknownHandPitches).toBe(1);
    expect(report.execution.executedStrike).toBe(2);
    expect(report.execution.executedBall).toBe(1);
    expect(report.execution.inZoneMisses).toBe(0);
    expect(report.execution.executionRate).toBe(100);
    expect(report.nextPitch.total).toBe(2);
    expect(report.nextPitch.fastballShare).toBe(50);
    expect(report.nextPitch.breakingBallShare).toBe(50);
    expect(report.nextPitch.strikeRate).toBe(50);
    expect(report.nextPitch.outRate).toBe(50);
    expect(report.nextPitch.twoPitchOutConversionRate).toBeCloseTo(33.3333, 3);
  });
});
