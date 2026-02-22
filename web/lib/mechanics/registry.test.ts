import { describe, it, expect } from "vitest";
import {
  getMechanicsForPlayer,
  getLatestMechanicsSession,
  getNeedsAttentionCount,
} from "./registry";
import type { MechanicsIndex } from "./hub";
import type { HubPlayerEntry, HubSessionEntry } from "./hub";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeSession(overrides: Partial<HubSessionEntry> = {}): HubSessionEntry {
  return {
    slug: "session_a",
    date: "2026-01-15",
    label: "Jan 15",
    efficiency_score: 6.0,
    efficiency_low_confidence: false,
    hand: "R",
    view_mode: "open_side",
    pass_count: 4,
    fail_count: 2,
    avg_confidence: 0.65,
    low_confidence_count: 2,
    ...overrides,
  };
}

function makePlayer(overrides: Partial<HubPlayerEntry> = {}): HubPlayerEntry {
  return {
    slug: "john_doe",
    player_id: "JDoe1",
    name: "John Doe",
    sessions: [makeSession()],
    ...overrides,
  };
}

function makeIndex(players: HubPlayerEntry[]): MechanicsIndex {
  return { players };
}

// ---------------------------------------------------------------------------
// getMechanicsForPlayer — tier 1: explicit profile_slug match
// ---------------------------------------------------------------------------
describe("getMechanicsForPlayer — profile_slug match", () => {
  it("matches on profile_slug when present", () => {
    const player = makePlayer({ profile_slug: "doe_john" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { profileSlug: "doe_john" });
    expect(result?.slug).toBe("john_doe");
  });

  it("does not match a different profile_slug", () => {
    const player = makePlayer({ profile_slug: "doe_john" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { profileSlug: "smith_jane" });
    expect(result).toBeNull();
  });

  it("prefers profile_slug over slug fallback", () => {
    const playerA = makePlayer({ slug: "target_slug", profile_slug: "profile_a" });
    const playerB = makePlayer({ slug: "profile_a", profile_slug: "profile_b" });
    const index = makeIndex([playerA, playerB]);
    // profileSlug "profile_a" should hit playerA.profile_slug first
    const result = getMechanicsForPlayer(index, { profileSlug: "profile_a" });
    expect(result?.slug).toBe("target_slug");
  });
});

// ---------------------------------------------------------------------------
// getMechanicsForPlayer — tier 2: direct slug fallback
// ---------------------------------------------------------------------------
describe("getMechanicsForPlayer — slug fallback", () => {
  it("matches when mechanics slug equals profileSlug (no profile_slug set)", () => {
    const player = makePlayer({ slug: "jane_smith" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { profileSlug: "jane_smith" });
    expect(result?.slug).toBe("jane_smith");
  });

  it("returns null when slug does not match and no profile_slug", () => {
    const player = makePlayer({ slug: "jane_smith" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { profileSlug: "smith_jane" });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getMechanicsForPlayer — tier 3: normalized name fallback
// ---------------------------------------------------------------------------
describe("getMechanicsForPlayer — name normalization fallback", () => {
  it("matches name regardless of apostrophes", () => {
    // Mechanics index has "Trafton O'Brien", player registry has "Trafton OBrien"
    const player = makePlayer({ name: "Trafton O'Brien" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { playerName: "Trafton OBrien" });
    expect(result?.slug).toBe("john_doe");
  });

  it("matches name case-insensitively", () => {
    const player = makePlayer({ name: "Jane Smith" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { playerName: "jane smith" });
    expect(result?.slug).toBe("john_doe");
  });

  it("returns null when no name match", () => {
    const player = makePlayer({ name: "John Doe" });
    const index = makeIndex([player]);
    const result = getMechanicsForPlayer(index, { playerName: "Jane Smith" });
    expect(result).toBeNull();
  });

  it("returns null for empty index", () => {
    const result = getMechanicsForPlayer({ players: [] }, { playerName: "John Doe" });
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getLatestMechanicsSession
// ---------------------------------------------------------------------------
describe("getLatestMechanicsSession", () => {
  it("returns null for empty sessions", () => {
    const player = makePlayer({ sessions: [] });
    expect(getLatestMechanicsSession(player)).toBeNull();
  });

  it("returns the only session", () => {
    const player = makePlayer();
    expect(getLatestMechanicsSession(player)?.slug).toBe("session_a");
  });

  it("returns the most recent by date", () => {
    const player = makePlayer({
      sessions: [
        makeSession({ slug: "old", date: "2025-10-01" }),
        makeSession({ slug: "new", date: "2026-02-15" }),
        makeSession({ slug: "mid", date: "2026-01-01" }),
      ],
    });
    expect(getLatestMechanicsSession(player)?.slug).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// getNeedsAttentionCount
// ---------------------------------------------------------------------------
describe("getNeedsAttentionCount", () => {
  it("returns 0 for empty list", () => {
    expect(getNeedsAttentionCount([])).toBe(0);
  });

  it("flags player with efficiency_score < 5", () => {
    const p = makePlayer({ sessions: [makeSession({ efficiency_score: 4.9 })] });
    expect(getNeedsAttentionCount([p])).toBe(1);
  });

  it("flags player with fail_count >= 2", () => {
    const p = makePlayer({ sessions: [makeSession({ efficiency_score: 7.0, fail_count: 2 })] });
    expect(getNeedsAttentionCount([p])).toBe(1);
  });

  it("flags player with >50% low-confidence metrics", () => {
    // pass_count=2, fail_count=2, low_confidence_count=3 => 3/4 = 75% > 50%
    const p = makePlayer({
      sessions: [
        makeSession({ efficiency_score: 7.0, fail_count: 1, pass_count: 2, low_confidence_count: 3 }),
      ],
    });
    expect(getNeedsAttentionCount([p])).toBe(1);
  });

  it("does not flag high-quality player", () => {
    const p = makePlayer({
      sessions: [
        makeSession({ efficiency_score: 8.0, fail_count: 0, pass_count: 6, low_confidence_count: 1 }),
      ],
    });
    expect(getNeedsAttentionCount([p])).toBe(0);
  });

  it("counts multiple flagged players", () => {
    const p1 = makePlayer({ slug: "p1", sessions: [makeSession({ efficiency_score: 3.0 })] });
    const p2 = makePlayer({ slug: "p2", sessions: [makeSession({ efficiency_score: 8.0, fail_count: 0, low_confidence_count: 0 })] });
    const p3 = makePlayer({ slug: "p3", sessions: [makeSession({ efficiency_score: 4.5 })] });
    expect(getNeedsAttentionCount([p1, p2, p3])).toBe(2);
  });

  it("uses latest session, not first", () => {
    const p = makePlayer({
      sessions: [
        makeSession({ slug: "old", date: "2025-01-01", efficiency_score: 3.0 }),
        makeSession({ slug: "new", date: "2026-01-01", efficiency_score: 8.0, fail_count: 0, low_confidence_count: 0 }),
      ],
    });
    // latest is "new" with good scores — should NOT be flagged
    expect(getNeedsAttentionCount([p])).toBe(0);
  });
});
