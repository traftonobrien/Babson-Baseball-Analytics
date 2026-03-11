import { describe, expect, it } from "vitest";
import { buildChartingPlayerProfile, type ChartingProfileGame } from "./playerProfile";
import type {
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

function makeGame(id: string, gameDate: string, opponent: string): ChartingProfileGame {
  return { id, gameDate, opponent };
}

function makeSegment(
  id: string,
  gameId: string,
  playerId: string,
  displayName: string,
  segmentOrder: number,
  enteredInning: number
): ChartingPitcherSegment {
  return {
    id,
    gameId,
    playerId,
    displayName,
    segmentOrder,
    enteredInning,
    exitedInning: enteredInning,
    runsOverride: null,
    earnedRunsOverride: null,
  };
}

function makePa(
  id: string,
  gameId: string,
  segmentId: string,
  paOrder: number,
  inning: number,
  hitterName: string,
  resultCode: string | null
): ChartingPlateAppearance {
  return {
    id,
    gameId,
    segmentId,
    paOrder,
    inning,
    hitterName,
    lineupSlot: 1,
    resultCode,
    buntContext: false,
  };
}

function makePitch(
  id: string,
  gameId: string,
  paId: string,
  pitchOrder: number,
  pitchResult: ChartingPitch["pitchResult"],
  locationCell: number | null
): ChartingPitch {
  return {
    id,
    gameId,
    paId,
    pitchOrder,
    pitchType: "Fastball",
    locationCell,
    pitchResult,
    ballsBefore: 0,
    strikesBefore: pitchOrder,
    velocity: null,
  };
}

describe("buildChartingPlayerProfile", () => {
  it("returns a pitcher-only profile when the player only appears as a charted pitcher", () => {
    const games = [makeGame("game-1", "2026-03-01", "MIT")];
    const segments = [makeSegment("seg-1", "game-1", "DJames1", "D. James", 0, 1)];
    const plateAppearances = [makePa("pa-1", "game-1", "seg-1", 0, 1, "Other Hitter", "K")];
    const pitches = [
      makePitch("pitch-1", "game-1", "pa-1", 0, "called_strike", 5),
      makePitch("pitch-2", "game-1", "pa-1", 1, "foul", 8),
      makePitch("pitch-3", "game-1", "pa-1", 2, "swinging_strike", 12),
    ];

    const profile = buildChartingPlayerProfile({
      playerSlug: "james_dillon",
      games,
      segments,
      plateAppearances,
      pitches,
    });

    expect(profile.availableRoles).toEqual(["pitcher"]);
    expect(profile.defaultRole).toBe("pitcher");
    expect(profile.pitcher?.playerId).toBe("DJames1");
    expect(profile.pitcher?.stats?.sessions).toBe(1);
    expect(profile.pitcher?.stats?.totalPAs).toBe(1);
    expect(profile.hitter).toBeNull();
  });

  it("merges multiple charted hitter name variants into one hitter profile", () => {
    const games = [
      makeGame("game-1", "2026-03-01", "MIT"),
      makeGame("game-2", "2026-03-05", "WPI"),
    ];
    const segments = [
      makeSegment("seg-1", "game-1", "OTHER1", "Other Pitcher", 0, 1),
      makeSegment("seg-2", "game-2", "OTHER2", "Other Pitcher", 0, 1),
    ];
    const plateAppearances = [
      makePa("pa-1", "game-1", "seg-1", 0, 1, "Dylan Drazka", "1B"),
      makePa("pa-2", "game-2", "seg-2", 0, 1, "Drazka, Dylan", "BB"),
    ];
    const pitches = [
      makePitch("pitch-1", "game-1", "pa-1", 0, "called_strike", 5),
      makePitch("pitch-2", "game-1", "pa-1", 1, "in_play", 8),
      makePitch("pitch-3", "game-2", "pa-2", 0, "ball", 11),
      makePitch("pitch-4", "game-2", "pa-2", 1, "ball", 12),
      makePitch("pitch-5", "game-2", "pa-2", 2, "ball", 13),
      makePitch("pitch-6", "game-2", "pa-2", 3, "ball", 14),
    ];

    const profile = buildChartingPlayerProfile({
      playerSlug: "drazka_dylan",
      games,
      segments,
      plateAppearances,
      pitches,
    });

    expect(profile.availableRoles).toEqual(["hitter"]);
    expect(profile.hitter?.matchedHitterNames).toEqual(["Dylan Drazka", "Drazka, Dylan"]);
    expect(profile.hitter?.stats?.sessions).toBe(2);
    expect(profile.hitter?.stats?.totalPAs).toBe(2);
    expect(profile.hitter?.sessions.map((session) => session.gameDate)).toEqual([
      "2026-03-05",
      "2026-03-01",
    ]);
    expect(profile.pitcher).toBeNull();
  });

  it("supports two-way players with both pitcher and hitter Live AB data", () => {
    const games = [
      makeGame("game-1", "2026-03-01", "MIT"),
      makeGame("game-2", "2026-03-05", "WPI"),
    ];
    const segments = [makeSegment("seg-1", "game-1", "DDrazka1", "D. Drazka", 0, 1)];
    const plateAppearances = [
      makePa("pa-1", "game-1", "seg-1", 0, 1, "Opp Hitter", "K"),
      makePa("pa-2", "game-2", "seg-2", 0, 1, "Dylan Drazka", "1B"),
    ];
    const pitches = [
      makePitch("pitch-1", "game-1", "pa-1", 0, "called_strike", 5),
      makePitch("pitch-2", "game-1", "pa-1", 1, "foul", 8),
      makePitch("pitch-3", "game-1", "pa-1", 2, "swinging_strike", 12),
      makePitch("pitch-4", "game-2", "pa-2", 0, "called_strike", 2),
      makePitch("pitch-5", "game-2", "pa-2", 1, "in_play", 9),
    ];

    const profile = buildChartingPlayerProfile({
      playerSlug: "drazka_dylan",
      games,
      segments,
      plateAppearances,
      pitches,
    });

    expect(profile.availableRoles).toEqual(["pitcher", "hitter"]);
    expect(profile.defaultRole).toBe("pitcher");
    expect(profile.pitcher?.stats?.sessions).toBe(1);
    expect(profile.hitter?.stats?.sessions).toBe(1);
  });

  it("returns explicit no-data state when the player has no charted Live AB records", () => {
    const profile = buildChartingPlayerProfile({
      playerSlug: "wilson_alexander",
      games: [],
      segments: [],
      plateAppearances: [],
      pitches: [],
    });

    expect(profile.availableRoles).toEqual([]);
    expect(profile.defaultRole).toBeNull();
    expect(profile.pitcher).toBeNull();
    expect(profile.hitter).toBeNull();
  });
});
