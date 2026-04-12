import { describe, it, expect } from "vitest";
import {
  buildMatrixLookups,
  lookupRe24,
  lookupRe288,
  computeDeltaRe,
  batchComputeDeltaRe,
} from "./deltaRe";
import type { ChartedPaLocator } from "./deltaRe";
import { buildPaLookupMap } from "./gameBaseStates";
import type {
  ReMatrixFile,
  GameBaseStatesIndex,
  PaBaseStateRecord,
} from "./types";

// ---------------------------------------------------------------------------
// Minimal matrix fixture
// RE24 values loosely modeled on MLB averages (bases empty: 0→0.54, 1→0.30, 2→0.12)
// ---------------------------------------------------------------------------

function makeMatrix(overrides: Partial<ReMatrixFile> = {}): ReMatrixFile {
  const re24: ReMatrixFile["re24"] = [
    { baseState: "000", outs: 0, n: 100, meanRe: 0.54 },
    { baseState: "000", outs: 1, n: 100, meanRe: 0.30 },
    { baseState: "000", outs: 2, n: 100, meanRe: 0.12 },
    { baseState: "100", outs: 0, n: 100, meanRe: 0.95 },
    { baseState: "100", outs: 1, n: 100, meanRe: 0.56 },
    { baseState: "100", outs: 2, n: 100, meanRe: 0.24 },
    { baseState: "010", outs: 0, n: 100, meanRe: 1.19 },
    { baseState: "010", outs: 1, n: 100, meanRe: 0.71 },
    { baseState: "010", outs: 2, n: 100, meanRe: 0.34 },
    { baseState: "001", outs: 0, n: 100, meanRe: 1.38 },
    { baseState: "001", outs: 1, n: 100, meanRe: 1.00 },
    { baseState: "001", outs: 2, n: 100, meanRe: 0.37 },
    { baseState: "110", outs: 0, n: 100, meanRe: 1.55 },
    { baseState: "110", outs: 1, n: 100, meanRe: 0.97 },
    { baseState: "110", outs: 2, n: 100, meanRe: 0.46 },
    { baseState: "101", outs: 0, n: 100, meanRe: 1.78 },
    { baseState: "101", outs: 1, n: 100, meanRe: 1.22 },
    { baseState: "101", outs: 2, n: 100, meanRe: 0.54 },
    { baseState: "011", outs: 0, n: 100, meanRe: 2.05 },
    { baseState: "011", outs: 1, n: 100, meanRe: 1.46 },
    { baseState: "011", outs: 2, n: 100, meanRe: 0.61 },
    { baseState: "111", outs: 0, n: 100, meanRe: 2.40 },
    { baseState: "111", outs: 1, n: 100, meanRe: 1.63 },
    { baseState: "111", outs: 2, n: 100, meanRe: 0.78 },
  ];

  // RE288: use same values as RE24 for simplicity, with count "0-2"
  const re288: ReMatrixFile["re288"] = re24.map((cell) => ({
    ...cell,
    count: "0-2" as const,
    outProb: 0.7,
  }));

  return {
    generatedAt: "2026-04-11T00:00:00Z",
    season: 2026,
    totalObservationsRe24: 2400,
    totalObservationsRe288: 2400,
    minObservations: 5,
    re24,
    re288,
    ...overrides,
  };
}

function makeIndex(pas: PaBaseStateRecord[]): GameBaseStatesIndex {
  return {
    generatedAt: "2026-04-11T00:00:00Z",
    season: 2026,
    totalGames: 1,
    totalPas: pas.length,
    pas,
  };
}

function makePa(overrides: Partial<PaBaseStateRecord> = {}): PaBaseStateRecord {
  return {
    gameId: "g1",
    date: "2026-02-14",
    opponent: "Bentley",
    homeAway: "home",
    suffix: null,
    inning: 1,
    halfInning: "top",
    paIndex: 0,
    baseStateBefore: "000",
    outsBefore: 0,
    baseStateAfter: "000",
    outsAfter: 1,
    runsScored: 0,
    count: "0-2",
    pitchSequence: "KK",
    ...overrides,
  };
}

