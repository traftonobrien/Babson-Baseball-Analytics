import { describe, expect, it } from "vitest";
import {
  buildPitcherPerformanceInsightsData,
  filterPitcherInsightPitches,
  selectPitcherInsightPitches,
  summarizePitcherInsightPitches,
  metricValueForAggregate,
  DEFAULT_PITCHER_INSIGHT_FILTERS,
  type PitcherInsightGameContext,
  type PitcherInsightPitchRecord,
  type PitcherInsightAggregate,
} from "./pitcherInsights";
import type { ChartingPitch, ChartingPlateAppearance } from "./types";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const games: PitcherInsightGameContext[] = [
  { id: "game-1", gameDate: "2026-03-01", opponent: "MIT" },
  { id: "game-2", gameDate: "2026-03-15", opponent: "Tufts" },
];

function makePa(
  overrides: Partial<ChartingPlateAppearance> & { id: string; paOrder: number }
): ChartingPlateAppearance {
  return {
    gameId: "game-1",
    segmentId: "seg-1",
    inning: 1,
    isTopInning: true,
    hitterName: "Batter A",
    lineupSlot: 1,
    teamSide: "opponent",
    resultCode: null,
    buntContext: false,
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
    ...overrides,
  };
}

function makePitch(
  overrides: Partial<ChartingPitch> & { id: string; paId: string; pitchOrder: number }
): ChartingPitch {
  return {
    gameId: "game-1",
    pitchType: "Fastball",
    locationCell: 5,
    pitchResult: "called_strike",
    ballsBefore: 0,
    strikesBefore: 0,
    velocity: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildPitcherPerformanceInsightsData
// ---------------------------------------------------------------------------

describe("buildPitcherPerformanceInsightsData", () => {
  it("returns null when there are no plate appearances", () => {
    const result = buildPitcherPerformanceInsightsData({
      pitcherId: "BBurk1",
      pitcherName: "Bobby Burk",
      games,
      plateAppearances: [],
      pitches: [makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0 })],
    });
    expect(result).toBeNull();
  });

  it("returns null when there are no pitches", () => {
    const result = buildPitcherPerformanceInsightsData({
      pitcherId: "BBurk1",
      pitcherName: "Bobby Burk",
      games,
      plateAppearances: [makePa({ id: "pa-1", paOrder: 0, resultCode: "K" })],
      pitches: [],
    });
    expect(result).toBeNull();
  });

  it("builds basic structure with correct pitcher metadata", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "K" });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, pitchResult: "swinging_strike" });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: "BBurk1",
      pitcherName: "Bobby Burk",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    expect(result).not.toBeNull();
    expect(result!.pitcherId).toBe("BBurk1");
    expect(result!.pitcherName).toBe("Bobby Burk");
  });

  it("sorts games descending by date", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, gameId: "game-1" });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, gameId: "game-1" });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    expect(result!.games[0].gameDate).toBe("2026-03-15");
    expect(result!.games[1].gameDate).toBe("2026-03-01");
  });

  it("correctly marks terminal pitch and PA outcome flags", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "K" });
    const pitch1 = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, pitchResult: "called_strike" });
    const pitch2 = makePitch({ id: "p2", paId: "pa-1", pitchOrder: 1, pitchResult: "swinging_strike", strikesBefore: 1 });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch1, pitch2],
    });

    const derived = result!.pitches;
    const first = derived.find((p) => p.id === "p1")!;
    const last = derived.find((p) => p.id === "p2")!;

    expect(first.isTerminalPitch).toBe(false);
    expect(first.terminalStrikeout).toBe(false);
    expect(last.isTerminalPitch).toBe(true);
    expect(last.terminalStrikeout).toBe(true);
    expect(last.terminalAtBat).toBe(true);
    expect(last.terminalWalk).toBe(false);
  });

  it("correctly marks walk outcome", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "BB" });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, pitchResult: "ball", ballsBefore: 3 });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    const derived = result!.pitches[0];
    expect(derived.terminalWalk).toBe(true);
    expect(derived.terminalAtBat).toBe(false);
    expect(derived.terminalStrikeout).toBe(false);
  });

  it("correctly marks hit outcome", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "1B" });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, pitchResult: "in_play" });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    const derived = result!.pitches[0];
    expect(derived.terminalHit).toBe(true);
    expect(derived.terminalAtBat).toBe(true);
  });

  it("assigns correct zone row and column for in-zone cells", () => {
    // Cell 1 = top-left (row 0, col 0), Cell 5 = middle-center (row 1, col 1), Cell 9 = bottom-right (row 2, col 2)
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "K" });
    const p1 = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, locationCell: 1 });
    const p2 = makePitch({ id: "p2", paId: "pa-1", pitchOrder: 1, locationCell: 5, strikesBefore: 1 });
    const p3 = makePitch({ id: "p3", paId: "pa-1", pitchOrder: 2, locationCell: 9, pitchResult: "swinging_strike", strikesBefore: 2 });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [p1, p2, p3],
    });

    const pitches = result!.pitches;
    const cell1 = pitches.find((p) => p.id === "p1")!;
    const cell5 = pitches.find((p) => p.id === "p2")!;
    const cell9 = pitches.find((p) => p.id === "p3")!;

    expect(cell1.zoneRow).toBe(0);
    expect(cell1.zoneColumn).toBe(0);
    expect(cell1.isInZone).toBe(true);

    expect(cell5.zoneRow).toBe(1);
    expect(cell5.zoneColumn).toBe(1);

    expect(cell9.zoneRow).toBe(2);
    expect(cell9.zoneColumn).toBe(2);
  });

  it("marks out-of-zone cells (11-17) as not in zone", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0, resultCode: "BB" });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, locationCell: 14, pitchResult: "ball" });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    const derived = result!.pitches[0];
    expect(derived.isInZone).toBe(false);
    expect(derived.zoneRow).toBeNull();
    expect(derived.zoneColumn).toBeNull();
  });

  it("assigns velocity bands correctly", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0 });
    const pitches = [
      makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, velocity: null }),
      makePitch({ id: "p2", paId: "pa-1", pitchOrder: 1, velocity: 78 }),
      makePitch({ id: "p3", paId: "pa-1", pitchOrder: 2, velocity: 82 }),
      makePitch({ id: "p4", paId: "pa-1", pitchOrder: 3, velocity: 87 }),
      makePitch({ id: "p5", paId: "pa-1", pitchOrder: 4, velocity: 92 }),
      makePitch({ id: "p6", paId: "pa-1", pitchOrder: 5, velocity: 96 }),
    ];

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches,
    });

    const derived = result!.pitches;
    expect(derived.find((p) => p.id === "p1")!.velocityBand).toBe("untracked");
    expect(derived.find((p) => p.id === "p2")!.velocityBand).toBe("lt80");
    expect(derived.find((p) => p.id === "p3")!.velocityBand).toBe("80_84");
    expect(derived.find((p) => p.id === "p4")!.velocityBand).toBe("85_89");
    expect(derived.find((p) => p.id === "p5")!.velocityBand).toBe("90_94");
    expect(derived.find((p) => p.id === "p6")!.velocityBand).toBe("95_plus");
  });

  it("sets capabilities.velocity=true when any pitch has a velocity", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0 });
    const pitches = [
      makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, velocity: null }),
      makePitch({ id: "p2", paId: "pa-1", pitchOrder: 1, velocity: 91 }),
    ];

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches,
    });

    expect(result!.capabilities.velocity).toBe(true);
  });

  it("sets capabilities.velocity=false when no pitch has a velocity", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0 });
    const pitch = makePitch({ id: "p1", paId: "pa-1", pitchOrder: 0, velocity: null });

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches: [pitch],
    });

    expect(result!.capabilities.velocity).toBe(false);
  });

  it("assigns correct count categories", () => {
    const pa = makePa({ id: "pa-1", paOrder: 0 });
    const pitches = [
      makePitch({ id: "p-even",       paId: "pa-1", pitchOrder: 0, ballsBefore: 0, strikesBefore: 0 }),
      makePitch({ id: "p-hitter",     paId: "pa-1", pitchOrder: 1, ballsBefore: 2, strikesBefore: 0 }),
      makePitch({ id: "p-pitcher",    paId: "pa-1", pitchOrder: 2, ballsBefore: 0, strikesBefore: 1 }),
      makePitch({ id: "p-twostrike",  paId: "pa-1", pitchOrder: 3, ballsBefore: 1, strikesBefore: 2 }),
      makePitch({ id: "p-full",       paId: "pa-1", pitchOrder: 4, ballsBefore: 3, strikesBefore: 2 }),
    ];

    const result = buildPitcherPerformanceInsightsData({
      pitcherId: null,
      pitcherName: "Test",
      games,
      plateAppearances: [pa],
      pitches,
    });

    const derived = result!.pitches;
    expect(derived.find((p) => p.id === "p-even")!.countCategory).toBe("even");
    expect(derived.find((p) => p.id === "p-hitter")!.countCategory).toBe("hitter");
    expect(derived.find((p) => p.id === "p-pitcher")!.countCategory).toBe("pitcher");
    expect(derived.find((p) => p.id === "p-twostrike")!.countCategory).toBe("twoStrike");
    expect(derived.find((p) => p.id === "p-full")!.countCategory).toBe("full");
  });
});

