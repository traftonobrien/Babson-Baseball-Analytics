import { describe, expect, it } from "vitest";
import {
  computePitcherAggregation,
  computeSegmentStats_pure,
} from "./analytics-pitcher";
import {
  computeHitterAggregation,
  computeHitterStats_pure,
} from "./analytics-hitter";
import { fixtureAnalyticsSnapshot as fx } from "./analytics-fixtures";
import type { ChartingPitch, ChartingPlateAppearance } from "./types";

function duplicateSmithSession(suffix: string) {
  const pas = fx.pasForSmith.map((pa) => ({
    ...pa,
    id: `${pa.id}-${suffix}`,
    gameId: `fix-game-${suffix}`,
  }));
  const paIdMap = new Map(fx.pasForSmith.map((pa, index) => [pa.id, pas[index].id]));
  const pitches = fx.pitchesForSmith.map((pitch) => ({
    ...pitch,
    id: `${pitch.id}-${suffix}`,
    gameId: `fix-game-${suffix}`,
    paId: paIdMap.get(pitch.paId) ?? pitch.paId,
  }));

  return { pas, pitches };
}

describe("computeSegmentStats_pure", () => {
  it("returns null for empty pitch array", () => {
    expect(computeSegmentStats_pure([], [])).toBeNull();
  });

  it("returns null for empty PA array", () => {
    expect(computeSegmentStats_pure(fx.pitchesForSegA, [])).toBeNull();
  });

  it("computes Strike% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.strikePct).toBeCloseTo(80.0, 1);
  });

  it("computes Whiff% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.whiffPct).toBeCloseTo(37.5, 1);
  });

  it("computes Zone% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.zonePct).toBeCloseTo(69.2, 1);
  });

  it("computes Chase% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.chasePct).toBeCloseTo(75.0, 1);
  });

  it("computes FPS% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.fpsPct).toBeCloseTo(60.0, 1);
  });

  it("computes K% using both K and KL result codes", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.kPct).toBeCloseTo(50.0, 1);
  });

  it("computes BB% from known fixture", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.bbPct).toBeCloseTo(25.0, 1);
  });

  it("excludes open PAs from K% and BB% denominators", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.kPct).toBeCloseTo(50.0, 1);
    expect(stats?.bbPct).toBeCloseTo(25.0, 1);
  });

  it("returns null for whiffPct when there are zero swings", () => {
    const pitches: ChartingPitch[] = [
      {
        ...fx.pitchesForSegA[0],
        id: "zero-swing-1",
        pitchResult: "ball",
      },
      {
        ...fx.pitchesForSegA[1],
        id: "zero-swing-2",
        pitchResult: "called_strike",
      },
    ];
    const pas: ChartingPlateAppearance[] = [
      {
        ...fx.pasForSegA[0],
        id: "zero-swing-pa",
        resultCode: "BB",
      },
    ];

    const stats = computeSegmentStats_pure(pitches, pas);

    expect(stats?.whiffPct).toBeNull();
  });

  it("returns null for zonePct when all location cells are null", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegB, fx.pasForSegB);

    expect(stats?.zonePct).toBeNull();
  });

  it("returns null for chasePct when there are no out-of-zone located pitches", () => {
    const zoneOnlyPitches = fx.pitchesForSmith.filter(
      (pitch) => pitch.locationCell !== null && pitch.locationCell <= 9
    );
    const stats = computeSegmentStats_pure(zoneOnlyPitches, fx.pasForSmith);

    expect(stats?.chasePct).toBeNull();
  });

  it("reports correct pitch mix counts", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);

    expect(stats?.pitchMix.Fastball).toBe(8);
    expect(stats?.pitchMix.Slider).toBe(4);
    expect(stats?.pitchMix.Curveball).toBe(2);
    expect(stats?.pitchMix.Changeup).toBe(1);
  });

  it("reports pitch mix percentages that sum to approximately 100", () => {
    const stats = computeSegmentStats_pure(fx.pitchesForSegA, fx.pasForSegA);
    const totalPct = Object.values(stats?.pitchMixPct ?? {}).reduce(
      (sum, value) => sum + value,
      0
    );

    expect(totalPct).toBeCloseTo(100, 5);
  });
});

