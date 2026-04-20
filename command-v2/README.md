# Command Tracker V2

Automated T/A frame detection pipeline for Babson Baseball pitch tracking.
Reduces per-game processing time from 1–2 hours to 15–20 minutes.

**Status:** Phase 25 (Calibration) in progress
**Architecture doc:** `docs/pipeline/command-tracker-v2.md`
**GSD milestone:** v5.0, phases 25–30

---

## What This Replaces

| v1 (keep unchanged) | v2 (this folder) |
|---|---|
| `src/batch_process.py` | preserved — T/A just come from auto-detector now |
| `src/mark_pitches.py` | replaced by `src/verify_pitches.py` |
| `src/track_glove.py` | replaced by `src/track_glove_v2.py` |
| `src/track_ball.py` | deleted — ball tracking not needed |

Everything in `src/batch_process.py` downstream of knowing T/A is unchanged.
Do not modify it.

---

## Folder Map

```
command-v2/
├── README.md                        ← you are here
├── calibration/
│   ├── ct2_calibration.yaml         ← machine-readable constants (consumed by phases 26–30)
│   ├── measurements.md              ← human-readable documented thresholds
│   └── glove_area_timeseries/       ← per-catcher YOLO area plots (Phase 25)
├── reference/
│   ├── glove-open/                  ← ~20 T-frame crops (VLM few-shot reference)
│   └── glove-closed/                ← ~20 A-frame crops (VLM few-shot reference)
├── src/                             ← new pipeline scripts (phases 26–28)
│   ├── detect_pitches.py            ← Phase 26: pitch onset detector (MediaPipe Pose)
│   ├── track_glove_v2.py            ← Phase 27: YOLO + ByteTrack glove tracker
│   ├── detect_ta_frames.py          ← Phase 27: T/A frame detector from glove timeseries
│   └── verify_pitches.py            ← Phase 27: streamlined strip-view verification UX
├── notebooks/                       ← exploratory analysis (calibration runs, a/b tests)
└── handoffs/                        ← Codex session handoff docs (one per phase)
```

---

## Phase Overview

| Phase | Name | Status | Goal |
|---|---|---|---|
| 25 | Calibration and Ground Truth | In progress | Measure glove area thresholds, leg lift timing, T-frame tolerance on existing footage |
| 26 | Pitch Onset Detection | Planned | `detect_pitches.py` — MediaPipe Pose → pitch windows |
| 27 | Automated T/A Detection | Planned | YOLO glove tracker + ByteTrack + T/A state machine + verify UX |
| 28 | Charting Integration | Planned | Auto-fill pitch type from charting sequence match |
| 29 | VLM Ambiguity Resolution | Planned | Claude/Gemini few-shot resolver for low-confidence pitches |
| 30 | End-to-End Validation | Planned | Full pipeline validation at 15-20 min/game target |

---

## Tech Stack

| Component | Role | Replaces |
|---|---|---|
| YOLO (custom glove model) | Glove detection/segmentation for calibration + tracking | Manual glove click in batch_process |
| ByteTrack (roboflow-trackers) | Persistent glove identity through brief occlusions | None (new) |
| MediaPipe Pose | Pitch onset detection from leg lift | Manual scrubbing in mark_pitches |
| Glove state machine | Open/closed from mask area threshold | None (new) |

---

## Install (when starting Phase 26+)

```bash
pip install mediapipe
pip install roboflow-trackers
pip install supervision
# Install YOLO/Ultralytics for calibration + detection
pip install ultralytics
```

---

## Calibration Constants (populated by Phase 25)

Committed to `calibration/ct2_calibration.yaml`. All downstream phases read from there.
Do not hardcode any of these values in src/ scripts.

Key constants that Phase 25 must produce:
- `glove.open_area_px` — median mask area when glove is at open/target position
- `glove.closed_area_px` — median mask area post-reception
- `glove.drop_threshold_ratio` — fraction of open area that triggers closure detection
- `glove.drop_frames` — typical number of frames for area to drop at reception
- `pose.leg_lift_to_release_frames` — median peak-to-release interval (windup)
- `pose.leg_lift_to_release_frames_stretch` — median peak-to-release interval (stretch)
- `ta_tolerance.acceptable_offset_frames` — max T-frame offset before miss vector degrades meaningfully

---

## Starting a Codex Session

1. Read this file first
2. Read `docs/pipeline/command-tracker-v2.md` for full architecture
3. Read `.planning/ROADMAP.md` for phase requirements
4. Read `handoffs/codex-handoff-phase{N}.md` for the active phase
5. Execute plans in the handoff doc in order — do not skip steps
6. All measurement outputs go in `calibration/`; all new scripts go in `src/`
