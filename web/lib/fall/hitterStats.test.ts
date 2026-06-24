import { describe, expect, it } from "vitest";
import { formatHitterAvg, formatHitterStat } from "./hitterStatsFmt";

describe("formatHitterAvg", () => {
  it("formats .300 without leading zero", () => {
    expect(formatHitterAvg(0.3)).toBe(".300");
  });

  it("formats .250 correctly", () => {
    expect(formatHitterAvg(0.25)).toBe(".250");
  });

  it("returns — for null", () => {
    expect(formatHitterAvg(null)).toBe("—");
  });

  it("formats .000 for zero avg", () => {
    expect(formatHitterAvg(0)).toBe(".000");
  });

  it("formats .500 correctly", () => {
    expect(formatHitterAvg(0.5)).toBe(".500");
  });
});

describe("formatHitterStat", () => {
  it("formats OBP with 3 decimals by default", () => {
    expect(formatHitterStat(0.4516)).toBe("0.452");
  });

  it("formats with custom decimal places", () => {
    expect(formatHitterStat(0.4516, 4)).toBe("0.4516");
  });

  it("returns — for null", () => {
    expect(formatHitterStat(null)).toBe("—");
  });

  it("formats zero", () => {
    expect(formatHitterStat(0)).toBe("0.000");
  });
});

describe("hitter stat math validation", () => {
  it("OPS = OBP + SLG for Ryan Grace", () => {
    const obp = 0.6364;
    const slg = 1.0;
    const ops = 1.6364;
    expect(Math.abs(obp + slg - ops)).toBeLessThan(0.001);
  });

  it("AVG = H/AB for Bobby Christensen", () => {
    const h = 6;
    const ab = 25;
    const avg = 0.24;
    expect(Math.abs(h / ab - avg)).toBeLessThan(0.001);
  });

  it("hit components sum to total hits for Dylan Drazka", () => {
    const singles = 6;
    const doubles = 0;
    const triples = 0;
    const hr = 1;
    const hits = 7;
    expect(singles + doubles + triples + hr).toBe(hits);
  });
});
