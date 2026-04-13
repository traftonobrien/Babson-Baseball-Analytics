import { describe, expect, it } from "vitest";
import {
  BABSON_BASEBALL_PROGRAM,
  NEWMAC_BASEBALL_PROGRAMS,
  buildScheduleUrl,
  extractBoxScoreUrlsFromScheduleHtml,
  extractScheduleGamesFromHtml,
} from "./scraper.ts";

describe("RE288 scraper migration", () => {
  it("loads the nine NEWMAC baseball programs from local config", () => {
    expect(NEWMAC_BASEBALL_PROGRAMS).toHaveLength(9);
    expect(BABSON_BASEBALL_PROGRAM.id).toBe("babson");
  });

  it("builds a season-specific schedule URL", () => {
    expect(buildScheduleUrl(BABSON_BASEBALL_PROGRAM, 2026)).toBe(
      "https://babsonathletics.com/sports/baseball/schedule/2026",
    );
  });

  it("extracts box score URLs from mixed schedule markup", () => {
    const html = `
      <a href="/sports/baseball/stats/2026/team-a/boxscore/111">Box</a>
      <a href="https://clarkathletics.com/sports/baseball/stats/2026/team-b/boxscore/222">Box</a>
      <div data-url="/sports/baseball/stats/2026/team-a/boxscore/111"></div>
    `;

    expect(extractBoxScoreUrlsFromScheduleHtml(html, "https://clarkathletics.com")).toEqual([
      "https://clarkathletics.com/sports/baseball/stats/2026/team-a/boxscore/111",
      "https://clarkathletics.com/sports/baseball/stats/2026/team-b/boxscore/222",
    ]);
  });

  it("canonicalizes mirrored NEWMAC schedule entries to the same dedupe key", () => {
    const wpi = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "wpi");
    const emerson = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "emerson");

    expect(wpi).toBeDefined();
    expect(emerson).toBeDefined();

    const wpiHtml = `
      <a href="/sports/baseball/stats/2026/emerson/boxscore/16689"
         aria-label="Box score of Baseball vs Emerson on April 4, 2026 at Noon">Box Score</a>
    `;
    const emersonHtml = `
      <a href="/sports/baseball/stats/2026/worcester-polytechnic-institute/boxscore/4265"
         aria-label="Box score of Baseball at Worcester Polytechnic Institute on April 4, 2026 at Noon">Box Score</a>
    `;

    const wpiGame = extractScheduleGamesFromHtml(wpiHtml, wpi!)[0];
    const emersonGame = extractScheduleGamesFromHtml(emersonHtml, emerson!)[0];

    expect(wpiGame?.dedupKey).toBe(emersonGame?.dedupKey);
    expect(wpiGame?.gameNumber).toBe(1);
    expect(wpiGame?.homeTeam).toBe("Worcester Polytechnic Institute");
    expect(emersonGame?.awayTeam).toBe("Emerson College");
  });

  it("normalizes cosmetic time and ranking differences before dedupe", () => {
    const babson = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "babson");
    const salve = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "salve-regina");

    expect(babson).toBeDefined();
    expect(salve).toBeDefined();

    const babsonHtml = `
      <a href="/sports/baseball/stats/2026/-4-4-salve-regina/boxscore/16024"
         aria-label="Box score of Baseball at #4/4 Salve Regina on April 7, 2026 at 3:00 PM">Box Score</a>
    `;
    const salveHtml = `
      <a href="/sports/baseball/stats/2026/babson-college/boxscore/11725"
         aria-label="Box score of Baseball vs Babson College on April 7, 2026 at 3:00 pm ET">Box Score</a>
    `;

    const babsonGame = extractScheduleGamesFromHtml(babsonHtml, babson!)[0];
    const salveGame = extractScheduleGamesFromHtml(salveHtml, salve!)[0];

    expect(babsonGame?.dedupKey).toBe(salveGame?.dedupKey);
    expect(babsonGame?.timeLabel).toBe("03:00 PM");
    expect(salveGame?.timeLabel).toBe("03:00 PM");
    expect(babsonGame?.homeTeam).toBe("Salve Regina University");
  });

  it("assigns stable game ordinals for doubleheaders even when mirrored times differ", () => {
    const babson = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "babson");
    const coastGuard = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "coast-guard");

    expect(babson).toBeDefined();
    expect(coastGuard).toBeDefined();

    const babsonHtml = `
      <a href="/sports/baseball/stats/2026/coast-guard/boxscore/16017"
         aria-label="Box score of Baseball at Coast Guard on March 29, 2026 at 12:00 pm">Game 1</a>
      <a href="/sports/baseball/stats/2026/coast-guard/boxscore/16018"
         aria-label="Box score of Baseball at Coast Guard on March 29, 2026 at 3:00 pm">Game 2</a>
    `;
    const coastGuardHtml = `
      <a href="/sports/baseball/stats/2026/babson/boxscore/9286"
         aria-label="Box score of Baseball vs Babson College on March 29, 2026 at Noon ET">Game 1</a>
      <a href="/sports/baseball/stats/2026/babson/boxscore/9480"
         aria-label="Box score of Baseball vs Babson College on March 29, 2026 at 3:30 PM ET">Game 2</a>
    `;

    const babsonGames = extractScheduleGamesFromHtml(babsonHtml, babson!);
    const coastGuardGames = extractScheduleGamesFromHtml(coastGuardHtml, coastGuard!);

    expect(babsonGames.map((game) => game.dedupKey)).toEqual([
      "2026-03-29|united states coast guard academy|babson college|g1",
      "2026-03-29|united states coast guard academy|babson college|g2",
    ]);
    expect(coastGuardGames.map((game) => game.dedupKey)).toEqual([
      "2026-03-29|united states coast guard academy|babson college|g1",
      "2026-03-29|united states coast guard academy|babson college|g2",
    ]);
  });

  it("maps known conference alias variants back to canonical school names", () => {
    const wpi = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "wpi");

    expect(wpi).toBeDefined();

    const html = `
      <a href="/sports/baseball/stats/2026/wheaton-ma-/boxscore/16693"
         aria-label="Box score of Baseball at Wheaton (MA) on April 11, 2026 at Noon">Game 1</a>
      <a href="/sports/baseball/stats/2026/wheaton-ma-/boxscore/16694"
         aria-label="Box score of Baseball at Wheaton (MA) on April 11, 2026 at 3:00 PM">Game 2</a>
    `;

    const games = extractScheduleGamesFromHtml(html, wpi!);

    expect(games.map((game) => game.homeTeam)).toEqual([
      "Wheaton College (Mass.)",
      "Wheaton College (Mass.)",
    ]);
    expect(games.map((game) => game.dedupKey)).toEqual([
      "2026-04-11|wheaton college mass|worcester polytechnic institute|g1",
      "2026-04-11|wheaton college mass|worcester polytechnic institute|g2",
    ]);
  });
});
