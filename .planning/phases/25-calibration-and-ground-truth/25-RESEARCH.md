# Phase 25: Calibration and Ground Truth — Research

**Researched:** 2026-04-20
**Domain:** Computer Vision — SAM2/SAM3 segmentation, MediaPipe Pose, glove area signal analysis, T/A frame precision tolerance
**Confidence:** HIGH (ground data from repo; MEDIUM on SAM3 API specifics — not yet installed)

---

## Summary

Phase 25 is a pure measurement phase: no production code is written. The goal is to run existing tools on existing processed footage to produce three empirical constants that every downstream phase (26–30) will consume. The constants live in `config/ct2_calibration.yaml`.

The project has 978 ground-truthed pitches across 29 outings already on disk at `outings/<playerId>/<dateId>/`. Each outing has `pitch_log.json` with human-marked `target_frame` and `arrival_frame` per pitch, plus pre-cut `clips/pitch_NNN.mp4` files. All clips are 30fps (some outings 29.97fps) at 1280x720 or 1920x1080. The T frame is always at clip-relative frame 10 — it is not variable per pitch, it is a fixed offset from clip_start_frame_abs set during `mark_pitches.py`. The A frame varies per pitch (median 50 frames after T, range 19–153 frames at 30fps).

SAM2 is already installed and working (`sam2.1_hiera_large.pt` in `models/`). SAM3 is NOT yet installed and requires a GitHub clone + Hugging Face model access request. For Plan 25-01 (glove area timeseries), SAM2 image predictor is the practical path since SAM3 is not yet available — SAM3 is the target for Phase 27. MediaPipe version 0.10.32 is installed with the new tasks API (`mp.tasks.vision.PoseLandmarker`), not the old `mp.solutions.pose` API.

**Primary recommendation:** Use SAM2 image predictor (already working) for the glove area calibration in Plan 25-01 rather than blocking on SAM3 installation. Plan 25-02 uses MediaPipe PoseLandmarker video mode. Plan 25-03 is pure Python arithmetic on existing pitch_log.json values.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CALIB-01 | Measure glove mask area timeseries for 20+ ground-truthed pitches; document open/closed area ratio and drop magnitude per catcher | SAM2 image predictor can segment glove on T and A frames from existing clips; area = np.sum(mask) in pixels |
| CALIB-02 | Measure leg lift peak-to-release frame interval for Babson pitchers; document window width; windup vs stretch differences | MediaPipe PoseLandmarker video mode on inning videos; knee Y-coordinate gives leg lift peak; T_abs in pitch_log gives release anchor |
| CALIB-03 | Validate T-frame precision tolerance by re-processing pitches with T shifted ±3, ±5, ±10 frames; measure miss vector delta | batch_process.py already computes miss from T/A; re-run with modified T values and compare dx/dy deltas |

</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sam2 | installed (sam2.1_hiera_large.pt) | Glove segmentation on clip frames | Already working in repo; SAM3 not yet installed |
| mediapipe | 0.10.32 | Pose landmarks for leg lift detection | Already installed; tasks API active |
| opencv-python (cv2) | installed | Frame extraction from clips and inning videos | Used throughout existing pipeline |
| numpy | installed | Mask area computation, signal analysis | Standard |
| matplotlib | installed | Plotting area timeseries for visual inspection | Already on system |
| pyyaml | installed | Writing config/ct2_calibration.yaml output | Used in batch_process.py already |
| scipy | check | find_peaks() for plateau detection prototype | May need install check |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json (stdlib) | — | Reading pitch_log.json per outing | Every plan |
| glob (stdlib) | — | Discovering outing directories | Plan 25-01 ground-truth selection |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SAM2 image predictor | SAM3 video predictor | SAM3 not installed; requires Hugging Face model access request; SAM2 is already proven in batch_process.py |
| MediaPipe PoseLandmarker | OpenPose / AlphaPose | MediaPipe already installed and CPU-capable; no GPU needed for calibration |
| scipy.signal.find_peaks | Custom rolling-window variance | scipy is more principled; plateau_size parameter directly applicable |

