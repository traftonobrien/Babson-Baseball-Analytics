import { describe, expect, it } from "vitest";
import {
  isWorkbookPitchStrike,
  splitWorkbookTokens,
  summarizeFallPitcherOuting,
} from "./outingStats";

describe("fall outing stats", () => {
  it("splits workbook-style pitch/result rows into compact tokens", () => {
    expect(splitWorkbookTokens("1B, 1S 3X\n1F;4B")).toEqual([
      "1B",
      "1S",
      "3X",
      "1F",
      "4B",
    ]);
  });

  it("classifies fall workbook pitch tokens by strike suffix", () => {
    expect(isWorkbookPitchStrike("1S")).toBe(true);
    expect(isWorkbookPitchStrike("3F")).toBe(true);
    expect(isWorkbookPitchStrike("1X")).toBe(true);
    expect(isWorkbookPitchStrike("Strike")).toBe(true);
    expect(isWorkbookPitchStrike("In play")).toBe(true);
    expect(isWorkbookPitchStrike("4B")).toBe(false);
  });

  it("summarizes strike rate, FPS, WHIP, and ERA from an outing row", () => {
    const summary = summarizeFallPitcherOuting({
      pitchTokens: "1B 1S 1X 3F 4B",
      resultTokens: "BB K GB-6-3",
      fpsTokens: "N Y Y",
      innings: 2,
      earnedRuns: 1,
      strikeouts: 1,
      walks: 1,
      hits: 2,
    });

    expect(summary).toMatchObject({
      pitchCount: 5,
      strikeCount: 3,
      firstPitchStrikeCount: 2,
      strikePct: 60,
      firstPitchStrikePct: 66.66666666666666,
      whip: 1.5,
      era: 4.5,
    });
  });

  it("falls back to result words when pitch tokens are pitch types", () => {
    const summary = summarizeFallPitcherOuting({
      pitchTokens: "FB SL CH FB CT FB",
      resultTokens: "Strike Ball Strike In-play Strike Ball",
      fpsTokens: "Y N Y Y N Y",
      innings: 2,
      earnedRuns: 1,
      strikeouts: 3,
      walks: 1,
      hits: 2,
    });

    expect(summary).toMatchObject({
      pitchCount: 6,
      strikeCount: 4,
      strikePct: 66.66666666666666,
      firstPitchStrikeCount: 4,
      firstPitchStrikePct: 66.66666666666666,
    });
  });
});