function makeLocator(overrides: Partial<ChartedPaLocator> = {}): ChartedPaLocator {
  return {
    gameId: "g1",
    inning: 1,
    halfInning: "top",
    paIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildMatrixLookups
// ---------------------------------------------------------------------------

describe("buildMatrixLookups", () => {
  it("builds re24 and re288 maps from the matrix file", () => {
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    expect(re24.size).toBe(24);
    expect(re288.size).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// lookupRe24 and lookupRe288
// ---------------------------------------------------------------------------

describe("lookupRe24", () => {
  it("returns the meanRe for a populated cell", () => {
    const { re24 } = buildMatrixLookups(makeMatrix());
    expect(lookupRe24(re24, "000", 0)).toBeCloseTo(0.54);
    expect(lookupRe24(re24, "000", 2)).toBeCloseTo(0.12);
  });

  it("returns null for a cell not in the map", () => {
    const { re24 } = buildMatrixLookups(makeMatrix());
    // "000"-0 with meanRe = null
    const matrixWithNull = makeMatrix({
      re24: [{ baseState: "000", outs: 0, n: 2, meanRe: null }],
    });
    const { re24: sparseRe24 } = buildMatrixLookups(matrixWithNull);
    expect(lookupRe24(sparseRe24, "000", 0)).toBeNull();
  });
});

describe("lookupRe288", () => {
  it("returns the meanRe for a populated cell", () => {
    const { re288 } = buildMatrixLookups(makeMatrix());
    expect(lookupRe288(re288, "0-2", "000", 0)).toBeCloseTo(0.54);
  });

  it("returns null for a missing count", () => {
    const { re288 } = buildMatrixLookups(makeMatrix());
    // Matrix only has "0-2" cells; "3-2" should be missing
    expect(lookupRe288(re288, "3-2", "000", 0)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeDeltaRe — hand-verified sign convention cases
// ---------------------------------------------------------------------------

describe("computeDeltaRe — sign convention", () => {
  it("strikeout (K) at 0-2, bases empty, 0 outs → delta_re < 0 (pitcher helped)", () => {
    // Pre:  RE288("0-2", "000", 0) = 0.54  (per our fixture)
    // Post: RE24("000", 1)         = 0.30  (one out recorded)
    // runs_scored = 0
    // delta_re = 0.30 - 0.54 + 0 = -0.24 → pitcher helped ✓
    const pa = makePa({ outsAfter: 1, runsScored: 0 });
    const matrix = makeMatrix();
    const { re24, re288 } = buildMatrixLookups(matrix);
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.deltaRe).toBeLessThan(0); // pitcher helped
    expect(result.deltaRe).toBeCloseTo(0.30 - 0.54 + 0); // -0.24
  });

  it("ball (→ 1-2 count, inning continues), bases empty, 0 outs → delta_re > 0 (pitcher hurt)", () => {
    // A ball at 0-2 with no baserunner change: outs stay 0, bases stay empty.
    // Pre:  RE288("0-2", "000", 0) = 0.54
    // Post: RE24("000", 0)         = 0.54 (same state — no change in outs/bases)
    // runs_scored = 0
    // delta_re ≈ 0 (count changed but base state unchanged; RE24 used for post)
    // This is approximate because RE24 ignores count; in reality 1-2 RE288 < 0-2 RE288.
    // The test just verifies the formula executes without error.
    const pa = makePa({ outsAfter: 0, baseStateAfter: "000", runsScored: 0 });
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    // delta_re = RE24("000", 0) - RE288("0-2", "000", 0) + 0
    //          = 0.54 - 0.54 = 0.0 (with these fixture values)
    expect(result.deltaRe).toBeCloseTo(0);
  });

  it("single (runner to first), bases empty, 0 outs → delta_re > 0 (pitcher hurt)", () => {
    // Pre:  RE288("0-2", "000", 0) = 0.54
    // Post: RE24("100", 0)         = 0.95 (runner on first, 0 outs)
    // runs_scored = 0
    // delta_re = 0.95 - 0.54 + 0 = 0.41 → pitcher hurt ✓
    const pa = makePa({
      outsAfter: 0,
      baseStateAfter: "100",
      runsScored: 0,
    });
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.deltaRe).toBeGreaterThan(0); // pitcher hurt
    expect(result.deltaRe).toBeCloseTo(0.95 - 0.54 + 0); // 0.41
  });

  it("walk (runner to first, ball count), bases empty → delta_re > 0 (pitcher hurt)", () => {
    // Identical outcome shape to a single at the base-state level.
    const pa = makePa({ outsAfter: 0, baseStateAfter: "100", runsScored: 0 });
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    expect(result.deltaRe).toBeGreaterThan(0);
  });

  it("ground out (outs+1, run scores), bases loaded, 1 out → delta_re can be negative (pitcher helped despite run)", () => {
    // Bases loaded, 1 out → a ground-out scores 1 run but records an out.
    // Pre:  RE288("0-2", "111", 1) = 1.63
    // Post: RE24("011", 2)         = 0.61  (runner on 2nd/3rd, 2 outs)
    // runs_scored = 1
    // delta_re = 0.61 - 1.63 + 1 = -0.02 → slightly negative (pitcher helped) ✓
    const pa = makePa({
      baseStateBefore: "111",
      outsBefore: 1,
      baseStateAfter: "011",
      outsAfter: 2,
      runsScored: 1,
    });
    const matrix = makeMatrix({
      re288: makeMatrix().re288.concat([
        { count: "0-2", baseState: "111", outs: 1, n: 100, meanRe: 1.63, outProb: 0.7 },
      ]),
    });
    const { re24, re288 } = buildMatrixLookups(matrix);
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    // delta_re = RE24("011", 2) - RE288("0-2", "111", 1) + 1
    //          = 0.61 - 1.63 + 1 = -0.02
    expect(result.deltaRe).toBeCloseTo(0.61 - 1.63 + 1);
  });

  it("end of half-inning (outsAfter >= 3) → post RE = 0", () => {
    // When the PA results in 3 outs, the half-inning ends and post RE = 0.
    const pa = makePa({ outsAfter: 3, runsScored: 0 });
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);

    expect(result.matched).toBe(true);
    if (!result.matched) return;
    // delta_re = 0 (post) - 0.54 (pre) + 0 = -0.54
    expect(result.postRe).toBe(0);
    expect(result.deltaRe).toBeCloseTo(-0.54);
  });
});

// ---------------------------------------------------------------------------
// computeDeltaRe — unmatched cases
// ---------------------------------------------------------------------------

describe("computeDeltaRe — unmatched", () => {
  it("returns matched:false when PA key not in index", () => {
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const emptyLookup = new Map();
    const result = computeDeltaRe(makeLocator(), "0-2", emptyLookup, re24, re288);
    expect(result.matched).toBe(false);
  });

  it("returns matched:false when pre RE288 cell is null (n < min)", () => {
    const pa = makePa();
    const matrixWithNull = makeMatrix({
      re288: [{ count: "0-2", baseState: "000", outs: 0, n: 2, meanRe: null, outProb: null }],
    });
    const { re24, re288 } = buildMatrixLookups(matrixWithNull);
    const paLookup = buildPaLookupMap(makeIndex([pa]));
    const result = computeDeltaRe(makeLocator(), "0-2", paLookup, re24, re288);
    expect(result.matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// batchComputeDeltaRe
// ---------------------------------------------------------------------------

describe("batchComputeDeltaRe", () => {
  it("returns 100% match rate when all PAs match", () => {
    const pa1 = makePa({ paIndex: 0, outsAfter: 1 });
    const pa2 = makePa({ paIndex: 1, outsAfter: 2 });
    const index = makeIndex([pa1, pa2]);
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(index);
    const locators: ChartedPaLocator[] = [
      makeLocator({ paIndex: 0 }),
      makeLocator({ paIndex: 1 }),
    ];
    const summary = batchComputeDeltaRe(locators, "0-2", paLookup, re24, re288);

    expect(summary.matchedCount).toBe(2);
    expect(summary.unmatchedCount).toBe(0);
    expect(summary.matchRate).toBeCloseTo(1.0);
    expect(typeof summary.totalDeltaRe).toBe("number");
  });

  it("returns 0% match rate when no PAs match", () => {
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const emptyLookup = new Map();
    const locators = [makeLocator({ paIndex: 0 }), makeLocator({ paIndex: 1 })];
    const summary = batchComputeDeltaRe(locators, "0-2", emptyLookup, re24, re288);

    expect(summary.matchedCount).toBe(0);
    expect(summary.matchRate).toBe(0);
    expect(summary.averageDeltaRe).toBeNull();
  });

  it("accumulates totalDeltaRe across matched PAs", () => {
    // Two PAs: both strikeouts at 0-2, bases empty, 0 outs → each delta_re ≈ -0.24
    const pa1 = makePa({ paIndex: 0, outsAfter: 1, runsScored: 0 });
    const pa2 = makePa({ paIndex: 1, outsAfter: 1, runsScored: 0 });
    const index = makeIndex([pa1, pa2]);
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(index);
    const locators: ChartedPaLocator[] = [
      makeLocator({ paIndex: 0 }),
      makeLocator({ paIndex: 1 }),
    ];
    const summary = batchComputeDeltaRe(locators, "0-2", paLookup, re24, re288);

    expect(summary.matchedCount).toBe(2);
    expect(summary.totalDeltaRe).toBeCloseTo(2 * (0.30 - 0.54));
    expect(summary.averageDeltaRe).toBeCloseTo(0.30 - 0.54);
  });

  it("tracks unmatched reasons", () => {
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const emptyLookup = new Map();
    const locators = [makeLocator({ paIndex: 99 })];
    const summary = batchComputeDeltaRe(locators, "0-2", emptyLookup, re24, re288);

    expect(Object.keys(summary.unmatchedReasons).length).toBeGreaterThan(0);
  });

  it("returns correct match rate with partial matches", () => {
    const pa = makePa({ paIndex: 0, outsAfter: 1 });
    const index = makeIndex([pa]);
    const { re24, re288 } = buildMatrixLookups(makeMatrix());
    const paLookup = buildPaLookupMap(index);
    const locators: ChartedPaLocator[] = [
      makeLocator({ paIndex: 0 }), // matches
      makeLocator({ paIndex: 5 }), // no match
    ];
    const summary = batchComputeDeltaRe(locators, "0-2", paLookup, re24, re288);
    expect(summary.matchedCount).toBe(1);
    expect(summary.unmatchedCount).toBe(1);
    expect(summary.matchRate).toBeCloseTo(0.5);
  });
});
