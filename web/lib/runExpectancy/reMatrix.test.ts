import { describe, it, expect } from "vitest";
import {
  baseStateCode,
  re24Key,
  re288Key,
  isValidCount,
  isValidOuts,
  aggregateHalfInnings,
  buildOhTwoBallStateMix,
  buildOhTwoCountProgressionSummary,
  buildRe24Cells,
  buildRe288Cells,
  evaluateOhTwoBallStateMix,
  ALL_BASE_STATES,
  ALL_OUTS,
  ALL_COUNTS,
} from "./reMatrix";
import type { ParsedPbpHalfInning, ParsedPbpPlay } from "./types";

// ---------------------------------------------------------------------------
// Helpers for building minimal test fixtures
// ---------------------------------------------------------------------------

function makePlay(overrides: Partial<ParsedPbpPlay> = {}): ParsedPbpPlay {
  return {
    rawPlay: {
      inning: 1,
      halfInning: "top",
      playIndex: 0,
      playText: "Test play",
      dedupKey: "1-top-0",
    },
    outsBefore: 0,
    outsAfter: 1,
    baseStateBefore: { first: false, second: false, third: false },
    baseStateAfter: { first: false, second: false, third: false },
    count: null,
    pitchSequence: null,
    countSnapshots: [],
    finalCount: null,
    countBeforeTerminalPitch: { balls: 0, strikes: 2, label: "0-2" },
    terminalPitchRecorded: true,
    runsScored: 0,
    ignored: false,
    ...overrides,
  };
}

function makeHalfInning(
  plays: ParsedPbpPlay[],
  expectedRuns = 0,
): ParsedPbpHalfInning {
  const rawHalfInning = {
    key: "top-1",
    caption: "Babson - Top of 1st",
    inning: 1,
    halfInning: "top" as const,
    offenseTeam: "Babson",
    playLines: [],
    plays: [],
    totals: {
      runs: expectedRuns,
      hits: null,
      errors: null,
      leftOnBase: null,
    },
  };
  return {
    rawHalfInning,
    plays,
    parsedRuns: plays.reduce((s, p) => s + p.runsScored, 0),
    validation: { passed: true, expectedRuns, parsedRuns: expectedRuns, reason: null },
    usableForMatrix: true,
  };
}

// ---------------------------------------------------------------------------
// baseStateCode
// ---------------------------------------------------------------------------

describe("baseStateCode", () => {
  it("returns 000 for empty bases", () => {
    expect(baseStateCode(false, false, false)).toBe("000");
  });

  it("returns 100 for runner on first only", () => {
    expect(baseStateCode(true, false, false)).toBe("100");
  });

  it("returns 111 for bases loaded", () => {
    expect(baseStateCode(true, true, true)).toBe("111");
  });

  it("returns 010 for runner on second only", () => {
    expect(baseStateCode(false, true, false)).toBe("010");
  });

  it("returns 101 for runners on first and third", () => {
    expect(baseStateCode(true, false, true)).toBe("101");
  });
});

// ---------------------------------------------------------------------------
// key formatters
// ---------------------------------------------------------------------------

describe("re24Key", () => {
  it("formats as baseState-outs", () => {
    expect(re24Key("000", 0)).toBe("000-0");
    expect(re24Key("111", 2)).toBe("111-2");
  });
});

describe("re288Key", () => {
  it("formats as count|baseState|outs", () => {
    expect(re288Key("0-2", "000", 0)).toBe("0-2|000|0");
    expect(re288Key("3-2", "111", 2)).toBe("3-2|111|2");
  });
});

// ---------------------------------------------------------------------------
// validators
// ---------------------------------------------------------------------------

describe("isValidCount", () => {
  it("accepts all 12 valid count labels", () => {
    for (const count of ALL_COUNTS) {
      expect(isValidCount(count)).toBe(true);
    }
  });

  it("rejects invalid labels", () => {
    expect(isValidCount("4-0")).toBe(false);
    expect(isValidCount("0-3")).toBe(false);
    expect(isValidCount("")).toBe(false);
    expect(isValidCount("0-0 BKFB")).toBe(false);
  });
});

