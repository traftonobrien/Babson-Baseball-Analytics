import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import path from "path";
import { promises as fs } from "fs";
import players from "@/data/players.json";
import { fetchPitchingLeaderboard } from "@/lib/d3db";
import { players as dataIndexPlayers } from "@/lib/dataIndex";
import PlayerProfileTabs from "./PlayerProfileTabs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RawPlayerEntry {
  player_slug?: string;
  slug?: string;
  full_name?: string;
  name?: string;
  team?: string;
  school?: string;
  role?: string;
  d3_player_id?: number | string | null;
}

interface PlayerRegistryEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
  d3_player_id: string | null;
}

type D3Row = Record<string, unknown>;

type TrackmanIndexEntry = {
  playerSlug?: string;
  date?: string;
  sessionType?: string | null;
};

type MetricDefinition = {
  id: string;
  label: string;
  higherBetter: boolean;
  format: (value: number | null) => string;
  valueKeys?: string[];
  percentileKeys?: string[];
  derive?: (row: D3Row) => number | null;
};

type PercentileMetric = {
  label: string;
  value: string;
  percentile: number | null;
  note?: string;
};

const TARGET_YEAR = 2025;

const registry = (players as RawPlayerEntry[])
  .map((entry) => normalizePlayerEntry(entry))
  .filter((entry): entry is PlayerRegistryEntry => entry != null);


const PITCHING_KEYS = {
  ip: ["ip", "innings", "innings_pitched"],
  ip_float: ["ip_float"],
  outs: ["ip_outs", "outs_pitched"],
  era: ["era"],
  fip: ["fip"],
  xfip: ["xfip", "x_fip"],
  whip: ["whip"],
  k_pct: ["k_pct", "k_percent", "k_percentage", "so_pct"],
  bb_pct: ["bb_pct", "bb_percent", "bb_percentage", "bb_rate"],
  kbb_pct: [
    "k_minus_bb_pct",
    "kbb_pct",
    "k_bb_pct",
  ],
  war: ["war", "pitching_war", "pwar"],
};

const BATTING_KEYS = {
  avg: ["avg", "ba", "batting_avg", "batting_average"],
  obp: ["obp", "on_base_percentage", "onbase"],
  slg: ["slg", "slugging", "slugging_pct"],
  ops: ["ops", "on_base_plus_slugging"],
  hr: ["hr", "home_runs", "home_run"],
  rbi: ["rbi", "runs_batted_in"],
  k_pct: ["k_pct", "k_percent", "k_percentage", "so_pct"],
  bb_pct: ["bb_pct", "bb_percent", "bb_percentage", "bb_rate"],
  war: ["war", "bwar", "fwar", "off_war", "owar"],
  wrc_plus: ["wrc_plus", "wrcplus"],
};

function normalizePlayerEntry(entry: RawPlayerEntry): PlayerRegistryEntry | null {
  const slug = entry.slug ?? entry.player_slug ?? "";
  const name = entry.name ?? entry.full_name ?? "";
  const team = entry.team ?? entry.school ?? "";
  const role = entry.role ?? "";
  if (!slug || !name) return null;

  return {
    slug,
    name,
    team,
    role,
    d3_player_id: entry.d3_player_id != null ? String(entry.d3_player_id) : null,
  };
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseMetric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[%,$]/g, "").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getNumberByCandidates(row: D3Row, candidates: string[]): number | null {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeKey(candidate);
    for (const [key, value] of Object.entries(row)) {
      if (normalizeKey(key) === normalizedCandidate) {
        return parseMetric(value);
      }
    }
  }
  return null;
}


function extractRows(payload: unknown): D3Row[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as D3Row[];
  if (typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const directKeys = ["data", "rows", "players", "results", "leaderboard"];
  for (const key of directKeys) {
    if (Array.isArray(record[key])) return record[key] as D3Row[];
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    for (const key of directKeys) {
      if (Array.isArray(nested[key])) return nested[key] as D3Row[];
    }
  }
  return [];
}


function formatNumber(value: number | null, decimals = 2): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(decimals);
}

