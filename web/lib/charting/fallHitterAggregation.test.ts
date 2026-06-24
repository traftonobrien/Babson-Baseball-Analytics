import { describe, it, expect } from "vitest";
import {
  makeAccumulator,
  addResultCode,
  computeSlash,
  buildAggregateMap,
  BASERUNNER_ONLY_CODES,
} from "./fallHitterAggregationUtils";

describe("BASERUNNER_ONLY_CODES", () => {
  it("contains CS and PO", () => {
    expect(BASERUNNER_ONLY_CODES.has("CS")).toBe(true);
    expect(BASERUNNER_ONLY_CODES.has("PO")).toBe(true);
    expect(BASERUNNER_ONLY_CODES.has("K")).toBe(false);
  });
});

describe("addResultCode", () => {
  it("counts K as AB, no hit", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "K");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(1);
    expect(acc.hits).toBe(0);
    expect(acc.k).toBe(1);
  });

  it("counts 1B as AB + hit + single", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "1B");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(1);
    expect(acc.hits).toBe(1);
    expect(acc.singles).toBe(1);
  });

  it("counts 1B+E as AB + hit + single (reach on error)", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "1B+E");
    expect(acc.hits).toBe(1);
    expect(acc.singles).toBe(1);
  });

  it("counts 2B, 3B, HR correctly", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "2B");
    addResultCode(acc, "3B");
    addResultCode(acc, "HR");
    expect(acc.doubles).toBe(1);
    expect(acc.triples).toBe(1);
    expect(acc.hr).toBe(1);
    expect(acc.hits).toBe(3);
    expect(acc.ab).toBe(3);
  });

  it("counts BB as PA, not AB, not hit", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "BB");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(0);
    expect(acc.hits).toBe(0);
    expect(acc.bb).toBe(1);
  });

  it("counts IBB as PA, not AB, counted as walk", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "IBB");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(0);
    expect(acc.bb).toBe(1);
  });

  it("counts HBP as PA, not AB", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "HBP");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(0);
    expect(acc.hbp).toBe(1);
  });

  it("counts SAC as PA, not AB", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "SAC");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(0);
    expect(acc.sacBunt).toBe(1);
  });

  it("counts SF as PA, not AB", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "SF");
    expect(acc.pa).toBe(1);
    expect(acc.ab).toBe(0);
    expect(acc.sacFly).toBe(1);
  });

  it("ignores CS and PO entirely", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "CS");
    addResultCode(acc, "PO");
    expect(acc.pa).toBe(0);
    expect(acc.ab).toBe(0);
  });

  it("counts groundouts as AB, no hit", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "6-3");
    addResultCode(acc, "4-3");
    expect(acc.pa).toBe(2);
    expect(acc.ab).toBe(2);
    expect(acc.hits).toBe(0);
  });
});

describe("computeSlash", () => {
  it("computes AVG = hits / AB", () => {
    const acc = makeAccumulator("Test");
    // 3 for 10
    for (let i = 0; i < 3; i++) addResultCode(acc, "1B");
    for (let i = 0; i < 7; i++) addResultCode(acc, "K");
    const { avg } = computeSlash(acc);
    expect(avg).toBeCloseTo(0.3);
  });

  it("computes OBP including BB and HBP", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "1B"); // hit
    addResultCode(acc, "BB"); // walk
    addResultCode(acc, "HBP"); // hbp
    addResultCode(acc, "K"); // out
    // OBP = (1+1+1) / (1+1+1+1) = 3/4 = .750
    // But OBP denom = AB + BB + HBP + SF = 1+1+1+0 = 3... wait
    // AB: 1B=1, K=1 → ab=2; BB,HBP → ab not incremented
    // OBP denom = ab + bb + hbp + sf = 2 + 1 + 1 + 0 = 4
    // OBP num = hits + bb + hbp = 1 + 1 + 1 = 3
    const { obp } = computeSlash(acc);
    expect(obp).toBeCloseTo(3 / 4);
  });

  it("SF counted in OBP denom", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "SF");  // pa, not ab, sacFly=1
    addResultCode(acc, "1B");  // pa, ab, hit
    // OBP denom = ab + bb + hbp + sf = 1 + 0 + 0 + 1 = 2
    // OBP num = hits + bb + hbp = 1
    const { obp } = computeSlash(acc);
    expect(obp).toBeCloseTo(0.5);
  });

  it("computes SLG correctly for extra-base hits", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "2B"); // 2 TB
    addResultCode(acc, "3B"); // 3 TB
    addResultCode(acc, "HR"); // 4 TB
    addResultCode(acc, "K");  // 0 TB
    // TB = 0 + 2 + 3 + 4 = 9; AB = 4; SLG = 9/4 = 2.25
    const { slg } = computeSlash(acc);
    expect(slg).toBeCloseTo(9 / 4);
  });

  it("returns null avg/obp/slg when AB=0", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "BB");
    addResultCode(acc, "HBP");
    const { avg, slg } = computeSlash(acc);
    expect(avg).toBeNull();
    expect(slg).toBeNull();
    // OBP still computable: (0 + 1 + 1) / (0 + 1 + 1 + 0) = 1.0
    const { obp } = computeSlash(acc);
    expect(obp).toBeCloseTo(1.0);
  });

  it("OPS = OBP + SLG", () => {
    const acc = makeAccumulator("Test");
    addResultCode(acc, "1B");
    addResultCode(acc, "K");
    const { obp, slg, ops } = computeSlash(acc);
    expect(ops).toBeCloseTo((obp ?? 0) + (slg ?? 0));
  });
});

describe("buildAggregateMap", () => {
  it("groups by hitterName", () => {
    const rows = [
      { hitterName: "Alice", resultCode: "1B" },
      { hitterName: "Bob", resultCode: "K" },
      { hitterName: "Alice", resultCode: "HR" },
    ];
    const map = buildAggregateMap(rows);
    expect(map.size).toBe(2);
    expect(map.get("Alice")?.hits).toBe(2);
    expect(map.get("Bob")?.k).toBe(1);
  });

  it("skips CS and PO rows", () => {
    const rows = [
      { hitterName: "Alice", resultCode: "CS" },
      { hitterName: "Alice", resultCode: "PO" },
      { hitterName: "Alice", resultCode: "1B" },
    ];
    const map = buildAggregateMap(rows);
    const acc = map.get("Alice")!;
    expect(acc.pa).toBe(1); // only the 1B
  });

  it("returns empty map for empty input", () => {
    expect(buildAggregateMap([]).size).toBe(0);
  });
});