// ---------------------------------------------------------------------------
// summarizePitcherInsightPitches
// ---------------------------------------------------------------------------

describe("summarizePitcherInsightPitches", () => {
  it("returns nulls for all rate stats when there are no pitches", () => {
    const agg = summarizePitcherInsightPitches([]);
    expect(agg.pitches).toBe(0);
    expect(agg.strikePct).toBeNull();
    expect(agg.whiffPct).toBeNull();
    expect(agg.chasePct).toBeNull();
    expect(agg.baa).toBeNull();
    expect(agg.kPct).toBeNull();
    expect(agg.bbPct).toBeNull();
    expect(agg.fpsPct).toBeNull();
  });

  function makeRecord(
    overrides: Partial<PitcherInsightPitchRecord> & { id: string }
  ): PitcherInsightPitchRecord {
    return {
      gameId: "game-1",
      gameDate: "2026-03-01",
      opponent: "MIT",
      batterHand: null,
      inning: 1,
      lineupSlot: 1,
      paId: "pa-1",
      pitchOrder: 0,
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      zoneRow: 1,
      zoneColumn: 1,
      isInZone: true,
      ballsBefore: 0,
      strikesBefore: 0,
      countLabel: "0-0",
      countCategory: "even",
      velocity: null,
      velocityBand: "untracked",
      isStrike: true,
      isCalledStrike: true,
      isSwing: false,
      isWhiff: false,
      isContact: false,
      isBall: false,
      isBallInPlay: false,
      isTerminalPitch: false,
      terminalAtBat: false,
      terminalStrikeout: false,
      terminalWalk: false,
      terminalHit: false,
      terminalHitByPitch: false,
      terminalPAs: 0,
      ...overrides,
    };
  }

  it("calculates strikePct correctly", () => {
    const pitches = [
      makeRecord({ id: "p1", isStrike: true }),
      makeRecord({ id: "p2", isStrike: true }),
      makeRecord({ id: "p3", isStrike: false, pitchResult: "ball", isCalledStrike: false }),
      makeRecord({ id: "p4", isStrike: false, pitchResult: "ball", isCalledStrike: false }),
    ];
    const agg = summarizePitcherInsightPitches(pitches);
    expect(agg.strikePct).toBe(50);
  });

  it("calculates whiffPct correctly", () => {
    const pitches = [
      makeRecord({ id: "p1", isSwing: true, isWhiff: true, pitchResult: "swinging_strike" }),
      makeRecord({ id: "p2", isSwing: true, isWhiff: true, pitchResult: "swinging_strike" }),
      makeRecord({ id: "p3", isSwing: true, isWhiff: false, pitchResult: "foul" }),
      makeRecord({ id: "p4", isSwing: false, isWhiff: false }),
    ];
    const agg = summarizePitcherInsightPitches(pitches);
    // 2 whiffs / 3 swings
    expect(agg.whiffPct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("calculates chasePct correctly", () => {
    // 2 out-of-zone pitches, 1 swung at
    const pitches = [
      makeRecord({ id: "p1", isInZone: false, isSwing: true, pitchResult: "swinging_strike", locationCell: 14 }),
      makeRecord({ id: "p2", isInZone: false, isSwing: false, pitchResult: "ball", locationCell: 11 }),
      makeRecord({ id: "p3", isInZone: true }),
    ];
    const agg = summarizePitcherInsightPitches(pitches);
    expect(agg.chasePct).toBe(50);
  });

  it("calculates BAA correctly", () => {
    // 2 at-bats, 1 hit
    const terminal1 = makeRecord({
      id: "p1",
      isTerminalPitch: true,
      terminalPAs: 1,
      terminalAtBat: true,
      terminalHit: true,
      pitchResult: "in_play",
    });
    const terminal2 = makeRecord({
      id: "p2",
      isTerminalPitch: true,
      terminalPAs: 1,
      terminalAtBat: true,
      terminalHit: false,
      terminalStrikeout: true,
    });
    const agg = summarizePitcherInsightPitches([terminal1, terminal2]);
    expect(agg.baa).toBeCloseTo(1 / 2, 5);
    expect(agg.hits).toBe(1);
    expect(agg.atBats).toBe(2);
  });

  it("calculates kPct and bbPct correctly", () => {
    const k = makeRecord({ id: "p1", isTerminalPitch: true, terminalPAs: 1, terminalStrikeout: true, terminalAtBat: true });
    const bb = makeRecord({ id: "p2", isTerminalPitch: true, terminalPAs: 1, terminalWalk: true });
    const hit = makeRecord({ id: "p3", isTerminalPitch: true, terminalPAs: 1, terminalAtBat: true, terminalHit: true });
    const non = makeRecord({ id: "p4" }); // non-terminal

    const agg = summarizePitcherInsightPitches([k, bb, hit, non]);
    // 3 terminal PAs
    expect(agg.kPct).toBeCloseTo((1 / 3) * 100, 5);
    expect(agg.bbPct).toBeCloseTo((1 / 3) * 100, 5);
    expect(agg.plateAppearances).toBe(3);
  });

  it("calculates fpsPct correctly", () => {
    // 3 first pitches (0-0 count), 2 are strikes
    const fps1 = makeRecord({ id: "p1", ballsBefore: 0, strikesBefore: 0, isStrike: true });
    const fps2 = makeRecord({ id: "p2", ballsBefore: 0, strikesBefore: 0, isStrike: false });
    const fps3 = makeRecord({ id: "p3", ballsBefore: 0, strikesBefore: 0, isStrike: true });
    const later = makeRecord({ id: "p4", ballsBefore: 1, strikesBefore: 0, isStrike: false });

    const agg = summarizePitcherInsightPitches([fps1, fps2, fps3, later]);
    expect(agg.fpsPct).toBeCloseTo((2 / 3) * 100, 5);
  });

  it("returns null for chasePct when there are no out-of-zone pitches", () => {
    const pitch = makeRecord({ id: "p1", isInZone: true });
    const agg = summarizePitcherInsightPitches([pitch]);
    expect(agg.chasePct).toBeNull();
  });

  it("returns null for whiffPct when there are no swings", () => {
    const pitch = makeRecord({ id: "p1", isSwing: false });
    const agg = summarizePitcherInsightPitches([pitch]);
    expect(agg.whiffPct).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// filterPitcherInsightPitches
// ---------------------------------------------------------------------------

describe("filterPitcherInsightPitches", () => {
  function makeRecord(
    overrides: Partial<PitcherInsightPitchRecord> & { id: string }
  ): PitcherInsightPitchRecord {
    return {
      gameId: "game-1",
      gameDate: "2026-03-10",
      opponent: "MIT",
      batterHand: null,
      inning: 1,
      lineupSlot: 1,
      paId: "pa-1",
      pitchOrder: 0,
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      zoneRow: 1,
      zoneColumn: 1,
      isInZone: true,
      ballsBefore: 0,
      strikesBefore: 0,
      countLabel: "0-0",
      countCategory: "even",
      velocity: null,
      velocityBand: "untracked",
      isStrike: true,
      isCalledStrike: true,
      isSwing: false,
      isWhiff: false,
      isContact: false,
      isBall: false,
      isBallInPlay: false,
      isTerminalPitch: false,
      terminalAtBat: false,
      terminalStrikeout: false,
      terminalWalk: false,
      terminalHit: false,
      terminalHitByPitch: false,
      terminalPAs: 0,
      ...overrides,
    };
  }

  it("passes all pitches through default filters", () => {
    const pitches = [makeRecord({ id: "p1" }), makeRecord({ id: "p2" })];
    expect(filterPitcherInsightPitches(pitches, DEFAULT_PITCHER_INSIGHT_FILTERS)).toHaveLength(2);
  });

  it("filters by dateFrom", () => {
    const pitches = [
      makeRecord({ id: "p1", gameDate: "2026-03-01" }),
      makeRecord({ id: "p2", gameDate: "2026-03-15" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      dateFrom: "2026-03-10",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p2");
  });

  it("filters by dateTo", () => {
    const pitches = [
      makeRecord({ id: "p1", gameDate: "2026-03-01" }),
      makeRecord({ id: "p2", gameDate: "2026-03-15" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      dateTo: "2026-03-10",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters by pitchType", () => {
    const pitches = [
      makeRecord({ id: "p1", pitchType: "Fastball" }),
      makeRecord({ id: "p2", pitchType: "Curveball" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      pitchTypes: ["Fastball"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters by velocityBand", () => {
    const pitches = [
      makeRecord({ id: "p1", velocityBand: "90_94" }),
      makeRecord({ id: "p2", velocityBand: "85_89" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      velocityBands: ["90_94"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });

  it("filters countCategory=twoStrike includes full count pitches", () => {
    const pitches = [
      makeRecord({ id: "p-even",       countCategory: "even" }),
      makeRecord({ id: "p-twostrike",  countCategory: "twoStrike" }),
      makeRecord({ id: "p-full",       countCategory: "full" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      countCategory: "twoStrike",
    });
    const ids = result.map((p) => p.id);
    expect(ids).toContain("p-twostrike");
    expect(ids).toContain("p-full");
    expect(ids).not.toContain("p-even");
  });

  it("filters countCategory=hitter excludes twoStrike and full", () => {
    const pitches = [
      makeRecord({ id: "p-hitter",    countCategory: "hitter" }),
      makeRecord({ id: "p-pitcher",   countCategory: "pitcher" }),
      makeRecord({ id: "p-twostrike", countCategory: "twoStrike" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      countCategory: "hitter",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p-hitter");
  });

  it("filters zoneScope=inZone excludes out-of-zone and unlocated pitches", () => {
    const pitches = [
      makeRecord({ id: "p-in",  isInZone: true }),
      makeRecord({ id: "p-out", isInZone: false }),
      makeRecord({ id: "p-null", isInZone: null }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      zoneScope: "inZone",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p-in");
  });

  it("filters zoneScope=outOfZone excludes in-zone and unlocated pitches", () => {
    const pitches = [
      makeRecord({ id: "p-in",  isInZone: true }),
      makeRecord({ id: "p-out", isInZone: false }),
      makeRecord({ id: "p-null", isInZone: null }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      zoneScope: "outOfZone",
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p-out");
  });

  it("stacks multiple filters with AND logic", () => {
    const pitches = [
      makeRecord({ id: "p1", pitchType: "Fastball", velocityBand: "90_94" }),
      makeRecord({ id: "p2", pitchType: "Fastball", velocityBand: "85_89" }),
      makeRecord({ id: "p3", pitchType: "Curveball", velocityBand: "90_94" }),
    ];
    const result = filterPitcherInsightPitches(pitches, {
      ...DEFAULT_PITCHER_INSIGHT_FILTERS,
      pitchTypes: ["Fastball"],
      velocityBands: ["90_94"],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("p1");
  });
});

// ---------------------------------------------------------------------------
// selectPitcherInsightPitches
// ---------------------------------------------------------------------------

describe("selectPitcherInsightPitches", () => {
  function makeRecord(
    overrides: Partial<PitcherInsightPitchRecord> & { id: string }
  ): PitcherInsightPitchRecord {
    return {
      gameId: "game-1",
      gameDate: "2026-03-10",
      opponent: "MIT",
      batterHand: null,
      inning: 1,
      lineupSlot: 1,
      paId: "pa-1",
      pitchOrder: 0,
      pitchType: "Fastball",
      pitchResult: "called_strike",
      locationCell: 5,
      zoneRow: 1,
      zoneColumn: 1,
      isInZone: true,
      ballsBefore: 0,
      strikesBefore: 0,
      countLabel: "0-0",
      countCategory: "even",
      velocity: null,
      velocityBand: "untracked",
      isStrike: true,
      isCalledStrike: true,
      isSwing: false,
      isWhiff: false,
      isContact: false,
      isBall: false,
      isBallInPlay: false,
      isTerminalPitch: false,
      terminalAtBat: false,
      terminalStrikeout: false,
      terminalWalk: false,
      terminalHit: false,
      terminalHitByPitch: false,
      terminalPAs: 0,
      wobaWeight: 0,
      ...overrides,
    };
  }

  const pitches = [
    makeRecord({ id: "cell5-a",  locationCell: 5,  zoneRow: 1, zoneColumn: 1, isInZone: true }),
    makeRecord({ id: "cell5-b",  locationCell: 5,  zoneRow: 1, zoneColumn: 1, isInZone: true }),
    makeRecord({ id: "cell7",    locationCell: 7,  zoneRow: 2, zoneColumn: 0, isInZone: true }),
    makeRecord({ id: "cell14",   locationCell: 14, zoneRow: null, zoneColumn: null, isInZone: false }),
    makeRecord({ id: "cell11",   locationCell: 11, zoneRow: null, zoneColumn: null, isInZone: false }),
    makeRecord({ id: "no-cell",  locationCell: null, zoneRow: null, zoneColumn: null, isInZone: null }),
  ];

  it('kind="all" returns all pitches', () => {
    expect(selectPitcherInsightPitches(pitches, { kind: "all" })).toHaveLength(6);
  });

  it('kind="cell" returns only pitches with that exact cell', () => {
    const result = selectPitcherInsightPitches(pitches, { kind: "cell", cell: 5 });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.locationCell === 5)).toBe(true);
  });

  it('kind="row" returns pitches in that zone row', () => {
    // row 2 = cells 7,8,9
    const result = selectPitcherInsightPitches(pitches, { kind: "row", row: 2 });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("cell7");
  });

  it('kind="column" returns pitches in that zone column', () => {
    // column 1 = cells 2,5,8
    const result = selectPitcherInsightPitches(pitches, { kind: "column", column: 1 });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.zoneColumn === 1)).toBe(true);
  });

  it('kind="inZone" returns only in-zone pitches', () => {
    const result = selectPitcherInsightPitches(pitches, { kind: "inZone" });
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.isInZone === true)).toBe(true);
  });

  it('kind="outOfZone" returns only out-of-zone pitches', () => {
    const result = selectPitcherInsightPitches(pitches, { kind: "outOfZone" });
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.isInZone === false)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// metricValueForAggregate
// ---------------------------------------------------------------------------

describe("metricValueForAggregate", () => {
  const agg: PitcherInsightAggregate = {
    pitches: 42,
    locatedPitches: 38,
    strikes: 25,
    swings: 15,
    whiffs: 5,
    contacts: 10,
    fouls: 4,
    ballsInPlay: 6,
    calledStrikes: 10,
    balls: 17,
    hits: 3,
    strikeouts: 4,
    walks: 2,
    hitByPitch: 0,
    outs: 5,
    atBats: 8,
    plateAppearances: 10,
    strikePct: 59.5,
    whiffPct: 33.3,
    chasePct: 25.0,
    baa: 0.375,
    woba: 0.310,
    kPct: 40.0,
    bbPct: 20.0,
    fpsPct: 62.5,
  };

  it("pitchCount returns raw pitch count", () => {
    expect(metricValueForAggregate(agg, "pitchCount")).toBe(42);
  });
  it("strikePct returns strikePct", () => {
    expect(metricValueForAggregate(agg, "strikePct")).toBe(59.5);
  });
  it("whiffPct returns whiffPct", () => {
    expect(metricValueForAggregate(agg, "whiffPct")).toBe(33.3);
  });
  it("chasePct returns chasePct", () => {
    expect(metricValueForAggregate(agg, "chasePct")).toBe(25.0);
  });
  it("baa returns baa", () => {
    expect(metricValueForAggregate(agg, "baa")).toBe(0.375);
  });
  it("woba returns woba", () => {
    expect(metricValueForAggregate(agg, "woba")).toBe(0.310);
  });
  it("kPct returns kPct", () => {
    expect(metricValueForAggregate(agg, "kPct")).toBe(40.0);
  });
  it("bbPct returns bbPct", () => {
    expect(metricValueForAggregate(agg, "bbPct")).toBe(20.0);
  });
  it("fpsPct returns fpsPct", () => {
    expect(metricValueForAggregate(agg, "fpsPct")).toBe(62.5);
  });
});