describe("computeHitterStats_pure", () => {
  it("returns null for empty pitch array", () => {
    expect(computeHitterStats_pure([], fx.pasForSmith)).toBeNull();
  });

  it("computes Chase% for a hitter from fixture pitches and PAs", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.chasePct).toBeCloseTo(100.0, 1);
  });

  it("computes Contact% correctly", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.contactPct).toBeCloseTo(60.0, 1);
  });

  it("computes Whiff% for hitter from fixture", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.whiffPct).toBeCloseTo(40.0, 1);
  });

  it("computes K% for hitter data including KL when provided", () => {
    const klPas = fx.pasForSmith.map((pa, index) =>
      index === 1 ? { ...pa, resultCode: "KL" } : pa
    );
    const stats = computeHitterStats_pure(fx.pitchesForSmith, klPas);

    expect(stats?.kPct).toBeCloseTo(100.0, 1);
  });

  it("computes BB% for hitter", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.bbPct).toBeCloseTo(0.0, 1);
  });

  it("computes wOBA from closed plate appearance outcomes", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.woba).toBeCloseTo(0.445, 3);
  });

  it("builds a zoneFrequency map with counts per non-null cell", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.zoneFrequency).toEqual({
      4: 1,
      5: 1,
      8: 1,
      9: 1,
      12: 1,
      14: 1,
    });
  });

  it("groups pitch-type splits into Fastball, Breaking, and Offspeed buckets", () => {
    const stats = computeHitterStats_pure(fx.pitchesForSmith, fx.pasForSmith);

    expect(stats?.vsFastball).toEqual({
      pitches: 3,
      swings: 2,
      whiffs: 2,
      whiffPct: 100,
    });
    expect(stats?.vsBreaking).toEqual({
      pitches: 3,
      swings: 3,
      whiffs: 0,
      whiffPct: 0,
    });
    expect(stats?.vsOffspeed).toEqual({
      pitches: 0,
      swings: 0,
      whiffs: 0,
      whiffPct: null,
    });
  });

  it("excludes open PAs from K% and BB% denominators", () => {
    const openPas = [
      ...fx.pasForSmith,
      {
        ...fx.pasForSegA[4],
        id: "smith-open-pa",
        hitterName: "Smith",
      },
    ];
    const stats = computeHitterStats_pure(fx.pitchesForSmith, openPas);

    expect(stats?.kPct).toBeCloseTo(50.0, 1);
    expect(stats?.bbPct).toBeCloseTo(0.0, 1);
  });
});

describe("computePitcherAggregation", () => {
  it("returns null when no segments are provided", () => {
    expect(computePitcherAggregation([], [], 0, 0)).toBeNull();
  });

  it("aggregates two segments by summing raw counts before dividing", () => {
    const stats = computePitcherAggregation(
      [...fx.pitchesForSegA, ...fx.pitchesForSegB],
      [...fx.pasForSegA, ...fx.pasForSegB],
      2,
      2
    );

    expect(stats?.strikePct).toBeCloseTo(66.7, 1);
    expect(stats?.strikePct).not.toBeCloseTo((80 + 33.3333333333) / 2, 1);
    expect(stats?.bbPct).toBeCloseTo(33.3, 1);
  });

  it("returns the correct session and PA counts", () => {
    const stats = computePitcherAggregation(
      [...fx.pitchesForSegA, ...fx.pitchesForSegB],
      [...fx.pasForSegA, ...fx.pasForSegB],
      2,
      2
    );

    expect(stats?.sessions).toBe(2);
    expect(stats?.totalPAs).toBe(8);
  });
});

describe("computeHitterAggregation", () => {
  it("returns null when no data is provided", () => {
    expect(computeHitterAggregation([], [], 0)).toBeNull();
  });

  it("aggregates hitter stats across two PA sets", () => {
    const secondSession = duplicateSmithSession("copy");
    const stats = computeHitterAggregation(
      [...fx.pitchesForSmith, ...secondSession.pitches],
      [...fx.pasForSmith, ...secondSession.pas],
      2
    );

    expect(stats?.sessions).toBe(2);
    expect(stats?.totalPAs).toBe(4);
    expect(stats?.totalPitches).toBe(12);
    expect(stats?.chasePct).toBeCloseTo(100.0, 1);
    expect(stats?.contactPct).toBeCloseTo(60.0, 1);
    expect(stats?.kPct).toBeCloseTo(50.0, 1);
  });
});
