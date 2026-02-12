/**
 * Leaderboard data loader.
 *
 * Fetches CSV data for all outings with:
 *   - Concurrency-limited fetching (max 6 parallel)
 *   - In-memory cache by outingId
 *   - Progressive callback for streaming results to UI
 *   - Arsenals-based handedness with "R" fallback + warning
 */

import Papa from "papaparse";
import type { Pitch } from "@/app/types";
import { players } from "@/lib/dataIndex";
import { getPlayerMeta } from "@/lib/arsenals";
import { seasonFromDateId } from "@/lib/season";
import { computeOutingKpis } from "./metrics";
import type { OutingLeaderboardRow, SeasonFilter } from "./types";

/* ------------------------------------------------------------------ */
/*  CSV parser (reuses pattern from useAllPitchData)                   */
/* ------------------------------------------------------------------ */

const NUM_FIELDS = new Set([
  "pitch_number", "target_frame", "arrival_frame",
  "target_x", "target_y", "ball_x", "ball_y",
  "total_miss_px", "total_miss_inches",
  "h_miss_px", "h_miss_inches", "h_miss_signed",
  "v_miss_px", "v_miss_inches", "v_miss_signed",
  "timestamp",
]);

function parseCsvText(text: string): Pitch[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  return result.data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = NUM_FIELDS.has(k) ? parseFloat(v) : v;
    }
    return out as unknown as Pitch;
  });
}

/* ------------------------------------------------------------------ */
/*  In-memory cache                                                    */
/* ------------------------------------------------------------------ */

interface CachedOuting {
  pitches: Pitch[];
  pitcherHand: "R" | "L";
  handUnknown: boolean;
}

const outingCache = new Map<string, CachedOuting>();

/* ------------------------------------------------------------------ */
/*  Concurrency limiter                                                */
/* ------------------------------------------------------------------ */

const MAX_CONCURRENT = 6;

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/* ------------------------------------------------------------------ */
/*  Single outing loader                                               */
/* ------------------------------------------------------------------ */

async function loadSingleOuting(
  outingId: string,
  csvPath: string,
  playerId: string,
): Promise<CachedOuting> {
  const cached = outingCache.get(outingId);
  if (cached) return cached;

  const [res, meta] = await Promise.all([
    fetch(csvPath),
    getPlayerMeta(playerId),
  ]);

  if (!res.ok) {
    throw new Error(`CSV fetch failed: ${res.status} (${csvPath})`);
  }

  const text = await res.text();
  const pitches = parseCsvText(text);

  let pitcherHand: "R" | "L" = "R";
  let handUnknown = false;

  if (meta.pitcherHand === "L" || meta.pitcherHand === "R") {
    pitcherHand = meta.pitcherHand;
  } else {
    handUnknown = true;
    console.warn(
      `[Leaderboards] No pitcher hand in Arsenals for ${playerId}. Falling back to "R".`,
    );
  }

  const entry: CachedOuting = { pitches, pitcherHand, handUnknown };
  outingCache.set(outingId, entry);
  return entry;
}

/* ------------------------------------------------------------------ */
/*  Season filter helpers                                              */
/* ------------------------------------------------------------------ */

function matchesSeason(
  season: number | null,
  filter: SeasonFilter,
): boolean {
  if (filter === "both") return season === 2025 || season === 2026;
  return season === filter;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface LoadOptions {
  seasonFilter: SeasonFilter;
  minPitches?: number;
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Load all outing leaderboard rows. Fetches CSVs with concurrency limit,
 * caches results, and calls onProgress as each outing completes.
 */
export async function loadAllLeaderboardData(
  opts: LoadOptions,
): Promise<OutingLeaderboardRow[]> {
  const { seasonFilter, minPitches = 5, onProgress } = opts;

  // Collect all outings across all players
  interface OutingTask {
    playerId: string;
    playerName: string;
    outing: { id: string; label: string; csvPath: string };
    dateId: string;
    season: number | null;
  }

  const tasks: OutingTask[] = [];
  for (const player of players) {
    for (const outing of player.outings) {
      const dateId = outing.id.split("/")[1];
      const season = seasonFromDateId(dateId);
      if (!matchesSeason(season, seasonFilter)) continue;
      tasks.push({
        playerId: player.id,
        playerName: player.name,
        outing,
        dateId,
        season,
      });
    }
  }

  let loaded = 0;
  const total = tasks.length;

  const rows = await mapWithLimit(tasks, MAX_CONCURRENT, async (task) => {
    try {
      const cached = await loadSingleOuting(
        task.outing.id,
        task.outing.csvPath,
        task.playerId,
      );
      const kpis = computeOutingKpis(cached.pitches, cached.pitcherHand);

      loaded++;
      onProgress?.(loaded, total);

      if (kpis.pitchCount < minPitches) return null;

      const row: OutingLeaderboardRow = {
        playerId: task.playerId,
        playerName: task.playerName,
        outingId: task.outing.id,
        dateId: task.dateId,
        season: task.season,
        label: task.outing.label,
        pitcherHand: cached.pitcherHand,
        handUnknown: cached.handUnknown,
        pitchCount: kpis.pitchCount,
        onTargetPct: kpis.onTargetPct,
        outlierPct: kpis.outlierPct,
        avgMissIn: kpis.avgMissIn,
        avgVAbsIn: kpis.avgVAbsIn,
        avgHAbsIn: kpis.avgHAbsIn,
        consistencyStdIn: kpis.consistencyStdIn,
      };
      return row;
    } catch (err) {
      loaded++;
      onProgress?.(loaded, total);
      console.warn(`[Leaderboards] Failed to load ${task.outing.id}:`, err);
      return null;
    }
  });

  return rows.filter((r): r is OutingLeaderboardRow => r !== null);
}

/** Clear the outing cache (useful for testing or forced refresh). */
export function clearCache(): void {
  outingCache.clear();
}
