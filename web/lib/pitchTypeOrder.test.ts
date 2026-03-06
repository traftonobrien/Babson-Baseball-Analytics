import { describe, expect, it } from "vitest";
import { comparePitchTypes, sortPitchTypes } from "@/lib/pitchTypeOrder";

describe("comparePitchTypes", () => {
  it("sorts fastballs before breaking balls before offspeed", () => {
    const sorted = sortPitchTypes(
      ["CH", "FF", "SL", "FS", "SI", "CU"],
      (pitchType) => pitchType,
    );

    expect(sorted).toEqual(["FF", "SI", "SL", "CU", "CH", "FS"]);
  });

  it("keeps changeups after breaking balls", () => {
    expect(comparePitchTypes("SL", "CH")).toBeLessThan(0);
    expect(comparePitchTypes("CH", "FS")).toBeLessThan(0);
  });
});
