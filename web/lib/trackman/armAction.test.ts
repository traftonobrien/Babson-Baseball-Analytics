import { describe, it, expect } from "vitest";
import { classifyArmProfile } from "./armAction";
import type { TrackmanPitchTypeSummary } from "./metrics";

function makePitch(overrides: Partial<TrackmanPitchTypeSummary>): TrackmanPitchTypeSummary {
  return {
    pitchType: "Fastball",
    count: 20,
    avgVelo: 91,
    maxVelo: 93,
    avgSpin: 2100,
    maxSpin: null,
    avgIvb: 14,
    avgHb: 6,
    avgExtension: 6.1,
    avgRelHeight: 5.6,
    avgRelSide: 1.2,
    avgSpinAxis2d: 200,
    avgSpinAxis3d: null,
    avgGyro: null,
    ...overrides,
  };
}

describe("classifyArmProfile", () => {
  describe("RHP Pronator", () => {
    it("classifies strong arm-side run as Pronator", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 8 })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBe("Pronator");
    });

    it("classifies Fastball + Sinker + Changeup as High confidence Pronator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 7, avgRelHeight: 5.7 }),
        makePitch({ pitchType: "Sinker", avgHb: 9 }),
        makePitch({ pitchType: "Changeup", avgHb: 5 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBe("Pronator");
      expect(profile.confidence).toBe("High");
    });

    it("returns arm slot from relHeight + relSide", () => {
      // relHeight=5.9, relSide=1.2 → atan2(0.4, 1.2)=18.4°+40=58.4° → "3/4"
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 6, avgRelHeight: 5.9, avgRelSide: 1.2 })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armSlot).toBe("3/4");
    });

    it("recommends Sinker when not already throwing it", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 8 })];
      const profile = classifyArmProfile(pitches, "R");
      const sinkerRec = profile.recommendations.find((r) => r.pitchType === "Sinker");
      expect(sinkerRec).toBeDefined();
      expect(sinkerRec?.priority).toBe("Primary");
      expect(sinkerRec?.variantLabel).toBe("Two-Seam Runner");
    });

    it("recommends Slider as a Primary Add for Pronator without a breaking ball", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 8 }),
        makePitch({ pitchType: "Changeup", avgHb: 4 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sliderRec = profile.recommendations.find((r) => r.pitchType === "Slider");
      expect(sliderRec).toBeDefined();
      expect(sliderRec?.priority).toBe("Primary");
    });

    it("suppresses Slider when Pronator already throws a Sweeper", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 7 }),
        makePitch({ pitchType: "Sweeper", avgHb: -12 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sliderRec = profile.recommendations.find((r) => r.pitchType === "Slider");
      expect(sliderRec).toBeUndefined();
    });

    it("suppresses Sinker recommendation when already throwing it", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 7 }),
        makePitch({ pitchType: "Sinker", avgHb: 9 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sinkerRec = profile.recommendations.find((r) => r.pitchType === "Sinker");
      expect(sinkerRec).toBeUndefined();
    });

    it("includes arm slot in label", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 8, avgRelHeight: 6.0, avgRelSide: 1.2 })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.label).toContain("Pronator");
      // slot derived from computeArmAngleDeg(6.0, 1.2)
      expect(profile.armSlot).not.toBeNull();
    });

    it("does not duplicate Sinker when a Pronator already throws a Slider", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 8 }),
        makePitch({ pitchType: "Slider", avgHb: -8 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sinkerRecs = profile.recommendations.filter((r) => r.pitchType === "Sinker");
      expect(sinkerRecs).toHaveLength(1);
      expect(sinkerRecs[0]?.rationale).toContain("slider");
    });
  });

  describe("RHP Supinator", () => {
    it("classifies glove-side cutting fastball as Supinator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -3, avgSpinAxis2d: 155 }),
        makePitch({ pitchType: "Slider", avgHb: -8 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBe("Supinator");
    });

    it("recommends Sweeper to Supinator who already throws Slider", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -2 }),
        makePitch({ pitchType: "Slider", avgHb: -9 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sweeperRec = profile.recommendations.find((r) => r.pitchType === "Sweeper");
      expect(sweeperRec).toBeDefined();
    });

    it("recommends Slider as Primary Add for Supinator without any breaking ball", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -4, avgSpinAxis2d: 150 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sliderRec = profile.recommendations.find((r) => r.pitchType === "Slider");
      expect(sliderRec?.priority).toBe("Primary");
      expect(sliderRec?.variantLabel).toBe("Gyro Slider");
    });

    it("recommends Splitter as a Primary Add for Supinator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -3, avgSpinAxis2d: 155 }),
        makePitch({ pitchType: "Slider", avgHb: -9 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const splitterRec = profile.recommendations.find((r) => r.pitchType === "Splitter");
      expect(splitterRec).toBeDefined();
      expect(splitterRec?.priority).toBe("Primary");
    });

    it("does not recommend Curveball to a sidearm Supinator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -3, avgRelHeight: 5.4, avgRelSide: 1.2 }),
        makePitch({ pitchType: "Slider", avgHb: -9 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const curveballRec = profile.recommendations.find((r) => r.pitchType === "Curveball");
      expect(profile.armSlot).toBe("Sidearm");
      expect(curveballRec).toBeUndefined();
    });

    it("recommends Curveball to an over-the-top Supinator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -3, avgRelHeight: 7.0, avgRelSide: 1.2 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const curveballRec = profile.recommendations.find((r) => r.pitchType === "Curveball");
      expect(profile.armSlot).toBe("Over-the-top");
      expect(curveballRec).toBeDefined();
      expect(curveballRec?.variantLabel).toBe("Knuckle Curve");
    });

    it("recommends Slurve as the slider branch for an upper-slot Supinator", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -4, avgRelHeight: 6.3, avgRelSide: 1.2, avgSpinAxis2d: 150 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      const sliderRec = profile.recommendations.find((r) => r.pitchType === "Slider");
      expect(profile.armSlot).toBe("High 3/4");
      expect(sliderRec?.variantLabel).toBe("Slurve");
    });
  });

  describe("LHP mirroring", () => {
    it("classifies LHP with negative HB fastball as Pronator (arm side for LHP)", () => {
      // For LHP, negative HB = toward 3B = arm side
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: -7 }),
        makePitch({ pitchType: "Changeup", avgHb: -5 }),
      ];
      const profile = classifyArmProfile(pitches, "L");
      expect(profile.armAction).toBe("Pronator");
    });

    it("classifies LHP with positive HB fastball as Supinator (glove side for LHP)", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 4 }),
        makePitch({ pitchType: "Slider", avgHb: 9 }),
      ];
      const profile = classifyArmProfile(pitches, "L");
      expect(profile.armAction).toBe("Supinator");
    });
  });

  describe("Arm slot classification", () => {
    // Slot derived from computeArmAngleDeg(relHeight, relSide):
    //   angle = atan2(relHeight - 5.5, |relSide|) * (180/π) + 40°, clamped 0–90°
    // relSide=1.2 used consistently throughout
    const cases: [number, string][] = [
      [7.0, "Over-the-top"],  // atan2(1.5, 1.2)=51.3°+40=91.3° → clamped 90° → Over-the-top
      [6.2, "High 3/4"],      // atan2(0.7, 1.2)=30.3°+40=70.3° → High 3/4
      [5.8, "3/4"],           // atan2(0.3, 1.2)=14.0°+40=54.0° → 3/4
      [5.4, "Sidearm"],       // atan2(-0.1, 1.2)=-4.8°+40=35.2° → Sidearm
      [4.0, "Submarine"],     // atan2(-1.5, 1.2)=-51.3°+40=-11.3° → clamped 0° → Submarine
    ];
    it.each(cases)("relHeight %f with relSide 1.2 → %s", (relHeight, expectedSlot) => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 6, avgRelHeight: relHeight, avgRelSide: 1.2 })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armSlot).toBe(expectedSlot);
    });

    it("returns null arm slot when relHeight and relSide are both null", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 6, avgRelHeight: null, avgRelSide: null })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armSlot).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("shows tentative pronator recommendations for a leaning Neutral profile", () => {
      const pitches = [
        makePitch({ pitchType: "Fastball", avgHb: 1.6, avgRelHeight: 5.8, avgRelSide: 1.2, avgSpinAxis2d: null }),
        makePitch({ pitchType: "Changeup", avgHb: 4 }),
        makePitch({ pitchType: "Slider", avgHb: -8 }),
      ];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBe("Neutral");
      expect(profile.armSlot).toBe("3/4");
      expect(profile.guidance).toContain("3/4");
      expect(profile.guidance).toContain("leans Pronator");
      expect(profile.recommendations.some((r) => r.pitchType === "Sinker")).toBe(true);
      expect(profile.recommendations.every((r) => r.pitchType !== "—")).toBe(true);
      expect(profile.recommendations.every((r) => r.rationale.includes("limited data"))).toBe(true);
    });

    it("shows a slot-specific guidance note for a fully balanced Neutral profile", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: 0.1, avgRelHeight: 5.8, avgRelSide: 1.2, avgSpinAxis2d: null })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBe("Neutral");
      expect(profile.armSlot).toBe("3/4");
      expect(profile.guidance).toContain("3/4");
      expect(profile.guidance).toContain("balanced between pronation and supination");
      expect(profile.recommendations).toHaveLength(0);
    });

    it("returns Insufficient Data when no fastball HB data", () => {
      const pitches = [makePitch({ pitchType: "Fastball", avgHb: null })];
      const profile = classifyArmProfile(pitches, "R");
      expect(profile.armAction).toBeNull();
      expect(profile.label).toBe("Insufficient Data");
    });

    it("returns Insufficient Data for empty pitch array", () => {
      const profile = classifyArmProfile([], "R");
      expect(profile.armAction).toBeNull();
    });
  });
});
