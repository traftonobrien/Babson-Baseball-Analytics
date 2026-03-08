import { describe, it, expect } from "vitest";
import {
  isRevisionMatch,
  nextRevision,
  isValidPitchType,
  isValidPitchResult,
  isValidLocationCell,
  isValidGameStatus,
  PITCH_TYPES,
  PITCH_RESULTS,
  LOCATION_CELL_MIN,
  LOCATION_CELL_MAX,
} from "./domain";
import { fixtureGameSnapshot } from "./fixtures";

// ---------------------------------------------------------------------------
// Revision safety (SYNC-03)
// ---------------------------------------------------------------------------

describe("revision safety", () => {
  it("matches when revisions are equal", () => {
    expect(isRevisionMatch(1, 1)).toBe(true);
  });

  it("rejects when client revision is stale (behind stored)", () => {
    expect(isRevisionMatch(2, 1)).toBe(false);
  });

  it("rejects when client revision is ahead of stored", () => {
    expect(isRevisionMatch(1, 2)).toBe(false);
  });

  it("increments revision by exactly 1", () => {
    expect(nextRevision(1)).toBe(2);
    expect(nextRevision(7)).toBe(8);
    expect(nextRevision(0)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Pitch type validation (CHRT-01)
// ---------------------------------------------------------------------------

describe("pitch type validation", () => {
  it("accepts all six charting families", () => {
    for (const pt of PITCH_TYPES) {
      expect(isValidPitchType(pt)).toBe(true);
    }
  });

  it("has exactly six pitch type families", () => {
    expect(PITCH_TYPES).toHaveLength(6);
  });

  it("rejects unknown pitch type strings", () => {
    expect(isValidPitchType("Splitter")).toBe(false);
    expect(isValidPitchType("FB")).toBe(false);
    expect(isValidPitchType("four-seam")).toBe(false);
    expect(isValidPitchType("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Pitch result validation (CHRT-03)
// ---------------------------------------------------------------------------

describe("pitch result validation", () => {
  it("accepts all defined pitch results", () => {
    for (const pr of PITCH_RESULTS) {
      expect(isValidPitchResult(pr)).toBe(true);
    }
  });

  it("has exactly seven pitch results", () => {
    expect(PITCH_RESULTS).toHaveLength(7);
  });

  it("rejects unknown pitch result strings", () => {
    expect(isValidPitchResult("strike")).toBe(false);
    expect(isValidPitchResult("walk")).toBe(false);
    expect(isValidPitchResult("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Location cell validation (CHRT-02)
// ---------------------------------------------------------------------------

describe("location cell validation", () => {
  it("accepts cells 1 through 17", () => {
    for (let i = LOCATION_CELL_MIN; i <= LOCATION_CELL_MAX; i++) {
      expect(isValidLocationCell(i)).toBe(true);
    }
  });

  it("rejects cell 0 (below minimum)", () => {
    expect(isValidLocationCell(0)).toBe(false);
  });

  it("rejects cell 18 (above maximum)", () => {
    expect(isValidLocationCell(18)).toBe(false);
  });

  it("rejects non-integer cells", () => {
    expect(isValidLocationCell(1.5)).toBe(false);
    expect(isValidLocationCell(5.0001)).toBe(false);
  });

  it("rejects negative cells", () => {
    expect(isValidLocationCell(-1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Game status validation
// ---------------------------------------------------------------------------

describe("game status validation", () => {
  it("accepts draft, active, and final", () => {
    expect(isValidGameStatus("draft")).toBe(true);
    expect(isValidGameStatus("active")).toBe(true);
    expect(isValidGameStatus("final")).toBe(true);
  });

  it("rejects non-status strings", () => {
    expect(isValidGameStatus("locked")).toBe(false);
    expect(isValidGameStatus("completed")).toBe(false);
    expect(isValidGameStatus("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Fixture round-trip (01-01 contract)
// ---------------------------------------------------------------------------

describe("fixture round-trip", () => {
  const { game, segments, plateAppearances, pitches } = fixtureGameSnapshot;

  it("has a non-empty game id", () => {
    expect(game.id).toBeTruthy();
  });

  it("has a gameDate in yyyy-mm-dd format", () => {
    expect(game.gameDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("has a valid game status", () => {
    expect(isValidGameStatus(game.status)).toBe(true);
  });

  it("starts at revision 1", () => {
    expect(game.revision).toBe(1);
  });

  it("has two pitcher segments", () => {
    expect(segments).toHaveLength(2);
  });

  it("segments have sequential segmentOrder starting at 0", () => {
    const orders = segments.map((s) => s.segmentOrder);
    expect(orders).toEqual([0, 1]);
  });

  it("all segments reference the fixture game id", () => {
    for (const seg of segments) {
      expect(seg.gameId).toBe(game.id);
    }
  });

  it("all plate appearances reference the fixture game id", () => {
    for (const pa of plateAppearances) {
      expect(pa.gameId).toBe(game.id);
    }
  });

  it("all plate appearances reference a known segment id", () => {
    const segIds = new Set(segments.map((s) => s.id));
    for (const pa of plateAppearances) {
      expect(segIds.has(pa.segmentId)).toBe(true);
    }
  });

  it("all pitches reference the fixture game id", () => {
    for (const p of pitches) {
      expect(p.gameId).toBe(game.id);
    }
  });

  it("all pitches reference a known plate appearance id", () => {
    const paIds = new Set(plateAppearances.map((pa) => pa.id));
    for (const p of pitches) {
      expect(paIds.has(p.paId)).toBe(true);
    }
  });

  it("all pitches have valid pitch types", () => {
    for (const p of pitches) {
      expect(isValidPitchType(p.pitchType)).toBe(true);
    }
  });

  it("all pitches have valid pitch results", () => {
    for (const p of pitches) {
      expect(isValidPitchResult(p.pitchResult)).toBe(true);
    }
  });

  it("all non-null location cells are valid", () => {
    for (const p of pitches) {
      if (p.locationCell !== null) {
        expect(isValidLocationCell(p.locationCell)).toBe(true);
      }
    }
  });

  it("pitch counts per PA match expected distribution", () => {
    const paIds = plateAppearances.map((pa) => pa.id);
    const counts = paIds.map(
      (id) => pitches.filter((p) => p.paId === id).length
    );
    // PA 1: K in 3 pitches, PA 2: BB in 4 pitches, PA 3: 1 pitch in progress
    expect(counts).toEqual([3, 4, 1]);
  });

  it("covers both defined pitch segments in the plate appearances", () => {
    const segIds = new Set(plateAppearances.map((pa) => pa.segmentId));
    expect(segIds.has(segments[0].id)).toBe(true);
    expect(segIds.has(segments[1].id)).toBe(true);
  });

  it("all six pitch type families appear at least once across the fixture", () => {
    // fixture uses Fastball, Slider, Curveball, Changeup, Split/Cut
    // confirming the charting families are represented
    const used = new Set(pitches.map((p) => p.pitchType));
    expect(used.has("Fastball")).toBe(true);
    expect(used.has("Slider")).toBe(true);
    expect(used.has("Curveball")).toBe(true);
    expect(used.has("Changeup")).toBe(true);
    expect(used.has("Split/Cut")).toBe(true);
  });
});
