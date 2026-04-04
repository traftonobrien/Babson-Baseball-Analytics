import { describe, expect, it } from "vitest";
import {
  computePitcherLuckIndex,
  luckBadgeClasses,
} from "./luckIndex";

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
