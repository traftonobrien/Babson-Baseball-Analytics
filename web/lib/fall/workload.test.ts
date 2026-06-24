import { describe, expect, it } from "vitest";
import { scoreFallWorkloadStress } from "./workload";

describe("fall workload stress scoring", () => {
  it("keeps bullpen sessions below the watch threshold normal", () => {
    expect(
      scoreFallWorkloadStress({ sessionType: "fall_bullpen", pitchCount: 35 }),
    ).toMatchObject({ level: "low", label: "Normal load" });
  });

  it("flags live AB sessions in the watch band earlier than bullpens", () => {
    expect(
      scoreFallWorkloadStress({ sessionType: "fall_live_ab", pitchCount: 26 }),
    ).toMatchObject({ level: "watch", label: "Workload watch" });
  });

  it("flags intersquad sessions above the high threshold", () => {
    expect(
      scoreFallWorkloadStress({ sessionType: "fall_intersquad", pitchCount: 66 }),
    ).toMatchObject({ level: "high", label: "High stress" });
  });
});