**Installation check needed:**
```bash
python3 -c "import scipy; print(scipy.__version__)"  # may need: pip install scipy
```

---

## Architecture Patterns

### Recommended Project Structure for Phase 25 Scripts

```
scripts/calibration/
├── 25_01_glove_area_timeseries.py   # CALIB-01: extract mask area at T and A per pitch
├── 25_02_leg_lift_timing.py          # CALIB-02: pose landmarker on inning videos
├── 25_03_t_frame_tolerance.py        # CALIB-03: re-run miss calc at ±3/5/10 offsets
└── plots/                            # Output PNG timeseries plots for inspection
config/
└── ct2_calibration.yaml             # OUTPUT: committed constants consumed by phases 26-30
```

Scripts go in `scripts/calibration/` to distinguish from `src/` production code. They are single-run measurement tools, not importable modules.

### Pattern 1: Frame Extraction from Existing Clips

T is always clip-relative frame 10. A is at `pitch['arrival_frame']`. Clips are pre-cut MP4s at `outings/<playerId>/<dateId>/clips/pitch_NNN.mp4`.

```python
# Source: existing batch_process.py pattern + pitch_log.json contract
import cv2, json

def read_frame(clip_path: str, frame_idx: int):
    cap = cv2.VideoCapture(clip_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    return frame if ret else None

def load_pitch_log(outing_dir: str):
    with open(f"{outing_dir}/pitch_log.json") as f:
        return json.load(f)
```

### Pattern 2: SAM2 Image Predictor for Glove Mask Area (CALIB-01)

Use SAM2 image predictor (same path as batch_process.py) to segment glove at each frame. Area = count of True pixels in mask.

```python
# Source: adapted from src/batch_process.py
import numpy as np
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

def get_glove_mask_area(frame_bgr, click_point, predictor):
    """Return pixel count of glove mask at click_point."""
    image_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    predictor.set_image(image_rgb)
    masks, scores, _ = predictor.predict(
        point_coords=np.array([click_point]),
        point_labels=np.array([1]),
        multimask_output=True,
    )
    best = masks[scores.argmax()]  # (H, W) boolean
    return int(np.sum(best))       # pixel area
```

**Key insight:** The glove click point for each pitch is already implied — batch_process.py has the user click on T frame. For calibration, either re-use those saved click coordinates (if stored) or use the ROI center as a heuristic. The `roi.json` per outing gives the catcher detection region.

**Alternative without re-clicking:** Segment using the ROI bounding box as a SAM2 box prompt instead of a point prompt, focusing on the lower-center of the catcher ROI where the glove typically sits.

### Pattern 3: MediaPipe PoseLandmarker Video Mode (CALIB-02)

The new 0.10.x API uses `mp.tasks.vision.PoseLandmarker` instead of the legacy `mp.solutions.pose.Pose`. Key landmarks for leg lift: LEFT_KNEE (25), RIGHT_KNEE (26), LEFT_ANKLE (27), RIGHT_ANKLE (28), LEFT_HIP (23), RIGHT_HIP (24).

```python
# Source: MediaPipe Tasks Python API (ai.google.dev/edge/mediapipe)
import mediapipe as mp
from mediapipe.tasks.python import vision
from mediapipe.tasks.python.vision import PoseLandmarkerOptions, RunningMode

BaseOptions = mp.tasks.BaseOptions
PoseLandmarker = mp.tasks.vision.PoseLandmarker

# Requires downloading pose_landmarker_full.task model
# https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
options = PoseLandmarkerOptions(
    base_options=BaseOptions(model_asset_path='models/pose_landmarker_full.task'),
    running_mode=RunningMode.VIDEO,
    num_poses=1,
    min_pose_detection_confidence=0.5,
    min_tracking_confidence=0.5,
)

def extract_leg_lift_signal(video_path: str, pitcher_roi: dict):
    """Return per-frame knee Y position (normalized) for pitch onset detection."""
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    knee_y_series = []
    
    with PoseLandmarker.create_from_options(options) as landmarker:
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            # Crop to pitcher ROI (defined separately from catcher ROI)
            # ...
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB,
                                data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            result = landmarker.detect_for_video(mp_image,
                                                  int(frame_idx * 1000 / fps))
            if result.pose_landmarks:
                lms = result.pose_landmarks[0]
                # Use the raised knee (non-pivot foot) — varies by pitcher handedness
                left_knee_y = lms[25].y   # normalized 0-1
                knee_y_series.append((frame_idx, left_knee_y))
            frame_idx += 1
    cap.release()
    return knee_y_series
```

