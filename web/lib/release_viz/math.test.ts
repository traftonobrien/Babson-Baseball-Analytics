import { describe, it, expect } from "vitest";
import {
  computeArmAngleDeg,
  classifyArmSlot,
  mapReleaseToFrontSVG,
  computeShoulderAnchor,
  computeArmPath,
  computeArmDirectionVector,
  computeLabelPlacement,
  clamp,
} from "./math";

describe("release_viz/math (Production V2)", () => {
  describe("computeArmAngleDeg (Biomechanical Correction)", () => {
    it("handles shoulder-level release (Sidearm)", () => {
      const angle = computeArmAngleDeg(5.5, 2.0);
      expect(angle).toBeCloseTo(40);
    });

    it("handles over-the-top release", () => {
      const angle = computeArmAngleDeg(6.5, 1.0);
      expect(angle).toBeCloseTo(85);
    });

    it("handles submarine release", () => {
      const angle = computeArmAngleDeg(3.5, 2.0);
      expect(angle).toBe(0);
    });
    
    it("handles low sidearm", () => {
      const angle = computeArmAngleDeg(4.8, 2.0);
      expect(angle).toBeGreaterThan(15);
      expect(angle).toBeLessThan(30);
    });
  });

  describe("classifyArmSlot", () => {
    it("buckets correctly", () => {
      expect(classifyArmSlot(80)?.label).toBe("Over-the-top");
      expect(classifyArmSlot(65)?.label).toBe("High 3/4");
      expect(classifyArmSlot(50)?.label).toBe("3/4");
      expect(classifyArmSlot(35)?.label).toBe("Sidearm");
      expect(classifyArmSlot(20)?.label).toBe("Low Sidearm");
      expect(classifyArmSlot(10)?.label).toBe("Submarine");
    });
  });

  describe("computeArmDirectionVector", () => {
    it("maps RHP Sidearm (0 deg) to +X", () => {
      const v = computeArmDirectionVector(0, 10, "R");
      expect(v.dx).toBeCloseTo(10);
      expect(v.dy).toBeCloseTo(0);
    });

    it("maps LHP Sidearm (0 deg) to -X", () => {
      const v = computeArmDirectionVector(0, 10, "L");
      expect(v.dx).toBeCloseTo(-10);
      expect(v.dy).toBeCloseTo(0);
    });

    it("maps OTT (90 deg) to +Y regardless of hand", () => {
      const vr = computeArmDirectionVector(90, 10, "R");
      expect(vr.dx).toBeCloseTo(0);
      expect(vr.dy).toBeCloseTo(10);
      
      const vl = computeArmDirectionVector(90, 10, "L");
      expect(vl.dx).toBeCloseTo(0);
      expect(vl.dy).toBeCloseTo(10);
    });
  });

  describe("computeLabelPlacement", () => {
    const RADIUS = 200;
    
    it("Case 1: 45° mid chart (extends normally)", () => {
      const pos = computeLabelPlacement({ x: 100, y: 100 }, RADIUS);
      expect(pos.x).toBeCloseTo(115);
      expect(pos.y).toBeCloseTo(115);
    });

    it("Case 2: Near right boundary (clamps X)", () => {
      const pos = computeLabelPlacement({ x: 190, y: 0 }, RADIUS);
      // Max X is 200 - (48/2 + 4) = 200 - 28 = 172
      expect(pos.x).toBe(172);
      expect(pos.y).toBeCloseTo(0);
    });

    it("Case 3: Near left boundary (clamps negative X)", () => {
      const pos = computeLabelPlacement({ x: -190, y: 0 }, RADIUS);
      expect(pos.x).toBe(-172);
      expect(pos.y).toBeCloseTo(0);
    });

    it("Case 4: Near top boundary", () => {
      const pos = computeLabelPlacement({ x: 0, y: 190 }, RADIUS);
      // Max Y is 200 - (22/2 + 4) = 200 - 15 = 185
      expect(pos.x).toBeCloseTo(0);
      expect(pos.y).toBe(185);
    });

    it("Case 5: Near bottom boundary", () => {
      const pos = computeLabelPlacement({ x: 0, y: -190 }, RADIUS);
      expect(pos.x).toBeCloseTo(0);
      expect(pos.y).toBe(-185);
    });
  });
});
