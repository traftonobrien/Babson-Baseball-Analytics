type LeaderboardRow = Record<string, unknown>;

export type MetricDefinition = {
  id: string;
  label: string;
  higherBetter: boolean;
  format: (value: number | null) => string;
  valueKeys?: string[];
  percentileKeys?: string[];
  derive?: (row: LeaderboardRow) => number | null;
};

export type PercentileMetric = {
  label: string;
  value: string;
  percentile: number | null;
  note?: string;
};

// ---------------------------------------------------------------------------
// Key candidate maps
// ---------------------------------------------------------------------------

export const PITCHING_KEYS = {
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

export const BATTING_KEYS = {
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

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

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

export function getNumberByCandidates(row: LeaderboardRow, candidates: string[]): number | null {
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

export function extractRows(payload: unknown): LeaderboardRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as LeaderboardRow[];
  if (typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const directKeys = ["data", "rows", "players", "results", "leaderboard"];
  for (const key of directKeys) {
    if (Array.isArray(record[key])) return record[key] as LeaderboardRow[];
  }
  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    for (const key of directKeys) {
      if (Array.isArray(nested[key])) return nested[key] as LeaderboardRow[];
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

export function getMetricValue(row: LeaderboardRow, metric: MetricDefinition): number | null {
  if (metric.derive) {
    const derived = metric.derive(row);
    if (derived != null) return derived;
  }
  if (metric.valueKeys) return getNumberByCandidates(row, metric.valueKeys);
  return null;
}

export function getPercentileValue(row: LeaderboardRow, metric: MetricDefinition): number | null {
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

// ---------------------------------------------------------------------------
// Metric definitions
// ---------------------------------------------------------------------------

export const PITCHING_SNAPSHOT_METRICS: MetricDefinition[] = [
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

export const PITCHING_PERCENTILE_METRICS: MetricDefinition[] = [
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

export const BATTING_SNAPSHOT_METRICS: MetricDefinition[] = [
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

export const BATTING_PERCENTILE_METRICS: MetricDefinition[] = [
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

// ---------------------------------------------------------------------------
// Stat / percentile builders
// ---------------------------------------------------------------------------

export function buildSeasonStats(
  metrics: MetricDefinition[],
  statsSource: LeaderboardRow,
): { label: string; value: string }[] {
  return metrics.map((metric) => {
    const value = getMetricValue(statsSource, metric);
    return {
      label: metric.label,
      value: metric.format(value),
    };
  });
}

export function buildSeasonPercentiles(
  metrics: MetricDefinition[],
  leaderboardRows: LeaderboardRow[],
  statsSource: LeaderboardRow,
  percentileRow: LeaderboardRow,
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
        note = "Computed (vs NCAA)";
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
