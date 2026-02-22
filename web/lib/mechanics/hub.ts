// Pure utility functions for the Mechanics Hub page.
// No imports from React — safe to test with vitest.

export interface HubSessionEntry {
  slug: string;
  date: string;
  label: string;
  efficiency_score: number;
  efficiency_low_confidence: boolean;
  hand: "R" | "L";
  view_mode: string;
  pass_count: number;
  fail_count: number;
  avg_confidence?: number;
  low_confidence_count?: number;
}

export interface HubPlayerEntry {
  slug: string;
  player_id: string;
  name: string;
  sessions: HubSessionEntry[];
}

export interface MechanicsIndex {
  players: HubPlayerEntry[];
}

export type SortKey = "date_desc" | "score_desc" | "conf_desc" | "name_asc";

/** Latest session by date (descending). Returns null if no sessions. */
export function getLatestSession(player: HubPlayerEntry): HubSessionEntry | null {
  if (!player.sessions.length) return null;
  return [...player.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Total session count across all players. */
export function getTotalSessions(players: HubPlayerEntry[]): number {
  return players.reduce((sum, p) => sum + p.sessions.length, 0);
}

/**
 * Filter players by search query and/or low-confidence toggle.
 * Low-confidence: latest session avg_confidence < 0.5 or efficiency_low_confidence.
 */
export function filterPlayers(
  players: HubPlayerEntry[],
  search: string,
  filterLowConf: boolean,
): HubPlayerEntry[] {
  let result = [...players];

  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }

  if (filterLowConf) {
    result = result.filter((p) => {
      const latest = getLatestSession(p);
      if (!latest) return false;
      return latest.efficiency_low_confidence || (latest.avg_confidence ?? 1) < 0.5;
    });
  }

  return result;
}

/** Sort players by the given key (operates on a copy). */
export function sortPlayers(players: HubPlayerEntry[], sortKey: SortKey): HubPlayerEntry[] {
  return [...players].sort((a, b) => {
    const la = getLatestSession(a);
    const lb = getLatestSession(b);
    if (!la) return 1;
    if (!lb) return -1;

    switch (sortKey) {
      case "date_desc":
        return lb.date.localeCompare(la.date);
      case "score_desc":
        return lb.efficiency_score - la.efficiency_score;
      case "conf_desc":
        return (lb.avg_confidence ?? 0) - (la.avg_confidence ?? 0);
      case "name_asc":
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });
}
