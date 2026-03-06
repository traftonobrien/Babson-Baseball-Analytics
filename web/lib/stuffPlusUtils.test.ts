import { describe, expect, it } from "vitest";
import {
  plusMetricTier,
  stuffPlusBadgeTone,
  plusMetricBadgeStyle,
  plusMetricSurfaceClasses,
  stuffPlusAccentClass,
} from "./stuffPlusUtils";

describe("plusMetricTier", () => {
  it("keeps a neutral band around 100 before switching accents", () => {
    expect(plusMetricTier(114)).toBe("elite");
    expect(plusMetricTier(105)).toBe("aboveAverage");
    expect(plusMetricTier(95)).toBe("average");
    expect(plusMetricTier(89)).toBe("belowAverage");
  });

  it("uses the displayed rounded value so matching pills stay in the same bucket", () => {
    expect(plusMetricTier(94.4)).toBe("belowAverage");
    expect(plusMetricTier(94.5)).toBe("average");
    expect(plusMetricTier(99.4)).toBe("average");
    expect(plusMetricTier(105.4)).toBe("aboveAverage");
    expect(plusMetricTier(105.5)).toBe("elite");
  });
});

describe("stuffPlusBadgeTone", () => {
  it("progresses from light to dark inside each color band", () => {
    const roseLow = stuffPlusBadgeTone(106);
    const roseHigh = stuffPlusBadgeTone(126);
    const orangeLow = stuffPlusBadgeTone(100);
    const orangeHigh = stuffPlusBadgeTone(105);
    const zincLow = stuffPlusBadgeTone(95);
    const zincHigh = stuffPlusBadgeTone(99);
    const blueLow = stuffPlusBadgeTone(72);
    const blueHigh = stuffPlusBadgeTone(94);

    expect(roseLow.bg).not.toBe(roseHigh.bg);
    expect(orangeLow.bg).not.toBe(orangeHigh.bg);
    expect(zincLow.bg).not.toBe(zincHigh.bg);
    expect(blueLow.bg).not.toBe(blueHigh.bg);

    expect(roseLow.text).toBe("#ffffff");
    expect(orangeLow.text).toBe("#ffffff");
    expect(zincLow.text).toBe("#ffffff");
    expect(blueLow.text).toBe("#ffffff");
  });

  it("keeps the same rendered number on the same exact tone", () => {
    expect(stuffPlusBadgeTone(94.5).bg).toBe(stuffPlusBadgeTone(95.4).bg);
    expect(stuffPlusBadgeTone(105.5).bg).toBe(stuffPlusBadgeTone(106.4).bg);
  });
});

describe("plusMetricBadgeStyle", () => {
  it("builds a glowing style from the shared tone", () => {
    const style = plusMetricBadgeStyle(112);

    expect(style.color).toBe("#ffffff");
    expect(String(style.background)).toContain("linear-gradient(180deg");
    expect(String(style.background)).toContain("rgba(");
    expect(String(style.border)).toContain("rgba(");
    expect(String(style.boxShadow)).toContain("inset 0 1px 0");
    expect(String(style.boxShadow)).toContain("rgba(");
  });
});

describe("plusMetricSurfaceClasses", () => {
  it("maps the shared tiers onto panel chrome", () => {
    expect(plusMetricSurfaceClasses(114).borderClass).toBe("border-rose-500/50");
    expect(plusMetricSurfaceClasses(105).borderClass).toBe("border-orange-500/50");
    expect(plusMetricSurfaceClasses(95).borderClass).toBe("border-slate-600/80");
    expect(plusMetricSurfaceClasses(88).borderClass).toBe("border-sky-500/50");
    expect(plusMetricSurfaceClasses(null).borderClass).toBe("border-zinc-800");
  });
});

describe("stuffPlusAccentClass", () => {
  it("tracks the same threshold buckets", () => {
    expect(stuffPlusAccentClass(112)).toBe("border-l-rose-500");
    expect(stuffPlusAccentClass(104)).toBe("border-l-orange-500");
    expect(stuffPlusAccentClass(95)).toBe("border-l-slate-400");
    expect(stuffPlusAccentClass(84)).toBe("border-l-sky-500");
  });
});
