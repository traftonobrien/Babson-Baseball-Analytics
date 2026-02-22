import type { MetricResult, NotesJson } from "./types";

export interface RankedMetric {
  key: string;
  metric: MetricResult;
  rank: number;
}

/**
 * Returns official metrics sorted by impact:
 *   1. score_eff ascending (worst first — highest impact issues)
 *   2. confidence descending (higher confidence surfaces when scores are tied)
 * Only includes metrics with status === "ok".
 */
export function getMetricsByImpact(notes: NotesJson): RankedMetric[] {
  const keys = notes.official_metrics.filter((k) => {
    const m = notes.metrics[k];
    return m && m.status === "ok";
  });

  return keys
    .map((key) => ({ key, metric: notes.metrics[key] }))
    .sort((a, b) => {
      const effA = a.metric.score_eff ?? a.metric.score ?? 10;
      const effB = b.metric.score_eff ?? b.metric.score ?? 10;
      if (Math.abs(effA - effB) > 0.001) return effA - effB;
      const confA = a.metric.confidence ?? 0;
      const confB = b.metric.confidence ?? 0;
      return confB - confA;
    })
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

/** Top N highest-impact metrics (lowest score_eff first). */
export function getTopInsights(notes: NotesJson, n = 3): RankedMetric[] {
  return getMetricsByImpact(notes).slice(0, n);
}

/**
 * Aggregated confidence across official metrics with status === "ok".
 * Returns null if no measurable metrics exist.
 */
export function getAggregateConfidence(notes: NotesJson): number | null {
  const confs = notes.official_metrics
    .map((k) => notes.metrics[k])
    .filter((m): m is MetricResult => !!m && m.status === "ok")
    .map((m) => m.confidence)
    .filter((c): c is number => c !== null);

  if (confs.length === 0) return null;
  return confs.reduce((sum, c) => sum + c, 0) / confs.length;
}

/** Pass/Fail counts for official metrics with status === "ok". */
export function getPassFailCounts(notes: NotesJson): { pass: number; fail: number } {
  let pass = 0;
  let fail = 0;
  for (const k of notes.official_metrics) {
    const m = notes.metrics[k];
    if (!m || m.status !== "ok") continue;
    if (m.pass_fail === true) pass++;
    else if (m.pass_fail === false) fail++;
  }
  return { pass, fail };
}

/**
 * Returns true if more than half of measurable official metrics are low confidence.
 */
export function isMajorityLowConfidence(notes: NotesJson): boolean {
  const official = notes.official_metrics.filter((k) => {
    const m = notes.metrics[k];
    return m && m.status === "ok";
  });
  if (official.length === 0) return false;
  const lowCount = official.filter((k) => notes.metrics[k].low_confidence).length;
  return lowCount / official.length > 0.5;
}