**Leg lift peak:** Minimum y-coordinate of raised knee (in image coordinates, y=0 at top, so minimum y = highest point = peak of leg lift). A local minimum in the knee Y signal = peak leg lift.

**Release anchor:** Use `target_frame_abs` from pitch_log.json as the release proxy. T is the glove-set frame, not exactly release, but it is the frame used for miss calculation and is typically within a few frames of actual ball release/arrival at catcher target zone.

**Model download required:** The PoseLandmarker task requires downloading a `.task` model file — not bundled with the mediapipe pip package.
```bash
wget -O models/pose_landmarker_full.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
```

### Pattern 4: T-Frame Tolerance Testing (CALIB-03)

`batch_process.py` already has `calculate_miss()` (via `src/calculate_miss.py` or inline). The tolerance test is: for each of 10 known pitches, read the saved miss vector from the existing CSV, then re-run the SAM2 image predictor at frames T±3, T±5, T±10 and compare centroid positions.

```python
# Source: adapted from src/batch_process.py calculate_miss pattern
import numpy as np

def measure_tolerance(clip_path, original_t, original_a, offsets, predictor, roi):
    """For each offset, get glove centroid at T+offset and compare to T centroid."""
    base_centroid = get_glove_centroid(clip_path, original_t, predictor, roi)
    results = {}
    for offset in offsets:
        shifted_t = original_t + offset
        if shifted_t < 0:
            continue
        shifted_centroid = get_glove_centroid(clip_path, shifted_t, predictor, roi)
        if base_centroid and shifted_centroid:
            dx = shifted_centroid[0] - base_centroid[0]
            dy = shifted_centroid[1] - base_centroid[1]
            results[offset] = {"dx_px": dx, "dy_px": dy, "dist_px": np.hypot(dx, dy)}
    return results
```

The miss vector uses `pixels_per_inch` from `calibration.yaml` (`pixels_per_inch: 3.8831`). So pixel delta / 3.8831 = inch delta. This converts tolerance from pixels to inches for the coaching-meaningful threshold.

### Pattern 5: Glove Area Signal Analysis (CALIB-01 Output)

The output of CALIB-01 is a per-pitch area timeseries. Key metrics to extract:

```python
import numpy as np

def analyze_area_signal(area_series: list):
    """area_series: list of (frame_idx, pixel_area) tuples."""
    areas = np.array([a for _, a in area_series])
    
    # Open plateau: mean area around T frame (frames T-3 to T+3)
    t_idx = next(i for i, (f, _) in enumerate(area_series) if f == 10)  # T at clip frame 10
    plateau_window = areas[max(0, t_idx-3):t_idx+4]
    open_area = float(np.mean(plateau_window))
    plateau_variance = float(np.std(plateau_window))
    
    # Closed floor: min area after T (glove fully closed)
    post_t_areas = areas[t_idx:]
    closed_area = float(np.min(post_t_areas))
    
    # Drop magnitude and frame of closure
    drop_threshold = open_area * 0.65  # e.g. 65% of open = closed
    drop_frame = next((i for i, a in enumerate(post_t_areas) if a < drop_threshold), None)
    
    return {
        "open_area_px": open_area,
        "closed_area_px": closed_area,
        "open_closed_ratio": open_area / closed_area if closed_area > 0 else None,
        "plateau_variance": plateau_variance,
        "frames_to_closure": drop_frame,
    }
```

### Pattern 6: ct2_calibration.yaml Output Format

