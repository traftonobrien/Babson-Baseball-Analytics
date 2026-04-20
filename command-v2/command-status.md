# Command Tracker V2 — Live Status

Update this file whenever you switch models, complete a plan, or make a key decision.
This is the single source of truth for anyone picking up this work mid-stream.

---

## Current State

**Active phase:** 25 — Calibration and Ground Truth
**Active plan:** 25-02 — Leg lift timing (MediaPipe Pose, next)
**Last updated:** 2026-04-20 13:26 EDT
**Last worked on by:** Codex (25-01 completed on YOLO baseline)

---

## Phase 25 Plan Status

| Plan | Name | Status | Output |
|---|---|---|---|
| 25-01 | YOLO glove area timeseries | Complete (baseline) | `calibration/glove_area_timeseries/*.png`, `yolo_pitch_measurements.csv`, `yolo_calibration_summary.json` |
| 25-02 | Leg lift timing (MediaPipe Pose) | Not started | `calibration/measurements.md` §2 |
| 25-03 | T-frame precision tolerance | Not started | `calibration/measurements.md` §3 |

---

## What Exists Right Now

| File / Folder | State | Notes |
|---|---|---|
| `command-v2/README.md` | Done | Master orientation doc |
| `command-v2/command-status.md` | Done | This file |
| `command-v2/calibration/ct2_calibration.yaml` | In progress | Glove constants filled from 24-pitch YOLO baseline run |
| `command-v2/calibration/measurements.md` | In progress | Section 1 filled with baseline metrics; Sections 2-3 pending |
| `command-v2/calibration/glove_area_timeseries/` | In progress | 24-pitch baseline plots + summary artifacts generated |
| `command-v2/reference/glove-open/` | Empty | T-frame crops land here during 25-01 |
| `command-v2/reference/glove-closed/` | Empty | A-frame crops land here during 25-01 |
| `command-v2/notebooks/` | In progress | `run_yolo_calibration.py` created and validated |
| `command-v2/src/` | Empty | Production scripts — Phase 26+ only |
| `command-v2/handoffs/codex-handoff-phase25.md` | Updated | Added YOLO pivot note and Plan 25-01 command updates |
| `.planning/phases/25-calibration-and-ground-truth/25-RESEARCH.md` | Done | GSD research doc |

---

## Key Decisions Locked

| Decision | Value | Rationale |
|---|---|---|
| Glove segmentation tool for Phase 25 | YOLO (detector/segmenter) | Primary path is model-driven glove detection on Mac without CUDA dependency |
| SAM2/SAM3 role in Phase 25 | Optional baseline only | Keep only for comparison, not calibration source of truth |
| T-frame convention | `target_frame` = clip-relative frame 10 (always) | Fixed in `mark_pitches.py` |
| Absolute T-frame field | `target_frame_abs` | Use this for inning-video timing work |
| MediaPipe API | `mp.tasks.vision.PoseLandmarker` | `mp.solutions.pose` removed in 0.10.x |
| Pose model file | `command-v2/notebooks/pose_landmarker_full.task` | Download before running 25-02 |
| Pixels per inch | 3.8831 | From `config.yaml` — use for CALIB-03 inch conversion |
| Miss delta threshold | 5px / ~1.3" | "Meaningful" degradation threshold for CALIB-03 |
| Config output file | `command-v2/calibration/ct2_calibration.yaml` | All downstream phases read from here |
| Production script location | `command-v2/src/` | Separate from existing `src/` — merged at Phase 28 |

---

## Calibration Constants (filled by Phase 25)

| Constant | Value | Source |
|---|---|---|
| `glove.open_area_px` | 2507.8915 | Plan 25-01 baseline |
| `glove.closed_area_px` | 2124.5137 | Plan 25-01 baseline |
| `glove.drop_threshold_ratio` | 0.8471 | Plan 25-01 baseline |
| `glove.drop_frames` | 19 | Plan 25-01 baseline |
| `glove.open_area_std_dev_px` | 2702.3192 | Plan 25-01 baseline |
| `pose.camera_fps` | TBD | Plan 25-02 (`cv2.CAP_PROP_FPS`) |
| `pose.leg_lift_to_release_frames_windup` | TBD | Plan 25-02 |
| `pose.leg_lift_to_release_frames_stretch` | TBD | Plan 25-02 |
| `ta_tolerance.acceptable_offset_frames` | TBD | Plan 25-03 |
| `ta_tolerance.delta_at_3_frames_px` | TBD | Plan 25-03 |
| `ta_tolerance.delta_at_5_frames_px` | TBD | Plan 25-03 |
| `ta_tolerance.delta_at_10_frames_px` | TBD | Plan 25-03 |

---

## Known Facts From Research

- **978 ground-truthed pitches** across 29 outings — use `ls outings/` to browse
- **T-to-A frame range:** 19–153 frames (median 50) at 30fps across the dataset
- **Pitcher is NOT in catcher ROI** — Plan 25-02 needs full inning video, not clips
- **No glove click coordinates saved** in `pitch_log.json` — YOLO inference must detect glove directly from frames
- **CSV centroids:** sampled `pitch_data_overlay_lite.csv` files do not include glove centroid columns; YOLO must infer glove per frame

---

## Open Questions

| # | Question | Blocking | Plan |
|---|---|---|---|
| 1 | Which YOLO checkpoint/class config gives stable glove detections on clips? | No — baseline used YOLOWorld; trained glove checkpoint still needed for final constants | 25-01/next run |
| 2 | Is the pitcher clearly visible in full inning video at 1280x720 for MediaPipe? | Yes | 25-02 |
| 3 | How many distinct catchers appear across outings? | No — affects stratification | 25-01 |

---

## Milestone Overview

| Phase | Name | Status |
|---|---|---|
| 25 | Calibration and Ground Truth | In progress |
| 26 | Pitch Onset Detection | Not started — needs Phase 25 constants |
| 27 | Automated T/A Detection | Not started — YOLO + ByteTrack |
| 28 | Charting Integration | Not started |
| 29 | VLM Ambiguity Resolution | Not started |
| 30 | End-to-End Validation | Not started |

---

## Session Log

| Date | Model | What happened |
|---|---|---|
| 2026-04-20 | Claude | Scaffolded command-v2/ folder, created handoff docs, GSD Phase 25 research complete |
| 2026-04-20 | Codex | Session started, required docs reviewed, Phase 25-01 kicked off |
| 2026-04-20 | Codex | Pivoted Phase 25 to YOLO-first, added `run_yolo_calibration.py`, completed 2-pitch smoke run |
| 2026-04-20 | Codex | Completed 24-pitch YOLO baseline compilation across 2 outings; populated Section 1 + glove constants |

---

## How to Update This File

After every plan completion, update:
1. `Phase 25 Plan Status` table — mark the plan done, add output file path
2. `Calibration Constants` table — fill in measured values
3. `What Exists Right Now` — mark notebooks as done once created
4. `Open Questions` — close any that got answered
5. `Session Log` — add a row with date, model, and what happened

After Phase 25 is fully done, update `Active phase` to 26 and reset the plan status table.