describe("isValidOuts", () => {
  it("accepts 0, 1, 2", () => {
    expect(isValidOuts(0)).toBe(true);
    expect(isValidOuts(1)).toBe(true);
    expect(isValidOuts(2)).toBe(true);
  });

  it("rejects 3 and negative values", () => {
    expect(isValidOuts(3)).toBe(false);
    expect(isValidOuts(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// aggregateHalfInnings
// ---------------------------------------------------------------------------

describe("aggregateHalfInnings", () => {
  it("returns empty maps for empty input", () => {
    const result = aggregateHalfInnings([]);
    expect(result.obsRe24).toBe(0);
    expect(result.obsRe288).toBe(0);
    expect(result.re24Map.size).toBe(0);
    expect(result.re288Map.size).toBe(0);
  });

  it("produces one RE24 observation per non-ignored play", () => {
    const plays = [
      makePlay({ outsBefore: 0, outsAfter: 1, runsScored: 0 }),
      makePlay({ outsBefore: 1, outsAfter: 2, runsScored: 0 }),
    ];
    const hi = makeHalfInning(plays);
    const result = aggregateHalfInnings([hi]);
    expect(result.obsRe24).toBe(2);
  });

  it("skips ignored plays", () => {
    const plays = [
      makePlay({ ignored: true }),
      makePlay({ outsBefore: 0, outsAfter: 1 }),
    ];
    const hi = makeHalfInning(plays);
    const result = aggregateHalfInnings([hi]);
    expect(result.obsRe24).toBe(1);
    expect(result.skippedIgnored).toBe(1);
  });

  it("computes runs-to-end-of-inning correctly", () => {
    // Play 0: scores 1 run; Play 1: scores 2 runs
    // RE for play 0 = 1 + 2 = 3; RE for play 1 = 2
    const plays = [
      makePlay({ outsBefore: 0, outsAfter: 0, runsScored: 1,
        baseStateBefore: { first: false, second: false, third: false } }),
      makePlay({ outsBefore: 0, outsAfter: 1, runsScored: 2,
        baseStateBefore: { first: true, second: false, third: false } }),
    ];
    const hi = makeHalfInning(plays, 3);
    const result = aggregateHalfInnings([hi]);

    // RE24 key for play 0: "000-0"
    const acc0 = result.re24Map.get("000-0");
    expect(acc0?.n).toBe(1);
    expect(acc0?.sumRe).toBe(3);

    // RE24 key for play 1: "100-0"
    const acc1 = result.re24Map.get("100-0");
    expect(acc1?.n).toBe(1);
    expect(acc1?.sumRe).toBe(2);
  });

  it("uses countSnapshots for RE288 when available", () => {
    const play = makePlay({
      outsBefore: 0,
      outsAfter: 1,
      runsScored: 0,
      baseStateBefore: { first: false, second: false, third: false },
      countSnapshots: [
        {
          pitchNumber: 1,
          pitchCode: "S",
          countBefore: { balls: 0, strikes: 0, label: "0-0" },
          countAfter: { balls: 0, strikes: 1, label: "0-1" },
        },
        {
          pitchNumber: 2,
          pitchCode: "S",
          countBefore: { balls: 0, strikes: 1, label: "0-1" },
          countAfter: { balls: 0, strikes: 2, label: "0-2" },
        },
      ],
    });
    const hi = makeHalfInning([play]);
    const result = aggregateHalfInnings([hi]);

    // Two RE288 observations: one at "0-0|000|0" and one at "0-1|000|0"
    expect(result.obsRe288).toBe(2);
    expect(result.re288Map.get("0-0|000|0")?.n).toBe(1);
    expect(result.re288Map.get("0-1|000|0")?.n).toBe(1);
  });

  it("falls back to countBeforeTerminalPitch when no snapshots", () => {
    const play = makePlay({
      outsBefore: 0,
      outsAfter: 1,
      runsScored: 0,
      baseStateBefore: { first: false, second: false, third: false },
      countSnapshots: [],
      countBeforeTerminalPitch: { balls: 0, strikes: 2, label: "0-2" },
    });
    const hi = makeHalfInning([play]);
    const result = aggregateHalfInnings([hi]);

    expect(result.obsRe288).toBe(1);
    expect(result.re288Map.get("0-2|000|0")?.n).toBe(1);
  });

  it("counts out-occurrence correctly in RE24", () => {
    // Play where outs increased: outsAfter > outsBefore
    const playOut = makePlay({ outsBefore: 0, outsAfter: 1, runsScored: 0 });
    // Play where outs did NOT increase (e.g., walk, base hit with no out)
    const playNoOut = makePlay({ outsBefore: 0, outsAfter: 0, runsScored: 1,
      baseStateBefore: { first: true, second: false, third: false } });
    const hi = makeHalfInning([playNoOut, playOut]);
    const result = aggregateHalfInnings([hi]);

    const noOutAcc = result.re24Map.get("100-0");
    expect(noOutAcc?.sumOutOccurred).toBe(0);

    const outAcc = result.re24Map.get("000-0");
    expect(outAcc?.sumOutOccurred).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// buildRe24Cells — null threshold
// ---------------------------------------------------------------------------

describe("buildRe24Cells", () => {
  it("always returns exactly 24 cells", () => {
    const cells = buildRe24Cells(new Map());
    expect(cells).toHaveLength(ALL_BASE_STATES.length * ALL_OUTS.length); // 8 × 3 = 24
  });

  it("returns null meanRe when n < minObs", () => {
    // Put n=4 observations into "000-0"
    const map = new Map([
      ["000-0", { n: 4, sumRe: 8, sumOutOccurred: 2 }],
    ]);
    const cells = buildRe24Cells(map, 5);
    const cell = cells.find((c) => c.baseState === "000" && c.outs === 0);
    expect(cell?.meanRe).toBeNull();
    expect(cell?.n).toBe(4);
  });

  it("computes meanRe when n >= minObs", () => {
    // 5 plays, each with runsToEnd = 2, so meanRe should be 2.0
    const map = new Map([
      ["000-0", { n: 5, sumRe: 10, sumOutOccurred: 3 }],
    ]);
    const cells = buildRe24Cells(map, 5);
    const cell = cells.find((c) => c.baseState === "000" && c.outs === 0);
    expect(cell?.meanRe).toBeCloseTo(2.0);
    expect(cell?.n).toBe(5);
  });

  it("returns null for cells with n=0 (no observations)", () => {
    const cells = buildRe24Cells(new Map(), 5);
    for (const cell of cells) {
      expect(cell.meanRe).toBeNull();
      expect(cell.n).toBe(0);
    }
  });

  it("covers all 8 base states and 3 out values", () => {
    const cells = buildRe24Cells(new Map());
    for (const bs of ALL_BASE_STATES) {
      for (const outs of ALL_OUTS) {
        const found = cells.find((c) => c.baseState === bs && c.outs === outs);
        expect(found).toBeDefined();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildRe288Cells — null threshold + structure
// ---------------------------------------------------------------------------

describe("buildRe288Cells", () => {
  it("always returns exactly 288 cells", () => {
    const cells = buildRe288Cells(new Map());
    expect(cells).toHaveLength(
      ALL_COUNTS.length * ALL_BASE_STATES.length * ALL_OUTS.length, // 12 × 8 × 3 = 288
    );
  });

  it("returns null meanRe and outProb when n < minObs", () => {
    const map = new Map([
      ["0-2|000|0", { n: 3, sumRe: 6, sumOutOccurred: 2 }],
    ]);
    const cells = buildRe288Cells(map, 5);
    const cell = cells.find(
      (c) => c.count === "0-2" && c.baseState === "000" && c.outs === 0,
    );
    expect(cell?.meanRe).toBeNull();
    expect(cell?.outProb).toBeNull();
  });

  it("computes meanRe and outProb when n >= minObs", () => {
    // 10 plays at (0-2, 000, 0): 7 resulted in outs, sumRe = 5
    const map = new Map([
      ["0-2|000|0", { n: 10, sumRe: 5, sumOutOccurred: 7 }],
    ]);
    const cells = buildRe288Cells(map, 5);
    const cell = cells.find(
      (c) => c.count === "0-2" && c.baseState === "000" && c.outs === 0,
    );
    expect(cell?.meanRe).toBeCloseTo(0.5);
    expect(cell?.outProb).toBeCloseTo(0.7);
  });

  it("covers all 12 counts, 8 base states, and 3 out values", () => {
    const cells = buildRe288Cells(new Map());
    for (const count of ALL_COUNTS) {
      for (const bs of ALL_BASE_STATES) {
        for (const outs of ALL_OUTS) {
          const found = cells.find(
            (c) => c.count === count && c.baseState === bs && c.outs === outs,
          );
          expect(found).toBeDefined();
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// buildOhTwoCountProgressionSummary
// ---------------------------------------------------------------------------

describe("buildOhTwoCountProgressionSummary", () => {
  it("weights 0-2 values across the actual base/out states in the corpus", () => {
    const plays = [
      makePlay({
        rawPlay: {
          inning: 1,
          halfInning: "top",
          playIndex: 0,
          playText: "Batter A struck out swinging",
          dedupKey: "1-top-0",
        },
        outsBefore: 0,
        outsAfter: 1,
        baseStateBefore: { first: false, second: false, third: false },
        countSnapshots: [
          {
            pitchNumber: 1,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 0, label: "0-0" },
            countAfter: { balls: 0, strikes: 1, label: "0-1" },
          },
          {
            pitchNumber: 2,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 1, label: "0-1" },
            countAfter: { balls: 0, strikes: 2, label: "0-2" },
          },
          {
            pitchNumber: 3,
            pitchCode: "K",
            countBefore: { balls: 0, strikes: 2, label: "0-2" },
            countAfter: { balls: 0, strikes: 2, label: "0-2" },
          },
        ],
      }),
      makePlay({
        rawPlay: {
          inning: 1,
          halfInning: "top",
          playIndex: 1,
          playText: "Batter B walked",
          dedupKey: "1-top-1",
        },
        outsBefore: 1,
        outsAfter: 1,
        baseStateBefore: { first: true, second: true, third: true },
        baseStateAfter: { first: true, second: true, third: true },
        countSnapshots: [
          {
            pitchNumber: 1,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 0, label: "0-0" },
            countAfter: { balls: 0, strikes: 1, label: "0-1" },
          },
          {
            pitchNumber: 2,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 1, label: "0-1" },
            countAfter: { balls: 0, strikes: 2, label: "0-2" },
          },
          {
            pitchNumber: 3,
            pitchCode: "B",
            countBefore: { balls: 0, strikes: 2, label: "0-2" },
            countAfter: { balls: 1, strikes: 2, label: "1-2" },
          },
        ],
      }),
      makePlay({
        rawPlay: {
          inning: 1,
          halfInning: "top",
          playIndex: 2,
          playText: "Batter C lined into double play",
          dedupKey: "1-top-2",
        },
        outsBefore: 2,
        outsAfter: 3,
        baseStateBefore: { first: true, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        countSnapshots: [
          {
            pitchNumber: 1,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 0, label: "0-0" },
            countAfter: { balls: 0, strikes: 1, label: "0-1" },
          },
          {
            pitchNumber: 2,
            pitchCode: "S",
            countBefore: { balls: 0, strikes: 1, label: "0-1" },
            countAfter: { balls: 0, strikes: 2, label: "0-2" },
          },
          {
            pitchNumber: 3,
            pitchCode: "X",
            countBefore: { balls: 0, strikes: 2, label: "0-2" },
            countAfter: { balls: 0, strikes: 2, label: "0-2" },
          },
        ],
      }),
    ];

    const halfInning = makeHalfInning(plays);
    const re24Map = new Map([
      ["000-1", { n: 10, sumRe: 2, sumOutOccurred: 5 }],
      ["111-2", { n: 10, sumRe: 11, sumOutOccurred: 3 }],
    ]);
    const re288Map = new Map([
      ["0-2|000|0", { n: 10, sumRe: 4, sumOutOccurred: 6 }],
      ["0-2|111|1", { n: 10, sumRe: 16, sumOutOccurred: 8 }],
      ["0-2|100|2", { n: 10, sumRe: 2, sumOutOccurred: 4 }],
      ["1-2|000|0", { n: 10, sumRe: 6, sumOutOccurred: 5 }],
      ["1-2|111|1", { n: 10, sumRe: 14, sumOutOccurred: 7 }],
      ["1-2|100|2", { n: 10, sumRe: 3, sumOutOccurred: 2 }],
    ]);

    const summary = buildOhTwoCountProgressionSummary(
      [halfInning],
      re24Map,
      re288Map,
    );

    expect(summary).not.toBeNull();
    expect(summary?.totalObserved).toBe(3);
    expect(summary?.baselineRe).toBeCloseTo((0.4 + 1.6 + 0.2) / 3);
    expect(summary?.baselineOutProb).toBeCloseTo((0.6 + 0.8 + 0.4) / 3);
    expect(summary?.stateMix.map((state) => `${state.baseState}/${state.outs}`)).toEqual([
      "000/0",
      "111/1",
      "100/2",
    ]);

    const strikeout = summary?.branches.find((branch) => branch.branch === "strikeout");
    const ball = summary?.branches.find((branch) => branch.branch === "ball");
    const inPlay = summary?.branches.find((branch) => branch.branch === "inPlay");

    expect(strikeout?.n).toBe(1);
    expect(strikeout?.preRe).toBeCloseTo(0.4);
    expect(strikeout?.postRe).toBeCloseTo(0.2);
    expect(strikeout?.deltaRangeMin).toBeCloseTo(-0.2);
    expect(strikeout?.deltaRangeMax).toBeCloseTo(-0.2);

    expect(ball?.preRe).toBeCloseTo(1.6);
    expect(ball?.postRe).toBeCloseTo(1.4);
    expect(ball?.postOutProb).toBeCloseTo(0.7);
    expect(ball?.n).toBe(1);
    expect(ball?.deltaRangeMin).toBeCloseTo(-0.2);
    expect(ball?.deltaRangeMax).toBeCloseTo(-0.2);
    expect(inPlay?.preRe).toBeCloseTo(0.2);
    expect(inPlay?.postRe).toBe(0);
    expect(inPlay?.n).toBe(1);
    expect(inPlay?.deltaRangeMin).toBeCloseTo(-0.2);
    expect(inPlay?.deltaRangeMax).toBeCloseTo(-0.2);

    expect(summary?.counterfactual.totalBalls).toBe(1);
    expect(summary?.counterfactual.valuePerConversion).toBeCloseTo(1.4 - 1.1);
  });

  it("treats last-recorded 0-2 foul strings with no terminal pitch as implicit contact", () => {
    const play = makePlay({
      rawPlay: {
        inning: 1,
        halfInning: "top",
        playIndex: 0,
        playText: "Batter A singled to left field (0-2 KFF).",
        dedupKey: "1-top-0",
      },
      outsBefore: 1,
      outsAfter: 1,
      baseStateBefore: { first: true, second: true, third: false },
      baseStateAfter: { first: true, second: false, third: true },
      terminalPitchRecorded: false,
      countBeforeTerminalPitch: { balls: 0, strikes: 2, label: "0-2" },
      countSnapshots: [
        {
          pitchNumber: 1,
          pitchCode: "K",
          countBefore: { balls: 0, strikes: 0, label: "0-0" },
          countAfter: { balls: 0, strikes: 1, label: "0-1" },
        },
        {
          pitchNumber: 2,
          pitchCode: "F",
          countBefore: { balls: 0, strikes: 1, label: "0-1" },
          countAfter: { balls: 0, strikes: 2, label: "0-2" },
        },
        {
          pitchNumber: 3,
          pitchCode: "F",
          countBefore: { balls: 0, strikes: 2, label: "0-2" },
          countAfter: { balls: 0, strikes: 2, label: "0-2" },
        },
      ],
    });

    const halfInning = makeHalfInning([play]);
    const re24Map = new Map([["101-1", { n: 10, sumRe: 5, sumOutOccurred: 2 }]]);
    const re288Map = new Map([["0-2|110|1", { n: 10, sumRe: 9, sumOutOccurred: 4 }]]);

    const summary = buildOhTwoCountProgressionSummary(
      [halfInning],
      re24Map,
      re288Map,
    );

    const inPlay = summary?.branches.find((branch) => branch.branch === "inPlay");
    expect(inPlay?.n).toBe(1);
    expect(inPlay?.preRe).toBeCloseTo(0.9);
    expect(inPlay?.postRe).toBeCloseTo(0.5);
  });
});

describe("buildOhTwoBallStateMix / evaluateOhTwoBallStateMix", () => {
  it("summarizes Babson 0-2 ball states and can revalue them against another matrix", () => {
    const halfInning = makeHalfInning([
      makePlay({
        baseStateBefore: { first: false, second: false, third: false },
        countSnapshots: [
          {
            pitchNumber: 1,
            pitchCode: "B",
            countBefore: { balls: 0, strikes: 2, label: "0-2" },
            countAfter: { balls: 1, strikes: 2, label: "1-2" },
          },
        ],
      }),
      makePlay({
        baseStateBefore: { first: true, second: false, third: false },
        outsBefore: 1,
        outsAfter: 1,
        countSnapshots: [
          {
            pitchNumber: 1,
            pitchCode: "B",
            countBefore: { balls: 0, strikes: 2, label: "0-2" },
            countAfter: { balls: 1, strikes: 2, label: "1-2" },
          },
        ],
      }),
    ]);

    const stateMix = buildOhTwoBallStateMix([halfInning]);
    expect(stateMix).toEqual([
      { baseState: "000", outs: 0, n: 1, share: 0.5 },
      { baseState: "100", outs: 1, n: 1, share: 0.5 },
    ]);

    const re24Map = new Map();
    const re288Map = new Map([
      ["0-2|000|0", { n: 10, sumRe: 2, sumOutOccurred: 8 }],
      ["1-2|000|0", { n: 10, sumRe: 3, sumOutOccurred: 7 }],
      ["0-2|100|1", { n: 10, sumRe: 4, sumOutOccurred: 6 }],
      ["1-2|100|1", { n: 10, sumRe: 5, sumOutOccurred: 5 }],
    ]);

    const summary = evaluateOhTwoBallStateMix(stateMix, re24Map, re288Map);
    expect(summary.totalObserved).toBe(2);
    expect(summary.preRe).toBeCloseTo(0.3);
    expect(summary.postRe).toBeCloseTo(0.4);
    expect(summary.reDelta).toBeCloseTo(0.1);
  });
});

// ---------------------------------------------------------------------------
// Hand-verified cell value
// ---------------------------------------------------------------------------

describe("hand-verified RE24 cell: bases empty, 0 outs", () => {
  it("produces correct meanRe from known synthetic inputs", () => {
    // Synthetic half-inning: 5 plays all at bases empty / 0 outs, each scoring
    // a fixed number of runs. We verify the mean directly.
    // Plays: runsScored = [3, 1, 0, 2, 0]
    // runsToEnd indices:     [6, 3, 2, 2, 0]  ← cumulative from right
    // Expected meanRe = (6 + 3 + 2 + 2 + 0) / 5 = 13 / 5 = 2.6
    const runsScored = [3, 1, 0, 2, 0];
    const plays = runsScored.map((r, idx) =>
      makePlay({
        outsBefore: 0,
        outsAfter: 0,
        runsScored: r,
        baseStateBefore: { first: false, second: false, third: false },
        countBeforeTerminalPitch: { balls: 0, strikes: 0, label: "0-0" },
        countSnapshots: [],
        // Give each play a unique dedup key
        rawPlay: {
          inning: 1,
          halfInning: "top",
          playIndex: idx,
          playText: `play ${idx}`,
          dedupKey: `1-top-${idx}`,
        },
      }),
    );
    const hi = makeHalfInning(plays, 6);
    const agg = aggregateHalfInnings([hi]);
    const cells = buildRe24Cells(agg.re24Map, 5);
    const cell = cells.find((c) => c.baseState === "000" && c.outs === 0);

    expect(cell?.n).toBe(5);
    expect(cell?.meanRe).toBeCloseTo(2.6);
  });
});
