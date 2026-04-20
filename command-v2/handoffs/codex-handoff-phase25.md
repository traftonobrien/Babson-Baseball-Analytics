# Codex Handoff — Phase 25: Calibration and Ground Truth

**Project:** Babson Baseball / Pitch Tracker — Command Tracker V2
**Phase:** 25 of 30 (Milestone v5.0)
**Goal:** Measure empirical constants on existing processed footage. No new production code. All outputs go into `command-v2/calibration/`.

---

## Read First (in this order)

1. `command-v2/README.md` — folder map, tech stack, what v2 replaces
2. `docs/pipeline/command-tracker-v2.md` — full architecture and calibration rationale
3. `.planning/REQUIREMENTS.md` — requirements CALIB-01, CALIB-02, CALIB-03
4. `command-v2/calibration/ct2_calibration.yaml` — the constants you must populate
5. `command-v2/calibration/measurements.md` — the measurement log you must fill in

Do not read any other files until you have read all five of these.

---

## Context You Need to Know

### Existing pipeline (do not touch)
- `src/mark_pitches.py` — human scrubs video, marks T and A frames, saves `pitch_log.json`
- `src/batch_process.py` — reads `pitch_log.json`, runs SAM2, computes miss vector
- `src/track_glove.py` — SAM2 glove tracker (requires human click to initialize)

### What T and A mean
- **T frame** — the frame where the catcher's glove is stationary in the target/set position, just before pitch arrival. This is the catcher's *intended* target.
- **A frame** — the frame where the glove closes at ball reception. This is where the ball actually arrived.
- Miss = ball_centroid(A) − glove_centroid(T). The entire downstream pipeline depends on these two frames being accurate.

### Existing processed outings
- Location: `outings/<playerId>/<dateId>/`
- Each outing has: `pitch_log.json` (human-marked T and A frame numbers) and `clips/pitch_NNN.mp4` (trimmed clip per pitch)
- `pitch_log.json` is the ground truth for this phase. Do not modify it.
- To list available outings: `ls outings/`

### What this phase produces
All outputs go into `command-v2/calibration/`. Nothing changes in `src/` or `outings/`.

---

## Install Requirements

```bash
# YOLO is the primary Phase 25 engine (custom glove detector/segmenter)
# SAM2/SAM3 are optional baselines only
pip install ultralytics

pip install mediapipe  # tasks API (0.10.x) — mp.solutions.pose is deprecated
pip install opencv-python
pip install matplotlib
pip install numpy
pip install pyyaml
pip install scipy  # for find_peaks in area timeseries analysis
```

Also download the MediaPipe Pose Landmarker task model:
```bash
wget -O command-v2/notebooks/pose_landmarker_full.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
```

Verify installs before proceeding:
```bash
python -c "import mediapipe; print('mediapipe ok')"
python -c "import cv2; print('cv2 ok')"
python -c "import matplotlib; print('matplotlib ok')"
python -c "import scipy.signal; print('scipy ok')"
```

---



## YOLO Pivot Note (2026-04-20)

Phase 25 is now YOLO-first by decision. Any older SAM2/SAM3 text in this doc should be interpreted as:
- YOLO is the primary calibration engine
- SAM2/SAM3 may be used only as optional baselines for comparison
- Calibration constants in `ct2_calibration.yaml` should be derived from YOLO outputs

## Plan 25-01: Glove Area Timeseries (YOLO)

**Requirement:** CALIB-01
**Output:** Plots in `command-v2/calibration/glove_area_timeseries/`, constants in `ct2_calibration.yaml`

**Important:** Use **YOLO** for Phase 25 calibration.
Provide your trained glove checkpoint when available; this is the primary calibration path.
SAM2/SAM3 are optional comparison baselines only and do not drive constants.

**T-frame convention:** In `pitch_log.json`, `target_frame` is always clip-relative frame 10
(a fixed convention set in `mark_pitches.py`). `target_frame_abs` is the absolute inning frame.
For clips, use `target_frame` (= 10). For A frames, use `arrival_frame` from pitch_log.json.

**Available data:** 978 ground-truthed pitches across 29 outings — far exceeds the 20-pitch minimum.
Select a representative sample across catchers and lighting conditions.

### What to build
A script at `command-v2/notebooks/run_yolo_calibration.py` that:

1. Reads `pitch_log.json` from a given outing to get ground-truth T and A frame numbers
2. Loads the corresponding `clips/pitch_NNN.mp4` for each pitch
3. Initializes a YOLO glove detector/segmenter (`ultralytics`) with a provided model checkpoint
4. Runs YOLO on every frame of each clip, extracts glove area (mask area if available, otherwise bbox area)
5. Plots area vs. frame number with T and A marked as vertical lines
6. Computes per-pitch stats: open plateau area, closed floor area, drop magnitude, frames to close
7. Saves plots to `command-v2/calibration/glove_area_timeseries/<catcher_id>_pitch<NNN>.png`

### Script interface
```bash
python command-v2/notebooks/run_yolo_calibration.py \
  --outing CBurrows1/2026_03_26 \
  --output command-v2/calibration/glove_area_timeseries/
```

