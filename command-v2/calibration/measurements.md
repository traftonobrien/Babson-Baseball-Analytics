# Calibration Measurements — Command Tracker V2

**Phase:** 25 — Calibration and Ground Truth
**Status:** In progress — Section 1 populated from YOLO baseline run (2026-04-20)

---

## 1. Glove Area Timeseries (YOLO)

**Method:** Run YOLO glove detection/segmentation on 20+ ground-truthed pitches
from existing processed outings. Extract glove area proxy per frame (mask area when available,
otherwise bbox area). Plot per catcher.

**Outings used:**
- `CBurrows1/2026_03_01`
- `CDoan1/2026_03_26`

| Catcher | Outing ID | Pitches Measured | Notes |
|---|---|---|---|
| CBurrows1 | 2026_03_01 | 12 | Home-field center-field angle clips |
| CDoan1 | 2026_03_26 | 12 | Home-field center-field angle clips |

**Results:**

| Metric | Value | Notes |
|---|---|---|
| Open/target area (median px²) | 2507.89 | From `yolo_calibration_summary.json` |
| Open/target area (std dev) | 2702.32 | High variance; likely needs per-outing normalization |
| Closed/reception area (median px²) | 2124.51 | From `yolo_calibration_summary.json` |
| Drop magnitude (open − closed, median) | 383.38 | Computed from medians |
| Drop sharpness (frames to close) | 19.0 | Median `drop_frames` |
| Drop threshold ratio (closed/open) | 0.8471 | Baseline ratio from YOLO run |
| Variability across catchers | High | Confirm with trained glove model next |

**Plots:** `glove_area_timeseries/<catcher_id>_pitch_<N>.png` (24 generated in baseline run)

---

## 2. Leg Lift Timing (MediaPipe Pose)

**Method:** Manually mark leg lift peak and release frame on 10+ known pitches.
Measure peak-to-release interval in frames at current FPS.

**Camera FPS:** TBD (check video metadata)

**Pitches measured:**

| Pitcher | Outing ID | Pitch # | Mechanic | Leg Lift Frame | Release Frame | Interval (frames) |
|---|---|---|---|---|---|---|
| | | | windup/stretch | | | |

**Results:**

| Mechanic | Median Interval (frames) | Range | Notes |
|---|---|---|---|
| Windup | TBD | TBD | |
| Stretch | TBD | TBD | |

---

## 3. T-Frame Precision Tolerance

**Method:** Re-process 10 pitches with T shifted ±3, ±5, ±10 frames from human-marked value.
Measure miss vector delta (Euclidean distance in pixels) at each offset.

**Pitches used:** (same outings as above for consistency)

**Results:**

| Offset | Median Miss Delta (px) | Max Miss Delta (px) | % pitches where delta > 5px |
|---|---|---|---|
| ±0 (baseline) | 0 | 0 | 0% |
| ±3 frames | TBD | TBD | TBD |
| ±5 frames | TBD | TBD | TBD |
| ±10 frames | TBD | TBD | TBD |

**Accepted tolerance:** TBD frames (committed to `ct2_calibration.yaml`)

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-20 | Phase 25 is YOLO-first | Better Mac reliability; SAM2/SAM3 baseline only |
| 2026-04-20 | Baseline run used YOLO-World prompt `baseball glove` | Immediate compilation across outings before custom glove checkpoint is ready |
