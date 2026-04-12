import { describe, it, expect } from "vitest";
import {
  extractHalfInningPas,
  buildGameBaseStatesIndex,
  buildPaLookupMap,
  makePaLookupKey,
} from "./gameBaseStates";
import type {
  ParsedPbpHalfInning,
  ParsedPbpPlay,
  SeasonRunExpectancyCorpus,
  SeasonRunExpectancyGameResult,
  ParsedPbpGame,
} from "./types";

// ---------------------------------------------------------------------------
// Test fixtures
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
    count: "0-2",
    pitchSequence: "KK",
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
  inning = 1,
  half: "top" | "bottom" = "top",
): ParsedPbpHalfInning {
  return {
    rawHalfInning: {
      key: `${half}-${inning}`,
      caption: `Babson - ${half === "top" ? "Top" : "Bottom"} of ${inning}`,
      inning,
      halfInning: half,
      offenseTeam: "Babson",
      playLines: [],
      plays: [],
      totals: { runs: 0, hits: null, errors: null, leftOnBase: null },
    },
    plays,
    parsedRuns: plays.reduce((s, p) => s + p.runsScored, 0),
    validation: { passed: true, expectedRuns: 0, parsedRuns: 0, reason: null },
    usableForMatrix: true,
  };
}

function makeCorpus(
  games: Array<{
    gameId: string;
    date: string;
    opponent: string;
    usableHalfInnings: ParsedPbpHalfInning[];
  }>,
): SeasonRunExpectancyCorpus {
  const results: SeasonRunExpectancyGameResult[] = games.map((g) => {
    const parsedGame: ParsedPbpGame = {
      rawGame: { gameId: g.gameId, sourceUrl: null, halfInnings: [] },
      metadata: {
        gameId: g.gameId,
        date: g.date,
        opponent: g.opponent,
        homeAway: "home",
        suffix: null,
        url: `https://example.com/boxscore/${g.gameId}`,
      },
      halfInnings: g.usableHalfInnings,
      usableHalfInnings: g.usableHalfInnings,
      failedHalfInnings: [],
    };
    return {
      gameId: g.gameId,
      sourceUrl: `https://example.com/boxscore/${g.gameId}`,
      metadata: parsedGame.metadata,
      parsedGame,
      passed: true,
      usableHalfInnings: g.usableHalfInnings.length,
      failedHalfInnings: 0,
      usableRatio: 1,
      failureReasons: [],
    };
  });

  return {
    games: results,
    totalGames: games.length,
    passingGames: games.length,
    failedGames: 0,
    totalUsableHalfInnings: games.reduce(
      (s, g) => s + g.usableHalfInnings.length,
      0,
    ),
    totalFailedHalfInnings: 0,
    failureReasons: {},
  };
}

// ---------------------------------------------------------------------------
// extractHalfInningPas
// ---------------------------------------------------------------------------

