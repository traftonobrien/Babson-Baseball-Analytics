import { describe, expect, it } from "vitest";
import {
  buildCanonicalGameId,
  buildCanonicalGameIndexFromScheduleGames,
} from "./gameIndex.ts";
import type { SidearmScheduleGame } from "./scraper.ts";

function makeScheduleGame(overrides: Partial<SidearmScheduleGame> = {}): SidearmScheduleGame {
  return {
    programId: "wpi",
    programSchool: "Worcester Polytechnic Institute",
    url: "https://athletics.wpi.edu/sports/baseball/stats/2026/emerson/boxscore/16689",
    opponent: "Emerson College",
    date: "2026-04-04",
    timeLabel: "12:00 PM",
    homeTeam: "Worcester Polytechnic Institute",
    awayTeam: "Emerson College",
    gameNumber: 1,
    dedupKey: "2026-04-04|worcester polytechnic institute|emerson college|g1",
    ...overrides,
  };
}

describe("buildCanonicalGameId", () => {
  it("creates a stable slugged identifier from normalized schedule metadata", () => {
    expect(buildCanonicalGameId(makeScheduleGame())).toBe(
      "2026-04-04__emerson-college__at__worcester-polytechnic-institute__g1",
    );
  });

  it("falls back to dedup key when metadata is incomplete", () => {
    expect(buildCanonicalGameId({
      dedupKey: "url:https://example.com/boxscore/123",
      date: null,
      homeTeam: null,
      awayTeam: null,
      gameNumber: null,
    })).toBe("fallback__url-https-example-com-boxscore-123");
  });
});

describe("buildCanonicalGameIndexFromScheduleGames", () => {
  it("groups mirrored host pages into one canonical entry with multiple sources", () => {
    const entries = buildCanonicalGameIndexFromScheduleGames([
      makeScheduleGame(),
      makeScheduleGame({
        programId: "emerson",
        programSchool: "Emerson College",
        url: "https://emersonlions.com/sports/baseball/stats/2026/worcester-polytechnic-institute/boxscore/4265",
      }),
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.sourceCount).toBe(2);
    expect(entries[0]?.sourceProgramIds).toEqual(["emerson", "wpi"]);
    expect(entries[0]?.sources.map((source) => source.programId)).toEqual(["emerson", "wpi"]);
  });

  it("keeps distinct games separate when the time slot differs", () => {
    const entries = buildCanonicalGameIndexFromScheduleGames([
      makeScheduleGame({ timeLabel: "12:00 PM", gameNumber: 1, dedupKey: "2026-04-04|worcester polytechnic institute|emerson college|g1" }),
      makeScheduleGame({
        url: "https://athletics.wpi.edu/sports/baseball/stats/2026/emerson/boxscore/16690",
        timeLabel: "03:00 PM",
        gameNumber: 2,
        dedupKey: "2026-04-04|worcester polytechnic institute|emerson college|g2",
      }),
    ]);

    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.gameNumber)).toEqual([1, 2]);
  });
});
