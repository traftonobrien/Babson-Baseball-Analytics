import { describe, expect, it } from "vitest";
import { buildPooledCanonicalGameIndex, buildPooledPbpCorpus } from "./pool.ts";
import type { CanonicalGameIndex } from "./gameIndex.ts";
import type { PbpCorpusFile } from "./pbpFetch.ts";

describe("buildPooledCanonicalGameIndex", () => {
  it("merges conference indexes and deduplicates by canonical game id", () => {
    const pooled = buildPooledCanonicalGameIndex("starter-pack", [
      {
        generatedAt: "2026-04-13T00:00:00.000Z",
        season: 2026,
        conferenceId: "a",
        conferenceName: "A",
        totalPrograms: 1,
        totalGames: 1,
        games: [{
          canonicalGameId: "g1",
          dedupKey: "g1",
          date: "2026-03-01",
          timeLabel: "12:00 PM",
          homeTeam: "Home",
          awayTeam: "Away",
          gameNumber: 1,
          sourceCount: 1,
          sourceProgramIds: ["a1"],
          sources: [{
            programId: "a1",
            programSchool: "A1",
            url: "https://a.example/1",
            opponent: "Away",
            date: "2026-03-01",
            timeLabel: "12:00 PM",
            homeTeam: "Home",
            awayTeam: "Away",
            gameNumber: 1,
            dedupKey: "g1",
          }],
        }],
      },
      {
        generatedAt: "2026-04-13T00:00:00.000Z",
        season: 2026,
        conferenceId: "b",
        conferenceName: "B",
        totalPrograms: 1,
        totalGames: 1,
        games: [{
          canonicalGameId: "g1",
          dedupKey: "g1",
          date: "2026-03-01",
          timeLabel: "12:00 PM",
          homeTeam: "Home",
          awayTeam: "Away",
          gameNumber: 1,
          sourceCount: 1,
          sourceProgramIds: ["b1"],
          sources: [{
            programId: "b1",
            programSchool: "B1",
            url: "https://b.example/1",
            opponent: "Away",
            date: "2026-03-01",
            timeLabel: "12:00 PM",
            homeTeam: "Home",
            awayTeam: "Away",
            gameNumber: 1,
            dedupKey: "g1",
          }],
        }],
      },
    ] satisfies CanonicalGameIndex[]);

    expect(pooled.totalGames).toBe(1);
    expect(pooled.games[0]?.sources).toHaveLength(2);
    expect(pooled.games[0]?.sourceProgramIds).toEqual(["a1", "b1"]);
  });
});

describe("buildPooledPbpCorpus", () => {
  it("prefers parsed games when pooling corpora", () => {
    const pooled = buildPooledPbpCorpus("starter-pack", [
      {
        generatedAt: "2026-04-13T00:00:00.000Z",
        season: 2026,
        conferenceId: "a",
        conferenceName: "A",
        totalPrograms: 1,
        totalGames: 1,
        parsedGames: 0,
        failedGames: 1,
        totalHalfInnings: 0,
        failureReasons: { failed: 1 },
        games: [{
          canonicalGameId: "g1",
          dedupKey: "g1",
          date: "2026-03-01",
          timeLabel: "12:00 PM",
          homeTeam: "Home",
          awayTeam: "Away",
          gameNumber: 1,
          sourceCount: 1,
          sourceProgramIds: ["a1"],
          selectedSourceUrl: null,
          selectedSourceProgramId: null,
          selectedHtmlHash: null,
          status: "failed",
          failureReason: "failed",
          fetchAttempts: [],
          rawGame: null,
        }],
      },
      {
        generatedAt: "2026-04-13T00:00:00.000Z",
        season: 2026,
        conferenceId: "b",
        conferenceName: "B",
        totalPrograms: 1,
        totalGames: 1,
        parsedGames: 1,
        failedGames: 0,
        totalHalfInnings: 2,
        failureReasons: {},
        games: [{
          canonicalGameId: "g1",
          dedupKey: "g1",
          date: "2026-03-01",
          timeLabel: "12:00 PM",
          homeTeam: "Home",
          awayTeam: "Away",
          gameNumber: 1,
          sourceCount: 1,
          sourceProgramIds: ["b1"],
          selectedSourceUrl: "https://b.example/1",
          selectedSourceProgramId: "b1",
          selectedHtmlHash: "hash",
          status: "parsed",
          failureReason: null,
          fetchAttempts: [],
          rawGame: {
            gameId: "1",
            sourceUrl: "https://b.example/1",
            halfInnings: [
              {
                key: "1:top",
                caption: "Away - Top of 1st",
                inning: 1,
                halfInning: "top",
                offenseTeam: "Away",
                playLines: [],
                plays: [],
                totals: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 },
              },
              {
                key: "1:bottom",
                caption: "Home - Bottom of 1st",
                inning: 1,
                halfInning: "bottom",
                offenseTeam: "Home",
                playLines: [],
                plays: [],
                totals: { runs: 0, hits: 0, errors: 0, leftOnBase: 0 },
              },
            ],
          },
        }],
      },
    ] satisfies PbpCorpusFile[]);

    expect(pooled.totalGames).toBe(1);
    expect(pooled.parsedGames).toBe(1);
    expect(pooled.failedGames).toBe(0);
    expect(pooled.totalHalfInnings).toBe(2);
    expect(pooled.games[0]?.status).toBe("parsed");
  });
});
