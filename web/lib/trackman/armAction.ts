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
import { getMlbAvg, normalizePitchTypeName } from "../mlbPitchAverages";
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
}

export interface ArmActionProfile {
  armSlot: ArmSlot | null;
  armAction: ArmAction | null;
  /** e.g. "3/4 Pronator", "Over the Top Supinator" */
  label: string;
  confidence: Confidence;
  /** Human-readable signals that drove the classification */
  signals: string[];
  /** Extra context shown when the profile is still neutral or tentative */
  guidance: string | null;
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
  weightedScore: number;
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
    return {
      action: "Neutral",
      confidence: "Low",
      signals: ["Insufficient data for classification"],
      weightedScore: 0,
    };
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

  return { action, confidence, signals, weightedScore };
}

// ---------------------------------------------------------------------------
// Blend detection
// ---------------------------------------------------------------------------

/**
 * How close (inches, Euclidean in IVB/HB space) an existing pitch's actual
 * movement must be to a suggested pitch's MLB average before it's considered
 * "already covered" and the suggestion is suppressed.
 *
 * ~5.5" catches genuine overlap (e.g. a fastball plotting at IVB=13, HB=0
 * that lands within the Cutter zone at MLB avg IVB=8.08, HB=2.45).
 */
const BLEND_THRESHOLD_IN = 5.5;

interface BlendResult {
  blends: boolean;
  /** The existing pitch type that occupies the suggested pitch's movement zone */
  culprit?: string;
}

/**
 * Returns true if any existing pitch plots within BLEND_THRESHOLD_IN of the
 * suggested pitch's MLB-average movement profile.  When true the suggestion
 * would be redundant — the shape is already represented in the arsenal.
 */
function blendsWith(
  suggestedType: string,
  hand: "R" | "L",
  existingPitches: TrackmanPitchTypeSummary[],
): BlendResult {
  const canon = normalizePitchTypeName(suggestedType);
  if (!canon) return { blends: false };

  const mlbAvg = getMlbAvg(hand, canon);
  if (!mlbAvg) return { blends: false };

  for (const existing of existingPitches) {
    if (existing.avgIvb == null || existing.avgHb == null) continue;
    const dIvb = existing.avgIvb - mlbAvg.ivb;
    const dHb = existing.avgHb - mlbAvg.hb;
    const dist = Math.sqrt(dIvb * dIvb + dHb * dHb);
    if (dist <= BLEND_THRESHOLD_IN) {
      return { blends: true, culprit: existing.pitchType };
    }
  }
  return { blends: false };
}

// ---------------------------------------------------------------------------
// Pitch recommendations
// ---------------------------------------------------------------------------

