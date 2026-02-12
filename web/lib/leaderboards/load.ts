/**
 * Leaderboard data loader.
 *
 * Fetches CSV data for all outings with:
 *   - Concurrency-limited fetching (max 6 parallel)
 *   - In-memory cache by outingId (raw pitches + hand)
 *   - Compute step separated from load (filters applied without refetch)
 *   - Progressive callback for streaming results to UI
 *   - Arsenals-based handedness with "R" fallback + warning
 */

import Papa from "papaparse";
import type { Pitch } from "@/app/types";
import { players } from "@/lib/dataIndex";
import { getPlayerMeta } from "@/lib/arsenals";
import { seasonFromDateId } from "@/lib/season";
import { computeOutingKpis, type ComputeOptions } from "./metrics";
import type { OutingLeaderboardRow, SeasonFilter } from "./types";
import type { PitchGroup } from "./pitchGroups";

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

export interface CachedOuting {
  pitches: Pitch[];
  pitcherHand: "R" | "L";
  handUnknown: boolean;
}

interface CachedOutingTask {
  playerId: string;
  playerName: string;
  outingId: string;
  dateId: string;
  season: number | null;
  label: string;
}

const outingCache = new Map<string, CachedOuting>();
let loadedTasks: CachedOutingTask[] | null = null;

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
      `[Leaderboards] Hand unknown for playerId=${playerId}. Falling back to "R".`,
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

export type HandFilter = "ALL" | "R" | "L";

export interface LoadOptions {
  seasonFilter: SeasonFilter;
  minPitches?: number;
  onProgress?: (loaded: number, total: number) => void;
}

export interface ComputeFilters {
  seasonFilter: SeasonFilter;
  handFilter?: HandFilter;
  pitchGroup?: PitchGroup;
  minPitches?: number;
}

/**
 * Load raw pitch data for all outings matching the season filter.
 * Caches raw data so subsequent computeLeaderboardRows calls are instant.
 */
export async function loadAllOutingData(
  opts: LoadOptions,
): Promise<void> {
  const { seasonFilter, onProgress } = opts;

  const tasks: CachedOutingTask[] = [];
  for (const player of players) {
    for (const outing of player.outings) {
      const dateId = outing.id.split("/")[1];
      const season = seasonFromDateId(dateId);
      if (!matchesSeason(season, seasonFilter)) continue;
      tasks.push({
        playerId: player.id,
        playerName: player.name,
        outingId: outing.id,
        dateId,
        season,
        label: outing.label,
      });
    }
  }

  let loaded = 0;
  const total = tasks.length;

  // Find the csvPath from dataIndex for each task
  const taskWithCsv = tasks.map((t) => {
    const player = players.find((p) => p.id === t.playerId)!;
    const outing = player.outings.find((o) => o.id === t.outingId)!;
    return { ...t, csvPath: outing.csvPath };
  });

  await mapWithLimit(taskWithCsv, MAX_CONCURRENT, async (task) => {
    try {
      await loadSingleOuting(task.outingId, task.csvPath, task.playerId);
    } catch (err) {
      console.warn(`[Leaderboards] Failed to load ${task.outingId}:`, err);
    }
    loaded++;
    onProgress?.(loaded, total);
  });

  loadedTasks = tasks;
}

/**
 * Compute leaderboard rows from cached data.
 * Applies filters (hand, pitch group, min pitches) at compute time
 * without refetching CSVs.
 */
export function computeLeaderboardRows(
  filters: ComputeFilters,
): OutingLeaderboardRow[] {
  if (!loadedTasks) return [];

  const {
    seasonFilter,
    handFilter = "ALL",
    pitchGroup = "ALL",
    minPitches = 5,
  } = filters;

  const computeOpts: ComputeOptions | undefined =
    pitchGroup !== "ALL" ? { pitchGroup } : undefined;

  const rows: OutingLeaderboardRow[] = [];

  for (const task of loadedTasks) {
    if (!matchesSeason(task.season, seasonFilter)) continue;

    const cached = outingCache.get(task.outingId);
    if (!cached) continue;

    // Hand filter
    if (handFilter !== "ALL") {
      if (cached.handUnknown) continue; // exclude unknown when filtering by hand
      if (cached.pitcherHand !== handFilter) continue;
    }

    const kpis = computeOutingKpis(cached.pitches, cached.pitcherHand, computeOpts);

    if (kpis.pitchCount < minPitches) continue;

    rows.push({
      playerId: task.playerId,
      playerName: task.playerName,
      outingId: task.outingId,
      dateId: task.dateId,
      season: task.season,
      label: task.label,
      pitcherHand: cached.pitcherHand,
      handUnknown: cached.handUnknown,
      pitchCount: kpis.pitchCount,
      onTargetPct: kpis.onTargetPct,
      outlierPct: kpis.outlierPct,
      avgMissIn: kpis.avgMissIn,
      avgVAbsIn: kpis.avgVAbsIn,
      avgHAbsIn: kpis.avgHAbsIn,
      consistencyStdIn: kpis.consistencyStdIn,
    });
  }

  return rows;
}

/**
 * Legacy convenience: load + compute in one call.
 * Used for backward compat; prefer loadAllOutingData + computeLeaderboardRows.
 */
export async function loadAllLeaderboardData(
  opts: LoadOptions,
): Promise<OutingLeaderboardRow[]> {
  await loadAllOutingData(opts);
  return computeLeaderboardRows({
    seasonFilter: opts.seasonFilter,
    minPitches: opts.minPitches,
  });
}

/** Clear the outing cache (useful for testing or forced refresh). */
export function clearCache(): void {
  outingCache.clear();
  loadedTasks = null;
}
