# Release & Arm Angle Visuals

This document describes the "Release Visuals" engine used in the TrackMan player dashboard.

## Overview

The feature provides two visualizations based on a pitcher's average release point:
1.  **Arm Angle Overlay (Movement Chart):** An amber dashed ray indicating the estimated arm slot relative to induced vertical break.
2.  **Release Graphic (Front View):** A schematic pitcher silhouette showing the release height and side from a catcher's perspective.

## Math Engine (`web/lib/release_viz/math.ts`)

### Arm Angle Definition
The "Arm Angle" is a geometric proxy derived from the release position vector relative to the ground origin.
-   **0°**: Horizontal (Sidearm).
-   **90°**: Vertical (Over-the-top).
-   **Formula**: `atan2(releaseHeight, abs(releaseSide))`

### Coordinate Systems

1.  **Movement Chart (Overlay)**
    -   **X-axis**: Horizontal Break (inches).
        -   **RHP**: +X is Arm-side (Right).
        -   **LHP**: -X is Arm-side (Left).
    -   **Y-axis**: Induced Vertical Break (inches). +Y is Up.
    -   **Origin**: (0,0) is the center of the chart (no break).
    -   **Ray Vector**: `computeOverlayRayOnMovementChart` maps the angle to a unit vector in this space.

2.  **Front View Graphic**
    -   **Perspective**: Catcher looking at Pitcher.
    -   **SVG Coordinates**:
        -   X increases to the Right.
        -   Y increases Downwards.
    -   **TrackMan Data**:
        -   `RelSide`: + is toward 1B (Catcher's Right).
        -   `RelHeight`: + is Up.
    -   **Mapping**:
        -   `x = center + (RelSide * scale)`
        -   `y = ground - (RelHeight * scale)`

### Handedness Logic
-   **RHP**: Throws from 3B side (negative RelSide). Arm is on viewer's Left.
-   **LHP**: Throws from 1B side (positive RelSide). Arm is on viewer's Right.

## Data Flow

1.  **Ingest**: TrackMan JSONs are parsed into `TrackmanPitchTypeSummary` rows.
2.  **Aggregation**: `computeArsenalReleaseAverages` (in `selectors.ts`) sums counts and computes weighted averages for `avgRelHeight` and `avgRelSide` across all pitches in the arsenal. It builds a `ReleaseAverages` object.
3.  **Visualization**:
    -   `MovementScatterByType` receives `releaseAverages` and renders `ArmAngleOverlay` inside its SVG.
    -   `ReleaseGraphicFront` receives `releaseAverages` (specifically height/side) and renders the silhouette.

## Extension

To add new metrics (e.g. Extension):
1.  Update `ReleaseAverages` type in `types.ts`.
2.  Update aggregation logic in `selectors.ts`.
3.  Pass new prop to `ReleaseGraphicFront` or other components.