function getPitchRecommendations(
  action: ArmAction,
  slot: ArmSlot | null,
  pitches: TrackmanPitchTypeSummary[],
  hand: "R" | "L",
  weightedScore: number,
): PitchRecommendation[] {
  const existing = new Set(pitches.map((p) => p.pitchType));
  const recs: PitchRecommendation[] = [];

  const hasSinker = existing.has("Sinker") || existing.has("Fastball / Sinker");
  const hasChangeup = existing.has("Changeup") || existing.has("Changeup / Splitter") || existing.has("Splitter");
  const hasSlider = existing.has("Slider") || existing.has("Slider / Sweeper");
  const hasSweeper = existing.has("Sweeper") || existing.has("Slider / Sweeper");
  const hasCurveball = existing.has("Curveball") || existing.has("Knuckle Curve");
  const hasCutter = existing.has("Cutter");
  const neutralLean =
    action === "Neutral" && Math.abs(weightedScore) > 0.1
      ? weightedScore > 0
        ? "Pronator"
        : "Supinator"
      : null;
  const effectiveAction = neutralLean ?? action;
  const tentativeSuffix =
    action === "Neutral" && neutralLean
      ? " Tentative add based on limited data — classification may shift with more sessions."
      : "";

  // Helper: only push if (a) pitcher doesn't already throw it and
  // (b) it wouldn't blend with an existing pitch's movement profile.
  function suggest(
    pitchType: string,
    alreadyHas: boolean,
    priority: PitchRecommendation["priority"],
    rationale: string,
  ) {
    if (alreadyHas) return;
    const blend = blendsWith(pitchType, hand, pitches);
    if (blend.blends) return; // shape already covered by existing arsenal
    recs.push({ pitchType, priority, rationale: `${rationale}${tentativeSuffix}` });
  }

  // Helper to find fastball HB for SSW context
  const fb = pitches.find((p) => p.pitchType === "Fastball" || p.pitchType === "Sinker");
  const fbHb = fb?.avgHb ?? null;
  const fbArmHb = fbHb != null ? armSideHb(fbHb, hand) : null;

  if (effectiveAction === "Pronator") {
    // ----------------------------------------------------------------
    // Primary additions
    // ----------------------------------------------------------------

    // 1. Sinker — most natural pronator pitch; SSW is most pronounced on sinkers
    const sswNote =
      fbArmHb != null && fbArmHb > 2
        ? ` Your fastball already shows ${fbArmHb.toFixed(1)}" of arm-side run — a 2-seam grip can channel that into seam-shifted wake (SSW) for extra late sink and run.`
        : "";
    suggest(
      "Sinker",
      hasSinker,
      "Primary",
      `Pronation naturally produces arm-side sink and run — the sinker is the extension of what your arm already does.${sswNote} Cue: pressure on the inside seam, pronate through the palm at release. Generates ground-ball contact when executed correctly.`,
    );

    // 2. Changeup — pronation IS the mechanical action; circle change is a natural fit
    suggest(
      "Changeup",
      hasChangeup,
      "Primary",
      "The circle changeup and 3-finger changeup both rely on pronation at release — the same wrist action your fastball uses. This means elite arm-speed disguise with minimal mechanical adjustment. Cue: grip loosely, pronate through the \"doorknob turn,\" let the circle flush forward at release. The pitch fades arm-side naturally.",
    );

    // 3. Gyro Slider — the pronator's natural breaking ball (the Pronator's Triangle)
    //    Doesn't require supination; relies on gyroscopic spin for late downward action
    suggest(
      "Slider",
      hasSlider || hasSweeper,
      "Primary",
      "Pronators naturally produce gyro spin — and gyro sliders don't require supination. Throw it like a fastball with your index finger slightly off-center, letting the ball spiral out. The result: a hard breaking ball with late, sharp downward action and minimal horizontal sweep. This completes the pronator's triangle: fastball → changeup → gyro slider. Cue: football spiral feel, stay through the ball.",
    );

    // If throwing a slider already, reinforce sinker for arm-side contrast
    if (hasSlider) {
      suggest(
        "Sinker",
        hasSinker,
        "Primary",
        "You throw a slider — the glove-side shape is covered. A sinker adds the arm-side contrast that makes both pitches work harder: hitters chasing the slider must adjust to the sinker's opposite movement. This arm-side/glove-side pairing is the core of the pronator's arsenal.",
      );
    }

    // ----------------------------------------------------------------
    // Secondary additions
    // ----------------------------------------------------------------

    // Cutter — requires mild supination; works but fights pronation slightly
    suggest(
      "Cutter",
      hasCutter || hasSlider,
      "Secondary",
      "A cutter is a secondary option for glove-side movement. It requires less supination than a true slider — more of a grip adjustment than a wrist change. Cue: firm grip with index/middle fingers slightly toward the outer third, no wrist snap. Tunnels well with your sinker and fastball.",
    );

    // Curveball — spike/knuckle curve minimizes required supination; not suited for low slots
    if (slot !== "Sidearm" && slot !== "Low Sidearm" && slot !== "Submarine") {
      suggest(
        "Curveball",
        hasCurveball,
        "Secondary",
        "A spike curve or knuckle curve requires less wrist supination than a traditional 12-6 curve and pairs well with a sinking fastball — the vertical depth contrast forces hitters to adjust their swing plane. Cue: spike middle finger on the seam, pull straight down. Effective at 3/4 and higher arm slots.",
      );
    }

    // Splitter — pronating splitter bypasses changeup limitations; good at lower slots
    suggest(
      "Splitter",
      hasChangeup,
      "Secondary",
      "A pronating splitter uses the split-finger grip to reduce spin and velocity while keeping a fastball-like arm action. The pronation at release adds late arm-side tumble. An effective alternative or complement to the changeup, particularly at sidearm slots where fading changeups are harder to command.",
    );
  }

  if (effectiveAction === "Supinator") {
    // ----------------------------------------------------------------
    // Primary additions
    // ----------------------------------------------------------------

    // 1. Slider — core supinator pitch; natural supination drives the break
    suggest(
      "Slider",
      hasSlider || hasSweeper,
      "Primary",
      "Your arm action is built for a slider. Natural supination means the break happens with no mechanical effort — the arm does the work. Try a gyro-slider grip (football spiral release) for a hard late-breaking version, or a traditional knuckle-slider for more tilt. Cue: \"karate chop\" at release, show the back of your hand to the sky.",
    );

    // 2. Sweeper — supination maximizes horizontal break; target 10–15" of sweep
    suggest(
      "Sweeper",
      hasSweeper,
      "Primary",
      hasSlider
        ? "Your slider is a natural stepping stone to a sweeper. Get further around the outer third of the ball and reduce the gyro component — the goal is more horizontal sweep (10–15\") with less depth. Lower arm slots amplify the horizontal movement even further."
        : "Your supination keeps you on the side of the ball longer than a pronator, which is exactly what a sweeper needs. Maximize the side-spin by getting around the outer third of the ball. Cue: stay on the outside of the ball through release, aim for 10–15\" of horizontal break.",
    );

    // 3. Curveball — supination is the mechanism for 12-6 or 11-5 shape
    //    Not suited for sidearm/submarine (can't get over the ball)
    if (slot !== "Sidearm" && slot !== "Low Sidearm" && slot !== "Submarine") {
      suggest(
        "Curveball",
        hasCurveball,
        "Primary",
        slot === "Over-the-top"
          ? "Over-the-top supinators are ideally positioned for a 12-6 curveball — the arm slot puts the hand directly over the ball, and supination drives straight downward snap. This pitch creates the most vertical movement contrast in baseball. Cue: pull straight down at release, knuckle to the ground."
          : "An 11-5 or 10-4 curveball leverages your natural supination. The spin axis tilts toward the glove side, producing a sharp combination of depth and sweep. Pairs well with your sweeper/slider for two distinct breaking-ball shapes at different depths. Cue: pull down-and-across at release.",
      );
    }

    // 4. Splitter — THE off-speed solution for supinators; bypass changeup pronation requirement
    //    Kick change concept: split grip or spiked middle finger to generate sink without pronating
    suggest(
      "Splitter",
      hasChangeup,
      "Primary",
      "Traditional changeups require pronation — which fights your arm action. A splitter bypasses this entirely: the split grip kills the spin naturally, producing velocity separation and late tumble with no wrist manipulation. Alternative: the \"kick change\" (spike middle finger on a seam) gives a saucer-like sinking action if the splitter grip feels uncomfortable. Both produce the arm-side depth that supinators struggle to get on a standard changeup.",
    );

    // ----------------------------------------------------------------
    // Secondary additions
    // ----------------------------------------------------------------

    // Cutter — natural extension of slider; less supination, more velocity
    suggest(
      "Cutter",
      hasCutter,
      "Secondary",
      "A cutter is a natural extension for supinators — essentially a slider with reduced break and added velocity. Less wrist involvement than your slider, making it easier to command. Tunnels effectively with your four-seam because both appear identical out of the hand. Cue: firm the grip slightly and reduce the amount of \"cut\" on release.",
    );
  }

  return recs;
}

