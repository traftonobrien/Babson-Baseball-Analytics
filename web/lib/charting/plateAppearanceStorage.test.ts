import { describe, expect, it } from "vitest";

import { loadPlateAppearancesWithFallback } from "./plateAppearanceStorage";

describe("loadPlateAppearancesWithFallback", () => {
  it("preserves current-schema result codes and hands when current rows load", async () => {
    const rows = await loadPlateAppearancesWithFallback({
      loadCurrentRows: async () => [
        {
          id: "pa-1",
          teamId: "babson",
          gameId: "game-1",
          segmentId: "seg-1",
          paOrder: 1,
          inning: 1,
          isTopInning: false,
          teamSide: "our",
          hitterName: "Dylan Drazka",
          hitterHand: "R",
          lineupSlot: 3,
          resultCode: "1B",
          initialCount: "0-0",
          buntContext: false,
          runnerOnFirst: null,
          runnerOnSecond: null,
          runnerOnThird: null,
        },
      ],
      loadLegacyRows: async () => [],
    });

    expect(rows[0]).toMatchObject({
      teamSide: "our",
      hitterHand: "R",
      lineupSlot: 3,
      resultCode: "1B",
      isTopInning: false,
    });
  });

  it("falls back to legacy rows when current-schema columns are unavailable", async () => {
    const rows = await loadPlateAppearancesWithFallback({
      loadCurrentRows: async () => {
        throw new Error(
          'Failed query: select "result_code" from "charting_plate_appearances"',
        );
      },
      loadLegacyRows: async () => [
        {
          id: "pa-legacy",
          gameId: "game-1",
          segmentId: "seg-1",
          paOrder: 1,
          inning: 1,
          hitterName: "Legacy Hitter",
        },
      ],
    });

    expect(rows[0]).toMatchObject({
      id: "pa-legacy",
      hitterName: "Legacy Hitter",
      resultCode: null,
      lineupSlot: 1,
      teamSide: "opponent",
    });
  });
});