```yaml
# Generated by Phase 25 calibration scripts
# Do NOT edit manually — re-run scripts/calibration/ to update
version: "25.0"
generated: "2026-04-XX"

glove_area:
  # CALIB-01 measurements
  open_area_px_mean: 0       # fill from measurements
  open_area_px_std: 0
  closed_area_px_mean: 0
  open_closed_ratio: 0.0     # open/closed; used by Phase 28 state machine
  drop_magnitude_frames: 0   # frames from stable plateau to closed floor
  closure_threshold_ratio: 0.65  # proportion of open area that marks "closed"

leg_lift_timing:
  # CALIB-02 measurements
  peak_to_release_frames_mean: 0
  peak_to_release_frames_std: 0
  peak_to_release_frames_min: 0
  peak_to_release_frames_max: 0
  windup_extra_frames: 0     # additional frames in windup vs stretch
  fps: 30.0

t_frame_tolerance:
  # CALIB-03 measurements
  tolerance_3_frames_delta_in_mean: 0.0
  tolerance_5_frames_delta_in_mean: 0.0
  tolerance_10_frames_delta_in_mean: 0.0
  accepted_tolerance_frames: 3   # COMMIT: ±N frames is acceptable
  accepted_tolerance_inches: 0.0
```

### Anti-Patterns to Avoid

- **Re-running batch_process.py interactively for tolerance testing** — it requires human clicks. Isolate the SAM2 image predictor call and centroid calculation directly instead.
- **Using inning videos for Plan 25-01** — the clips already have T isolated at frame 10. Use clips, not inning videos, for glove area calibration.
- **Running MediaPipe on the catcher ROI** — the pitcher is not in the catcher ROI. Plan 25-02 needs a pitcher ROI or full-frame processing. The existing `roi.json` covers the catcher, not the pitcher.
- **Averaging across catchers** — CALIB-01 output must be stratified by catcher if multiple catchers are in the dataset. Different catchers have different glove sizes and distances from camera.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Glove segmentation | Custom edge detection / HSV thresholding | SAM2 image predictor (already in repo) | SAM2 already trained; HSV ball detection already exists in config but is unreliable for gloves |
| Leg lift peak detection | Custom motion detector | MediaPipe PoseLandmarker | 33 body landmarks with confidence scores; already installed |
| Plateau detection | Rolling-window rolling mean comparison | `scipy.signal.find_peaks` with `plateau_size` or rolling std < threshold | scipy is principled; rolling std approach also fine for this simple case |
| YAML config writing | String interpolation | `yaml.safe_dump()` | Avoids formatting errors in output config |

---

## Common Pitfalls

### Pitfall 1: T Frame Convention Is Clip-Relative, Not Absolute

**What goes wrong:** Confusing `target_frame` (= 10, always, clip-relative) with `target_frame_abs` (absolute frame in the inning video).
**Why it happens:** pitch_log.json stores both. Plan 25-01 uses clip-relative (frame 10 in the clip file). Plan 25-02 uses `target_frame_abs` to anchor the release time in the inning video.
**How to avoid:** Read the relevant field by name from pitch_log.json. Never assume target_frame == target_frame_abs.
**Warning signs:** Getting frame 10 when you expect 646+ (or vice versa).

### Pitfall 2: SAM2 Image Predictor Needs a Click Point — No Glove Coordinates Saved

**What goes wrong:** `batch_process.py` prompts for human glove click at runtime but does not persist the click coordinate to disk.
**Why it happens:** The pipeline was designed to be interactive. There is no `glove_click_x`, `glove_click_y` in `pitch_log.json`.
**How to avoid:** For calibration, use the ROI center as a seed point, or use the center-bottom of the detection ROI (`roi.json`). Alternatively: use a SAM2 box prompt with the ROI rectangle instead of a point. If accuracy is insufficient, select a small sample (5–10 pitches) manually with clicks and scale up.
**Warning signs:** Masks are wrong shape (segmenting pitcher not catcher) or empty.

### Pitfall 3: MediaPipe Pose Model File Not Downloaded

**What goes wrong:** `mp.tasks.vision.PoseLandmarker` throws FileNotFoundError or model init error.
**Why it happens:** The 0.10.x tasks API requires a separate `.task` bundle download, not included in the pip package.
**How to avoid:** Download `pose_landmarker_full.task` to `models/` before running Plan 25-02.
**Warning signs:** Import works but `create_from_options()` fails.

