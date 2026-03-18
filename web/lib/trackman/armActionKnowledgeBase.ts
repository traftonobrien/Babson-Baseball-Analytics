/**
 * App-facing arm-action pitch-variant knowledge base.
 *
 * This is the production subset of the research captured in:
 *   - docs/mechanics/arm_action_pitch_variant_matrix.md
 *   - docs/mechanics/arm_action_variant_registry.json
 *
 * The current engine still recommends within the existing canonical pitch
 * families. This layer adds variant metadata for better copy and future
 * variant-aware expansion without changing the movement/suppression model.
 */

export type CanonicalPitchType =
  | "Fastball"
  | "Sinker"
  | "Cutter"
  | "Changeup"
  | "Splitter"
  | "Slider"
  | "Sweeper"
  | "Curveball";

export type ArmSlotForVariant =
  | "Over-the-top"
  | "High 3/4"
  | "3/4"
  | "Sidearm"
  | "Low Sidearm"
  | "Submarine";

export type RecommendationAction = "Pronator" | "Supinator";

export type ArmActionVariantId =
  | "cut-fastball"
  | "two-seam-runner"
  | "circle-change"
  | "kick-change"
  | "splitter"
  | "forkball"
  | "gyro-slider"
  | "sweeper"
  | "slurve"
  | "knuckle-curve"
  | "slow-curve";

export interface ArmActionPitchVariantRecord {
  variantId: ArmActionVariantId;
  label: string;
  canonicalPitchType: CanonicalPitchType;
  publicLabels: string[];
  publicCodes: string[];
  separability: "raw-separable" | "summary-collapsed" | "house-variant-only";
  armActionFit: "Pronator" | "Supinator" | "Mixed" | "Unknown";
  fitConfidence: "High" | "Medium" | "Low";
  status: "ready-now" | "research-only";
  notes: string;
}