function getNeutralGuidance(slot: ArmSlot | null, weightedScore: number): string | null {
  const neutralLean =
    Math.abs(weightedScore) > 0.1
      ? weightedScore > 0
        ? "Pronator"
        : "Supinator"
      : null;

  if (neutralLean && slot) {
    return `${slot} slot is already measurable, but the movement score only leans ${neutralLean}. Treat the adds below as tentative until more TrackMan sessions confirm the direction.`;
  }

  if (neutralLean) {
    return `The movement profile only leans ${neutralLean}, so the adds below are tentative until more TrackMan sessions sharpen the classification.`;
  }

  if (slot) {
    return `${slot} slot is already measurable, but the movement signals are still balanced between pronation and supination. Import more TrackMan sessions before making arm-action-specific pitch changes.`;
  }

  return "The movement signals are still balanced between pronation and supination. Import more TrackMan sessions before making arm-action-specific pitch changes.";
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
      guidance: null,
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
  const { action: armAction, confidence, signals, weightedScore } = classifyArmAction(pitches, hand);

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
  const guidance = armAction === "Neutral" ? getNeutralGuidance(armSlot, weightedScore) : null;
  const recommendations = getPitchRecommendations(armAction, armSlot, pitches, hand, weightedScore);

  return { armSlot, armAction, label, confidence, signals, guidance, recommendations };
}
