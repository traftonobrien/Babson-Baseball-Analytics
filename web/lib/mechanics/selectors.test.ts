import { describe, it, expect } from "vitest";
import {
  getMetricsByImpact,
  getTopInsights,
  getAggregateConfidence,
  getPassFailCounts,
  isMajorityLowConfidence,
} from "./selectors";
import type { NotesJson, MetricResult } from "./types";

function makeMetric(overrides: Partial<MetricResult> = {}): MetricResult {
  return {
    status: "ok",
    raw_value: 1.0,
    unit: "test",
    score: 5.0,
    score_raw: 5.0,
    score_eff: 5.0,
    pass_fail: true,
    callout: null,
    confidence: 0.8,
    low_confidence: false,
    reasons: [],
    coaching_cues: [],
    ...overrides,
  };
}

function makeNotes(metrics: Record<string, MetricResult>, official?: string[]): NotesJson {
  return {
    efficiency_score: 5.0,
    efficiency_low_confidence: false,
    hand: "R",
    view_mode: "open_side",
    metrics,
    phases: {},
    camera_limitations: [],
    limitations: {
      camera_view: "open_side",
      not_measurable: [],
      low_confidence_metrics: [],
    },
    official_metric_set: "test_v1",
    official_metrics: official ?? Object.keys(metrics),
  };
}

// ---------------------------------------------------------------------------
// getMetricsByImpact
// ---------------------------------------------------------------------------
describe("getMetricsByImpact", () => {
  it("sorts by score_eff ascending (lowest first)", () => {
    const notes = makeNotes({
      a: makeMetric({ score_eff: 8.0 }),
      b: makeMetric({ score_eff: 2.0 }),
      c: makeMetric({ score_eff: 5.0 }),
    });
    const result = getMetricsByImpact(notes);
    expect(result.map((r) => r.key)).toEqual(["b", "c", "a"]);
  });

  it("breaks ties by confidence descending", () => {
    const notes = makeNotes({
      x: makeMetric({ score_eff: 4.0, confidence: 0.3 }),
      y: makeMetric({ score_eff: 4.0, confidence: 0.8 }),
    });
    const result = getMetricsByImpact(notes);
    // y has higher confidence — surfaces first when scores are equal
    expect(result[0].key).toBe("y");
    expect(result[1].key).toBe("x");
  });

  it("excludes metrics with status !== ok", () => {
    const notes = makeNotes({
      good: makeMetric({ score_eff: 3.0 }),
      bad: makeMetric({ status: "insufficient_data", score_eff: 1.0 }),
    });
    const result = getMetricsByImpact(notes);
    expect(result.map((r) => r.key)).toEqual(["good"]);
  });

  it("only includes official_metrics", () => {
    const notes = makeNotes(
      {
        a: makeMetric({ score_eff: 2.0 }),
        b: makeMetric({ score_eff: 4.0 }),
        c: makeMetric({ score_eff: 1.0 }), // not official
      },
      ["a", "b"],
    );
    const result = getMetricsByImpact(notes);
    expect(result.map((r) => r.key)).toEqual(["a", "b"]);
  });

  it("assigns rank starting at 1", () => {
    const notes = makeNotes({
      a: makeMetric({ score_eff: 1.0 }),
      b: makeMetric({ score_eff: 3.0 }),
    });
    const [first, second] = getMetricsByImpact(notes);
    expect(first.rank).toBe(1);
    expect(second.rank).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// getTopInsights
// ---------------------------------------------------------------------------
describe("getTopInsights", () => {
  it("returns top N by default 3", () => {
    const notes = makeNotes({
      a: makeMetric({ score_eff: 1 }),
      b: makeMetric({ score_eff: 2 }),
      c: makeMetric({ score_eff: 3 }),
      d: makeMetric({ score_eff: 4 }),
    });
    const top = getTopInsights(notes);
    expect(top).toHaveLength(3);
    expect(top.map((r) => r.key)).toEqual(["a", "b", "c"]);
  });

  it("respects custom n", () => {
    const notes = makeNotes({
      a: makeMetric({ score_eff: 1 }),
      b: makeMetric({ score_eff: 2 }),
    });
    expect(getTopInsights(notes, 1)).toHaveLength(1);
    expect(getTopInsights(notes, 5)).toHaveLength(2); // only 2 available
  });
});

// ---------------------------------------------------------------------------
// getAggregateConfidence
// ---------------------------------------------------------------------------
describe("getAggregateConfidence", () => {
  it("averages confidence across ok metrics", () => {
    const notes = makeNotes({
      a: makeMetric({ confidence: 0.8 }),
      b: makeMetric({ confidence: 0.4 }),
    });
    expect(getAggregateConfidence(notes)).toBeCloseTo(0.6);
  });

  it("returns null when no ok metrics exist", () => {
    const notes = makeNotes({
      a: makeMetric({ status: "skipped", confidence: 0.8 }),
    });
    expect(getAggregateConfidence(notes)).toBeNull();
  });

  it("ignores null confidence values", () => {
    const notes = makeNotes({
      a: makeMetric({ confidence: 0.6 }),
      b: makeMetric({ confidence: null }),
    });
    expect(getAggregateConfidence(notes)).toBeCloseTo(0.6);
  });
});

// ---------------------------------------------------------------------------
// getPassFailCounts
// ---------------------------------------------------------------------------
describe("getPassFailCounts", () => {
  it("counts pass and fail correctly", () => {
    const notes = makeNotes({
      a: makeMetric({ pass_fail: true }),
      b: makeMetric({ pass_fail: false }),
      c: makeMetric({ pass_fail: true }),
      d: makeMetric({ pass_fail: null }),
    });
    expect(getPassFailCounts(notes)).toEqual({ pass: 2, fail: 1 });
  });

  it("ignores non-ok metrics", () => {
    const notes = makeNotes({
      a: makeMetric({ pass_fail: false }),
      b: makeMetric({ status: "insufficient_data", pass_fail: false }),
    });
    expect(getPassFailCounts(notes)).toEqual({ pass: 0, fail: 1 });
  });
});

// ---------------------------------------------------------------------------
// isMajorityLowConfidence
// ---------------------------------------------------------------------------
describe("isMajorityLowConfidence", () => {
  it("returns true when >50% are low confidence", () => {
    const notes = makeNotes({
      a: makeMetric({ low_confidence: true }),
      b: makeMetric({ low_confidence: true }),
      c: makeMetric({ low_confidence: false }),
    });
    expect(isMajorityLowConfidence(notes)).toBe(true);
  });

  it("returns false when <=50% are low confidence", () => {
    const notes = makeNotes({
      a: makeMetric({ low_confidence: true }),
      b: makeMetric({ low_confidence: false }),
      c: makeMetric({ low_confidence: false }),
    });
    expect(isMajorityLowConfidence(notes)).toBe(false);
  });

  it("returns false when no metrics", () => {
    const notes = makeNotes({});
    expect(isMajorityLowConfidence(notes)).toBe(false);
  });
});
