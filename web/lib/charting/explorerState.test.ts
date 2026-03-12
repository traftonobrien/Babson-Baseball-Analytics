import { describe, expect, it } from "vitest";
import {
  buildHitterExplorerQuery,
  buildPitcherExplorerQuery,
  normalizeComparisonView,
  readHitterExplorerQuery,
  readPitcherExplorerQuery,
} from "@/app/charting/insights/explorerState";

describe("explorerState", () => {
  it("defaults the comparison view to hitters", () => {
    expect(normalizeComparisonView(null)).toBe("hitters");
    expect(normalizeComparisonView("pitchers")).toBe("pitchers");
    expect(normalizeComparisonView("unknown")).toBe("hitters");
  });

  it("normalizes invalid hitter and pitcher event params back to all", () => {
    const hitterQuery = readHitterExplorerQuery(
      new URLSearchParams("event=balls&pitcherHand=R")
    );
    const pitcherQuery = readPitcherExplorerQuery(new URLSearchParams("event=avg"));

    expect(hitterQuery.event).toBe("all");
    expect(hitterQuery.pitcherHand).toBe("R");
    expect(pitcherQuery.event).toBe("all");
  });

  it("builds hitter queries with pitcher handedness preserved", () => {
    const query = new URLSearchParams(
      buildHitterExplorerQuery({
        playerSlug: "drazka_dylan",
        pitcherHand: "L",
        season: "2026",
        latestSeason: "2025",
        pitchType: "Slider",
        count: "1-2",
        event: "whiffs",
        veloMin: 84,
        veloMax: 90,
      })
    );

    expect(query.get("player")).toBe("drazka_dylan");
    expect(query.get("pitcherHand")).toBe("L");
    expect(query.get("season")).toBe("2026");
    expect(query.get("pitchType")).toBe("Slider");
    expect(query.get("count")).toBe("1-2");
    expect(query.get("event")).toBe("whiffs");
    expect(query.get("veloMin")).toBe("84");
    expect(query.get("veloMax")).toBe("90");
  });

  it("builds pitcher queries without a hitter-only handedness param", () => {
    const query = new URLSearchParams(
      buildPitcherExplorerQuery({
        playerSlug: "lapierre_anthony",
        season: "2026",
        latestSeason: "2025",
        pitchType: "Fastball",
        count: "0-0",
        event: "calledStrikes",
        veloMin: 88,
        veloMax: 92,
      })
    );

    expect(query.get("player")).toBe("lapierre_anthony");
    expect(query.get("season")).toBe("2026");
    expect(query.get("pitchType")).toBe("Fastball");
    expect(query.get("count")).toBe("0-0");
    expect(query.get("event")).toBe("calledStrikes");
    expect(query.get("veloMin")).toBe("88");
    expect(query.get("veloMax")).toBe("92");
    expect(query.has("pitcherHand")).toBe(false);
  });
});
