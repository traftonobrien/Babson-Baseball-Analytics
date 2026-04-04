type LeaderboardRow = Record<string, unknown>;

export type LuckConfidence = "low" | "medium" | "high";
export type LuckDirection = "lucky" | "unlucky" | "neutral";

export interface LuckComponent {
  id: string;
  label: string;
  weight: number;
  /** Clamped to [-2, +2]. Positive = lucky for this player. */
  raw: number;
  contribution: number;
}

export interface LuckIndexResult {
  score: number;
  label: string;
  direction: LuckDirection;
  confidence: LuckConfidence;
  components: LuckComponent[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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

function getNumberByCandidates(row: LeaderboardRow, candidates: string[]): number | null {
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

export function luckLabel(score: number): string {
  if (score < 70) return "Very Unlucky";
  if (score < 85) return "Unlucky";
  if (score < 95) return "Slightly Unlucky";
  if (score <= 105) return "Neutral";
  if (score <= 115) return "Slightly Lucky";
  if (score <= 130) return "Lucky";
  return "Very Lucky";
}

function luckDirection(score: number): LuckDirection {
  if (score > 105) return "lucky";
  if (score < 95) return "unlucky";
  return "neutral";
}

export function luckBadgeClasses(
  result: LuckIndexResult,
  _playerType: "pitcher" | "hitter"
): string {
  const { direction } = result;
  if (direction === "neutral") {
    return "border-slate-200 bg-gradient-to-b from-slate-50 to-slate-100 text-slate-700 shadow-sm dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-800 dark:text-zinc-200 dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]";
  }
  if (direction === "lucky") {
    return "border-emerald-200 bg-gradient-to-b from-emerald-50 to-emerald-100 text-emerald-800 shadow-sm dark:border-emerald-500/35 dark:from-emerald-950/70 dark:to-emerald-900/80 dark:text-emerald-200 dark:shadow-[0_10px_24px_rgba(6,95,70,0.3)]";
  }
  return "border-rose-200 bg-gradient-to-b from-rose-50 to-rose-100 text-rose-800 shadow-sm dark:border-rose-500/35 dark:from-rose-950/70 dark:to-rose-900/80 dark:text-rose-200 dark:shadow-[0_10px_24px_rgba(136,19,55,0.32)]";
}

function buildScore(
  components: Array<{ weight: number; raw: number }>
): number {
  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 100;
  const weightedSum = components.reduce((sum, c) => sum + c.weight * c.raw, 0);
  const finalRaw = weightedSum / totalWeight;
  return clamp(100 + finalRaw * 25, 30, 170);
}

// ---------------------------------------------------------------------------
// Pitcher Luck Index — computed from NCAA leaderboard row
// ---------------------------------------------------------------------------

export function computePitcherLuckIndex(
  row: LeaderboardRow
): LuckIndexResult | null {
  const ipFloat =
    getNumberByCandidates(row, ["ip_float"]) ??
    getNumberByCandidates(row, ["ip", "innings", "innings_pitched"]);
  if (!ipFloat || ipFloat < 5) return null;

  const era = getNumberByCandidates(row, ["era"]);
  const fip = getNumberByCandidates(row, ["fip"]);
  const xfip = getNumberByCandidates(row, ["xfip", "x_fip"]);
  const siera = getNumberByCandidates(row, ["siera"]);

  const h = getNumberByCandidates(row, ["h"]);
  const bb = getNumberByCandidates(row, ["bb"]);
  const so = getNumberByCandidates(row, ["so"]);
  const hb = getNumberByCandidates(row, ["hb", "hbp"]);
  const bf = getNumberByCandidates(row, ["bf"]);
  const hrA = getNumberByCandidates(row, ["hr_a", "hra", "hr"]);
  const babipValue = getNumberByCandidates(row, ["babip"]);
  const lobPct = getNumberByCandidates(row, ["lob_pct", "lobpct", "lobPercent", "lobPct"]);
  const hrFbPct = getNumberByCandidates(row, ["hr_fb_pct", "hrfb_pct", "hr_fb", "hr_fly_ball_pct", "hrFbPct"]);

  const components: Array<{ id: string; label: string; weight: number; raw: number }> = [];

  // 1. ERA vs FIP Spread
  if (era !== null && fip !== null) {
    const raw = clamp((fip - era) / 1.25, -2, 2);
    components.push({ id: "era_fip", label: "ERA vs FIP", weight: 0.26, raw });
  }

  // 2. ERA vs xFIP
  if (era !== null && xfip !== null && xfip > 0) {
    const raw = clamp((xfip - era) / 1.2, -2, 2);
    components.push({ id: "era_xfip", label: "ERA vs xFIP", weight: 0.20, raw });
  }

  // 3. ERA vs SIERA
  if (era !== null && siera !== null && siera > 0) {
    const raw = clamp((siera - era) / 1.15, -2, 2);
    components.push({ id: "era_siera", label: "ERA vs SIERA", weight: 0.18, raw });
  }

  // 4. BABIP vs Baseline
  if (babipValue !== null && babipValue > 0) {
    const raw = clamp((0.295 - babipValue) / 0.085, -2, 2);
    components.push({ id: "babip", label: "BABIP vs Baseline", weight: 0.14, raw });
  } else if (h !== null && hrA !== null && bf !== null && bb !== null && so !== null) {
    const hbSafe = hb ?? 0;
    const denominator = bf - bb - so - hbSafe - hrA;
    if (denominator > 0) {
      const babip = (h - hrA) / denominator;
      const raw = clamp((0.295 - babip) / 0.085, -2, 2);
      components.push({ id: "babip", label: "BABIP vs Baseline", weight: 0.14, raw });
    }
  }

  // 5. Strand-rate variance
  if (lobPct !== null && lobPct > 0) {
    const raw = clamp((lobPct - 72) / 8, -2, 2);
    components.push({ id: "lob_pct", label: "LOB% vs Baseline", weight: 0.12, raw });
  }

  // 6. Home-run variance on fly balls
  if (hrFbPct !== null && hrFbPct > 0) {
    const raw = clamp((10.5 - hrFbPct) / 6, -2, 2);
    components.push({ id: "hr_fb_pct", label: "HR/FB% vs Baseline", weight: 0.10, raw });
  }

  if (components.length === 0) return null;

  const confidence: LuckConfidence =
    ipFloat >= 40 && components.length >= 5
      ? "high"
      : ipFloat >= 20 && components.length >= 3
        ? "medium"
        : "low";

  const score = buildScore(components);
  const label = luckLabel(score);
  const direction = luckDirection(score);

  return {
    score,
    label,
    direction,
    confidence,
    components: components.map((c) => ({
      id: c.id,
      label: c.label,
      weight: c.weight,
      raw: c.raw,
      contribution: c.weight * c.raw,
    })),
  };
}

// ---------------------------------------------------------------------------
// Hitter Luck Index — computed from NCAA leaderboard row
// ---------------------------------------------------------------------------

export function computeHitterLuckIndex(
  row: LeaderboardRow
): LuckIndexResult | null {
  const pa = getNumberByCandidates(row, ["pa"]);
  if (!pa || pa < 15) return null;

  const confidence: LuckConfidence =
    pa >= 60 ? "high" : pa >= 30 ? "medium" : "low";

  const avg = getNumberByCandidates(row, ["avg", "ba", "batting_avg"]);
  const obp = getNumberByCandidates(row, ["obp", "on_base_percentage"]);
  const bbPct = getNumberByCandidates(row, ["bb_pct", "bb_percent"]);
  const h = getNumberByCandidates(row, ["h"]);
  const ab = getNumberByCandidates(row, ["ab"]);
  const so = getNumberByCandidates(row, ["so"]);
  const hr = getNumberByCandidates(row, ["hr", "home_runs"]);
  const sf = getNumberByCandidates(row, ["sf"]);

  const components: Array<{ id: string; label: string; weight: number; raw: number }> = [];

  // 1. BABIP vs Baseline (70%)
  //    High BABIP = lucky (balls finding holes)
  //    BABIP = (H - HR) / (AB - K - HR + SF)
  if (h !== null && hr !== null && ab !== null && so !== null) {
    const sfSafe = sf ?? 0;
    const denominator = ab - so - hr + sfSafe;
    if (denominator > 0) {
      const babip = (h - hr) / denominator;
      const raw = clamp((babip - 0.295) / 0.080, -2, 2);
      components.push({ id: "babip", label: "BABIP vs Baseline", weight: 0.70, raw });
    }
  }

  // 2. OBP vs Proxy (30%)
  //    proxy_obp = avg + (bb_pct / 100)
  //    If actual OBP > proxy → lucky (extra value beyond H+BB)
  if (avg !== null && obp !== null && bbPct !== null) {
    const proxyObp = avg + bbPct / 100;
    const raw = clamp((obp - proxyObp) / 0.04, -2, 2);
    components.push({ id: "obp", label: "OBP vs Proxy", weight: 0.30, raw });
  }

  if (components.length === 0) return null;

  const score = buildScore(components);
  const label = luckLabel(score);
  const direction = luckDirection(score);

  return {
    score,
    label,
    direction,
    confidence,
    components: components.map((c) => ({
      id: c.id,
      label: c.label,
      weight: c.weight,
      raw: c.raw,
      contribution: c.weight * c.raw,
    })),
  };
}
