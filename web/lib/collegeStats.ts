import { readFile } from "fs/promises";
import path from "path";

export interface NcaaSyncMeta {
  synced_at: string;
  source: string;
  division: number;
  years: number[];
  types: string[];
  results: Record<string, {
    row_count: number;
    team_count: number;
    freshly_synced: boolean;
    stale: boolean;
  }>;
}

export async function fetchNcaaStatsMeta(): Promise<NcaaSyncMeta | null> {
  const cwd = process.cwd();
  const metaPath = path.join(cwd, "public", "college-stats", "meta.json");
  try {
    const raw = await readFile(metaPath, "utf-8");
    return JSON.parse(raw) as NcaaSyncMeta;
  } catch {
    return null;
  }
}

async function readCachedLeaderboard(
  endpoint: "pitching" | "batting",
  year: string,
): Promise<unknown | null> {
  const cwd = process.cwd();
  const candidates = [path.join(cwd, "public", "college-stats", `${endpoint}-${year}.json`)];

  for (const cachePath of candidates) {
    try {
      const raw = await readFile(cachePath, "utf-8");
      return JSON.parse(raw) as unknown;
    } catch {
      continue;
    }
  }

  return null;
}

export async function fetchPitchingLeaderboard(
  year: string,
  division = 3,
): Promise<unknown> {
  void division;
  const cached = await readCachedLeaderboard("pitching", year);
  if (cached != null) return cached;
  throw new Error(`Missing cached NCAA pitching leaderboard for ${year}`);
}

export async function fetchBattingLeaderboard(
  year: string,
  division = 3,
): Promise<unknown> {
  void division;
  const cached = await readCachedLeaderboard("batting", year);
  if (cached != null) return cached;
  throw new Error(`Missing cached NCAA batting leaderboard for ${year}`);
}
