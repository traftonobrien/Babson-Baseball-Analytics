/**
 * Arm action profile classification.
 *
 * Classifies a pitcher as Pronator / Supinator / Neutral based on:
 *   1. Fastball horizontal break direction (primary signal)
 *   2. Breaking-ball type presence (secondary signal)
 *   3. Spin axis of fastball (tertiary signal)
 *
 * Arm slot is derived from release height + side using the canonical
 * computeArmAngleDeg / classifyArmSlot functions from release_viz/math.ts.
 *
 * HB convention (from mlbPitchAverages.ts):
 *   positive HB = toward 1B  (arm side for RHP, glove side for LHP)
 *   negative HB = toward 3B  (glove side for RHP, arm side for LHP)
 */

import { computeArmAngleDeg, classifyArmSlot as slotFromAngle } from "../release_viz/math";
import type { TrackmanPitchTypeSummary } from "./metrics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Mirrors the slot labels from release_viz/math.ts classifyArmSlot */
export type ArmSlot =
  | "Over-the-top"
  | "High 3/4"
  | "3/4"
  | "Sidearm"
  | "Low Sidearm"
  | "Submarine";

export type ArmAction = "Pronator" | "Supinator" | "Neutral";

export type Confidence = "High" | "Medium" | "Low";

export interface PitchRecommendation {
  pitchType: string;
  rationale: string;
  priority: "Primary" | "Secondary";
  alreadyThrows: boolean;
}

