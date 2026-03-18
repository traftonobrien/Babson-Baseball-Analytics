import { describe, expect, it } from "vitest";
import {
  getArmActionVariantRecord,
  getRecommendationVariant,
} from "./armActionKnowledgeBase";

describe("armActionKnowledgeBase", () => {
  it("tracks forkball as a research-only splitter branch", () => {
    const variant = getArmActionVariantRecord("forkball");
    expect(variant.canonicalPitchType).toBe("Splitter");
    expect(variant.publicCodes).toContain("FO");
    expect(variant.status).toBe("research-only");
  });

  it("uses Slurve for upper-slot supinator slider recommendations", () => {
    const variant = getRecommendationVariant({
      action: "Supinator",
      pitchType: "Slider",
      slot: "Over-the-top",
    });
    expect(variant?.variantId).toBe("slurve");
    expect(variant?.label).toBe("Slurve");
  });

  it("uses Gyro Slider for lower-slot supinator slider recommendations", () => {
    const variant = getRecommendationVariant({
      action: "Supinator",
      pitchType: "Slider",
      slot: "3/4",
    });
    expect(variant?.variantId).toBe("gyro-slider");
    expect(variant?.label).toBe("Gyro Slider");
  });
});
