import { describe, it, expect } from "vitest";
import { parseDateId, seasonFromDateId } from "./season";

describe("parseDateId", () => {
  it("parses canonical yyyy_mm_dd", () => {
    const d = parseDateId("2025_03_26");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(2); // March = 2
    expect(d!.getDate()).toBe(26);
  });

  it("parses canonical with same-day suffix yyyy_mm_dd_01", () => {
    const d = parseDateId("2025_10_04_01");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2025);
    expect(d!.getMonth()).toBe(9); // October = 9
    expect(d!.getDate()).toBe(4);
  });

  it("parses legacy mm_dd_yy", () => {
    const d = parseDateId("04_27_24");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2024);
    expect(d!.getMonth()).toBe(3); // April = 3
    expect(d!.getDate()).toBe(27);
  });

  it("returns null for empty string", () => {
    expect(parseDateId("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseDateId("not_a_date")).toBeNull();
  });

  it("returns null for too few parts", () => {
    expect(parseDateId("2025_03")).toBeNull();
  });

  it("returns null for invalid month", () => {
    expect(parseDateId("2025_13_01")).toBeNull();
  });

  it("returns null for invalid day", () => {
    expect(parseDateId("2025_01_32")).toBeNull();
  });
});

describe("seasonFromDateId", () => {
  it("extracts season from canonical dateId", () => {
    expect(seasonFromDateId("2025_03_26")).toBe(2025);
  });

  it("extracts season from 2024 dateId", () => {
    expect(seasonFromDateId("2024_04_27")).toBe(2024);
  });

  it("extracts season from 2026 dateId", () => {
    expect(seasonFromDateId("2026_01_15")).toBe(2026);
  });

  it("extracts season from legacy format", () => {
    expect(seasonFromDateId("03_26_25")).toBe(2025);
  });

  it("returns null for unparseable", () => {
    expect(seasonFromDateId("invalid")).toBeNull();
  });
});
