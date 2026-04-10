import { describe, expect, it } from "vitest";
import {
  computeHitterLuckIndex,
  computePitcherLuckIndex,
  luckBadgeClasses,
  luckLabel,
} from "./luckIndex";
import type { LuckIndexResult } from "./luckIndex";

// ---------------------------------------------------------------------------
// luckLabel
// ---------------------------------------------------------------------------

describe("luckLabel", () => {
  it("maps score ranges to correct labels", () => {
    expect(luckLabel(60)).toBe("Very Unlucky");
    expect(luckLabel(77)).toBe("Unlucky");
    expect(luckLabel(92)).toBe("Slightly Unlucky");
    expect(luckLabel(100)).toBe("Neutral");
    expect(luckLabel(110)).toBe("Slightly Lucky");
    expect(luckLabel(120)).toBe("Lucky");
    expect(luckLabel(140)).toBe("Very Lucky");
  });
});

// ---------------------------------------------------------------------------
// computePitcherLuckIndex — null / sample
// ---------------------------------------------------------------------------

describe("computePitcherLuckIndex — null cases", () => {
  it("returns null for insufficient sample (< 5 IP)", () => {
    expect(computePitcherLuckIndex({ ip_float: 4, era: 2.0, fip: 4.0 })).toBeNull();
    expect(computePitcherLuckIndex({ ip_float: 0, era: 2.0, fip: 4.0 })).toBeNull();
  });

  it("returns null when no metrics are computable", () => {
    expect(computePitcherLuckIndex({ ip_float: 30 })).toBeNull();
    expect(computePitcherLuckIndex({})).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computePitcherLuckIndex — neutral case
// ---------------------------------------------------------------------------

describe("computePitcherLuckIndex — neutral case", () => {
  it("scores ≈ 100 when ERA = FIP and BABIP is at baseline (.295)", () => {
    const result = computePitcherLuckIndex({
      ip_float: 20,
      era: 3.50,
      fip: 3.50,   // zero spread → neutral
      babip: 0.295, // exactly at baseline → neutral
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBeCloseTo(100, 0);
    expect(result!.direction).toBe("neutral");
  });
});

// ---------------------------------------------------------------------------
// computePitcherLuckIndex — clamp [30, 170]
// ---------------------------------------------------------------------------

describe("computePitcherLuckIndex — clamp", () => {
  it("stays within [30, 170] for maximally lucky inputs", () => {
    const result = computePitcherLuckIndex({
      ip_float: 60,
      era: 0.10, fip: 10.0, xfip: 9.5, siera: 9.0,
      babip: 0.050, lob_pct: 99, hr_fb_pct: 0.1,
    });
    expect(result!.score).toBeGreaterThanOrEqual(30);
    expect(result!.score).toBeLessThanOrEqual(170);
  });

  it("stays within [30, 170] for maximally unlucky inputs", () => {
    const result = computePitcherLuckIndex({
      ip_float: 60,
      era: 15.0, fip: 1.5, xfip: 1.8, siera: 2.0,
      babip: 0.600, lob_pct: 25, hr_fb_pct: 40,
    });
    expect(result!.score).toBeGreaterThanOrEqual(30);
    expect(result!.score).toBeLessThanOrEqual(170);
  });
});

// ---------------------------------------------------------------------------
// computeHitterLuckIndex
// ---------------------------------------------------------------------------

describe("computeHitterLuckIndex — null cases", () => {
  it("returns null for insufficient sample (< 15 PA)", () => {
    expect(
      computeHitterLuckIndex({ pa: 14, h: 4, ab: 13, so: 3, hr: 0, avg: 0.308, obp: 0.357, bb_pct: 7 })
    ).toBeNull();
    expect(computeHitterLuckIndex({ pa: 0 })).toBeNull();
  });

  it("returns null when no components can be computed", () => {
    expect(computeHitterLuckIndex({ pa: 20 })).toBeNull();
  });
});

describe("computeHitterLuckIndex — unlucky hitter", () => {
  it("scores < 95 when BABIP well below baseline (.240)", () => {
    // BABIP = (9-2)/(40-8-2+0) = 7/30 ≈ 0.233 → below .295 → unlucky
    const result = computeHitterLuckIndex({
      pa: 45,
      h: 9, ab: 40, so: 8, hr: 2, sf: 0,
      avg: 9 / 40,
      obp: 0.310,
      bb_pct: 7,
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBeLessThan(95);
    expect(result!.direction).toBe("unlucky");
  });
});

describe("computeHitterLuckIndex — lucky hitter", () => {
  it("scores > 105 when BABIP well above baseline (.370)", () => {
    // BABIP = (13-2)/(40-8-2+0) = 11/30 ≈ 0.367 → above .295 → lucky
    const result = computeHitterLuckIndex({
      pa: 45,
      h: 13, ab: 40, so: 8, hr: 2, sf: 0,
      avg: 13 / 40,
      obp: 0.400,
      bb_pct: 10,
    });
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThan(105);
    expect(result!.direction).toBe("lucky");
  });
});

describe("computeHitterLuckIndex — clamp [30, 170]", () => {
  it("stays within [30, 170] for extreme positive inputs", () => {
    const result = computeHitterLuckIndex({
      pa: 60, h: 50, ab: 55, so: 2, hr: 0, sf: 0,
      avg: 50 / 55, obp: 0.920, bb_pct: 8,
    });
    expect(result!.score).toBeGreaterThanOrEqual(30);
    expect(result!.score).toBeLessThanOrEqual(170);
  });

  it("stays within [30, 170] for extreme negative inputs", () => {
    const result = computeHitterLuckIndex({
      pa: 60, h: 1, ab: 56, so: 25, hr: 0, sf: 0,
      avg: 1 / 56, obp: 0.050, bb_pct: 2,
    });
    expect(result!.score).toBeGreaterThanOrEqual(30);
    expect(result!.score).toBeLessThanOrEqual(170);
  });
});

describe("computeHitterLuckIndex — confidence tiers", () => {
  const base = { h: 7, ab: 22, so: 5, hr: 1, sf: 0, avg: 7 / 22, obp: 0.350, bb_pct: 8 };
  it("low confidence for 15–29 PA", () => {
    expect(computeHitterLuckIndex({ ...base, pa: 20 })!.confidence).toBe("low");
  });
  it("medium confidence for 30–59 PA", () => {
    expect(computeHitterLuckIndex({ ...base, pa: 40 })!.confidence).toBe("medium");
  });
  it("high confidence for 60+ PA", () => {
    expect(computeHitterLuckIndex({ ...base, pa: 65 })!.confidence).toBe("high");
  });
});

// ---------------------------------------------------------------------------
// Original integration tests (kept)
// ---------------------------------------------------------------------------

describe("luckIndex", () => {
  it("uses every available advanced pitcher luck signal when present", () => {
    const result = computePitcherLuckIndex({
      ip_float: 41,
      era: 2.45,
      fip: 3.7,
      xfip: 3.95,
      siera: 3.55,
      babip: 0.248,
      lobPct: 81.2,
      hrFbPct: 6.4,
    });

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("high");
    expect(result?.direction).toBe("lucky");
    expect(result?.score).toBeGreaterThan(100);
    expect(result?.components.map((component) => component.id)).toEqual([
      "era_fip",
      "era_xfip",
      "era_siera",
      "babip",
      "lob_pct",
      "hr_fb_pct",
    ]);
  });

  it("flags unlucky pitchers when estimators and variance stats are worse than the results", () => {
    const result = computePitcherLuckIndex({
      ip_float: 28,
      era: 5.4,
      fip: 3.7,
      xfip: 3.45,
      siera: 3.55,
      babip: 0.352,
      lobPct: 61.5,
      hrFbPct: 17.4,
    });

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe("medium");
    expect(result?.direction).toBe("unlucky");
    expect(result?.score).toBeLessThan(100);
    expect(result?.label).toContain("Unlucky");
  });

  it("maps badge styles to red, gray, and green buckets", () => {
    expect(
      luckBadgeClasses(
        {
          score: 112,
          label: "Lucky",
          direction: "lucky",
          confidence: "medium",
          components: [],
        },
        "pitcher",
      ),
    ).toContain("emerald");

    expect(
      luckBadgeClasses(
        {
          score: 100,
          label: "Neutral",
          direction: "neutral",
          confidence: "medium",
          components: [],
        },
        "pitcher",
      ),
    ).toContain("slate");

    expect(
      luckBadgeClasses(
        {
          score: 84,
          label: "Unlucky",
          direction: "unlucky",
          confidence: "medium",
          components: [],
        },
        "pitcher",
      ),
    ).toContain("rose");
  });
});
