import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildPbpCorpusFromIndex,
  fetchCanonicalGamePbp,
} from "./pbpFetch.ts";
import type { CanonicalGameIndex, CanonicalGameIndexEntry } from "./gameIndex.ts";

const SAMPLE_PBP_HTML = `
  <section id="play-by-play">
    <table class="sidearm-table play-by-play">
      <caption>Babson College - Top of 1st</caption>
      <tbody>
        <tr><td>Christensen doubled down the lf line (1-2 BKF).</td></tr>
      </tbody>
    </table>
    <dl class="special-stats">
      <dt>Runs</dt><dd>0</dd>
      <dt>Hits</dt><dd>1</dd>
      <dt>Errors</dt><dd>0</dd>
      <dt>Left On Base</dt><dd>1</dd>
    </dl>
  <section id="composite-stats"></section>
`;

const BASE_GAME: CanonicalGameIndexEntry = {
  canonicalGameId: "2026-03-01__away__at__home__g1",
  dedupKey: "2026-03-01|home|away|g1",
  date: "2026-03-01",
  timeLabel: "12:00 PM",
  homeTeam: "Home College",
  awayTeam: "Away College",
  gameNumber: 1,
  sourceCount: 2,
  sourceProgramIds: ["away", "home"],
  sources: [
    {
      programId: "away",
      programSchool: "Away College",
      url: "https://example.com/bad/boxscore/1",
      opponent: "Home College",
      date: "2026-03-01",
      timeLabel: "12:00 PM",
      homeTeam: "Home College",
      awayTeam: "Away College",
      gameNumber: 1,
      dedupKey: "2026-03-01|home|away|g1",
    },
    {
      programId: "home",
      programSchool: "Home College",
      url: "https://example.com/good/boxscore/2",
      opponent: "Away College",
      date: "2026-03-01",
      timeLabel: "12:00 PM",
      homeTeam: "Home College",
      awayTeam: "Away College",
      gameNumber: 1,
      dedupKey: "2026-03-01|home|away|g1",
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fetchCanonicalGamePbp", () => {
  it("falls through failed sources and selects the first source with parsed PBP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("/bad/")) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(SAMPLE_PBP_HTML, { status: 200 });
      }),
    );

    const result = await fetchCanonicalGamePbp(BASE_GAME);

    expect(result.status).toBe("parsed");
    expect(result.selectedSourceProgramId).toBe("home");
    expect(result.fetchAttempts).toHaveLength(2);
    expect(result.fetchAttempts[0]?.ok).toBe(false);
    expect(result.fetchAttempts[1]?.selected).toBe(true);
    expect(result.rawGame?.halfInnings).toHaveLength(1);
  });
});

describe("buildPbpCorpusFromIndex", () => {
  it("aggregates parsed and failed game counts into a deterministic corpus summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("boxscore/1")) {
          return new Response(SAMPLE_PBP_HTML, { status: 200 });
        }

        return new Response("Missing", { status: 404 });
      }),
    );

    const index: CanonicalGameIndex = {
      generatedAt: "2026-04-13T00:00:00.000Z",
      season: 2026,
      conferenceId: "test",
      conferenceName: "Test Conference",
      totalPrograms: 2,
      totalGames: 2,
      games: [
        {
          ...BASE_GAME,
          sourceCount: 1,
          sourceProgramIds: ["away"],
          sources: [BASE_GAME.sources[0]!],
        },
        {
          ...BASE_GAME,
          canonicalGameId: "2026-03-02__away__at__home__g1",
          dedupKey: "2026-03-02|home|away|g1",
          sources: [
            {
              ...BASE_GAME.sources[1]!,
              url: "https://example.com/failed/boxscore/9",
              dedupKey: "2026-03-02|home|away|g1",
              date: "2026-03-02",
            },
          ],
          sourceCount: 1,
          sourceProgramIds: ["home"],
          date: "2026-03-02",
        },
      ],
    };

    const corpus = await buildPbpCorpusFromIndex(index);

    expect(corpus.parsedGames).toBe(1);
    expect(corpus.failedGames).toBe(1);
    expect(corpus.totalHalfInnings).toBe(1);
    expect(corpus.failureReasons["HTTP 404"]).toBe(1);
  });
});