describe("extractHalfInningPas", () => {
  it("returns one record per non-ignored play", () => {
    const plays = [
      makePlay({ outsBefore: 0, outsAfter: 1, runsScored: 0 }),
      makePlay({ outsBefore: 1, outsAfter: 2, runsScored: 0 }),
      makePlay({ ignored: true }),
    ];
    const hi = makeHalfInning(plays, 1, "top");
    const records = extractHalfInningPas(
      hi,
      "12345",
      "2026-02-14",
      "Bentley",
      "home",
      null,
    );
    expect(records).toHaveLength(2);
  });

  it("sets paIndex as sequential 0-based index among non-ignored plays", () => {
    const plays = [
      makePlay({ outsBefore: 0 }),
      makePlay({ ignored: true }),
      makePlay({ outsBefore: 1 }),
    ];
    const hi = makeHalfInning(plays, 1, "top");
    const records = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(records[0].paIndex).toBe(0);
    expect(records[1].paIndex).toBe(1); // ignored play doesn't count
  });

  it("encodes baseStateBefore correctly", () => {
    const play = makePlay({
      baseStateBefore: { first: true, second: false, third: false },
      outsBefore: 0,
      outsAfter: 1,
    });
    const hi = makeHalfInning([play], 1, "top");
    const [record] = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(record.baseStateBefore).toBe("100");
  });

  it("encodes baseStateAfter correctly (bases loaded)", () => {
    const play = makePlay({
      baseStateAfter: { first: true, second: true, third: true },
      outsAfter: 0,
      outsBefore: 0,
    });
    const hi = makeHalfInning([play], 1, "top");
    const [record] = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(record.baseStateAfter).toBe("111");
  });

  it("preserves inning and halfInning from the half-inning metadata", () => {
    const play = makePlay();
    const hi = makeHalfInning([play], 5, "bottom");
    const [record] = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(record.inning).toBe(5);
    expect(record.halfInning).toBe("bottom");
  });

  it("carries count and pitchSequence from the play", () => {
    const play = makePlay({ count: "1-2 BKFS", pitchSequence: "BKS" });
    const hi = makeHalfInning([play]);
    const [record] = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(record.count).toBe("1-2 BKFS");
    expect(record.pitchSequence).toBe("BKS");
  });

  it("returns empty array for a half-inning with all ignored plays", () => {
    const plays = [makePlay({ ignored: true }), makePlay({ ignored: true })];
    const hi = makeHalfInning(plays);
    const records = extractHalfInningPas(hi, "1", "2026-02-14", "Opp", "home", null);
    expect(records).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildGameBaseStatesIndex
// ---------------------------------------------------------------------------

describe("buildGameBaseStatesIndex", () => {
  it("returns empty pas array for corpus with no parsedGame", () => {
    const corpus: SeasonRunExpectancyCorpus = {
      games: [
        {
          gameId: "1",
          sourceUrl: "url",
          metadata: null,
          parsedGame: null,
          passed: false,
          usableHalfInnings: 0,
          failedHalfInnings: 0,
          usableRatio: 0,
          failureReasons: [],
        },
      ],
      totalGames: 1,
      passingGames: 0,
      failedGames: 1,
      totalUsableHalfInnings: 0,
      totalFailedHalfInnings: 0,
      failureReasons: {},
    };
    const index = buildGameBaseStatesIndex(corpus, 2026);
    expect(index.totalPas).toBe(0);
    expect(index.totalGames).toBe(0);
  });

  it("aggregates PAs across multiple games and half-innings", () => {
    const play1 = makePlay({ outsBefore: 0, outsAfter: 1 });
    const play2 = makePlay({ outsBefore: 1, outsAfter: 2 });
    const play3 = makePlay({ outsBefore: 0, outsAfter: 0, runsScored: 1 });

    const corpus = makeCorpus([
      {
        gameId: "g1",
        date: "2026-02-14",
        opponent: "Bentley",
        usableHalfInnings: [
          makeHalfInning([play1, play2], 1, "top"),
        ],
      },
      {
        gameId: "g2",
        date: "2026-02-21",
        opponent: "MIT",
        usableHalfInnings: [
          makeHalfInning([play3], 1, "bottom"),
        ],
      },
    ]);

    const index = buildGameBaseStatesIndex(corpus, 2026);
    expect(index.totalGames).toBe(2);
    expect(index.totalPas).toBe(3);
    expect(index.season).toBe(2026);
    expect(typeof index.generatedAt).toBe("string");
  });

  it("includes game identification fields on each PA record", () => {
    const corpus = makeCorpus([
      {
        gameId: "g1",
        date: "2026-03-14",
        opponent: "Tufts",
        usableHalfInnings: [makeHalfInning([makePlay()])],
      },
    ]);
    const index = buildGameBaseStatesIndex(corpus, 2026);
    const pa = index.pas[0];
    expect(pa.gameId).toBe("g1");
    expect(pa.date).toBe("2026-03-14");
    expect(pa.opponent).toBe("Tufts");
    expect(pa.homeAway).toBe("home");
    expect(pa.suffix).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildPaLookupMap + makePaLookupKey
// ---------------------------------------------------------------------------

describe("buildPaLookupMap", () => {
  it("builds a map with one entry per PA", () => {
    const corpus = makeCorpus([
      {
        gameId: "g1",
        date: "2026-02-14",
        opponent: "Bentley",
        usableHalfInnings: [
          makeHalfInning(
            [makePlay({ outsBefore: 0 }), makePlay({ outsBefore: 1 })],
            1,
            "top",
          ),
        ],
      },
    ]);
    const index = buildGameBaseStatesIndex(corpus, 2026);
    const map = buildPaLookupMap(index);
    expect(map.size).toBe(2);
  });

  it("retrieves a PA by its lookup key", () => {
    const corpus = makeCorpus([
      {
        gameId: "g1",
        date: "2026-02-14",
        opponent: "Bentley",
        usableHalfInnings: [
          makeHalfInning([makePlay({ outsBefore: 2, outsAfter: 2, runsScored: 1 })], 3, "bottom"),
        ],
      },
    ]);
    const index = buildGameBaseStatesIndex(corpus, 2026);
    const map = buildPaLookupMap(index);
    const key = makePaLookupKey("g1", 3, "bottom", 0);
    const pa = map.get(key);
    expect(pa).toBeDefined();
    expect(pa?.outsBefore).toBe(2);
    expect(pa?.runsScored).toBe(1);
  });

  it("returns undefined for an unknown key", () => {
    const index = buildGameBaseStatesIndex(
      makeCorpus([
        {
          gameId: "g1",
          date: "2026-02-14",
          opponent: "Bentley",
          usableHalfInnings: [],
        },
      ]),
      2026,
    );
    const map = buildPaLookupMap(index);
    expect(map.get("unknown-key")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// makePaLookupKey
// ---------------------------------------------------------------------------

describe("makePaLookupKey", () => {
  it("produces a deterministic string key", () => {
    expect(makePaLookupKey("g1", 1, "top", 0)).toBe("g1|1|top|0");
    expect(makePaLookupKey("game-abc", 9, "bottom", 12)).toBe(
      "game-abc|9|bottom|12",
    );
  });
});
