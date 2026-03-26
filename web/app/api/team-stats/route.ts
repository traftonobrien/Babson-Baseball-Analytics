import { NextResponse } from "next/server";
import players from "@/data/players.json";
import { fetchBattingLeaderboard, fetchNcaaStatsMeta, fetchPitchingLeaderboard } from "@/lib/collegeStats";
import {
  computeQualifiedAggregate,
  filterBabsonPitchers,
  type BabsonPitcherRow,
  type PitchingLeaderboardRow,
} from "@/lib/college-stats/babsonPitchers";
import { TEAM_STATS_MIN_PITCHER_IP } from "@/lib/teamStatsQualifications";

type BattingLeaderboardRow = Record<string, unknown>;

type BabsonHitterRow = {
  playerId: string;
  playerName: string;
  gp: number;
  gs: number;
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  tb: number;
  r: number;
  hr: number;
  rbi: number;
  sb: number;
  cs: number;
  bb: number;
  so: number;
  hbp: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPct: number;
  bbPct: number;
  wrcPlus: number;
  war: number;
  sf: number;
  iso: number;
  babip: number;
  bbk: number;
  sbPct: number;
};

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildPlayerLookups() {
  const idMap = new Map<string, string>();
  const nameMap = new Map<string, string>();

  for (const p of players as {
    slug?: string;
    name?: string;
    d3_player_id?: string;
    ncaa_player_id?: string;
  }[]) {
    if (!p.slug) continue;
    if (p.d3_player_id) idMap.set(String(p.d3_player_id), p.slug);
    if ((p as { ncaa_player_id?: string }).ncaa_player_id) {
      idMap.set(String((p as { ncaa_player_id?: string }).ncaa_player_id), p.slug);
    }
    if (p.name) nameMap.set(normalizeName(p.name), p.slug);
  }

  return { idMap, nameMap };
}

function extractRows<T>(payload: unknown): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as T[];
  if (typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const directKeys = ["data", "rows", "players", "results", "leaderboard"];
  for (const key of directKeys) {
    if (Array.isArray(record[key])) return record[key] as T[];
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    for (const key of directKeys) {
      if (Array.isArray(nested[key])) return nested[key] as T[];
    }
  }
  return [];
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getNumberByCandidates(row: Record<string, unknown>, candidates: string[]): number {
  for (const candidate of candidates) {
    const needle = normalizeKey(candidate);
    for (const [key, value] of Object.entries(row)) {
      if (normalizeKey(key) === needle) {
        return parseNumber(value);
      }
    }
  }
  return 0;
}

function filterBabsonHitters(rows: BattingLeaderboardRow[]): BabsonHitterRow[] {
  return rows
    .filter((row) => normalizeName(String(row.team_name ?? "")) === "babson")
    .map((row) => {
      const playerId = String(row.player_id ?? "").trim();
      const playerName = String(row.player_name ?? "").trim();
      const gp = getNumberByCandidates(row, ["gp", "games_played", "g"]);
      const gs = getNumberByCandidates(row, ["gs", "games_started"]);
      const pa = getNumberByCandidates(row, ["pa", "plate_appearances"]);
      const ab = getNumberByCandidates(row, ["ab", "at_bats"]);
      const h = getNumberByCandidates(row, ["h", "hits"]);
      const doubles = getNumberByCandidates(row, ["doubles", "2b", "d"]);
      const triples = getNumberByCandidates(row, ["triples", "3b", "t"]);
      const tb = getNumberByCandidates(row, ["tb", "total_bases"]);
      const r = getNumberByCandidates(row, ["r", "runs"]);
      const hr = getNumberByCandidates(row, ["hr", "home_runs"]);
      const rbi = getNumberByCandidates(row, ["rbi", "runs_batted_in"]);
      const sb = getNumberByCandidates(row, ["sb", "stolen_bases"]);
      const cs = getNumberByCandidates(row, ["cs", "caught_stealing"]);
      const bb = getNumberByCandidates(row, ["bb", "walks", "base_on_balls"]);
      const so = getNumberByCandidates(row, ["so", "k", "strikeouts"]);
      const hbp = getNumberByCandidates(row, ["hbp", "hit_by_pitch", "hb"]);
      const avg = getNumberByCandidates(row, ["avg", "ba", "batting_avg", "batting_average"]);
      const obp = getNumberByCandidates(row, ["obp", "on_base_percentage", "onbase"]);
      const slg = getNumberByCandidates(row, ["slg", "slugging", "slugging_pct"]);
      const ops = getNumberByCandidates(row, ["ops", "on_base_plus_slugging"]) || (obp + slg);
      const kPct = getNumberByCandidates(row, ["k_pct", "k_percent", "k_percentage", "so_pct"]);
      const bbPct = getNumberByCandidates(row, ["bb_pct", "bb_percent", "bb_percentage", "bb_rate"]);
      const wrcPlus = getNumberByCandidates(row, ["wrc_plus", "wrcplus"]);
      const war = getNumberByCandidates(row, ["war", "bwar", "fwar", "off_war", "owar"]);
      const sf = getNumberByCandidates(row, ["sf", "sacrifice_flies"]);

      // Derived
      const iso = Math.max(0, slg - avg);
      const babipDenom = ab - so - hr + sf;
      const babip = babipDenom > 0 ? (h - hr) / babipDenom : 0;
      const bbk = so > 0 ? bb / so : 0;
      const sbPct = (sb + cs) > 0 ? (sb / (sb + cs)) * 100 : 0;

      return {
        playerId,
        playerName,
        gp,
        gs,
        pa,
        ab,
        h,
        doubles,
        triples,
        tb,
        r,
        hr,
        rbi,
        sb,
        cs,
        bb,
        so,
        hbp,
        avg,
        obp,
        slg,
        ops,
        kPct,
        bbPct,
        wrcPlus,
        war,
        sf,
        iso,
        babip,
        bbk,
        sbPct,
      };
    })
    .filter((row) => row.playerId && row.playerName);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get("year") ?? "2026";
    const statType = searchParams.get("statType") === "batting" ? "batting" : "pitching";
    const minIp = Math.max(
      TEAM_STATS_MIN_PITCHER_IP,
      parseInt(searchParams.get("minIp") ?? String(TEAM_STATS_MIN_PITCHER_IP), 10) ||
        TEAM_STATS_MIN_PITCHER_IP,
    );

    const { idMap, nameMap } = buildPlayerLookups();
    const meta = await fetchNcaaStatsMeta();
    if (statType === "batting") {
      const data = await fetchBattingLeaderboard(year, 3);
      const rows = extractRows<BattingLeaderboardRow>(data);
      const hitters = filterBabsonHitters(rows);
      const enriched = hitters.map((hitter) => ({
        ...hitter,
        slug: idMap.get(hitter.playerId) ?? nameMap.get(normalizeName(hitter.playerName)) ?? undefined,
      }));

      return NextResponse.json({ year, statType, hitters: enriched, meta });
    }

    const data = await fetchPitchingLeaderboard(year, 3);
    const rows = extractRows<PitchingLeaderboardRow>(data);
    const pitchers = filterBabsonPitchers(rows);
    const enriched: (BabsonPitcherRow & { slug?: string })[] = pitchers.map((p) => ({
      ...p,
      slug: idMap.get(p.playerId) ?? nameMap.get(normalizeName(p.playerName)) ?? undefined,
    }));
    const qualified = computeQualifiedAggregate(pitchers, minIp);

    return NextResponse.json({ year, statType, minIp, pitchers: enriched, qualified, meta });
  } catch (err) {
    console.error("[team-stats]", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 },
    );
  }
}