### Pitfall 4: Pitcher Not Visible in Catcher ROI

**What goes wrong:** Plan 25-02 tries to detect leg lift using the existing `roi.json` ROI, which covers the catcher zone — the pitcher is not in it.
**Why it happens:** The existing system defines ROI around the catcher/strike zone. The pitcher stands at the mound ~60 feet away and occupies a different region of the frame.
**How to avoid:** For Plan 25-02, either process full frames (slower) or manually define a pitcher ROI from the inning video (upper 40% of frame, center-right depending on handedness). Document this ROI in `ct2_calibration.yaml` as `pitcher_roi`.
**Warning signs:** PoseLandmarker returns no detections or detects the catcher/umpire instead.

### Pitfall 5: SAM3 Is Not Installed — Do Not Block Plan 25-01 on It

**What goes wrong:** The architecture doc references SAM3 for glove tracking. Plan 25-01 is specifically a calibration step to characterize what SAM3 will eventually see.
**Why it happens:** SAM3 requires GitHub clone + Hugging Face access request + CUDA 12.6 + PyTorch 2.7 + Python 3.12. Current env has Python 3.x, SAM2.
**How to avoid:** Use SAM2 image predictor for CALIB-01 measurements. SAM3 is the Phase 27 target; calibration measurements taken with SAM2 are valid because we are measuring the underlying glove physics (area ratios), not SAM3-specific outputs.
**Warning signs:** Spending time on SAM3 install when the plan goal is empirical measurement, not new tracking code.

### Pitfall 6: T-Frame Tolerance Test Needs Per-Pitch Ground Truth, Not Just Frame Shift

**What goes wrong:** The tolerance test shifts T but compares to the original centroid, not to the "true" miss vector from the human operator.
**Why it happens:** We do not have the original human-operator click centroid saved per pitch.
**How to avoid:** The test is comparative: for each pitch, T is the reference; shifted T gives a different centroid; delta between them = measurement error introduced by frame offset. This is valid even without the absolute ground truth because we are measuring centroid stability, not absolute miss accuracy.

---

## Code Examples

### Example: Reading Ground-Truth Data Per Outing

```python
# Source: pitch_log.json contract — confirmed from repo inspection 2026-04-20
import json, os, glob

def iter_ground_truth_pitches(outings_root="/path/to/outings"):
    for pitch_log_path in glob.glob(f"{outings_root}/*/*/pitch_log.json"):
        outing_dir = os.path.dirname(pitch_log_path)
        clips_dir = os.path.join(outing_dir, "clips")
        if not os.path.isdir(clips_dir):
            continue
        with open(pitch_log_path) as f:
            log = json.load(f)
        for pitch in log.get("pitches", []):
            clip_path = os.path.join(clips_dir, pitch["clip"])
            if os.path.exists(clip_path):
                yield {
                    "outing_dir": outing_dir,
                    "clip_path": clip_path,
                    "pitch_num": pitch["pitch"],
                    "target_frame": pitch["target_frame"],    # always 10
                    "arrival_frame": pitch["arrival_frame"],  # varies 19-153
                    "target_frame_abs": pitch["target_frame_abs"],
                    "fps": pitch.get("fps", 30.0),
                    "source_video": pitch["source_video"],
                }
```

### Example: Glove Area Extraction at Two Frames (CALIB-01)

```python
# Source: adapted from src/batch_process.py SAM2 image predictor usage
import numpy as np, cv2, torch
from sam2.build_sam import build_sam2
from sam2.sam2_image_predictor import SAM2ImagePredictor

def build_predictor(checkpoint="models/sam2.1_hiera_large.pt",
                    config="configs/sam2.1/sam2.1_hiera_l.yaml"):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = build_sam2(config, checkpoint, device=device)
    return SAM2ImagePredictor(model)

def glove_area_at_frame(clip_path, frame_idx, seed_point, predictor):
    """Segment glove at frame_idx using seed_point click. Return pixel area."""
    cap = cv2.VideoCapture(clip_path)
    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return None
    img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    predictor.set_image(img_rgb)
    masks, scores, _ = predictor.predict(
        point_coords=np.array([[seed_point[0], seed_point[1]]]),
        point_labels=np.array([1]),
        multimask_output=True,
    )
    best_mask = masks[scores.argmax()]  # boolean (H, W)
    return int(np.sum(best_mask))
```