### Minimum data
Run on at least 20 pitches across at least 2 different outings. More is better.

### What to measure and record
After running, fill in `command-v2/calibration/measurements.md` Section 1 with:
- Median open area (px²) across all measured T frames
- Median closed area (px²) across all measured A frames
- Median drop magnitude (open − closed)
- Median frames to close (frame of A − frame where drop begins)
- Standard deviation of open area across catchers/lighting conditions
- Whether per-outing normalization is needed (high std dev = yes)

Then populate these fields in `command-v2/calibration/ct2_calibration.yaml`:
```yaml
glove:
  open_area_px: <median>
  closed_area_px: <median>
  drop_threshold_ratio: <closed_median / open_median>
  drop_frames: <median frames to close>
  open_area_std_dev_px: <std dev>
```

### Acceptance criteria
- At least 20 pitches measured
- At least 2 catchers / outings represented
- Plots exist for every measured pitch
- All four glove fields in ct2_calibration.yaml are non-null

---

## Plan 25-02: Leg Lift Timing (MediaPipe Pose)

**Requirement:** CALIB-02
**Output:** Timing table in `measurements.md`, constants in `ct2_calibration.yaml`

### What to build
A script at `command-v2/notebooks/measure_leg_lift_timing.py` that:

1. Loads the **full inning video** (not the clip) — the pitcher is NOT in the existing catcher ROI.
   Inning videos are in `outings/<playerId>/<dateId>/` — check for `.mp4` files at that level.
2. Uses the **MediaPipe tasks API** (NOT the deprecated `mp.solutions.pose`):
   ```python
   import mediapipe as mp
   from mediapipe.tasks import python as mp_python
   from mediapipe.tasks.python import vision as mp_vision
   BaseOptions = mp_python.BaseOptions
   PoseLandmarker = mp_vision.PoseLandmarker
   PoseLandmarkerOptions = mp_vision.PoseLandmarkerOptions
   options = PoseLandmarkerOptions(
       base_options=BaseOptions(model_asset_path="command-v2/notebooks/pose_landmarker_full.task")
   )
   ```
3. Extracts LEFT_KNEE (landmark 25) and RIGHT_KNEE (landmark 26) Y positions per frame
4. Identifies the lead leg (opposite of pitching arm — check pitcher hand from roster or pitch_log)
5. Finds the frame where lead knee Y position is minimum (highest in image = largest leg lift)
   Use `scipy.signal.find_peaks` on the inverted Y signal
6. Uses `target_frame_abs` from pitch_log.json as the proxy for release (it is after release but consistent)
7. Prints: leg lift peak frame, T-frame absolute, interval in frames

**Note on release frame:** We do not have a machine-marked release frame. Use `target_frame_abs` as a
proxy — it is always after release and the interval is consistent. Goal is window width, not exact timing.

### Script interface
```bash
python command-v2/notebooks/measure_leg_lift_timing.py \
  --outing CBurrows1/2026_03_26 \
  --pitches 1,2,3,4,5,6,7,8,9,10
```

### What to measure and record
For each pitch, record in `measurements.md` Section 2:
- Pitcher name
- Outing ID
- Pitch number
- Mechanic (windup or stretch — read from pitch_log.json or note manually)
- Leg lift peak frame (MediaPipe output)
- T frame (from pitch_log.json ground truth)
- Interval = T frame − leg lift peak frame

Compute median interval separately for windup and stretch.

Then populate in `ct2_calibration.yaml`:
```yaml
pose:
  camera_fps: <actual FPS from video metadata>
  leg_lift_to_release_frames_windup: <median>
  leg_lift_to_release_frames_stretch: <median>
  window_pre_frames: 10    # start looking 10 frames before leg lift peak
  window_post_frames: 20   # extend 20 frames past the expected release
```

To get camera FPS from video metadata:
```python
import cv2
cap = cv2.VideoCapture("clips/pitch_001.mp4")
fps = cap.get(cv2.CAP_PROP_FPS)
print(fps)
```

### Acceptance criteria
- At least 10 pitches measured
- Windup and stretch both represented if both mechanics appear in the outings
- `camera_fps`, `leg_lift_to_release_frames_windup` populated in yaml

---

## Plan 25-03: T-Frame Precision Tolerance

**Requirement:** CALIB-03
**Output:** Tolerance table in `measurements.md`, constant in `ct2_calibration.yaml`

### What to build
A script at `command-v2/notebooks/measure_t_frame_tolerance.py` that:

1. Reads `pitch_log.json` for ground-truth T frames
2. For each of 10 selected pitches, re-runs the miss calculation (from `src/calculate_miss.py` or equivalent) with T shifted by ±3, ±5, ±10 frames
3. Computes the Euclidean distance (px) between the original miss vector and the shifted miss vector
4. Outputs a table: pitch number, offset, miss delta (px)

