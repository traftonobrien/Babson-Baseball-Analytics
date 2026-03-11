import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import path from "path";
import { promises as fs } from "fs";
import { and, eq, ne } from "drizzle-orm";
import rosterData from "@/data/roster.json";
import { db } from "@/db";
import { stuffPlusArsenal } from "@/db/schema";
import { fetchBattingLeaderboard, fetchPitchingLeaderboard } from "@/lib/d3db";
import { getHand } from "@/lib/canonicalPlayers";
import {
  buildCommandPlusBaselines,
  computeCommandPlus,
  type CommandPlusResult,
} from "@/lib/commandPlus";
import { handBadgeClasses } from "@/lib/handBadge";
import { players as dataIndexPlayers } from "@/lib/dataIndex";
import { readMechanicsIndex, getMechanicsForPlayer } from "@/lib/mechanics/registry";
import { parsePitchCsvText } from "@/lib/pitchCsv";
import {
  computePitchingPlus,
  type PitchingPlusResult,
} from "@/lib/pitchingPlus";
import { getPlayerBySlug, type PlayerRegistryEntry } from "@/lib/playerRegistry";
import { seasonFromDateId } from "@/lib/season";
import { buildStuffPlusLookupCandidates } from "@/lib/stuffPlusLookup";
import {
  LeaderboardPageFrame,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import PlayerProfileTabs from "./PlayerProfileTabs";
import { loadChartingPlayerProfile } from "@/lib/charting/playerProfile";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type D3Row = Record<string, unknown>;

type TrackmanIndexEntry = {
  playerSlug?: string;
  date?: string;
  sessionType?: string | null;
};

type StuffPlusProfilePitch = {
  pitchType: string;
  meanStuffPlus: number | null;
  nSessions: number | null;
};

type StuffPlusProfileData = {
  lookupPlayerId: string | null;
  pitches: StuffPlusProfilePitch[];
};

type CommandHeroSummary = {
  playerId: string;
  score: number | null;
  season: number | null;
  outingCount: number;
  pitchCount: number;
};

type PitchingProfileModel = {
  ready: boolean;
  overall: number | null;
  note: string;
  result: PitchingPlusResult | null;
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

type ProfileMode = "pitcher" | "hitter" | "two-way";

const TARGET_YEAR = 2025;


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

async function loadStuffPlusProfileData(
  candidates: string[],
): Promise<StuffPlusProfileData> {
  for (const candidate of candidates) {
    try {
      const rows = await db
        .select()
        .from(stuffPlusArsenal)
        .where(
          and(
            eq(stuffPlusArsenal.playerId, candidate),
            ne(stuffPlusArsenal.pitchType, "Other"),
          ),
        );

      if (rows.length === 0) continue;

      return {
        lookupPlayerId: candidate,
        pitches: rows.map((row) => ({
          pitchType: row.pitchType,
          meanStuffPlus: row.meanStuffPlus,
          nSessions: row.nSessions,
        })),
      };
    } catch (error) {
      console.error("[PlayerProfile] stuff+ load failed:", candidate, error);
    }
  }

  return {
    lookupPlayerId: candidates[0] ?? null,
    pitches: [],
  };
}

const loadPublicPitchCsv = cache(async (publicPath: string) => {
  try {
    const relativePath = publicPath.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", relativePath);
    const raw = await fs.readFile(filePath, "utf-8");
    return parsePitchCsvText(raw);
  } catch (error) {
    console.error("[PlayerProfile] command csv load failed:", publicPath, error);
    return [];
  }
});

const loadSeasonCommandBaselines = cache(async (season: number) => {
  const seasonCsvPaths = dataIndexPlayers.flatMap((player) =>
    player.outings
      .filter((outing) => {
        const dateId = outing.id.split("/")[1] ?? "";
        return seasonFromDateId(dateId) === season;
      })
      .map((outing) => outing.csvPath),
  );

  const arrays = await Promise.all(seasonCsvPaths.map((csvPath) => loadPublicPitchCsv(csvPath)));
  return buildCommandPlusBaselines(arrays.flat());
});

function getD3PlayerId(player: PlayerRegistryEntry): string | null {
  return player.d3_player_id != null ? String(player.d3_player_id) : null;
}

function normalizePlayerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveProfileMode(player: PlayerRegistryEntry): ProfileMode {
  if (player.isTwoWay) {
    return "two-way";
  }
  return player.isPitcher ? "pitcher" : "hitter";
}

function findLeaderboardRow(
  leaderboardRows: D3Row[],
  player: PlayerRegistryEntry,
): D3Row | null {
  const d3PlayerId = getD3PlayerId(player);
  if (d3PlayerId) {
    const byId = leaderboardRows.find((row) => String(row.player_id ?? "") === d3PlayerId);
    if (byId) {
      return byId;
    }
  }

  const normalizedName = normalizePlayerName(player.name);
  return (
    leaderboardRows.find((row) => {
      const rowName = normalizePlayerName(String(row.player_name ?? row.name ?? ""));
      const rowTeam = normalizePlayerName(String(row.team_name ?? row.team ?? ""));
      return rowName === normalizedName && (!rowTeam || rowTeam === "babson");
    }) ?? null
  );
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
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const player = getPlayerBySlug(slug);

  if (!player) {
    notFound();
  }

  const profileMode = resolveProfileMode(player);
  const overviewMode = profileMode === "hitter" ? "hitting" : "pitching";

  let leaderboardRows: D3Row[] = [];
  let fetchError: string | null = null;

  try {
    const data =
      overviewMode === "pitching"
        ? await fetchPitchingLeaderboard(String(TARGET_YEAR), 3)
        : await fetchBattingLeaderboard(String(TARGET_YEAR), 3);
    leaderboardRows = Array.isArray(data) ? data : extractRows(data);
  } catch (err) {
    fetchError = String(err);
    console.error("[PlayerProfile] leaderboard fetch failed:", fetchError);
  }

  const playerRow = findLeaderboardRow(leaderboardRows, player);
  const snapshotMetrics =
    overviewMode === "pitching" ? PITCHING_SNAPSHOT_METRICS : BATTING_SNAPSHOT_METRICS;
  const percentileMetrics =
    overviewMode === "pitching" ? PITCHING_PERCENTILE_METRICS : BATTING_PERCENTILE_METRICS;

  const seasonStats = playerRow
    ? buildSeasonStats(snapshotMetrics, playerRow)
    : [];
  const d3Percentiles = playerRow
    ? buildD3Percentiles(
        percentileMetrics,
        leaderboardRows,
        playerRow,
        playerRow,
      )
    : [];

  const debugInfo = {
    foundRow: Boolean(playerRow),
    playerId: getD3PlayerId(player) ?? "Unresolved",
    leaderboardCount: leaderboardRows.length,
    sourceUsed: playerRow ? overviewMode : "none",
    error: fetchError,
  };

  // Always log in server logs (visible in Vercel function logs)
  console.log("[PlayerProfile]", player.name, debugInfo);

  const statsUnavailable = !playerRow && fetchError != null;
  const roleLabel = player.role;
  const seasonNote = undefined;
  const roster = rosterData as Record<string, { height?: string; weight?: string; class?: string }>;
  const rosterInfo = roster[player.slug];
  const throwHand =
    getHand(player.slug) ??
    (player.throws === "R" || player.throws === "L" ? player.throws : null);
  const handBadge =
    player.bats && player.throws
      ? `${player.bats}/${player.throws}`
      : throwHand
        ? player.isPitcher && !player.isHitter
          ? throwHand === "R"
            ? "RHP"
            : "LHP"
          : `T ${throwHand}`
        : null;
  const liveAbProfile = await loadChartingPlayerProfile(player.slug, {
    batterHand:
      player.bats === "R" || player.bats === "L" || player.bats === "S"
        ? player.bats
        : null,
  });

  const mechanicsIndex = await readMechanicsIndex();
  const mechanicsEntry = getMechanicsForPlayer(mechanicsIndex, {
    profileSlug: player.slug,
    playerName: player.name,
  });

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
      csvPath: o.csvPath,
    };
  });
  const stuffPlusCandidates = buildStuffPlusLookupCandidates([
    player.slug,
    diPlayer?.id ?? null,
  ]);
  const initialStuff = await loadStuffPlusProfileData(stuffPlusCandidates);
  const latestCommandSeason =
    commandOutings
      .map((outing) => seasonFromDateId(outing.dateId))
      .filter((season): season is number => season != null)
      .sort((a, b) => b - a)[0] ?? null;

  let initialCommandHero: CommandHeroSummary | null = null;
  let initialCommandResult: CommandPlusResult | null = null;
  let initialPitchingModel: PitchingProfileModel = {
    ready: false,
    overall: null,
    note: commandOutings.length > 0 ? "Missing live command variable" : "No live command outings yet",
    result: null,
  };

  if (diPlayer?.id && latestCommandSeason != null) {
    const latestSeasonOutings = commandOutings.filter(
      (outing) => seasonFromDateId(outing.dateId) === latestCommandSeason,
    );
    const latestSeasonPitchArrays = await Promise.all(
      latestSeasonOutings.map((outing) => loadPublicPitchCsv(outing.csvPath)),
    );
    const latestSeasonPitches = latestSeasonPitchArrays.flat();
    const latestSeasonBaselines = await loadSeasonCommandBaselines(latestCommandSeason);
    const commandResult = computeCommandPlus(latestSeasonPitches, latestSeasonBaselines);
    initialCommandResult = commandResult;
    const measuredPitchCount = commandResult.pitchTypeScores.reduce(
      (sum, row) => sum + row.subjectCount,
      0,
    );

    initialCommandHero = {
      playerId: diPlayer.id,
      score: commandResult.overall,
      season: latestCommandSeason,
      outingCount: latestSeasonOutings.length,
      pitchCount: measuredPitchCount,
    };

    const pitchingResult = computePitchingPlus(
      initialStuff.lookupPlayerId ?? player.slug,
      commandResult,
      initialStuff.pitches,
    );

    if (!pitchingResult.ready || pitchingResult.overall == null) {
      initialPitchingModel = {
        ready: false,
        overall: null,
        note:
          pitchingResult.reason === "missing_live_command"
            ? "Missing live command variable"
            : pitchingResult.reason === "missing_stuff"
              ? "Missing Stuff+ variable"
              : "No clean pitch overlap yet",
        result: pitchingResult,
      };
    } else {
      initialPitchingModel = {
        ready: true,
        overall: pitchingResult.overall,
        note: `${pitchingResult.overlapPitchTypeCount} pitch type${pitchingResult.overlapPitchTypeCount === 1 ? "" : "s"} | ${pitchingResult.overlapPitchCount} live pitch${pitchingResult.overlapPitchCount === 1 ? "" : "es"} in ${latestCommandSeason}`,
        result: pitchingResult,
      };
    }
  }

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <div className="mx-auto w-full">
        <Link
          href="/players"
          className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition-smooth hover:border-zinc-700 hover:text-zinc-200"
        >
          Back To Roster
        </Link>

        <header className="mt-6">
          <div className="relative overflow-hidden rounded-[2.1rem] border border-emerald-500/18 bg-zinc-950/82 p-6 shadow-[0_28px_70px_rgba(0,0,0,0.30)] sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,0.16),transparent_26%),radial-gradient(circle_at_84%_20%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <LeaderboardPill tone="emerald">Player Profile</LeaderboardPill>
                {handBadge && throwHand && (
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${handBadgeClasses(throwHand)}`}
                  >
                    {handBadge}
                  </span>
                )}
              </div>

              <h1 className="mt-5 text-[34px] font-black tracking-tight text-white sm:text-[3rem] sm:leading-[1.02]">
                {player.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <LeaderboardPill tone="neutral">{player.team}</LeaderboardPill>
                <LeaderboardPill tone="neutral">{roleLabel}</LeaderboardPill>
                <LeaderboardPill tone="neutral">{TARGET_YEAR}</LeaderboardPill>
                {player.positions.length > 0 && (
                  <LeaderboardPill tone="neutral">{player.positions.join(" / ")}</LeaderboardPill>
                )}
                {(rosterInfo?.height || rosterInfo?.weight || rosterInfo?.class || player.academicYear) && (
                  <LeaderboardPill tone="neutral">
                    {[
                      rosterInfo?.height,
                      rosterInfo?.weight && `${rosterInfo.weight} lbs`,
                      rosterInfo?.class ?? player.academicYear,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </LeaderboardPill>
                )}
              </div>
            </div>
          </div>
        </header>

        {statsUnavailable && (
          <div className="mt-4 rounded-2xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            2025 {overviewMode} stats temporarily unavailable. Check back soon.
          </div>
        )}

        {!playerRow && !statsUnavailable && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
            No 2025 stats available
          </div>
        )}

        <PlayerProfileTabs
          profileMode={profileMode}
          percentileAudienceLabel={overviewMode === "pitching" ? "pitchers" : "hitters"}
          seasonStats={seasonStats}
          seasonYear={TARGET_YEAR}
          seasonNote={seasonNote}
          d3Percentiles={d3Percentiles}
          trackmanSessions={trackmanSessions}
          commandOutings={commandOutings}
          playerSlug={player.slug}
          initialCommandHero={initialCommandHero}
          initialCommandResult={initialCommandResult}
          initialPitchingModel={initialPitchingModel}
          initialStuffLookupPlayerId={initialStuff.lookupPlayerId}
          initialStuffPitches={initialStuff.pitches}
          initialTab={initialTab}
          mechanicsEntry={mechanicsEntry ?? null}
          liveAbProfile={liveAbProfile}
        />
      </div>
    </LeaderboardPageFrame>
  );
}
