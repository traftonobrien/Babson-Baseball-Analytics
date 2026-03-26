import { describe, expect, it } from "vitest";
import type { StuffPlusOuting } from "@/lib/stuffPlusJson";
import { buildOneOffStuffFallbackRows } from "./plusLeaderboardStuffFallback";

const JASON_OUTINGS: StuffPlusOuting[] = [
  {
    playerSlug: "finkelstein_jason",
    playerName: "Jason Finkelstein",
    throws: "R",
    date: "2025_09_20",
    pitchType: "Fastball",
    stuffPlus: 111.1,
    avgVeloMph: 89.1,
    avgIvbIn: 12.2,
    avgHbIn: 15.3,
    avgSpinRpm: 2299,
    avgExtFt: 5.6,
    maxFbVelo: 91.4,
  },
  {
    playerSlug: "finkelstein_jason",
    playerName: "Jason Finkelstein",
    throws: "R",
    date: "2025_10_03",
    pitchType: "Fastball",
    stuffPlus: 118.2,
    avgVeloMph: 90,
    avgIvbIn: 12.5,
    avgHbIn: 16.6,
    avgSpinRpm: 2304,
    avgExtFt: 5.7,
    maxFbVelo: 92,
  },
  {
    playerSlug: "finkelstein_jason",
    playerName: "Jason Finkelstein",
    throws: "R",
    date: "2025_10_03",
    pitchType: "Slider",
    stuffPlus: 115.5,
    avgVeloMph: 83.8,
    avgIvbIn: 0.7,
    avgHbIn: -8.8,
    avgSpinRpm: 2540,
    avgExtFt: 5.3,
    maxFbVelo: 92,
  },
];

describe("buildOneOffStuffFallbackRows", () => {
  it("uses Jason Finkelstein's latest available TrackMan stuff rows on the 2026 board", () => {
    const rows = buildOneOffStuffFallbackRows({
      seasons: [2026],
      existingRows: [],
      outings: JASON_OUTINGS,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.pitchType).sort()).toEqual(["Fastball", "Slider"]);
    expect(rows.every((row) => row.playerId === "JFinkelstein1")).toBe(true);
    expect(rows.every((row) => row.playerName === "Jason Finkelstein")).toBe(true);
    expect(rows.every((row) => row.throws === "R")).toBe(true);
    expect(rows.every((row) => row.season === 2026)).toBe(true);
    expect(rows.every((row) => row.dateId === "2025_10_03")).toBe(true);
  });

  it("does not inject fallback rows once Jason already has 2026 Stuff+ rows", () => {
    const rows = buildOneOffStuffFallbackRows({
      seasons: [2026],
      existingRows: [
        {
          playerId: "JFinkelstein1",
          playerName: "Jason Finkelstein",
          throws: "R",
          dateId: "2026_03_12",
          season: 2026,
          pitchType: "Fastball",
          stuffPlus: 121.4,
        },
      ],
      outings: JASON_OUTINGS,
    });

    expect(rows).toEqual([]);
  });

  it("does nothing when the 2026 board is not being built", () => {
    const rows = buildOneOffStuffFallbackRows({
      seasons: [2025],
      existingRows: [],
      outings: JASON_OUTINGS,
    });

    expect(rows).toEqual([]);
  });
});
