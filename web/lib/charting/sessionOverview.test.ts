import { describe, expect, it } from "vitest";
import { fixtureAnalyticsSnapshot as fx } from "./analytics-fixtures";
import {
  buildHitterOverviewModels,
  buildPitcherOverviewModels,
  buildZoneFrequency,
  summarizeOutcomes,
} from "./sessionOverview";
import type {
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
} from "./types";

describe("buildZoneFrequency", () => {
  it("counts non-null location cells and ignores nulls", () => {
    expect(buildZoneFrequency(fx.pitchesForSegA)).toEqual({
      1: 1,
      2: 1,
      3: 1,
      4: 1,
      5: 1,
      6: 1,
      7: 1,
      8: 1,
      9: 1,
      11: 1,
      12: 1,
      13: 1,
      14: 1,
    });
  });
});

describe("summarizeOutcomes", () => {
  it("buckets strikeouts, walks, hit by pitch, hits, outs, and open PAs", () => {
    const plateAppearances: ChartingPlateAppearance[] = [
      { ...fx.pasForSegA[0], id: "sum-k", resultCode: "K" },
      { ...fx.pasForSegA[1], id: "sum-kl", resultCode: "KL" },
      { ...fx.pasForSegA[2], id: "sum-bb", resultCode: "BB" },
      { ...fx.pasForSegA[3], id: "sum-hbp", resultCode: "HBP" },
      { ...fx.pasForSegA[3], id: "sum-1b", resultCode: "1B" },
      { ...fx.pasForSegA[3], id: "sum-out", resultCode: "6-3" },
      { ...fx.pasForSegA[4], id: "sum-open", resultCode: null },
    ];

    expect(summarizeOutcomes(plateAppearances)).toEqual({
      strikeouts: 2,
      walks: 1,
      hitByPitch: 1,
      hits: 1,
      outs: 1,
      closedPas: 6,
      openPas: 1,
      results: ["K", "KL", "BB", "HBP", "1B", "6-3"],
    });
  });
});

describe("buildPitcherOverviewModels", () => {
  it("returns one overview per pitcher in first-appearance order", () => {
    const models = buildPitcherOverviewModels(
      fx.segments,
      fx.plateAppearances,
      fx.pitches
    );

    expect(models).toHaveLength(2);
    expect(models[0]?.displayName).toBe("D. James");
    expect(models[1]?.displayName).toBe("C. Burrows");
  });

  it("uses the shared analytics engine and builds readable outcomes", () => {
    const models = buildPitcherOverviewModels(
      fx.segments,
      fx.plateAppearances,
      fx.pitches
    );

    expect(models[0]?.stats?.strikePct).toBeCloseTo(80.0, 1);
    expect(models[0]?.pitchMixEntries[0]).toMatchObject({
      pitchType: "Fastball",
      count: 8,
    });
    expect(models[0]?.outcomes).toMatchObject({
      strikeouts: 2,
      walks: 1,
      hits: 1,
      openPas: 1,
    });
  });

  it("merges repeat segments from the same pitcher into one outing", () => {
    const repeatSegment: ChartingPitcherSegment = {
      ...fx.segments[0],
      id: "fix-seg-A-reentry",
      segmentOrder: 2,
      enteredInning: 8,
      exitedInning: 8,
    };
    const repeatPa: ChartingPlateAppearance = {
      ...fx.pasForSegA[0],
      id: "fix-pa-A-reentry",
      segmentId: repeatSegment.id,
      paOrder: 8,
      inning: 8,
      isTopInning: true,
      hitterName: "Wilson",
      lineupSlot: 8,
      teamSide: "opponent",
      resultCode: "6-3",
      runnerOnFirst: null,
      runnerOnSecond: null,
      runnerOnThird: null,
    };
    const repeatPitches: ChartingPitch[] = [
      {
        ...fx.pitchesForSegA[0],
        id: "fix-pitch-A-reentry-1",
        paId: repeatPa.id,
        pitchOrder: 0,
        locationCell: 1,
      },
      {
        ...fx.pitchesForSegA[1],
        id: "fix-pitch-A-reentry-2",
        paId: repeatPa.id,
        pitchOrder: 1,
        locationCell: 11,
      },
    ];

    const models = buildPitcherOverviewModels(
      [...fx.segments, repeatSegment],
      [...fx.plateAppearances, repeatPa],
      [...fx.pitches, ...repeatPitches]
    );
    const james = models[0];

    expect(models).toHaveLength(2);
    expect(james?.displayName).toBe("D. James");
    expect(james?.segments.map((segment) => segment.id)).toEqual([
      "fix-seg-A",
      "fix-seg-A-reentry",
    ]);
    expect(james?.plateAppearances).toHaveLength(fx.pasForSegA.length + 1);
    expect(james?.pitches).toHaveLength(fx.pitchesForSegA.length + repeatPitches.length);
    expect(james?.outcomes).toMatchObject({
      closedPas: 5,
      outs: 1,
      strikeouts: 2,
      walks: 1,
      hits: 1,
      openPas: 1,
    });
    expect(james?.zoneFrequency).toMatchObject({
      1: 2,
      11: 2,
    });
  });

  it("retains empty zone maps for segments without located pitches", () => {
    const models = buildPitcherOverviewModels(
      fx.segments,
      fx.plateAppearances,
      fx.pitches
    );

    expect(models[1]?.zoneFrequency).toEqual({});
    expect(models[1]?.stats?.zonePct).toBeNull();
  });
});