### Example: T-Frame Tolerance Delta Computation (CALIB-03)

```python
# Source: adapted from src/batch_process.py calculate_miss logic
import numpy as np
from scipy.ndimage import center_of_mass

def centroid_at_frame(clip_path, frame_idx, predictor, roi, seed_point):
    """Return (x, y) centroid of glove mask at frame_idx."""
    area = glove_area_at_frame(clip_path, frame_idx, seed_point, predictor)
    # ... (use mask not area to get centroid)
    ...

OFFSETS = [-10, -5, -3, -1, 0, 1, 3, 5, 10]
PPI = 3.8831  # pixels per inch from config.yaml

def measure_t_tolerance(clip_path, t_frame, a_frame, predictor, roi, seed_point):
    base_centroid = centroid_at_frame(clip_path, t_frame, predictor, roi, seed_point)
    results = {}
    for offset in OFFSETS:
        shifted_t = t_frame + offset
        if shifted_t < 0 or shifted_t >= a_frame:
            continue
        shifted_centroid = centroid_at_frame(clip_path, shifted_t, predictor, roi, seed_point)
        if base_centroid and shifted_centroid:
            dx_px = shifted_centroid[0] - base_centroid[0]
            dy_px = shifted_centroid[1] - base_centroid[1]
            results[offset] = {
                "dx_in": dx_px / PPI,
                "dy_in": dy_px / PPI,
                "dist_in": np.hypot(dx_px, dy_px) / PPI,
            }
    return results
```

### Example: Leg Lift Peak Detection Signal (CALIB-02)