export interface ArmActionProfile {
  armSlot: ArmSlot | null;
  armAction: ArmAction | null;
  /** e.g. "3/4 Pronator", "Over the Top Supinator" */
  label: string;
  confidence: Confidence;
  /** Human-readable signals that drove the classification */
  signals: string[];
  recommendations: PitchRecommendation[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FASTBALL_TYPES = new Set(["Fastball", "Sinker", "Fastball / Sinker"]);
const BREAKING_TYPES = new Set(["Slider", "Sweeper", "Curveball", "Knuckle Curve", "Slider / Sweeper"]);
const OFFSPEED_TYPES = new Set(["Changeup", "Splitter", "Changeup / Splitter"]);
const CUTTER_TYPES = new Set(["Cutter"]);

// ---------------------------------------------------------------------------
// Arm slot — delegates to canonical release_viz/math functions
// ---------------------------------------------------------------------------

function getArmSlot(relHeight: number | null, relSide: number | null): ArmSlot | null {
  const angle = computeArmAngleDeg(relHeight, relSide);
  const classification = slotFromAngle(angle);
  return classification ? (classification.label as ArmSlot) : null;
}

// ---------------------------------------------------------------------------
// Arm action
// ---------------------------------------------------------------------------

/**
 * Returns a signed "arm-side HB" value:
 *   positive = ball moving toward arm side
 *   negative = ball moving toward glove side
 */
function armSideHb(hb: number, hand: "R" | "L"): number {
  // RHP: positive HB = toward 1B = arm side
  // LHP: positive HB = toward 1B = glove side → negate
  return hand === "R" ? hb : -hb;
}

interface ActionResult {
  action: ArmAction;
  confidence: Confidence;
  signals: string[];
}

function classifyArmAction(
  pitches: TrackmanPitchTypeSummary[],
  hand: "R" | "L",
): ActionResult {
  const signals: string[] = [];
  const scoreWeights: { score: number; weight: number }[] = [];

  // ----------------------------------------------------------------
  // Signal 1: fastball HB direction (strongest signal)
  // ----------------------------------------------------------------
  const fastballs = pitches.filter((p) => FASTBALL_TYPES.has(p.pitchType));
  // Weight toward pure 4-seam/sinker, not blended type
  const primaryFb = pitches.find((p) => p.pitchType === "Fastball")
    ?? pitches.find((p) => p.pitchType === "Sinker")
    ?? fastballs[0]
    ?? null;

  if (primaryFb?.avgHb != null) {
    const asHb = armSideHb(primaryFb.avgHb, hand);
    const pitchName = primaryFb.pitchType;
    if (asHb > 4) {
      scoreWeights.push({ score: 1, weight: 3 });
      signals.push(`${pitchName} runs ${Math.abs(asHb).toFixed(1)}" arm-side (strong pronation signal)`);
    } else if (asHb > 1.5) {
      scoreWeights.push({ score: 0.5, weight: 3 });
      signals.push(`${pitchName} runs ${Math.abs(asHb).toFixed(1)}" arm-side (mild pronation signal)`);
    } else if (asHb < -2) {
      scoreWeights.push({ score: -1, weight: 3 });
      signals.push(`${pitchName} cuts ${Math.abs(asHb).toFixed(1)}" glove-side (strong supination signal)`);
    } else if (asHb < 0) {
      scoreWeights.push({ score: -0.5, weight: 3 });
      signals.push(`${pitchName} cuts ${Math.abs(asHb).toFixed(1)}" glove-side (mild supination signal)`);
    } else {
      scoreWeights.push({ score: 0, weight: 1 });
      signals.push(`${pitchName} is mostly straight (neutral HB)`);
    }
  }

  // ----------------------------------------------------------------
  // Signal 2: Sinker presence (strong pronator marker)
  // ----------------------------------------------------------------
  const hasSinker = pitches.some((p) => p.pitchType === "Sinker");
  if (hasSinker) {
    scoreWeights.push({ score: 1, weight: 2 });
    signals.push("Throws a Sinker (arm action supports arm-side movement)");
  }

  // ----------------------------------------------------------------
  // Signal 3: Changeup presence (pronators throw changeups naturally)
  // ----------------------------------------------------------------
  const hasChangeup = pitches.some((p) => OFFSPEED_TYPES.has(p.pitchType));
  if (hasChangeup) {
    scoreWeights.push({ score: 0.5, weight: 1 });
    signals.push("Throws a Changeup / Splitter (consistent with pronation-based arm action)");
  }

  // ----------------------------------------------------------------
  // Signal 4: Slider / Sweeper presence (supinator marker)
  // ----------------------------------------------------------------
  const hasSliderOrSweeper = pitches.some(
    (p) => p.pitchType === "Slider" || p.pitchType === "Sweeper" || p.pitchType === "Slider / Sweeper",
  );
  if (hasSliderOrSweeper) {
    scoreWeights.push({ score: -0.75, weight: 1.5 });
    signals.push("Throws a Slider / Sweeper (consistent with supination-based arm action)");
  }

  // ----------------------------------------------------------------
  // Signal 5: Cutter HB (cutters break glove-side = supination)
  // ----------------------------------------------------------------
  const cutter = pitches.find((p) => CUTTER_TYPES.has(p.pitchType));
  if (cutter?.avgHb != null) {
    const asHb = armSideHb(cutter.avgHb, hand);
    if (asHb < -1) {
      scoreWeights.push({ score: -0.5, weight: 1 });
      signals.push(`Cutter moves ${Math.abs(asHb).toFixed(1)}" glove-side (supination component)`);
    }
  }

  // ----------------------------------------------------------------
  // Signal 6: Fastball spin axis (0–360 degrees)
  //   RHP over-the-top backspin ≈ 180°
  //   RHP pronator tilt: toward ~180–210° (arm-side tilt)
  //   RHP supinator tilt: toward ~150–180° (glove-side tilt)
  //   LHP: mirror image
  // ----------------------------------------------------------------
  if (primaryFb?.avgSpinAxis2d != null) {
    const axis = primaryFb.avgSpinAxis2d;
    // For RHP: arm-side tilt is clockwise from 12 o'clock (axis > 180 = toward 3-4 o'clock side)
    // For LHP: arm-side tilt is counter-clockwise (axis < 180 = toward 9-10 o'clock side)
    // Simple heuristic: RHP 185-240 = pronator tilt, 120-175 = supinator tilt
    if (hand === "R") {
      if (axis >= 185 && axis <= 250) {
        scoreWeights.push({ score: 0.6, weight: 1 });
        signals.push(`Fastball spin axis ${axis.toFixed(0)}° (arm-side tilt, supports pronation)`);
      } else if (axis >= 110 && axis <= 175) {
        scoreWeights.push({ score: -0.6, weight: 1 });
        signals.push(`Fastball spin axis ${axis.toFixed(0)}° (glove-side tilt, supports supination)`);
      }
    } else {
      if (axis >= 110 && axis <= 175) {
        scoreWeights.push({ score: 0.6, weight: 1 });
        signals.push(`Fastball spin axis ${axis.toFixed(0)}° (arm-side tilt, supports pronation)`);
      } else if (axis >= 185 && axis <= 250) {
        scoreWeights.push({ score: -0.6, weight: 1 });
        signals.push(`Fastball spin axis ${axis.toFixed(0)}° (glove-side tilt, supports supination)`);
      }
    }
  }

  // ----------------------------------------------------------------
  // Aggregate score
  // ----------------------------------------------------------------
  if (scoreWeights.length === 0) {
    return { action: "Neutral", confidence: "Low", signals: ["Insufficient data for classification"] };
  }

  const totalWeight = scoreWeights.reduce((s, x) => s + x.weight, 0);
  const weightedScore = scoreWeights.reduce((s, x) => s + x.score * x.weight, 0) / totalWeight;

  // Confidence: based on how many signals fired and how strong the score is
  const absScore = Math.abs(weightedScore);
  const signalCount = scoreWeights.length;
  let confidence: Confidence;
  if (absScore >= 0.6 && signalCount >= 3) confidence = "High";
  else if (absScore >= 0.35 || signalCount >= 2) confidence = "Medium";
  else confidence = "Low";

  let action: ArmAction;
  if (weightedScore > 0.2) action = "Pronator";
  else if (weightedScore < -0.2) action = "Supinator";
  else action = "Neutral";

  return { action, confidence, signals };
}

// ---------------------------------------------------------------------------
// Pitch recommendations
// ---------------------------------------------------------------------------

function getPitchRecommendations(
  action: ArmAction,
  slot: ArmSlot | null,
  pitches: TrackmanPitchTypeSummary[],
  hand: "R" | "L",
): PitchRecommendation[] {
  const existing = new Set(pitches.map((p) => p.pitchType));
  const recs: PitchRecommendation[] = [];

  const hasSinker = existing.has("Sinker") || existing.has("Fastball / Sinker");
  const hasChangeup = existing.has("Changeup") || existing.has("Changeup / Splitter") || existing.has("Splitter");
  const hasSlider = existing.has("Slider") || existing.has("Slider / Sweeper");
  const hasSweeper = existing.has("Sweeper") || existing.has("Slider / Sweeper");
  const hasCurveball = existing.has("Curveball") || existing.has("Knuckle Curve");
  const hasCutter = existing.has("Cutter");

  // Helper to find fastball HB for SSW context
  const fb = pitches.find((p) => p.pitchType === "Fastball" || p.pitchType === "Sinker");
  const fbHb = fb?.avgHb ?? null;
  const fbArmHb = fbHb != null ? armSideHb(fbHb, hand) : null;

  if (action === "Pronator") {
    // --- Pitches that confirm / fit well ---
    if (hasSinker) {
      recs.push({
        pitchType: "Sinker",
        rationale:
          "Natural fit — your arm action produces arm-side run. Focus on getting 2-seam grip pressure to maximize seam-shifted wake (SSW). Pairs as a primary pitch against same-side hitters.",
        priority: "Primary",
        alreadyThrows: true,
      });
    }
    if (hasChangeup) {
      recs.push({
        pitchType: "Changeup",
        rationale:
          "Ideal for your arm action. Pronation through the changeup mirrors your fastball delivery — the circle change or CU grip will feel natural and the arm speed disguise is excellent.",
        priority: "Primary",
        alreadyThrows: true,
      });
    }

    // --- Primary additions ---
    if (!hasSinker) {
      const sswNote =
        fbArmHb != null && fbArmHb > 2
          ? ` Your fastball already shows ${fbArmHb.toFixed(1)}" of arm-side run — a 2-seam grip can amplify that into natural SSW.`
          : "";
      recs.push({
        pitchType: "Sinker",
        rationale:
          `Your pronator arm action naturally produces arm-side run. A sinker/2-seam is your most natural pitch addition.${sswNote} Cue: "pronate through the palm" — your arm does the work.`,
        priority: "Primary",
        alreadyThrows: false,
      });
    }
    if (!hasChangeup) {
      recs.push({
        pitchType: "Changeup",
        rationale:
          "Pronators throw changeups with exceptional arm-speed disguise because the pronation action at release is nearly identical to the fastball. Try a circle change or standard 3-finger grip. Cue: \"turn the doorknob\" through the pitch.",
        priority: "Primary",
        alreadyThrows: false,
      });
    }

    // --- Secondary additions ---
    if (!hasCutter && !hasSlider) {
      recs.push({
        pitchType: "Cutter",
        rationale:
          "A cutter is a secondary option for a pronator wanting a glove-side pitch. It requires mild supination at release — less demanding than a true slider. Cue: slight pressure off-center on the index finger.",
        priority: "Secondary",
        alreadyThrows: false,
      });
    }
    if (hasSlider && !hasSinker) {
      recs.push({
        pitchType: "Sinker",
        rationale:
          "You throw a slider, which fights your natural pronation. Pairing it with a sinker creates a powerful arm-side / glove-side contrast and gives you a high-confidence pitch that works with your arm action.",
        priority: "Primary",
        alreadyThrows: false,
      });
    }
    if (!hasCurveball && slot !== "Sidearm" && slot !== "Low Sidearm" && slot !== "Submarine") {
      recs.push({
        pitchType: "Curveball",
        rationale:
          "A spike curve or knuckle curve requires minimal supination and can complement your pronation-based fastball. The vertical break contrast is effective when paired with a sinking fastball.",
        priority: "Secondary",
        alreadyThrows: false,
      });
    }
  }

  if (action === "Supinator") {
    // --- Pitches that confirm / fit well ---
    if (hasSlider) {
      recs.push({
        pitchType: "Slider",
        rationale:
          "Natural fit for your arm action. Supination at release drives the horizontal break. Focus on spin axis tilt — more tilt toward 3 o'clock (RHP) gives more sweep, tilt toward 1 o'clock gives more depth.",
        priority: "Primary",
        alreadyThrows: true,
      });
    }
    if (hasSweeper) {
      recs.push({
        pitchType: "Sweeper",
        rationale:
          "Your supination is well-suited to a sweeper. Maximize horizontal break by tilting spin axis toward 9 o'clock (LHP) or 3 o'clock (RHP) and reducing gyro component. This is your highest-ceiling breaking ball.",
        priority: "Primary",
        alreadyThrows: true,
      });
    }
    if (hasCurveball) {
      recs.push({
        pitchType: "Curveball",
        rationale:
          "Your 11-5 or 10-4 curveball leverages your supination. Focus on 'karate chop' wrist position and pulling down through the pitch. Higher spin rate confirms more defined 12-6 shape.",
        priority: "Primary",
        alreadyThrows: true,
      });
    }

    // --- Primary additions ---
    if (!hasSlider && !hasSweeper) {
      recs.push({
        pitchType: "Slider",
        rationale:
          "Your arm action is built for a slider. Try a gyro-slider grip (football spiral feel). Your natural supination drives the break — the pitch should feel like the arm is doing the work for you. Cue: \"karate chop\" or \"show the sky.\"",
        priority: "Primary",
        alreadyThrows: false,
      });
    }
    if (!hasSweeper && hasSlider) {
      recs.push({
        pitchType: "Sweeper",
        rationale:
          "Your slider is a natural stepping stone to a sweeper. Increase the supination by tilting your wrist more and moving your grip toward the outer third of the ball. More horizontal break, less depth.",
        priority: "Primary",
        alreadyThrows: false,
      });
    }
    if (!hasCutter) {
      recs.push({
        pitchType: "Cutter",
        rationale:
          "A cutter is a natural extension for supinators — it's essentially a slider with reduced break. Less supination than your slider, more velocity. Gives you a glove-side fastball variant that tunnels with your four-seam.",
        priority: "Secondary",
        alreadyThrows: false,
      });
    }
    if (!hasChangeup) {
      recs.push({
        pitchType: "Splitter",
        rationale:
          "A traditional changeup is harder for supinators (requires pronation). A split-finger grip bypasses that requirement and still produces velocity separation. Consider as an off-speed option against opposite-hand hitters.",
        priority: "Secondary",
        alreadyThrows: false,
      });
    } else {
      // Has changeup — affirm it
      recs.push({
        pitchType: "Changeup",
        rationale:
          "Your changeup requires deliberate pronation — the opposite of your natural arm action. If it's working, it's a real weapon because batters rarely expect good changeup command from a supinator. Monitor arm stress and grip consistency.",
        priority: "Secondary",
        alreadyThrows: true,
      });
    }
  }

  if (action === "Neutral") {
    recs.push({
      pitchType: "Fastball",
      rationale:
        "Insufficient data to classify arm action. More TrackMan sessions will improve classification accuracy. Focus on establishing your primary pitch shape first.",
      priority: "Secondary",
      alreadyThrows: existing.has("Fastball"),
    });
  }

  return recs;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Classify a pitcher's arm action profile from their TrackMan pitch-type summaries.
 * Requires at least one fastball-family pitch with HB data.
 */
export function classifyArmProfile(
  pitches: TrackmanPitchTypeSummary[],
  hand: "R" | "L",
): ArmActionProfile {
  // Need enough data
  const hasFbData = pitches.some(
    (p) => FASTBALL_TYPES.has(p.pitchType) && p.avgHb != null,
  );
  if (!hasFbData || pitches.length === 0) {
    return {
      armSlot: null,
      armAction: null,
      label: "Insufficient Data",
      confidence: "Low",
      signals: ["No fastball movement data available. Import TrackMan sessions to classify arm action."],
      recommendations: [],
    };
  }

  // Arm slot from fastball release height + side (canonical math)
  const fbForSlot =
    pitches.find((p) => p.pitchType === "Fastball")
    ?? pitches.find((p) => p.pitchType === "Sinker")
    ?? pitches.find((p) => FASTBALL_TYPES.has(p.pitchType))
    ?? null;
  const armSlot = getArmSlot(fbForSlot?.avgRelHeight ?? null, fbForSlot?.avgRelSide ?? null);

  // Arm action from movement profile
  const { action: armAction, confidence, signals } = classifyArmAction(pitches, hand);

  // Label
  const label =
    armAction === "Neutral"
      ? armSlot
        ? `${armSlot} (Neutral)`
        : "Neutral"
      : armSlot
        ? `${armSlot} ${armAction}`
        : armAction;

  // Recommendations
  const recommendations = getPitchRecommendations(armAction, armSlot, pitches, hand);

  return { armSlot, armAction, label, confidence, signals, recommendations };
}