describe("buildHitterOverviewModels", () => {
  it("groups plate appearances by hitter in first-seen order", () => {
    const models = buildHitterOverviewModels(fx.plateAppearances, fx.pitches);

    expect(models.map((model) => model.hitterName)).toEqual([
      "Smith",
      "Jones",
      "Brown",
      "Taylor",
      "Garcia",
      "Miller",
      "Davis",
    ]);
  });

  it("reuses hitter analytics and keeps stable zone-frequency maps", () => {
    const models = buildHitterOverviewModels(fx.plateAppearances, fx.pitches);
    const smith = models.find((model) => model.hitterName === "Smith");

    expect(smith?.stats?.chasePct).toBeCloseTo(100.0, 1);
    expect(smith?.stats?.contactPct).toBeCloseTo(60.0, 1);
    expect(smith?.zoneFrequency).toEqual({
      4: 1,
      5: 1,
      8: 1,
      9: 1,
      12: 1,
      14: 1,
    });
  });

  it("does not let open PAs corrupt the hitter outcome summary", () => {
    const models = buildHitterOverviewModels(fx.plateAppearances, fx.pitches);
    const taylor = models.find((model) => model.hitterName === "Taylor");

    expect(taylor?.outcomes).toMatchObject({
      strikeouts: 0,
      walks: 0,
      hits: 0,
      outs: 0,
      closedPas: 0,
      openPas: 1,
      results: [],
    });
  });

  it("merges Babson hitter aliases into one overview row", () => {
    const babsonPas: ChartingPlateAppearance[] = [
      {
        ...fx.pasForSegA[0],
        id: "our-pa-1",
        gameId: "game-1",
        segmentId: fx.segments[0].id,
        paOrder: 1,
        teamSide: "our",
        hitterName: "Michael McCarthy",
        lineupSlot: 6,
        resultCode: "6-3",
      },
      {
        ...fx.pasForSegA[1],
        id: "our-pa-2",
        gameId: "game-1",
        segmentId: fx.segments[0].id,
        paOrder: 2,
        teamSide: "our",
        hitterName: "Mike McCarthy",
        lineupSlot: 6,
        resultCode: "1B",
      },
    ];
    const babsonPitches: ChartingPitch[] = [
      {
        ...fx.pitchesForSegA[0],
        id: "our-pitch-1",
        gameId: "game-1",
        paId: "our-pa-1",
        pitchOrder: 1,
      },
      {
        ...fx.pitchesForSegA[1],
        id: "our-pitch-2",
        gameId: "game-1",
        paId: "our-pa-2",
        pitchOrder: 2,
      },
    ];

    const models = buildHitterOverviewModels(babsonPas, babsonPitches, [
      {
        hitterName: "Mike McCarthy",
        lineupSlot: 6,
        teamSide: "our",
      },
    ]);

    expect(models).toHaveLength(1);
    expect(models[0]?.hitterName).toBe("Mike McCarthy");
    expect(models[0]?.lineupSlot).toBe(6);
    expect(models[0]?.plateAppearances).toHaveLength(2);
  });
});