### How miss calculation works (read before building)
Open `src/batch_process.py` and `src/calculate_miss.py`. The miss vector is:
```
miss_px = (ball_centroid_at_A) - (glove_centroid_at_T)
```
You are shifting T, so glove_centroid changes while ball_centroid stays fixed.
The delta you measure is: `|miss_shifted - miss_original|` in pixels.

**Convert to inches using `config.yaml`:** `pixels_per_inch: 3.8831` (already calibrated).
Report miss delta in both pixels AND inches — inches are more meaningful for the tolerance decision.

**T-frame range context:** T-to-A frame range across the full dataset is 19–153 frames (median 50)
at 30fps. A ±10 frame offset is a meaningful fraction of that window — do not be surprised if it
produces large miss deltas.

### Script interface
```bash
python command-v2/notebooks/measure_t_frame_tolerance.py \
  --outing CBurrows1/2026_03_26 \
  --pitches 1,2,3,4,5,6,7,8,9,10 \
  --offsets 3,5,10
```

### What to measure and record
Fill in `measurements.md` Section 3:
- Median miss delta at ±3 frames
- Median miss delta at ±5 frames
- Median miss delta at ±10 frames
- Percentage of pitches where delta > 5px at each offset

Then determine `acceptable_offset_frames`: the largest offset where median delta stays under 5px.
This becomes the precision target for Phase 27's auto-detector.

Populate in `ct2_calibration.yaml`:
```yaml
ta_tolerance:
  acceptable_offset_frames: <determined value>
  delta_at_3_frames_px: <median>
  delta_at_5_frames_px: <median>
  delta_at_10_frames_px: <median>
```

### Acceptance criteria
- 10 pitches measured at all three offsets
- `acceptable_offset_frames` is determined and recorded
- All four ta_tolerance fields in yaml are non-null

---

## Bonus: Extract Reference Frame Crops

While running 25-01, also extract T and A frame crops for the VLM reference library.
These are used in Phase 29 (VLM ambiguity resolver) as few-shot examples.

```python
# For each pitch after extracting frames:
import cv2

cap = cv2.VideoCapture(f"clips/pitch_{pitch_num:03d}.mp4")
cap.set(cv2.CAP_PROP_POS_FRAMES, t_frame)
ret, frame = cap.read()
cv2.imwrite(f"command-v2/reference/glove-open/{catcher_id}_{outing_id}_pitch{pitch_num:03d}_T.png", frame)

cap.set(cv2.CAP_PROP_POS_FRAMES, a_frame)
ret, frame = cap.read()
cv2.imwrite(f"command-v2/reference/glove-closed/{catcher_id}_{outing_id}_pitch{pitch_num:03d}_A.png", frame)
```

Target: 20+ images per folder across 2+ catchers.

---

## Completion Checklist

Before declaring Phase 25 done, verify all of these:

- [ ] `command-v2/calibration/glove_area_timeseries/` — at least 20 plot files
- [ ] `command-v2/calibration/measurements.md` — all three sections filled with real values
- [ ] `command-v2/calibration/ct2_calibration.yaml` — zero null fields remaining
- [ ] `command-v2/reference/glove-open/` — 20+ T-frame crop images
- [ ] `command-v2/reference/glove-closed/` — 20+ A-frame crop images
- [ ] `command-v2/notebooks/run_yolo_calibration.py` — committed
- [ ] `command-v2/notebooks/measure_leg_lift_timing.py` — committed
- [ ] `command-v2/notebooks/measure_t_frame_tolerance.py` — committed
- [ ] `git add command-v2/ && git commit -m "feat(ct2): phase 25 calibration complete"`

---

## What Comes Next (Phase 26)

Phase 26 builds `command-v2/src/detect_pitches.py` — the MediaPipe Pose pitch onset detector.
It reads `pose.leg_lift_to_release_frames_*` and `pose.window_*` from the yaml you just populated.

Handoff doc will be at: `command-v2/handoffs/codex-handoff-phase26.md`

---

## If You Get Stuck

- **MediaPipe import error:** `mp.solutions.pose` is removed in 0.10.x. Use `mp.tasks.vision.PoseLandmarker` — see Install Requirements section above for correct API shape.
- **MediaPipe landmarks wrong angle:** Center-field camera — pitcher faces away from camera, so leg lift appears as the *near* leg rising. Test with a single frame and print all landmark Y values to identify the correct knee index. LEFT_KNEE=25, RIGHT_KNEE=26.
- **YOLO glove class/weights unclear:** use a trained glove checkpoint (`--model`) and explicit class id/name settings for calibration runs.
- **`pitch_log.json` format unclear:** Open `src/mark_pitches.py`, search for where it writes the file — the schema is defined there. Key fields: `target_frame` (clip-relative, always 10), `target_frame_abs` (absolute inning frame), `arrival_frame`.
- **Inning video path unclear:** Look in `outings/<playerId>/<dateId>/` for `.mp4` files that are NOT in the `clips/` subfolder — those are the full inning recordings.
- **Miss calculation unclear:** Open `src/batch_process.py`, find the `calculate_miss` call, trace the inputs. Pixel-to-inch conversion: `pixels_per_inch: 3.8831` from `config.yaml`.
