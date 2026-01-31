/** App-wide configuration — edit defaults here, not in components. */

export const config = {
  /** Plot axis bounds (inches). Change to [-18,18] for a wider view. */
  plotMin: -12,
  plotMax: 12,

  /** Visual strike-zone rectangle (inches, centered at 0,0).
   *  Width = 17" plate.  Height ≈ average zone height.  */
  zoneWidth: 17 / 2,   // ±8.5"
  zoneHeight: 23 / 2,  // ±11.5"
} as const;
