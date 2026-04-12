import { describe, expect, it } from "vitest";
import {
  BABSON_BASEBALL_PROGRAM,
  NEWMAC_BASEBALL_PROGRAMS,
  buildScheduleUrl,
  extractBoxScoreUrlsFromScheduleHtml,
  extractScheduleGamesFromHtml,
} from "./scraper";

describe("NEWMAC baseball registry", () => {
  it("includes the nine current NEWMAC baseball programs", () => {
    expect(NEWMAC_BASEBALL_PROGRAMS).toHaveLength(9);
    expect(NEWMAC_BASEBALL_PROGRAMS.map((program) => program.id)).toEqual([
      "babson",
      "clark",
      "coast-guard",
      "emerson",
      "mit",
      "salve-regina",
      "springfield",
      "wheaton",
      "wpi",
    ]);
  });

  it("keeps Babson available as the default legacy program", () => {
    expect(BABSON_BASEBALL_PROGRAM.id).toBe("babson");
    expect(BABSON_BASEBALL_PROGRAM.baseUrl).toBe("https://babsonathletics.com");
  });
});

describe("buildScheduleUrl", () => {
  it("builds a season-specific schedule URL from the program template", () => {
    const wpi = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "wpi");
    const salve = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "salve-regina");

    expect(wpi).toBeDefined();
    expect(salve).toBeDefined();
    expect(buildScheduleUrl(wpi!, 2026)).toBe(
      "https://athletics.wpi.edu/sports/baseball/schedule/2026",
    );
    expect(buildScheduleUrl(salve!, 2026)).toBe(
      "https://salveathletics.com/sports/baseball/schedule/2026",
    );
  });
});

describe("extractBoxScoreUrlsFromScheduleHtml", () => {
  it("collects relative, absolute, and href box score URLs without duplicates", () => {
    const html = `
      <a href="/sports/baseball/stats/2026/team-a/boxscore/111">Box</a>
      <a href="https://clarkathletics.com/sports/baseball/stats/2026/team-b/boxscore/222">Box</a>
      <div data-url="/sports/baseball/stats/2026/team-a/boxscore/111"></div>
      <a href="/sports/baseball/stats/2026/team-c/boxscore/333?view=full">Box</a>
    `;

    expect(extractBoxScoreUrlsFromScheduleHtml(html, "https://clarkathletics.com")).toEqual([
      "https://clarkathletics.com/sports/baseball/stats/2026/team-a/boxscore/111",
      "https://clarkathletics.com/sports/baseball/stats/2026/team-b/boxscore/222",
      "https://clarkathletics.com/sports/baseball/stats/2026/team-c/boxscore/333",
    ]);
  });
});

describe("extractScheduleGamesFromHtml", () => {
  it("parses Sidearm aria labels into canonical home/away schedule entries", () => {
    const wpi = NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "wpi");
    expect(wpi).toBeDefined();

    const html = `
      <a href="/sports/baseball/stats/2026/emerson/boxscore/16689"
         aria-label="Box score of Baseball vs Emerson on April 4, 2026 at Noon">Box Score</a>
    `;

    expect(extractScheduleGamesFromHtml(html, wpi!)).toEqual([
      {
        programId: "wpi",
        programSchool: "Worcester Polytechnic Institute",
        url: "https://athletics.wpi.edu/sports/baseball/stats/2026/emerson/boxscore/16689",
        opponent: "Emerson College",
        date: "2026-04-04",
        timeLabel: "Noon",
        homeTeam: "Worcester Polytechnic Institute",
        awayTeam: "Emerson College",
        dedupKey:
          "2026-04-04|worcester polytechnic institute|emerson college|noon",
      },
    ]);
  });

  it("canonicalizes mirrored conference games to the same dedupe identity", () => {
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

    expect(wpiGame?.homeTeam).toBe("Worcester Polytechnic Institute");
    expect(wpiGame?.awayTeam).toBe("Emerson College");
    expect(emersonGame?.homeTeam).toBe("Worcester Polytechnic Institute");
    expect(emersonGame?.awayTeam).toBe("Emerson College");
    expect(wpiGame?.dedupKey).toBe(emersonGame?.dedupKey);
  });
});
