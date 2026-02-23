import { NextResponse } from "next/server";
import players from "@/data/players.json";
import { fetchPitchingLeaderboard } from "@/lib/d3db";
import {
  computeQualifiedAggregate,
  filterBabsonPitchers,
  type BabsonPitcherRow,
  type D3PitcherRow,
} from "@/lib/d3/babsonPitchers";

function buildD3ToSlugMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const p of players as { slug?: string; d3_player_id?: string }[]) {
    const id = p.d3_player_id;
    if (id && p.slug) map.set(String(id), p.slug);
  }
  return map;
}

function extractRows(payload: unknown): D3PitcherRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as D3PitcherRow[];
  if (typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const directKeys = ["data", "rows", "players", "results", "leaderboard"];
  for (const key of directKeys) {
    if (Array.isArray(record[key])) return record[key] as D3PitcherRow[];
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    for (const key of directKeys) {
      if (Array.isArray(nested[key])) return nested[key] as D3PitcherRow[];
    }
  }
  return [];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ?? "2025";
    const minIp = Math.max(1, parseInt(searchParams.get("minIp") ?? "15", 10) || 15);

    const data = await fetchPitchingLeaderboard(year, 3);
    const rows = extractRows(data);
    const pitchers = filterBabsonPitchers(rows);
    const d3ToSlug = buildD3ToSlugMap();

    const enriched: (BabsonPitcherRow & { slug?: string })[] = pitchers.map((p) => ({
      ...p,
      slug: d3ToSlug.get(p.playerId) ?? undefined,
    }));

    const qualified = computeQualifiedAggregate(pitchers, minIp);

    return NextResponse.json({ year, minIp, pitchers: enriched, qualified });
  } catch (err) {
    console.error("[team-stats]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