export const ARM_ACTION_PITCH_VARIANTS: ArmActionPitchVariantRecord[] = [
  {
    variantId: "cut-fastball",
    label: "Cut Fastball",
    canonicalPitchType: "Cutter",
    publicLabels: ["Cutter"],
    publicCodes: ["FC"],
    separability: "raw-separable",
    armActionFit: "Supinator",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "Fastball-slider bridge; best used as copy enrichment rather than a new family.",
  },
  {
    variantId: "two-seam-runner",
    label: "Two-Seam Runner",
    canonicalPitchType: "Sinker",
    publicLabels: ["Two-seam FB", "Sinker"],
    publicCodes: ["FT", "SI"],
    separability: "summary-collapsed",
    armActionFit: "Pronator",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "Pronator-friendly arm-side fastball variant anchored to the sinker movement family.",
  },
  {
    variantId: "circle-change",
    label: "Circle Change",
    canonicalPitchType: "Changeup",
    publicLabels: ["Changeup"],
    publicCodes: ["CH"],
    separability: "house-variant-only",
    armActionFit: "Pronator",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "House-defined changeup variant; public feeds do not separate changeup grips cleanly.",
  },
  {
    variantId: "kick-change",
    label: "Kick Change",
    canonicalPitchType: "Changeup",
    publicLabels: ["Changeup", "Splitter"],
    publicCodes: ["CH", "FS"],
    separability: "house-variant-only",
    armActionFit: "Mixed",
    fitConfidence: "Low",
    status: "research-only",
    notes: "Tracked as a research-only offspeed branch until external evidence is stronger.",
  },
  {
    variantId: "splitter",
    label: "Splitter",
    canonicalPitchType: "Splitter",
    publicLabels: ["Splitter"],
    publicCodes: ["FS"],
    separability: "raw-separable",
    armActionFit: "Mixed",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "First-class offspeed family; keep the family intact while the forkball branch is still research-only.",
  },
  {
    variantId: "forkball",
    label: "Forkball",
    canonicalPitchType: "Splitter",
    publicLabels: ["Forkball"],
    publicCodes: ["FO"],
    separability: "raw-separable",
    armActionFit: "Unknown",
    fitConfidence: "Low",
    status: "research-only",
    notes: "Tracked as a splitter-family branch now that public ingest preserves FO labels.",
  },
  {
    variantId: "gyro-slider",
    label: "Gyro Slider",
    canonicalPitchType: "Slider",
    publicLabels: ["Slider", "Gyroball"],
    publicCodes: ["SL", "GY"],
    separability: "house-variant-only",
    armActionFit: "Supinator",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "Variant anchored to the slider family; use for tighter, harder breaking-ball copy.",
  },
  {
    variantId: "sweeper",
    label: "Sweeper",
    canonicalPitchType: "Sweeper",
    publicLabels: ["Sweeper"],
    publicCodes: ["ST"],
    separability: "raw-separable",
    armActionFit: "Supinator",
    fitConfidence: "High",
    status: "ready-now",
    notes: "Already a first-class family in the current engine.",
  },
  {
    variantId: "slurve",
    label: "Slurve",
    canonicalPitchType: "Slider",
    publicLabels: ["Slurve"],
    publicCodes: ["SV"],
    separability: "raw-separable",
    armActionFit: "Supinator",
    fitConfidence: "Medium",
    status: "ready-now",
    notes: "Slider-curve bridge variant suitable for higher-slot supinators.",
  },
  {
    variantId: "knuckle-curve",
    label: "Knuckle Curve",
    canonicalPitchType: "Curveball",
    publicLabels: ["Knuckle Curve"],
    publicCodes: ["KC"],
    separability: "summary-collapsed",
    armActionFit: "Supinator",
    fitConfidence: "High",
    status: "ready-now",
    notes: "Best current curveball variant for slot-aware recommendation copy.",
  },
  {
    variantId: "slow-curve",
    label: "Slow Curve",
    canonicalPitchType: "Curveball",
    publicLabels: ["Slow Curve"],
    publicCodes: ["CS"],
    separability: "raw-separable",
    armActionFit: "Supinator",
    fitConfidence: "High",
    status: "research-only",
    notes: "Tracked for future slower, steeper curveball overlays and movement bands.",
  },
];

const VARIANTS_BY_ID = Object.fromEntries(
  ARM_ACTION_PITCH_VARIANTS.map((variant) => [variant.variantId, variant]),
) as Record<ArmActionVariantId, ArmActionPitchVariantRecord>;

const UPPER_SLOT_VARIANTS = new Set<ArmSlotForVariant>(["Over-the-top", "High 3/4"]);

export function getArmActionVariantRecord(
  variantId: ArmActionVariantId,
): ArmActionPitchVariantRecord {
  return VARIANTS_BY_ID[variantId];
}

export function getRecommendationVariant({
  action,
  pitchType,
  slot,
}: {
  action: RecommendationAction;
  pitchType: CanonicalPitchType;
  slot: ArmSlotForVariant | null;
}): ArmActionPitchVariantRecord | null {
  if (action === "Pronator") {
    switch (pitchType) {
      case "Sinker":
        return getArmActionVariantRecord("two-seam-runner");
      case "Changeup":
        return getArmActionVariantRecord("circle-change");
      case "Slider":
        return getArmActionVariantRecord("gyro-slider");
      case "Curveball":
        return getArmActionVariantRecord("knuckle-curve");
      default:
        return null;
    }
  }

  switch (pitchType) {
    case "Slider":
      return UPPER_SLOT_VARIANTS.has(slot ?? "3/4")
        ? getArmActionVariantRecord("slurve")
        : getArmActionVariantRecord("gyro-slider");
    case "Curveball":
      return getArmActionVariantRecord("knuckle-curve");
    case "Cutter":
      return getArmActionVariantRecord("cut-fastball");
    default:
      return null;
  }
}
