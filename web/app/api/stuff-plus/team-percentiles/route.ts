import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promises as fs } from "fs";
import { loadStuffPlusData } from "@/lib/stuffPlusJson";

interface IndexEntry {
  playerSlug?: string;
  team?: string;
}

/** Compute percentile: (count below + 0.5 * count equal) / total. Higher = better. */
function computePercentile(values: number[], value: number): number | null {
  if (!Number.isFinite(value) || values.length === 0) return null;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  const pct = (below + equal * 0.5) / values.length;
  return Math.round(pct * 1000) / 10;
}

export async function GET(request: NextRequest) {
  const playerId = request.nextUrl.searchParams.get("playerId");
  if (!playerId?.trim()) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  try {
    // Load trackman index to get team
    const indexPath = path.join(process.cwd(), "public", "trackman", "index.json");
    let index: IndexEntry[] = [];
    try {
      const raw = await fs.readFile(indexPath, "utf-8");
      const data = JSON.parse(raw);
      index = Array.isArray(data) ? data : [];
    } catch {
      // No index or parse error — return empty percentiles
    }

    const pid = playerId.trim();
    const pidLower = pid.toLowerCase();
    const playerEntry = index.find(
      (e) =>
        e.playerSlug === pid ||
        e.playerSlug?.toLowerCase() === pidLower
    );
    const team = playerEntry?.team;
    if (!team) {
      return NextResponse.json({ pitches: [], team: null, note: "Team not found in index" });
    }

    const teammateSlugs = Array.from(
      new Set(
        index
          .filter((e) => e.team === team && e.playerSlug)
          .map((e) => e.playerSlug!)
      )
    );
    if (teammateSlugs.length === 0) {
      return NextResponse.json({ pitches: [], team, note: "No teammates in index" });
    }

    // Load arsenal entries from JSON for all teammates
    const { arsenal } = await loadStuffPlusData();
    const rows = arsenal.filter((r) =>
      teammateSlugs.some(
        (s) => s === r.playerSlug || s.toLowerCase() === r.playerSlug?.toLowerCase()
      )
    );

    const byPitchType = new Map<string, { playerSlug: string; meanStuffPlus: number }[]>();
    for (const r of rows) {
      if (r.meanStuffPlus == null) continue;
      if (!byPitchType.has(r.pitchType)) byPitchType.set(r.pitchType, []);
      byPitchType.get(r.pitchType)!.push({ playerSlug: r.playerSlug, meanStuffPlus: r.meanStuffPlus });
    }

    const playerPitches = rows.filter(
      (r) => r.playerSlug === pid || r.playerSlug?.toLowerCase() === pidLower
    );
    const pitches: { pitchType: string; meanStuffPlus: number; percentile: number | null }[] = [];

    for (const pt of playerPitches) {
      if (pt.meanStuffPlus == null) continue;
      const teamValues = byPitchType.get(pt.pitchType)?.map((x) => x.meanStuffPlus) ?? [];
      const percentile = computePercentile(teamValues, pt.meanStuffPlus);
      pitches.push({
        pitchType: pt.pitchType,
        meanStuffPlus: pt.meanStuffPlus,
        percentile,
      });
    }

    // Total Stuff+ percentile: avg of each player's pitches, then rank
    const byPlayer = new Map<string, number[]>();
    for (const r of rows) {
      if (r.meanStuffPlus == null) continue;
      if (!byPlayer.has(r.playerSlug)) byPlayer.set(r.playerSlug, []);
      byPlayer.get(r.playerSlug)!.push(r.meanStuffPlus);
    }
    const playerTotals = Array.from(byPlayer.entries()).map(([slug, vals]) => ({
      playerSlug: slug,
      total: vals.reduce((a, b) => a + b, 0) / vals.length,
    }));
    const playerTotal = playerTotals.find(
      (x) => x.playerSlug === pid || x.playerSlug?.toLowerCase() === pidLower
    )?.total;
    const totalPercentile =
      playerTotal != null
        ? computePercentile(
            playerTotals.map((x) => x.total),
            playerTotal
          )
        : null;

    return NextResponse.json({
      team,
      teammateCount: teammateSlugs.length,
      totalPercentile,
      pitches,
    });
  } catch (err) {
    console.error("stuff-plus team-percentiles:", err);
    return NextResponse.json({ error: "Failed to compute percentiles" }, { status: 500 });
  }
}
