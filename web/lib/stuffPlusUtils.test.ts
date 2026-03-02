import { describe, expect, it } from "vitest";
import {
  stuffPlusBadgeTone,
  plusMetricBadgeStyle,
  stuffPlusAccentClass,
} from "./stuffPlusUtils";

describe("stuffPlusBadgeTone", () => {
  it("keeps the same four bands but shades within each band", () => {
    const roseLow = stuffPlusBadgeTone(110);
    const roseHigh = stuffPlusBadgeTone(126);
    const orangeLow = stuffPlusBadgeTone(100);
    const orangeHigh = stuffPlusBadgeTone(108);
    const zincLow = stuffPlusBadgeTone(90);
    const zincHigh = stuffPlusBadgeTone(98);
    const blueLow = stuffPlusBadgeTone(72);
    const blueHigh = stuffPlusBadgeTone(88);

    expect(roseLow.bg).not.toBe(roseHigh.bg);
    expect(orangeLow.bg).not.toBe(orangeHigh.bg);
    expect(zincLow.bg).not.toBe(zincHigh.bg);
    expect(blueLow.bg).not.toBe(blueHigh.bg);

    expect(roseLow.text).toBe("#ffffff");
    expect(orangeLow.text).toBe("#18181b");
    expect(zincLow.text).toBe("#18181b");
    expect(blueLow.text).toBe("#ffffff");
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

describe("stuffPlusAccentClass", () => {
  it("tracks the same threshold buckets", () => {
    expect(stuffPlusAccentClass(112)).toBe("border-l-rose-500");
    expect(stuffPlusAccentClass(104)).toBe("border-l-orange-500");
    expect(stuffPlusAccentClass(95)).toBe("border-l-zinc-400");
    expect(stuffPlusAccentClass(84)).toBe("border-l-sky-500");
  });
});
