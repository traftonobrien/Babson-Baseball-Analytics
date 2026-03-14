/**
 * Per-player overrides for Stuff+ pitch type display names.
 * The R model may output a generic label (e.g. "Slider") that doesn't match
 * what the pitcher actually throws. Use this map to correct display names.
 *
 * Key: playerId (Trackman slug, e.g. place_cal)
 * Value: { modelPitchType -> displayPitchType }
 */
/**
 * Overrides derived from movement analysis (IVB/HB vs MLB averages).
 * Sliders whose movement is closest to Curveball or Sweeper are corrected.
 */
export const STUFF_PLUS_PITCH_OVERRIDES: Record<
  string,
  Record<string, string>
> = {
  // Slider -> Curveball (movement matches curveball profile)
  place_cal: { Slider: "Curveball" },
  CPlace1: { Slider: "Curveball" },
  chou_colin: { Slider: "Curveball" },
  CChou1: { Slider: "Curveball" },
  // Slider -> Sweeper (movement matches sweeper profile)
  camardi_michael: { Slider: "Sweeper" },
  MCamardi1: { Slider: "Sweeper" },
  burk_bobby: { Slider: "Sweeper" },
  BBurk1: { Slider: "Sweeper" },
  langan_shane: { Slider: "Sweeper" },
  SLangan1: { Slider: "Sweeper" },
  valente_ben: { Slider: "Sweeper" },
  BValente1: { Slider: "Sweeper" },
  burrows_chase: { Slider: "Sweeper" },
  CBurrows1: { Slider: "Sweeper" },
};

/**
 * Get the display pitch type for Stuff+ data.
 * Returns the override if one exists, otherwise the original model pitch type.
 */
export function getStuffPlusDisplayPitchType(
  playerId: string,
  modelPitchType: string
): string {
  const overrides = STUFF_PLUS_PITCH_OVERRIDES[playerId];
  if (!overrides) return modelPitchType;
  return overrides[modelPitchType] ?? modelPitchType;
}

/**
 * Get the model pitch type(s) that map to a given display pitch type.
 * Used when merging Stuff+ into Trackman rows (Trackman has display names).
 */
export function getStuffPlusModelPitchForDisplay(
  playerId: string,
  displayPitchType: string
): string | null {
  const overrides = STUFF_PLUS_PITCH_OVERRIDES[playerId];
  if (!overrides) return null;
  for (const [model, display] of Object.entries(overrides)) {
    if (display === displayPitchType) return model;
  }
  return null;
}
