import { describe, expect, it } from "vitest";
import { buildOhTwoReport } from "./ohtwo";
import type {
  ChartingGame,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const games: Pick<ChartingGame, "id" | "gameDate" | "opponent" | "sessionType">[] = [
  { id: "g1", gameDate: "2026-04-01", opponent: "MIT", sessionType: "game" },
  { id: "g2", gameDate: "2026-04-05", opponent: "WPI", sessionType: "game" },
];

const segments: Pick<
  ChartingPitcherSegment,
  "id" | "gameId" | "teamSide" | "playerId" | "displayName"
>[] = [
  { id: "seg-1", gameId: "g1", teamSide: "our", playerId: "P1", displayName: "A. Pitcher" },
  { id: "seg-2", gameId: "g2", teamSide: "our", playerId: "P2", displayName: "B. Reliever" },
];

const plateAppearances: Pick<
  ChartingPlateAppearance,
  "id" | "gameId" | "segmentId" | "paOrder" | "inning" | "teamSide" | "hitterName" | "hitterHand" | "lineupSlot" | "resultCode"
>[] = [
  // pa-1: 0-2 FB → in_play → hit (1B), PA ended on pitch
  { id: "pa-1", gameId: "g1", segmentId: "seg-1", paOrder: 1, inning: 1, teamSide: "opponent", hitterName: "Hitter One", hitterHand: "R", lineupSlot: 1, resultCode: "1B" },
  // pa-2: first 0-2 pitch is Slider (disqualified), second is FB → NOT qualified
  { id: "pa-2", gameId: "g1", segmentId: "seg-1", paOrder: 2, inning: 1, teamSide: "opponent", hitterName: "Hitter Two", hitterHand: "R", lineupSlot: 2, resultCode: "K" },
  // pa-3: 0-2 FB → foul (PA continues), next pitch is Slider → F8 out
  { id: "pa-3", gameId: "g1", segmentId: "seg-1", paOrder: 3, inning: 2, teamSide: "opponent", hitterName: "Hitter Three", hitterHand: "L", lineupSlot: 3, resultCode: "F8" },
  // pa-4: 0-2 FB → ball (escape to 1-2), next pitch → BB (walk)
  { id: "pa-4", gameId: "g1", segmentId: "seg-1", paOrder: 4, inning: 2, teamSide: "opponent", hitterName: "Hitter Four", hitterHand: null, lineupSlot: 4, resultCode: "BB" },
  // pa-5: second game, 0-2 FB → swinging_strike → K
  { id: "pa-5", gameId: "g2", segmentId: "seg-2", paOrder: 1, inning: 3, teamSide: "opponent", hitterName: "Hitter Five", hitterHand: "R", lineupSlot: 1, resultCode: "K" },
];

const pitches: ChartingPitch[] = [
  // pa-1: single 0-2 FB, in_play → 1B
  { id: "p1", gameId: "g1", paId: "pa-1", pitchOrder: 1, pitchType: "Fastball", locationCell: 12, pitchResult: "in_play", ballsBefore: 0, strikesBefore: 2, velocity: 91 },

  // pa-2: first pitch is Slider at 0-2, second is FB at 0-2 → Slider disqualifies the PA
  { id: "p2", gameId: "g1", paId: "pa-2", pitchOrder: 1, pitchType: "Slider", locationCell: 5, pitchResult: "foul", ballsBefore: 0, strikesBefore: 2, velocity: 83 },
  { id: "p3", gameId: "g1", paId: "pa-2", pitchOrder: 2, pitchType: "Fastball", locationCell: 14, pitchResult: "swinging_strike", ballsBefore: 0, strikesBefore: 2, velocity: 92 },

  // pa-3: 0-2 FB foul (PA continues), next pitch Slider → F8 out
  { id: "p4", gameId: "g1", paId: "pa-3", pitchOrder: 1, pitchType: "Fastball", locationCell: 11, pitchResult: "foul", ballsBefore: 0, strikesBefore: 2, velocity: 90 },
  { id: "p5", gameId: "g1", paId: "pa-3", pitchOrder: 2, pitchType: "Slider", locationCell: 3, pitchResult: "in_play", ballsBefore: 0, strikesBefore: 2, velocity: 82 },

  // pa-4: 0-2 FB ball (escape → 1-2), next pitch → walk
  { id: "p6", gameId: "g1", paId: "pa-4", pitchOrder: 1, pitchType: "Fastball", locationCell: 17, pitchResult: "ball", ballsBefore: 0, strikesBefore: 2, velocity: 91 },
  { id: "p7", gameId: "g1", paId: "pa-4", pitchOrder: 2, pitchType: "Fastball", locationCell: 5, pitchResult: "ball", ballsBefore: 1, strikesBefore: 2, velocity: 92 },

  // pa-5: second pitcher, 0-2 FB swinging_strike → K
  { id: "p8", gameId: "g2", paId: "pa-5", pitchOrder: 1, pitchType: "Fastball", locationCell: 14, pitchResult: "swinging_strike", ballsBefore: 0, strikesBefore: 2, velocity: 94 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildOhTwoReport — event filtering", () => {
  it("uses only the first 0-2 pitch and requires it to be a fastball", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    // pa-2 disqualified because first 0-2 pitch is Slider
    expect(report.events).toHaveLength(4);
    expect(report.events.map((e) => e.paId).sort()).toEqual(["pa-1", "pa-3", "pa-4", "pa-5"].sort());
    expect(report.events.some((e) => e.paId === "pa-2")).toBe(false);
  });

  it("excludes live_ab sessions", () => {
    const liveGame = [{ ...games[0]!, sessionType: "live_ab" as const }];
    const report = buildOhTwoReport({ games: liveGame, segments, plateAppearances, pitches });
    expect(report.events).toHaveLength(0);
  });
});

