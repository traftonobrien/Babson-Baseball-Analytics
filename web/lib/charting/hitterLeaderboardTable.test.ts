import { describe, expect, it } from "vitest";
import {
  getVisibleColumns,
  sortHitterLeaderboardRows,
  type HitterLeaderboardRow,
} from "@/app/charting/leaderboard/HitterLeaderboardTable";

function makeHitterRow(
  hitterName: string,
  overrides: Partial<HitterLeaderboardRow> = {}
): HitterLeaderboardRow {
  return {
    hitterName,
    opsPlus: null,
    sessions: 3,
    totalPitches: 42,
    totalPAs: 12,
    avg: 0.3,
    obp: 0.38,
    slg: 0.52,
    ops: 0.9,
    woba: 0.39,
    chasePct: 24,
    contactPct: 78,
    whiffPct: 22,
    kPct: 18,
    bbPct: 9,
    zoneWfPct: 14,
    zoneSwingPct: 66,
    babip: 0.31,
    iso: 0.22,
    zoneFrequency: {},
    vsFastball: {
      pitches: 12,
      swings: 8,
      whiffs: 2,
      whiffPct: 25,
    },
    vsBreaking: {
      pitches: 10,
      swings: 6,
      whiffs: 2,
      whiffPct: 33.3,
    },
    vsOffspeed: {
      pitches: 8,
      swings: 5,
      whiffs: 1,
      whiffPct: 20,
    },
    ...overrides,
  };
}

describe("sortHitterLeaderboardRows", () => {
  it("sorts OPS+ descending with null rows pushed to the bottom", () => {
    const rows = [
      makeHitterRow("Average", { opsPlus: 101 }),
      makeHitterRow("Missing", { opsPlus: null }),
      makeHitterRow("Impact", { opsPlus: 117 }),
    ];

    const sorted = sortHitterLeaderboardRows(rows, "opsPlus", true);

    expect(sorted.map((row) => row.hitterName)).toEqual([
      "Impact",
      "Average",
      "Missing",
    ]);
  });

  it("sorts OPS+ ascending with null rows still pushed to the bottom", () => {
    const rows = [
      makeHitterRow("Above", { opsPlus: 109 }),
      makeHitterRow("Missing", { opsPlus: null }),
      makeHitterRow("Below", { opsPlus: 93 }),
    ];

    const sorted = sortHitterLeaderboardRows(rows, "opsPlus", false);

    expect(sorted.map((row) => row.hitterName)).toEqual([
      "Below",
      "Above",
      "Missing",
    ]);
  });
});

describe("getVisibleColumns", () => {
  it("places OPS+ before AVG in the basic hitter view", () => {
    expect(getVisibleColumns("basic").map((column) => column.key)).toEqual([
      "sessions",
      "totalPAs",
      "opsPlus",
      "avg",
      "obp",
      "slg",
      "ops",
      "woba",
      "kPct",
      "bbPct",
    ]);
  });

  it("keeps Chase% and Contact% on the advanced hitter view", () => {
    expect(getVisibleColumns("advanced").map((column) => column.key)).toEqual([
      "sessions",
      "totalPAs",
      "chasePct",
      "contactPct",
      "fbWhiff",
      "brkWhiff",
      "offWhiff",
      "zoneSwingPct",
      "zoneWfPct",
      "babip",
      "iso",
    ]);
  });
});
