import { describe, it, expect } from "vitest";
import {
  isValidLineupSlot,
  nextSegmentOrder,
  CHARTING_COOKIE,
  LINEUP_SLOT_MIN,
  LINEUP_SLOT_MAX,
} from "./domain";
import {
  CANONICAL_BY_PLAYER_ID,
  HAND_BY_PLAYER_ID,
} from "@/lib/canonicalPlayersData";
import type { ChartingBootstrapPitcher, ChartingBootstrapResponse } from "./types";
import { fixtureGameSnapshot } from "./fixtures";

// ---------------------------------------------------------------------------
// Lineup slot validation (GAME-02)
// ---------------------------------------------------------------------------

describe("lineup slot validation", () => {
  it("accepts slots 1 through 9", () => {
    for (let i = LINEUP_SLOT_MIN; i <= LINEUP_SLOT_MAX; i++) {
      expect(isValidLineupSlot(i)).toBe(true);
    }
  });

  it("has minimum slot of 1", () => {
    expect(LINEUP_SLOT_MIN).toBe(1);
  });

  it("has maximum slot of 9", () => {
    expect(LINEUP_SLOT_MAX).toBe(9);
  });

  it("rejects slot 0", () => {
    expect(isValidLineupSlot(0)).toBe(false);
  });

  it("rejects slot 10", () => {
    expect(isValidLineupSlot(10)).toBe(false);
  });

  it("rejects non-integer slots", () => {
    expect(isValidLineupSlot(1.5)).toBe(false);
  });

  it("rejects negative slots", () => {
    expect(isValidLineupSlot(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Segment ordering (GAME-03)
// ---------------------------------------------------------------------------

describe("segment ordering", () => {
  it("returns 0 when there are no existing segments", () => {
    expect(nextSegmentOrder([])).toBe(0);
  });

  it("returns 1 after one segment with order 0", () => {
    expect(nextSegmentOrder([{ segmentOrder: 0 }])).toBe(1);
  });

  it("returns max+1 for non-sequential orders", () => {
    expect(
      nextSegmentOrder([
        { segmentOrder: 0 },
        { segmentOrder: 1 },
        { segmentOrder: 2 },
      ])
    ).toBe(3);
  });

  it("does not depend on array order", () => {
    expect(
      nextSegmentOrder([
        { segmentOrder: 2 },
        { segmentOrder: 0 },
        { segmentOrder: 1 },
      ])
    ).toBe(3);
  });

  it("fixture segments produce order 2 when both are present", () => {
    const { segments } = fixtureGameSnapshot;
    expect(nextSegmentOrder(segments)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Auth cookie constant (AUTH-01)
// ---------------------------------------------------------------------------

describe("charting cookie", () => {
  it("is named pt_charting", () => {
    expect(CHARTING_COOKIE).toBe("pt_charting");
  });
});

// ---------------------------------------------------------------------------
// Bootstrap pitcher roster shape (AUTH-02)
// ---------------------------------------------------------------------------

describe("bootstrap pitcher roster", () => {
  // Build the pitcher list the same way the bootstrap route does, so
  // we can verify the shape without hitting the DB.
  const pitchers: ChartingBootstrapPitcher[] = Object.entries(
    CANONICAL_BY_PLAYER_ID
  )
    .map(([playerId, name]) => ({
      playerId,
      name,
      throws: (HAND_BY_PLAYER_ID[playerId] ?? "R") as "R" | "L",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  it("has at least one pitcher", () => {
    expect(pitchers.length).toBeGreaterThan(0);
  });

  it("every pitcher has a non-empty playerId", () => {
    for (const p of pitchers) {
      expect(p.playerId).toBeTruthy();
    }
  });

  it("every pitcher has a non-empty name", () => {
    for (const p of pitchers) {
      expect(p.name).toBeTruthy();
    }
  });

  it("every pitcher throws R or L", () => {
    for (const p of pitchers) {
      expect(["R", "L"]).toContain(p.throws);
    }
  });

  it("is sorted alphabetically by name", () => {
    for (let i = 1; i < pitchers.length; i++) {
      expect(
        pitchers[i - 1].name.localeCompare(pitchers[i].name)
      ).toBeLessThanOrEqual(0);
    }
  });

  it("contains known pitchers from the fixture", () => {
    const { segments } = fixtureGameSnapshot;
    const ids = new Set(pitchers.map((p) => p.playerId));
    for (const seg of segments) {
      expect(ids.has(seg.playerId)).toBe(true);
    }
  });

  it("bootstrap response shape has pitchers and recentGames fields", () => {
    // Type-check the shape without a DB call
    const mockResponse: ChartingBootstrapResponse = {
      pitchers,
      recentGames: [],
    };
    expect(Array.isArray(mockResponse.pitchers)).toBe(true);
    expect(Array.isArray(mockResponse.recentGames)).toBe(true);
  });
});
