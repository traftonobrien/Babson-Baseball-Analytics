# Release & Arm Angle Visuals V2 (Production Grade)

This document describes the upgraded biomechanical and visual engine for TrackMan release analysis.

## 1. Biomechanical Math Engine (`web/lib/release_viz/math.ts`)

The core innovation in V2 is the shift from "Ground Origin" to "Shoulder Pivot" normalization.

### Arm Angle Formula
We estimate the arm slot relative to the shoulder, then map it to global consensus buckets.

1.  **Baseline**: `SHOULDER_BASELINE_FT` (5.5 ft) approximates the shoulder height.
2.  **Effective Height**: `releaseHeight - 5.5`.
3.  **Raw Angle**: `atan2(effectiveHeight, abs(releaseSide))`.
4.  **Calibration**: `+ BIOMECHANICAL_OFFSET_DEG` (40°) aligns the result with scouting scales.
5.  **Output**: Clamped [0, 90].

### Classification Buckets
| Angle (Deg) | Slot Label | Tier |
|---|---|---|
| 75–90 | Over-the-top | extreme |
| 60–75 | High 3/4 | high |
| 45–60 | 3/4 | mid |
| 30–45 | Sidearm | low |
| 15–30 | Low Sidearm | low |
| 0–15 | Submarine | extreme |

### MLB Percentiles
We assume a Normal Distribution for MLB arm slots:
-   **Mean**: 55° (High 3/4 boundary)
-   **StdDev**: 10°

## 2. Visual Systems

### A) Movement Chart Overlay (`ArmAngleOverlay.tsx`)
-   **Vector**: Maps 0-90° to chart coordinates (HB/IVB).
-   **Visual**: Thick amber beam with tapering opacity and glow.
-   **Handedness**: RHP points Right (+HB), LHP points Left (-HB).

### B) Release Graphic Front (`ReleaseGraphicFront.tsx`)
-   **Perspective**: Catcher View.
-   **Articulated Arm**:
    -   Shoulder anchor (fixed relative to handedness).
    -   Elbow joint (computed via inverse kinematics/heuristic).
    -   Wrist/Ball (actual data point).
-   **Grid**: Labeled in feet.
-   **Legend**: Height, Side, Angle, Slot Label.

## 3. Data Flow

1.  **Ingest**: Raw TrackMan pitch rows.
2.  **Selector**: `computeArsenalReleaseAverages` (weighted aggregation).
3.  **Components**: Receive `ReleaseAverages` object with pre-computed classification.

## 4. Design Standards
-   **Palette**: Zinc-950 background, Amber-400 accents, Zinc-500 text.
-   **Typography**: Monospace numbers, Sans-serif labels.
-   **Effects**: SVG Filters for glow/blur.