describe("buildOhTwoReport — summary", () => {
  it("counts qualifying pitches and PA continuation correctly", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    expect(report.summary.qualifyingPitches).toBe(4);
    // pa-1 (in_play → 1B) and pa-5 (swinging_strike → K) both ended on the 0-2 FB
    expect(report.summary.plateAppearancesEnded).toBe(2);
    // pa-3 (foul → continued) and pa-4 (ball → continued)
    expect(report.summary.continuedPlateAppearances).toBe(2);
  });

  it("computes BAA only on pitches that ended the at-bat", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    // endedAtBats: pa-1 (1B hit) + pa-5 (K out) = 2
    // hits on ending pitch: pa-1 (1B) = 1
    // BAA = 1/2 = 0.5
    expect(report.summary.battingAverageAgainst).toBeCloseTo(0.5, 3);
  });
});

describe("buildOhTwoReport — execution", () => {
  it("classifies chase execution correctly", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    // pa-1 (cell 12, RHH) → executedStrike (in_play is a strike result)
    // pa-3 (cell 11, LHH) → executedStrike (foul for LHH)
    // pa-4 (cell 17, null hand) → fallback lateral cells include 17 → executedBall (ball result)
    // pa-5 (cell 14, RHH) → executedStrike (swinging_strike for RHH)
    expect(report.execution.executedStrike).toBe(3);
    expect(report.execution.executedBall).toBe(1);
    expect(report.execution.executedTotal).toBe(4);
    expect(report.execution.inZoneMisses).toBe(0);
    expect(report.execution.executionRate).toBe(100);
    expect(report.execution.unknownHandPitches).toBe(1);
  });
});

describe("buildOhTwoReport — PA outcomes", () => {
  it("computes full PA result distribution across all qualifying PAs", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    const o = report.paOutcomes;
    expect(o.total).toBe(4);
    expect(o.closedTotal).toBe(4);  // all have resultCodes
    expect(o.singles).toBe(1);      // pa-1
    expect(o.strikeouts).toBe(1);   // pa-5 → "K"
    expect(o.walks).toBe(1);        // pa-4 → "BB"
    expect(o.contactOuts).toBe(1);  // pa-3 → "F8"
    expect(o.homeRuns).toBe(0);
    expect(o.doubles).toBe(0);
    expect(o.totalBases).toBe(1);   // one single
  });

  it("computes strikeout rate, walk rate, BAA, SLG, OBP, OPS", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    const o = report.paOutcomes;
    // 4 closed PAs: K, F8, BB, 1B
    // strikeouts = 1, walks = 1
    // atBats = 3 (K, F8, 1B — BB excluded)
    // hits = 1 (1B), hitless atBats = 2

    expect(o.strikeoutRate).toBeCloseTo(25, 1);         // 1/4
    expect(o.walkRate).toBeCloseTo(25, 1);              // 1/4
    expect(o.battingAverage).toBeCloseTo(1 / 3, 4);    // 1 hit / 3 AB
    expect(o.slugging).toBeCloseTo(1 / 3, 4);           // 1 TB / 3 AB
    expect(o.obp).toBeCloseTo(2 / 4, 4);               // (1 hit + 1 BB) / (3 AB + 1 BB)
    expect(o.ops).toBeCloseTo(1 / 3 + 2 / 4, 4);

    expect(o.kMinusBB).toBeCloseTo(0, 2);              // 25% - 25% = 0
  });
});

describe("buildOhTwoReport — pitch results breakdown", () => {
  it("counts pitch-level results on the 0-2 fastball", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    const pr = report.pitchResults;
    // pa-1: in_play, pa-3: foul, pa-4: ball, pa-5: swinging_strike
    expect(pr.inPlay).toBe(1);
    expect(pr.foul).toBe(1);
    expect(pr.ball).toBe(1);
    expect(pr.swingingStrike).toBe(1);
    expect(pr.calledStrike).toBe(0);
    expect(pr.total).toBe(4);
    expect(pr.ballRate).toBeCloseTo(25, 1);
    expect(pr.swingingStrikeRate).toBeCloseTo(25, 1);
    expect(pr.foulRate).toBeCloseTo(25, 1);
    expect(pr.inPlayRate).toBeCloseTo(25, 1);
    // strike rate = foul + swinging + called + in_play = 3/4
    expect(pr.strikeRate).toBeCloseTo(75, 1);
  });
});

