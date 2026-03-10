import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import GameStatsSection from "./GameStatsSection";
import type { OutingMeta, PlayerGameStats } from "./index";

const meta: OutingMeta = {
  outingId: "CBurrows1/2025_03_26",
  linkedGames: [
    { gameId: "14570", season: 2025, opponent: "Suffolk", date: "2025-03-26" },
  ],
  updatedAt: "2025-03-26T00:00:00Z",
};

const stats: PlayerGameStats = {
  season: 2025,
  gameId: "14570",
  playerId: "CBurrows1",
  playerDisplay: "Chase Burrows",
  team: "babson",
  batting: null,
  pitching: {
    name: "Chase Burrows",
    ip: "5.0",
    h: 1,
    r: 0,
    er: 0,
    bb: 0,
    so: 2,
    hr: null,
    bf: 15,
    pitches: 45,
    strikes: 30,
    era: null,
  },
  source: { url: "https://example.com", importedAt: "2025-03-26T00:00:00Z" },
};

const statsByGame: Record<string, PlayerGameStats | null> = {
  "14570": stats,
};

describe("GameStatsSection", () => {
  it("renders when outing meta exists", () => {
    const html = renderToStaticMarkup(
      GameStatsSection({ meta, statsByGame }),
    );
    expect(html).toContain("Pitching Line");
    expect(html).toContain("Suffolk");
    expect(html).toContain("5.0"); // IP value rendered in pitching grid
    expect(html).toContain("IP");  // stat label
  });

  it("renders fallback when stats missing", () => {
    const html = renderToStaticMarkup(
      GameStatsSection({ meta, statsByGame: { "14570": null } }),
    );
    expect(html).toContain("Stats not found");
  });
});
