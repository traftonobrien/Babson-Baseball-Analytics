/**
 * D3 Dashboard API helpers.
 *
 * Server-side code (RSC, route handlers) prefers cached data from
 * web/public/d3/{year}.json (updated daily by GitHub Actions), falling back
 * to the live D3 API when cache is missing or stale.
 */

import { readFile } from "fs/promises";
import path from "path";

const D3_BASE = "https://d3-dashboard.com/api";

// ---------------------------------------------------------------------------
// Cache (daily sync via .github/workflows/sync-d3-daily.yml)
// ---------------------------------------------------------------------------

async function readCachedLeaderboard(
  endpoint: "pitching" | "batting",
  year: string,
): Promise<unknown | null> {
  try {
    const cwd = process.cwd();
    const candidates =
      endpoint === "pitching"
        ? [
            path.join(cwd, "public", "d3", `${year}.json`),
            path.join(cwd, "public", "d3", `pitching-${year}.json`),
          ]
        : [path.join(cwd, "public", "d3", `batting-${year}.json`)];

    for (const cachePath of candidates) {
      try {
        const raw = await readFile(cachePath, "utf-8");
        return JSON.parse(raw) as unknown;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Server-direct helpers (used by RSC pages — no self-fetch needed)
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.D3_DASHBOARD_API_KEY;
  if (!key) throw new Error("Missing D3_DASHBOARD_API_KEY env var");
  return key;
}

async function fetchD3Direct(
  endpoint: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${D3_BASE}/${endpoint}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.log("[d3db] direct fetch:", url.toString());
  }

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-Key": getApiKey(),
      Accept: "application/json",
    },
    cache: "no-store",
    redirect: "manual",
  });

  if (isDev) {
    console.log("[d3db] response status:", res.status);
  }

  if (res.status >= 300 && res.status < 400) {
    const msg = `D3 API redirected (${res.status}) — likely auth issue. Location: ${res.headers.get("location")}`;
    console.error("[d3db]", msg);
    throw new Error(msg);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const msg = `D3 API error ${res.status} for ${endpoint}: ${body.slice(0, 300)}`;
    console.error("[d3db]", msg);
    throw new Error(msg);
  }

  return res.json();
}

export async function fetchPitchingLeaderboard(
  year: string,
  division = 3,
): Promise<unknown> {
  const cached = await readCachedLeaderboard("pitching", year);
  if (cached != null) return cached;

  return fetchD3Direct("pitching", {
    years: year,
    division: String(division),
  });
}

export async function fetchBattingLeaderboard(
  year: string,
  division = 3,
): Promise<unknown> {
  const cached = await readCachedLeaderboard("batting", year);
  if (cached != null) return cached;

  return fetchD3Direct("batting", {
    years: year,
    division: String(division),
  });
}

export async function fetchPlayer(playerId: string): Promise<unknown> {
  return fetchD3Direct(`player/${playerId}`);
}

export async function searchPlayers(q: string): Promise<unknown> {
  return fetchD3Direct("search/players", { q });
}