```python
# Source: MediaPipe Tasks Python API — PoseLandmark indices confirmed 2026-04-20
# LEFT_KNEE=25, RIGHT_KNEE=26, LEFT_HIP=23, RIGHT_HIP=24

import mediapipe as mp
import numpy as np

PoseLandmarker = mp.tasks.vision.PoseLandmarker
BaseOptions = mp.tasks.BaseOptions
PoseLandmarkerOptions = mp.tasks.vision.PoseLandmarkerOptions
RunningMode = mp.tasks.vision.RunningMode

def extract_knee_y_timeseries(inning_video_path, model_path="models/pose_landmarker_full.task"):
    """
    Returns [(frame_idx, knee_y_normalized)] where knee_y is the RAISED knee.
    Minimum knee_y in image coordinates = highest position = leg lift peak.
    """
    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=RunningMode.VIDEO,
        num_poses=1,
        min_pose_detection_confidence=0.4,
    )
    cap = cv2.VideoCapture(inning_video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    series = []
    with PoseLandmarker.create_from_options(options) as lm:
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB,
                                data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            result = lm.detect_for_video(mp_image, int(frame_idx * 1000 / fps))
            if result.pose_landmarks:
                lms = result.pose_landmarks[0]
                # For RHP: left knee (non-pivot) lifts; for LHP: right knee
                left_knee_y = lms[25].y   # normalized; lower value = higher in frame
                right_knee_y = lms[26].y
                raised_knee_y = min(left_knee_y, right_knee_y)  # whoever is highest
                series.append((frame_idx, raised_knee_y))
            frame_idx += 1
    cap.release()
    return series, fps
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `mp.solutions.pose.Pose` | `mp.tasks.vision.PoseLandmarker` | MediaPipe 0.10.0 (2023) | Old API deprecated; new tasks API requires `.task` model file download |
| SAM2 requires human click | SAM3 text prompt "catcher's glove" | Nov 2025 (Phase 27) | Eliminates interactive_select() — but SAM3 not yet installed |
| Single-frame SAM2 image predictor | SAM2/SAM3 video predictor propagation | (Phase 27) | Per-frame glove tracking; calibration uses image predictor |
| Scrubber-based mark_pitches.py | verify_pitches.py strip+confirm | Phase 29 | Phase 25 calibration validates the T-frame tolerance that makes this viable |

**Deprecated/outdated:**
- `mp.solutions.pose`: import raises AttributeError in mediapipe 0.10.32. Use `mp.tasks.vision.PoseLandmarker`.
- SAM2 click-based glove init: archived in Phase 27; SAM2 image predictor still valid for calibration in Phase 25.

---

## Data Available: Ground Truth Inventory

From repo inspection on 2026-04-20:

| Outing | Pitches | FPS | Resolution | Notes |
|--------|---------|-----|-----------|-------|
| BBurk1/2026_03_24 | 45 | 30.0 | 1280x720 | Good sample |
| BReid1/2026_03_26 | 40 | 30.0 | 1280x720 | Wide A-frame range (33–114 diff) |
| CBurrows1/2026_03_01 | 79 | 29.97 | 1920x1080 | Largest single outing; 1080p |
| CBurrows1/2025_03_26 | 25 | 30.0 | 1280x720 | Different season |
| CDoan1/2026_03_26 | 66 | 30.0 | (check) | Good sample |
| CSmith1/2026_02_28 | 75 | 30.0 | (check) | Good sample |
| DJames1/2026_03_24 | 33 | 30.0 | (check) | |
| JClark1/2026_03_25 | 46 | 30.0 | 1280x720 | |
| JFinkelstein1/2026_03_24 | 70 | 30.0 | (check) | |
| + 20 more outings | ~500 more | 30.0 | — | 978 pitches total |

**T-frame statistics (confirmed):**
- `target_frame` is ALWAYS 10 (clip-relative) across all 978 pitches — this is a fixed convention in mark_pitches.py, not a variable.
- `arrival_frame` range: 29 to 163 (clip-relative); median 50 frames after T; mean 54.6 frames.
- At 30fps: median T-to-A = 1.67 seconds; max observed 153 frames = 5.1 seconds.

**FPS:** 30.0 exact (some CBurrows1 outings at 29.97). This should be 30.0 for window-width documentation.

**Catchers:** Multiple catchers across outings (position player catches differ). CALIB-01 must note which catcher each measurement comes from. The ROI per outing covers the single catcher in that outing.

---

## Open Questions

1. **Are glove click coordinates stored anywhere?**
   - What we know: `pitch_log.json` does not include click coordinates.
   - What's unclear: Whether any debug output from batch_process.py ever wrote centroid coordinates to the CSV.
   - Recommendation: Check `pitch_data_overlay_lite.csv` columns before running calibration — if `glove_x`/`glove_y` columns exist, use them as the seed points. Otherwise fall back to ROI-center heuristic.

2. **Is the pitcher visible at 1280x720 from center-field for MediaPipe Pose?**
   - What we know: MediaPipe Pose was validated for baseball pitching classification at 1920x1080 in published research. At 720p the pitcher appears smaller.
   - What's unclear: Minimum detection confidence at 1280x720 from center-field camera angle.
   - Recommendation: Test on one inning video first; if confidence < 0.5 on most frames, try full-frame 1080p outings (CBurrows1/2026_03_01).

3. **Does a pitcher-specific ROI exist or need to be defined?**
   - What we know: `roi.json` defines the catcher ROI only. The config.yaml `detection_roi` is also the catcher zone.
   - What's unclear: Whether there is any existing pitcher ROI definition.
   - Recommendation: For CALIB-02, either process full frame or manually identify pitcher ROI from one video (upper ~40% of frame, center-left of catcher ROI). Document as `pitcher_roi` in `ct2_calibration.yaml`.

4. **Are multiple catchers distinguishable in calibration data?**
   - What we know: Each outing has one catcher. ROI differs per outing.
   - What's unclear: How many distinct catchers appear across outings (names not tracked in pitch_log.json).
   - Recommendation: Group by `outing_dir` parent folder and manually note which outings share the same catcher setup. Report area stats per-outing rather than pooled until catcher identity is confirmed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (Python) |
| Config file | None detected — create `scripts/calibration/conftest.py` if fixtures needed |
| Quick run command | `pytest scripts/calibration/ -x -q` |
| Full suite command | `pytest scripts/calibration/ -v` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CALIB-01 | glove area ratio extracted for 20+ pitches | integration (reads real clips) | `pytest scripts/calibration/test_01_glove_area.py -x` | No — Wave 0 |
| CALIB-02 | knee Y signal extracted and peak detected in known inning | integration (reads real inning video) | `pytest scripts/calibration/test_02_leg_lift.py -x` | No — Wave 0 |
| CALIB-03 | miss delta at each offset is numeric and bounded | unit (uses saved centroid values) | `pytest scripts/calibration/test_03_tolerance.py -x` | No — Wave 0 |
| All | ct2_calibration.yaml exists and has required keys | smoke | `pytest scripts/calibration/test_config_output.py -x` | No — Wave 0 |

**Note:** Plans 25-01 through 25-03 are measurement scripts, not full test suites. Verification is: the output YAML is present and values are within reasonable bounds (area > 0, ratio > 1.0, tolerance in inches > 0).

### Sampling Rate

- Per task commit: `pytest scripts/calibration/ -x -q`
- Per wave merge: same (all calibration tests)
- Phase gate: `ct2_calibration.yaml` exists with all required keys populated before Phase 26 begins

### Wave 0 Gaps

- [ ] `scripts/calibration/` directory — does not exist yet
- [ ] `scripts/calibration/test_config_output.py` — validates YAML schema
- [ ] `models/pose_landmarker_full.task` — MediaPipe model file download
- Framework install: `pip install scipy` — if not present

---

## Sources

### Primary (HIGH confidence)

- Repo inspection 2026-04-20 — `src/batch_process.py`, `src/mark_pitches.py`, `src/track_glove.py`, `config.yaml`, `outings/*/pitch_log.json` (29 outings, 978 pitches)
- Repo inspection — clip metadata: 1280x720 @ 30fps (most), 1920x1080 @ 29.97fps (CBurrows1/2026_03_01), T always at clip frame 10
- MediaPipe tasks Python API — `mp.tasks.vision.PoseLandmarker` confirmed via `dir(mp.tasks.vision)`; landmark indices confirmed (LEFT_KNEE=25, RIGHT_KNEE=26, etc.)
- [MediaPipe Pose Landmarker Python Guide](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/python)

### Secondary (MEDIUM confidence)

- [SAM3 GitHub — facebookresearch/sam3](https://github.com/facebookresearch/sam3) — GitHub clone + pip install; requires Hugging Face model access; CUDA 12.6 + PyTorch 2.7; NOT pip-installable standalone
- [SAM3 Video Predictor API DeepWiki](https://deepwiki.com/facebookresearch/sam3/4-video-segmentation-and-tracking) — `Sam3VideoPredictor`, `handle_request()` session lifecycle, `propagate_in_video()` for mask extraction
- [Baseball pitching phases with MediaPipe (MDPI 2025)](https://www.mdpi.com/2076-3417/15/22/12155) — validated MediaPipe pose for baseball pitching; 12 landmarks used; LightGBM classifies phases in ~6–8s per video
- [scipy.signal.find_peaks documentation](https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.find_peaks.html) — `plateau_size` parameter for flat peak detection

### Tertiary (LOW confidence — needs validation)

- SAM3 Ultralytics integration claim — pip installable via `pip install -U ultralytics`; LOW because it may expose a subset of SAM3 API and checkpoint access still requires HuggingFace approval

---

## Metadata

**Confidence breakdown:**

- Data inventory (outings, pitches, FPS): HIGH — confirmed from repo filesystem
- T-frame convention (always frame 10): HIGH — confirmed across all 978 pitches
- A-frame range (19–153, median 50): HIGH — confirmed from all pitch_log.json files
- SAM2 image predictor approach: HIGH — already used in batch_process.py
- MediaPipe 0.10.x tasks API: HIGH — confirmed imports and landmark indices
- SAM3 installation path: MEDIUM — confirmed GitHub, not pip; HuggingFace access required
- SAM3 text prompt API details: MEDIUM — based on docs/DeepWiki, not tested locally
- MediaPipe Pose detectability at 1280x720 from center field: LOW — not validated on actual footage

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (SAM3 release cadence fast; verify checkpoint access before Phase 27)
