import { describe, it, expect } from "vitest";
import {
  getLatestSession,
  getTotalSessions,
  filterPlayers,
  sortPlayers,
  type HubPlayerEntry,
  type HubSessionEntry,
} from "./hub";

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
    slug: "test_player",
    player_id: "TPlayer1",
    name: "Test Player",
    sessions: [makeSession()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getLatestSession
// ---------------------------------------------------------------------------
describe("getLatestSession", () => {
  it("returns null for empty sessions", () => {
    const player = makePlayer({ sessions: [] });
    expect(getLatestSession(player)).toBeNull();
  });

  it("returns the only session when one exists", () => {
    const player = makePlayer();
    expect(getLatestSession(player)?.slug).toBe("session_a");
  });

  it("returns the most recent session by date", () => {
    const player = makePlayer({
      sessions: [
        makeSession({ slug: "old", date: "2025-10-01" }),
        makeSession({ slug: "new", date: "2026-02-15" }),
        makeSession({ slug: "mid", date: "2026-01-01" }),
      ],
    });
    expect(getLatestSession(player)?.slug).toBe("new");
  });
});

// ---------------------------------------------------------------------------
// getTotalSessions
// ---------------------------------------------------------------------------
describe("getTotalSessions", () => {
  it("sums sessions across players", () => {
    const players = [
      makePlayer({ sessions: [makeSession(), makeSession({ slug: "s2" })] }),
      makePlayer({ slug: "p2", sessions: [makeSession()] }),
    ];
    expect(getTotalSessions(players)).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(getTotalSessions([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// filterPlayers — search
// ---------------------------------------------------------------------------
describe("filterPlayers — search", () => {
  const players = [
    makePlayer({ slug: "john_doe", name: "John Doe" }),
    makePlayer({ slug: "jane_smith", name: "Jane Smith" }),
  ];

  it("returns all players when search is empty", () => {
    expect(filterPlayers(players, "", false)).toHaveLength(2);
  });

  it("filters by name case-insensitively", () => {
    const result = filterPlayers(players, "john", false);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("john_doe");
  });

  it("filters by slug", () => {
    const result = filterPlayers(players, "smith", false);
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("jane_smith");
  });

  it("returns empty when no match", () => {
    expect(filterPlayers(players, "zzz", false)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// filterPlayers — low confidence toggle
// ---------------------------------------------------------------------------
describe("filterPlayers — low confidence", () => {
  const players = [
    makePlayer({
      slug: "high_conf",
      sessions: [makeSession({ avg_confidence: 0.75, efficiency_low_confidence: false })],
    }),
    makePlayer({
      slug: "low_conf_avg",
      sessions: [makeSession({ avg_confidence: 0.4, efficiency_low_confidence: false })],
    }),
    makePlayer({
      slug: "low_conf_flag",
      sessions: [makeSession({ avg_confidence: 0.65, efficiency_low_confidence: true })],
    }),
  ];

  it("returns all when filter is off", () => {
    expect(filterPlayers(players, "", false)).toHaveLength(3);
  });

  it("keeps players with avg_confidence < 0.5", () => {
    const result = filterPlayers(players, "", true);
    const slugs = result.map((p) => p.slug);
    expect(slugs).toContain("low_conf_avg");
  });

  it("keeps players with efficiency_low_confidence flag", () => {
    const result = filterPlayers(players, "", true);
    const slugs = result.map((p) => p.slug);
    expect(slugs).toContain("low_conf_flag");
  });

  it("excludes high-confidence players", () => {
    const result = filterPlayers(players, "", true);
    const slugs = result.map((p) => p.slug);
    expect(slugs).not.toContain("high_conf");
  });
});

// ---------------------------------------------------------------------------
// sortPlayers
// ---------------------------------------------------------------------------
describe("sortPlayers", () => {
  const p1 = makePlayer({
    slug: "alpha",
    name: "Alpha",
    sessions: [makeSession({ date: "2026-02-01", efficiency_score: 7.5, avg_confidence: 0.8 })],
  });
  const p2 = makePlayer({
    slug: "beta",
    name: "Beta",
    sessions: [makeSession({ date: "2026-01-01", efficiency_score: 5.0, avg_confidence: 0.5 })],
  });
  const p3 = makePlayer({
    slug: "gamma",
    name: "Gamma",
    sessions: [makeSession({ date: "2026-03-01", efficiency_score: 6.0, avg_confidence: 0.65 })],
  });

  it("sorts by latest date descending (default)", () => {
    const sorted = sortPlayers([p1, p2, p3], "date_desc");
    expect(sorted.map((p) => p.slug)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("sorts by efficiency score descending", () => {
    const sorted = sortPlayers([p1, p2, p3], "score_desc");
    expect(sorted.map((p) => p.slug)).toEqual(["alpha", "gamma", "beta"]);
  });

  it("sorts by avg confidence descending", () => {
    const sorted = sortPlayers([p1, p2, p3], "conf_desc");
    expect(sorted.map((p) => p.slug)).toEqual(["alpha", "gamma", "beta"]);
  });

  it("sorts by name A→Z", () => {
    const sorted = sortPlayers([p3, p1, p2], "name_asc");
    expect(sorted.map((p) => p.slug)).toEqual(["alpha", "beta", "gamma"]);
  });

  it("does not mutate the input array", () => {
    const input = [p3, p1, p2];
    sortPlayers(input, "name_asc");
    expect(input.map((p) => p.slug)).toEqual(["gamma", "alpha", "beta"]);
  });

  it("pushes players with no sessions to the end", () => {
    const noSessions = makePlayer({ slug: "empty", sessions: [] });
    const sorted = sortPlayers([noSessions, p1], "score_desc");
    expect(sorted[sorted.length - 1].slug).toBe("empty");
  });
});
