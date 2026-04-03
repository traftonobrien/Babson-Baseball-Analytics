import { getNumberByCandidates } from "@/app/players/[slug]/_lib/metrics";

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
  playerType: "pitcher" | "hitter"
): string {
  const { direction } = result;
  if (direction === "neutral") {
    return "border-slate-200 bg-slate-100 text-slate-600 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300";
  }
  if (playerType === "pitcher") {
    // Lucky pitcher: results likely to regress → amber warning
    // Unlucky pitcher: process better than results → green
    if (direction === "lucky") {
      return "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300";
    }
    return "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  // Hitter: lucky = green, unlucky = amber
  if (direction === "lucky") {
    return "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  return "border-amber-300/60 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-300";
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

  const confidence: LuckConfidence =
    ipFloat >= 40 ? "high" : ipFloat >= 20 ? "medium" : "low";

  const era = getNumberByCandidates(row, ["era"]);
  const fip = getNumberByCandidates(row, ["fip"]);

  const h = getNumberByCandidates(row, ["h"]);
  const bb = getNumberByCandidates(row, ["bb"]);
  const so = getNumberByCandidates(row, ["so"]);
  const hb = getNumberByCandidates(row, ["hb", "hbp"]);
  const bf = getNumberByCandidates(row, ["bf"]);
  const hrA = getNumberByCandidates(row, ["hr_a", "hra", "hr"]);

  const components: Array<{ id: string; label: string; weight: number; raw: number }> = [];

  // 1. ERA vs FIP Spread (60%) — FIP is the gold-standard luck separator
  //    FIP < ERA → pitcher unlucky (process better than results)
  //    raw = (fip - era) / 1.5  → negative when ERA > FIP → score < 100 = unlucky
  if (era !== null && fip !== null) {
    const raw = clamp((fip - era) / 1.5, -2, 2);
    components.push({ id: "era_fip", label: "ERA vs FIP", weight: 0.60, raw });
  }

  // 2. BABIP vs Baseline (40%)
  //    Low BABIP against = lucky (balls finding gloves)
  //    Compute from counting stats: (H - HR) / (BF - BB - K - HBP - HR)
  if (h !== null && hrA !== null && bf !== null && bb !== null && so !== null) {
    const hbSafe = hb ?? 0;
    const denominator = bf - bb - so - hbSafe - hrA;
    if (denominator > 0) {
      const babip = (h - hrA) / denominator;
      const raw = clamp((0.295 - babip) / 0.090, -2, 2);
      components.push({ id: "babip", label: "BABIP vs Baseline", weight: 0.40, raw });
    }
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