describe("buildOhTwoReport — velocity", () => {
  it("computes avg, max, min from tracked pitches", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    const v = report.velocity;
    // velocities on qualifying pitches: 91 (pa-1), 90 (pa-3), 91 (pa-4), 94 (pa-5)
    expect(v.tracked).toBe(4);
    expect(v.untracked).toBe(0);
    expect(v.max).toBe(94);
    expect(v.min).toBe(90);
    expect(v.avg).toBeCloseTo((91 + 90 + 91 + 94) / 4, 2);
  });
});

describe("buildOhTwoReport — by pitcher", () => {
  it("groups events by pitcher and computes per-pitcher stats", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    expect(report.byPitcher).toHaveLength(2);
    const pitcher1 = report.byPitcher.find((p) => p.pitcherName === "A. Pitcher")!;
    const pitcher2 = report.byPitcher.find((p) => p.pitcherName === "B. Reliever")!;
    expect(pitcher1.count).toBe(3); // pa-1, pa-3, pa-4
    expect(pitcher2.count).toBe(1); // pa-5
    // B. Reliever: 1 closed PA → K → K% = 100%
    expect(pitcher2.strikeoutRate).toBeCloseTo(100, 1);
    expect(pitcher2.avgVelocity).toBe(94);
  });
});

describe("buildOhTwoReport — by opponent", () => {
  it("groups by opponent and computes K%/BAA per opponent", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    const mit = report.byOpponent.find((o) => o.opponent === "MIT")!;
    const wpi = report.byOpponent.find((o) => o.opponent === "WPI")!;
    expect(mit.count).toBe(3);  // pa-1, pa-3, pa-4
    expect(wpi.count).toBe(1);  // pa-5
    // WPI: 1 PA, K → K% = 100%, BAA = 0/1 = 0
    expect(wpi.strikeoutRate).toBeCloseTo(100, 1);
    expect(wpi.battingAverageAgainst).toBe(0);
    // MIT: 3 PAs → 1B, F8, BB
    // closedMIT = 3, strikeouts = 0, K% = 0
    expect(mit.strikeoutRate).toBeCloseTo(0, 1);
    // atBats = 2 (1B, F8), hits = 1 → BAA = 0.500
    expect(mit.battingAverageAgainst).toBeCloseTo(0.5, 3);
  });
});

describe("buildOhTwoReport — inning distribution", () => {
  it("groups by inning and computes shares", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    expect(report.inningDistribution).toHaveLength(3); // innings 1, 2, 3
    const inn1 = report.inningDistribution.find((i) => i.inning === 1)!;
    const inn3 = report.inningDistribution.find((i) => i.inning === 3)!;
    expect(inn1.count).toBe(1); // pa-1
    expect(inn3.count).toBe(1); // pa-5
    expect(inn1.share).toBeCloseTo(25, 1);
    expect(inn3.share).toBeCloseTo(25, 1);
  });
});

describe("buildOhTwoReport — next pitch", () => {
  it("tracks next pitch events and two-pitch out conversion", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    // pa-3 and pa-4 continued past the 0-2 FB → 2 next pitches
    expect(report.nextPitch.total).toBe(2);
    expect(report.nextPitch.fastballShare).toBe(50);  // pa-4 next was Fastball
    expect(report.nextPitch.breakingBallShare).toBe(50);  // pa-3 next was Slider
    // pa-3 next pitch: in_play → F8 out → out rate 1/2 = 50%
    expect(report.nextPitch.outRate).toBe(50);
    // two-pitch outs: pa-1 ended on 0-2 FB (no — it was a hit), pa-3 next pitch was out
    // pa-5 ended on 0-2 FB via swinging_strike → K → that's not tracked as "recordedOutOnPitch" unless isAtBat
    // pa-5: isTerminalPitch=true, isAtBat=true (K≠BB,HBP), isHit=false → recordedOutOnPitch=true
    // pa-3 next pitch: recordedOut=true
    // Total two-pitch outs = 2 (pa-5 + pa-3)
    expect(report.nextPitch.twoPitchOutConversionRate).toBeCloseTo(50, 1); // 2/4
  });
});

describe("buildOhTwoReport — location counts", () => {
  it("tracks location cell distribution", () => {
    const report = buildOhTwoReport({ games, segments, plateAppearances, pitches });
    expect(report.locationCounts[12]).toBe(1);  // pa-1
    expect(report.locationCounts[11]).toBe(1);  // pa-3
    expect(report.locationCounts[17]).toBe(1);  // pa-4
    expect(report.locationCounts[14]).toBe(1);  // pa-5
  });
});

describe("buildOhTwoReport — empty input", () => {
  it("returns zero-state without errors", () => {
    const report = buildOhTwoReport({ games: [], segments: [], plateAppearances: [], pitches: [] });
    expect(report.events).toHaveLength(0);
    expect(report.summary.qualifyingPitches).toBe(0);
    expect(report.paOutcomes.strikeoutRate).toBeNull();
    expect(report.velocity.avg).toBeNull();
    expect(report.byPitcher).toHaveLength(0);
    expect(report.byOpponent).toHaveLength(0);
    expect(report.inningDistribution).toHaveLength(0);
  });
});