function formatAverage(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(3);
}

function formatInteger(value: number | null): string {
  if (value == null || Number.isNaN(value)) return "--";
  return Math.round(value).toString();
}

function formatPercent(value: number | null, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return "--";
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(decimals)}%`;
}

function computePercentile(values: number[], value: number, higherBetter: boolean): number | null {
  if (!Number.isFinite(value)) return null;
  if (values.length === 0) return null;

  const adjustedValues = higherBetter ? values : values.map((v) => -v);
  const adjustedValue = higherBetter ? value : -value;
  const below = adjustedValues.filter((v) => v < adjustedValue).length;
  const equal = adjustedValues.filter((v) => v === adjustedValue).length;
  const percentile = (below + equal * 0.5) / adjustedValues.length;
  return Math.round(percentile * 1000) / 10;
}

function normalizePercentile(raw: number | null): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  const normalized = raw <= 1 ? raw * 100 : raw;
  return Math.min(100, Math.max(0, normalized));
}

function getMetricValue(row: D3Row, metric: MetricDefinition): number | null {
  if (metric.derive) {
    const derived = metric.derive(row);
    if (derived != null) return derived;
  }
  if (metric.valueKeys) return getNumberByCandidates(row, metric.valueKeys);
  return null;
}

function getPercentileValue(row: D3Row, metric: MetricDefinition): number | null {
  if (metric.percentileKeys) {
    const direct = getNumberByCandidates(row, metric.percentileKeys);
    if (direct != null) return direct;
  }

  const metricNeedle = normalizeKey(metric.id);
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeKey(key);
    if (!normalizedKey.includes("percentile")) continue;
    if (!normalizedKey.includes(metricNeedle)) continue;
    const parsed = parseMetric(value);
    if (parsed != null) return parsed;
  }
  return null;
}

const PITCHING_SNAPSHOT_METRICS: MetricDefinition[] = [
  {
    id: "ip",
    label: "IP",
    higherBetter: true,
    format: (value) => formatNumber(value, 1),
    valueKeys: PITCHING_KEYS.ip,
    derive: (row) => {
      const direct = getNumberByCandidates(row, PITCHING_KEYS.ip);
      if (direct != null) return direct;
      const ipFloat = getNumberByCandidates(row, PITCHING_KEYS.ip_float);
      if (ipFloat != null) return ipFloat;
      const outs = getNumberByCandidates(row, PITCHING_KEYS.outs);
      return outs != null ? outs / 3 : null;
    },
  },
  {
    id: "era",
    label: "ERA",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.era,
  },
  {
    id: "fip",
    label: "FIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.fip,
  },
  {
    id: "xfip",
    label: "xFIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.xfip,
  },
  {
    id: "whip",
    label: "WHIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.whip,
  },
  {
    id: "k_pct",
    label: "K%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.k_pct,
  },
  {
    id: "bb_pct",
    label: "BB%",
    higherBetter: false,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.bb_pct,
  },
  {
    id: "kbb_pct",
    label: "K-BB%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.kbb_pct,
    derive: (row) => {
      const direct = getNumberByCandidates(row, PITCHING_KEYS.kbb_pct);
      if (direct != null) return direct;
      const k = getNumberByCandidates(row, PITCHING_KEYS.k_pct);
      const bb = getNumberByCandidates(row, PITCHING_KEYS.bb_pct);
      if (k != null && bb != null) return k - bb;
      return null;
    },
  },
  {
    id: "war",
    label: "WAR",
    higherBetter: true,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.war,
  },
];

const PITCHING_PERCENTILE_METRICS: MetricDefinition[] = [
  {
    id: "ip_float",
    label: "IP",
    higherBetter: true,
    format: (value) => formatNumber(value, 1),
    valueKeys: PITCHING_KEYS.ip_float,
    derive: (row) => {
      const direct = getNumberByCandidates(row, PITCHING_KEYS.ip_float);
      if (direct != null) return direct;
      const ip = getNumberByCandidates(row, PITCHING_KEYS.ip);
      if (ip != null) return ip;
      const outs = getNumberByCandidates(row, PITCHING_KEYS.outs);
      return outs != null ? outs / 3 : null;
    },
  },
  {
    id: "era",
    label: "ERA",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.era,
    percentileKeys: ["era_percentile", "era_pct", "era_percent"],
  },
  {
    id: "fip",
    label: "FIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.fip,
    percentileKeys: ["fip_percentile", "fip_pct", "fip_percent"],
  },
  {
    id: "xfip",
    label: "xFIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.xfip,
    percentileKeys: ["xfip_percentile", "xfip_pct", "xfip_percent"],
  },
  {
    id: "k_pct",
    label: "K%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.k_pct,
    percentileKeys: ["k_percentile", "k_pct_percentile", "k%_percentile"],
  },
  {
    id: "bb_pct",
    label: "BB%",
    higherBetter: false,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.bb_pct,
    percentileKeys: ["bb_percentile", "bb_pct_percentile", "bb%_percentile"],
  },
  {
    id: "kbb_pct",
    label: "K-BB%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: PITCHING_KEYS.kbb_pct,
    percentileKeys: ["kbb_percentile", "kbb_pct_percentile", "kbb%_percentile"],
    derive: (row) => {
      const direct = getNumberByCandidates(row, PITCHING_KEYS.kbb_pct);
      if (direct != null) return direct;
      const k = getNumberByCandidates(row, PITCHING_KEYS.k_pct);
      const bb = getNumberByCandidates(row, PITCHING_KEYS.bb_pct);
      if (k != null && bb != null) return k - bb;
      return null;
    },
  },
  {
    id: "whip",
    label: "WHIP",
    higherBetter: false,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.whip,
    percentileKeys: ["whip_percentile", "whip_pct", "whip_percent"],
  },
  {
    id: "war",
    label: "WAR",
    higherBetter: true,
    format: (value) => formatNumber(value, 2),
    valueKeys: PITCHING_KEYS.war,
    percentileKeys: ["war_percentile", "pwar_percentile", "pitching_war_percentile"],
  },
];

const BATTING_SNAPSHOT_METRICS: MetricDefinition[] = [
  {
    id: "avg",
    label: "AVG",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.avg,
  },
  {
    id: "obp",
    label: "OBP",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.obp,
  },
  {
    id: "slg",
    label: "SLG",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.slg,
  },
  {
    id: "ops",
    label: "OPS",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.ops,
    derive: (row) => {
      const direct = getNumberByCandidates(row, BATTING_KEYS.ops);
      if (direct != null) return direct;
      const obp = getNumberByCandidates(row, BATTING_KEYS.obp);
      const slg = getNumberByCandidates(row, BATTING_KEYS.slg);
      if (obp != null && slg != null) return obp + slg;
      return null;
    },
  },
  {
    id: "hr",
    label: "HR",
    higherBetter: true,
    format: formatInteger,
    valueKeys: BATTING_KEYS.hr,
  },
  {
    id: "rbi",
    label: "RBI",
    higherBetter: true,
    format: formatInteger,
    valueKeys: BATTING_KEYS.rbi,
  },
  {
    id: "k_pct",
    label: "K%",
    higherBetter: false,
    format: (value) => formatPercent(value, 1),
    valueKeys: BATTING_KEYS.k_pct,
  },
  {
    id: "bb_pct",
    label: "BB%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: BATTING_KEYS.bb_pct,
  },
  {
    id: "war",
    label: "WAR",
    higherBetter: true,
    format: (value) => formatNumber(value, 2),
    valueKeys: BATTING_KEYS.war,
  },
];

const BATTING_PERCENTILE_METRICS: MetricDefinition[] = [
  {
    id: "avg",
    label: "AVG",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.avg,
    percentileKeys: ["avg_percentile", "avg_pct", "avg_percent"],
  },
  {
    id: "obp",
    label: "OBP",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.obp,
    percentileKeys: ["obp_percentile", "obp_pct", "obp_percent"],
  },
  {
    id: "slg",
    label: "SLG",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.slg,
    percentileKeys: ["slg_percentile", "slg_pct", "slg_percent"],
  },
  {
    id: "ops",
    label: "OPS",
    higherBetter: true,
    format: formatAverage,
    valueKeys: BATTING_KEYS.ops,
    percentileKeys: ["ops_percentile", "ops_pct", "ops_percent"],
    derive: (row) => {
      const direct = getNumberByCandidates(row, BATTING_KEYS.ops);
      if (direct != null) return direct;
      const obp = getNumberByCandidates(row, BATTING_KEYS.obp);
      const slg = getNumberByCandidates(row, BATTING_KEYS.slg);
      if (obp != null && slg != null) return obp + slg;
      return null;
    },
  },
  {
    id: "k_pct",
    label: "K%",
    higherBetter: false,
    format: (value) => formatPercent(value, 1),
    valueKeys: BATTING_KEYS.k_pct,
    percentileKeys: ["k_percentile", "k_pct_percentile", "k%_percentile"],
  },
  {
    id: "bb_pct",
    label: "BB%",
    higherBetter: true,
    format: (value) => formatPercent(value, 1),
    valueKeys: BATTING_KEYS.bb_pct,
    percentileKeys: ["bb_percentile", "bb_pct_percentile", "bb%_percentile"],
  },
  {
    id: "war",
    label: "WAR",
    higherBetter: true,
    format: (value) => formatNumber(value, 2),
    valueKeys: BATTING_KEYS.war,
    percentileKeys: ["war_percentile", "bwar_percentile", "fwar_percentile"],
  },
];

const loadTrackmanIndex = cache(async (): Promise<TrackmanIndexEntry[]> => {
  try {
    const filePath = path.join(process.cwd(), "public", "trackman", "index.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as TrackmanIndexEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
});

function getD3PlayerId(player: PlayerRegistryEntry): string | null {
  return player.d3_player_id != null ? String(player.d3_player_id) : null;
}

function buildSeasonStats(metrics: MetricDefinition[], statsSource: D3Row): { label: string; value: string }[] {
  return metrics.map((metric) => {
    const value = getMetricValue(statsSource, metric);
    return {
      label: metric.label,
      value: metric.format(value),
    };
  });
}

function buildD3Percentiles(
  metrics: MetricDefinition[],
  leaderboardRows: D3Row[],
  statsSource: D3Row,
  percentileRow: D3Row,
): PercentileMetric[] {
  return metrics.map((metric) => {
    const playerValue = getMetricValue(statsSource, metric);
    const rawPercentile = getPercentileValue(percentileRow, metric);

    let percentile: number | null = null;
    let note: string | undefined;

    if (rawPercentile != null) {
      const normalized = normalizePercentile(rawPercentile);
      percentile =
        normalized == null
          ? null
          : metric.higherBetter
            ? normalized
            : 100 - normalized;
    } else if (playerValue != null) {
      const values = leaderboardRows
        .map((row) => getMetricValue(row, metric))
        .filter((value): value is number => value != null);
      const computed = computePercentile(values, playerValue, metric.higherBetter);
      percentile = computed;
      if (computed != null) {
        note = "Computed (vs D3)";
      }
    }

    return {
      label: metric.label,
      value: metric.format(playerValue),
      percentile,
      note,
    };
  });
}

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const player = registry.find((entry) => entry.slug === slug);

  if (!player) {
    notFound();
  }

  const d3PlayerId = getD3PlayerId(player);

  let leaderboardRows: D3Row[] = [];
  let fetchError: string | null = null;

  try {
    const data = await fetchPitchingLeaderboard(String(TARGET_YEAR), 3);
    leaderboardRows = Array.isArray(data) ? data : extractRows(data);
  } catch (err) {
    fetchError = String(err);
    console.error("[PlayerProfile] leaderboard fetch failed:", fetchError);
  }

  // ID-only match. No fuzzy/name fallback.
  const playerRow = d3PlayerId
    ? (leaderboardRows.find((row) => row.player_id === d3PlayerId) ?? null)
    : null;

  const seasonStats = playerRow
    ? buildSeasonStats(PITCHING_SNAPSHOT_METRICS, playerRow)
    : [];
  const d3Percentiles = playerRow
    ? buildD3Percentiles(
        PITCHING_PERCENTILE_METRICS,
        leaderboardRows,
        playerRow,
        playerRow,
      )
    : [];

  const isDev = process.env.NODE_ENV !== "production";
  const debugInfo = {
    foundRow: Boolean(playerRow),
    playerId: d3PlayerId ?? "Unresolved",
    leaderboardCount: leaderboardRows.length,
    sourceUsed: playerRow ? "leaderboard" : "none",
    error: fetchError,
  };

  // Always log in server logs (visible in Vercel function logs)
  console.log("[PlayerProfile]", player.name, debugInfo);

  const statsUnavailable = !playerRow && d3PlayerId != null && fetchError != null;

  const roleLabel =
    player.role.length > 0
      ? `${player.role.charAt(0).toUpperCase()}${player.role.slice(1)}`
      : player.role;
  const seasonNote = undefined;

  const trackmanIndex = await loadTrackmanIndex();
  const trackmanSessions = trackmanIndex
    .filter((entry) => entry.playerSlug === player.slug && entry.date)
    .map((entry) => {
      const date = entry.date ?? "";
      const dateSlug = date.replace(/-/g, "_");
      const rawLabel = entry.sessionType ?? "Session";
      const sessionLabel = rawLabel
        .split(/[_-]/g)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return {
        date,
        dateSlug,
        sessionLabel: sessionLabel || "Session",
      };
    });

  // Command outings from dataIndex — match by normalized name
  const normName = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
  const diPlayer = dataIndexPlayers.find(
    (p) => normName(p.name) === normName(player.name),
  );
  const commandOutings = (diPlayer?.outings ?? []).map((o) => {
    const dateId = o.id.split("/")[1] ?? "";
    return {
      outingId: o.id,
      playerId: diPlayer!.id,
      dateId,
      label: o.label,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <Link
          href="/players"
          className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700 transition-colors hover:text-zinc-400"
        >
          Roster
        </Link>

        <header className="mt-6 pb-8">
          <h1 className="text-[32px] font-black tracking-tight text-white">
            {player.name}
          </h1>
          <p className="mt-1 text-[12px] font-bold uppercase tracking-[0.2em] text-zinc-600">
            {player.team}
            <span className="mx-3 text-zinc-800">/</span>
            {roleLabel}
            <span className="mx-3 text-zinc-800">/</span>
            {TARGET_YEAR}
          </p>
        </header>

        {statsUnavailable && (
          <div className="mb-4 rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-400">
            2025 stats temporarily unavailable. Check back soon.
          </div>
        )}

        {!d3PlayerId && (
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
            No 2025 stats available
          </div>
        )}

        {isDev && (
          <details className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 text-xs text-zinc-500">
            <summary className="cursor-pointer font-mono">Debug info</summary>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}

        <PlayerProfileTabs
          seasonStats={seasonStats}
          seasonYear={TARGET_YEAR}
          seasonNote={seasonNote}
          d3Percentiles={d3Percentiles}
          trackmanSessions={trackmanSessions}
          commandOutings={commandOutings}
          playerSlug={player.slug}
        />
      </div>
    </main>
  );
}
