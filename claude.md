# Pitch Tracker

Baseball pitch command tracking system. Uses SAM 2 (Segment Anything Model 2) to track the catcher's glove and segment the ball, then measures "miss distance" — how far the pitched ball landed from the catcher's target.

## NON-NEGOTIABLE RULES

1. **Canonical perspective:** Center-field camera, viewing from behind the pitcher toward home plate. All spatial descriptions in this document and in code use this perspective. There is no other valid perspective for this system.
2. **Miss vector definition:** `dx = ball_x - target_x`, `dy = ball_y - target_y`. These are image-space deltas. Do not redefine.
3. **Arm-side / glove-side labeling:** Derived from `dx` and pitcher hand using `arm_sign = 1 if pitcher_hand == "R" else -1`. `dx * arm_sign > 0` = arm-side. This must not be reinterpreted or inverted without updating this document, the truth table below, and every file that implements the logic.
4. **Batch workflow is primary.** The standalone workflow (`extract_frames.py` → `track_glove.py` → `track_ball.py` → `calculate_miss.py` → `visualize.py`) is legacy and exists for debugging only. New features target `batch_process.py`.
5. **Code ↔ documentation parity:** Any change to Python source must be reflected in this file. Any change to this file that contradicts code must be flagged in Known Issues until the code is updated.

## Design Assumptions

- **Center-field camera.** Static, fixed position behind the pitcher. No panning, no zoom during a pitch.
- **Catcher's glove is visible and stationary at the target frame.** The glove must be clearly distinguishable and in its intended target position before the pitch is thrown.
- **Ball is visible at the arrival frame.** The ball must be identifiable in the frame where it reaches the catcher. Motion blur or occlusion degrades results.
- **One pitch per clip.** Each clip in `clips/` contains exactly one pitch, cut from target_frame - pad to arrival_frame + pad.
- **Manual T/A frame marking is correct.** The pipeline trusts the user's target and arrival frame selections from `mark_pitches.py`. Garbage in, garbage out.
- **Calibration is accurate.** All inch-based measurements depend on `pixels_per_inch` from `calibrate.py`. If calibration is wrong, inch values are wrong (pixel values remain correct).
- **Detection ROI contains the catcher and ball arrival zone.** The ROI crop must include the glove at the target frame and the ball at the arrival frame, or detection will fail silently.
- **Ball detection is manual.** The user clicks on the ball; SAM 2 segments the click. There is no automatic ball detection in the current pipeline.

## Current Development Focus

- Stabilizing the `batch_process.py` pipeline end-to-end
- Ensuring direction labeling (arm-side/glove-side, high/low) is correct and consistent across all output files
- Preparing for batch CSV export and miss heatmap visualization
- **Not in scope:** SAM 3 migration, web UI, fully automatic ball detection, multi-camera support

## Quick Start

> **Warning:** The standalone workflow (Workflow B below) is legacy and intended for debugging only. The batch workflow is authoritative.

```bash
# 1. Mark pitches in full inning video (scrubber UI)
python3 src/mark_pitches.py --video sourcevideo/inning.mov --output-dir outings/2024-01-15 --player-id SLangan1

# 2. Process all marked pitches — FAST mode (default, no overlay)
python3 src/batch_process.py --clips-dir outings/2024-01-15/clips --player-id SLangan1 --pitcher-hand R --output-csv outings/2024-01-15/pitch_data.csv

# 2b. With review overlay videos — OVERLAY-LITE mode (recommended for game review)
python3 src/batch_process.py --clips-dir outings/2024-01-15/clips --player-id SLangan1 --pitcher-hand R --output-csv outings/2024-01-15/pitch_data.csv --overlay-lite

# 2c. Deep debugging a single pitch — DEBUG mode (slow, full SAM2 propagation)
python3 src/batch_process.py --clips-dir outings/2024-01-15/clips --player-id SLangan1 --pitcher-hand R --output-csv outings/2024-01-15/pitch_data.csv --debug

# 3. Generate scouting report
python3 src/generate_report.py --csv outings/2024-01-15/pitch_data.csv
```

## Repo Structure

```
pitch-tracker/
├── config.yaml              # Model paths, calibration, detection ROI, video FPS
├── requirements.txt          # torch, torchvision, sam2, opencv-python, numpy, PyYAML
├── claude.md                 # This file (single source of truth)
├── pitch_data.csv            # Legacy single-pitch CSV output
│
├── src/
│   ├── arsenals.py           # Shared arsenal loader from data/Arsenals.csv
│   ├── mark_pitches.py       # Manual pitch marking (scrubber UI) + clip cutting
│   ├── batch_process.py      # Main pipeline: SAM 2 tracking + miss calc per pitch
│   ├── extract_frames.py     # Extract JPEG frames from video (standalone/debug)
│   ├── calibrate.py          # Calibrate pixels-per-inch + set detection ROI
│   ├── track_glove.py        # Standalone SAM 2 glove tracking (legacy/debug)
│   ├── track_ball.py         # Standalone classical CV ball detection (legacy/debug)
│   ├── calculate_miss.py     # Standalone miss calculation from .npy files (legacy/debug)
│   ├── visualize.py          # Standalone overlay video renderer (legacy/debug; also imported by batch_process.py)
│   ├── segment_pitches.py    # Auto-segment pitches from inning video via motion detection (experimental)
│   ├── export_csv.py         # CSV row builder and writer (used by batch_process.py)
│   ├── sheets_sync.py        # Google Sheets player database sync
│   └── generate_report.py    # Scouting command report from CSV
│
├── models/
│   └── sam2.1_hiera_large.pt # SAM 2.1 checkpoint (~900MB)
│
├── configs/
│   └── sam2.1/
│       └── sam2.1_hiera_l.yaml  # SAM 2.1 model config
│
├── data/
│   ├── Arsenals.csv          # Player arsenals (single source of truth for pitch types)
│   ├── players.yaml          # Local player database (synced from Google Sheets)
│   └── credentials.json      # Google service account credentials (not committed)
│
├── input/                    # Default input video directory (standalone workflow)
├── frames/                   # Extracted JPEG frames (standalone workflow)
├── output/                   # Standalone workflow outputs
├── outings/                  # Per-outing directories (batch workflow)
├── sourcevideo/              # Raw inning videos
└── venv/                     # Python virtual environment
```

## Two Workflows

### Workflow A: Batch Pipeline (primary)

This is the active workflow. Uses `mark_pitches.py` to mark T/A frames in full inning video, then `batch_process.py` to process each pitch with SAM 2.

**Step 1: Mark pitches** — `src/mark_pitches.py`

Opens a scrubber UI on the full inning video. User scrubs to the **target frame** (catcher's glove is set as target, press T) and **arrival frame** (ball reaches the catcher, press A), optionally sets pitch type via number keys (mapped to player's arsenal), then confirms with Enter. Repeats for each pitch. After all pitches are marked, cuts individual clips.

- **Input:** Full inning video (`.mov` / `.mp4`)
- **Output:**
  - `clips/pitch_001.mp4`, `pitch_002.mp4`, ... (each clip = target_frame - pad to arrival_frame + pad)
  - `pitch_log.json` (list of pitches with `pitch`, `video_index`, `target_frame`, `arrival_frame`, `pitch_type`)
- **CLI:** `--video FILE` or `--videos FILE1 FILE2 ...`, `--output-dir DIR`, `--pad N` (default 5), `--player-id ID` (for arsenal), `--sheet-id ID`
- **Multi-video:** Pass `--videos` for multiple inning segments. Pitch numbering continues across videos.

**Step 2: Process pitches** — `src/batch_process.py`

Processes each clip through the SAM 2 pipeline. Per-pitch flow:

1. Read pre-marked T/A frames from `pitch_log.json` (or open scrubber if no log)
2. Create **mini-clip**: extract frames `T-pad` to `A+pad`, crop to detection ROI → temp directory of JPEGs
3. **Glove detection:**
   - Normal mode: user clicks on glove in target frame
   - Batch mode (`--batch`): auto-detect glove via HSV color filter (tan/brown leather), use as click point
4. **SAM 2 video propagation** on mini-clip (~10 frames) → glove masks for all frames
5. **Ball detection:** user clicks on ball in arrival frame → SAM 2 image segmentation → precise centroid
6. **Pitch type:** from `pitch_log.json`, or play clip + arsenal selection UI
7. **Miss calculation:** dx/dy between glove centroid (target frame) and ball centroid (arrival frame)
8. **Outputs per pitch:**
   - Row appended to CSV
   - `{stem}_overlay.mp4` — overlay video with masks, circles, H/V lines, text box
   - `{stem}_result.png` — annotated arrival frame still image

- **CLI:** `--clips-dir DIR`, `--player-id ID`, `--pitcher-hand R|L`, `--output-csv PATH`, `--zone-height INCHES` (default 23), `--start-at N`, `--batch`, `--sheet-id ID`, `--show-roi`, `--debug`, `--no-overlay`, `--overlay-lite`, `--no-result-png`, `--sam-max-width INT`, `--sam-crop-size INT`, `--glove-crop-size INT`, `--ball-crop-size INT`
- **Speed modes:**
  - **Fast mode (default):** Uses SAM 2 image predictor on 2 frames only (target + arrival). No video propagation, no overlay video, no result PNG. Extracts only the target and arrival frames to disk.
  - **Overlay-lite mode (`--overlay-lite`):** Same SAM 2 image-predictor-only approach as fast mode, but also renders an overlay MP4 and result PNG. Overlay uses static markers (target crosshair, ball circle, miss vector/text) — no glove mask tracking across frames. Dramatically faster than `--debug` while still producing review-quality video.
  - **Debug mode (`--debug`):** Full SAM 2 video propagation on ~10-frame mini-clip + per-frame glove mask overlay + result PNG. Use for deep visual inspection only.
  - `--no-overlay` is an alias for fast mode (accepted for clarity, same as default).
  - `--no-result-png` skips result PNG generation (only relevant with `--overlay-lite`).
- **Recommended usage:**
  - Full game processing with review videos: `--overlay-lite`
  - Maximum speed, no videos: (default, no flags)
  - Deep debugging a single pitch: `--debug`
- **SAM performance flags (fast / overlay-lite modes):**
  - `--sam-crop-size N` (default 0 = off, recommended 384): Crop a square NxN region around the click point before running SAM 2. Reduces `set_image()` cost significantly.
  - `--sam-max-width N` (default 0 = off, recommended 800): Downscale the frame/crop to at most N pixels wide before SAM 2 inference. Applied after crop if both are set.
  - `--glove-crop-size N` (default 0 = use `--sam-crop-size`): Override crop size for glove segmentation only. Glove is larger and may need a bigger crop.
  - `--ball-crop-size N` (default 0 = use `--sam-crop-size`): Override crop size for ball segmentation only. Ball benefits from tighter crops.
  - Centroids are mapped back to the original ROI-crop coordinate space before the existing `_to_full_coords()` translation, so miss calculations remain consistent.
  - Recommended fast invocation: `--sam-crop-size 384 --sam-max-width 800`
- **SAM mask quality guard:** If a predicted mask is suspiciously small (<0.05% of crop area) or large (>40%), a WARNING is printed and one retry is attempted with `crop_size=0` (full ROI). This prevents bad crops from silently corrupting centroids. Only one retry is attempted.
- **Pitch preview window:** During interactive mode, the pitch clip plays in an OpenCV window ("Pitch Preview") that loops until Enter is pressed. Enter immediately closes the window and proceeds to pitch type selection in the terminal. If the window is manually closed, it also proceeds. On macOS, after closing the window the app automatically activates Terminal (or iTerm if Terminal fails) via `osascript` so focus returns to the terminal prompt. Controlled by `--focus-terminal` (default ON on macOS, OFF elsewhere) / `--no-focus-terminal`.
- **Timing: compute vs user:** Each pitch reports three timing values:
  - `compute` — frames + glove_seg + ball_seg + miss_calc + csv_write + overlay_render + result_png
  - `user` — time waiting for glove click, ball click, and pitch type selection
  - `wall` — total elapsed time (compute + user)
  - End-of-run summary breaks down compute and user phases separately.
- **Outputs directory:** `{outing_dir}/results/` (overlay-lite and debug modes for overlay/PNG; CSV always written)

**Step 3: Generate report** — `src/generate_report.py`

Reads pitch CSV, groups by pitch type, computes averages, detects tendencies (>1.5" bias), generates recommendations.

- **CLI:** `--csv PATH`, `--pitcher-name NAME`, `--pitcher-hand R|L`

### Workflow B: Standalone Pipeline (legacy/debug only)

> **Warning:** This workflow is legacy. Use Workflow A for all production work.

Individual scripts run sequentially. Operates on a single pitch clip at a time using files in `frames/` and `output/`.

```bash
python3 src/extract_frames.py --video input/pitch.mov
python3 src/calibrate.py                              # Interactive plate-width click
python3 src/track_glove.py --frame 60                 # Click on glove, SAM 2 full-video propagation
python3 src/track_ball.py                             # Classical CV ball detection
python3 src/calculate_miss.py --target-frame 60 --pitcher-hand R --export-csv pitch_data.csv
python3 src/visualize.py --target-frame 60 --show-zone --export-frame
```

Artifacts: `frames/*.jpg`, `output/glove_masks.npz`, `output/ball_positions.npy`, `output/miss_results.npy`, `output/overlay.mp4`, `output/arrival_frame.png`

## File Reference

### `src/batch_process.py` (main pipeline)

| Function | Purpose |
|---|---|
| `create_mini_clip()` | Extract + crop frames around T/A into temp dir for SAM 2 |
| `get_video_predictor()` | Lazy-load SAM 2 video predictor (cached) |
| `get_image_predictor()` | Lazy-load SAM 2 image predictor (cached) |
| `auto_detect_glove()` | HSV color filter for tan/brown leather → centroid + confidence |
| `track_glove_mini()` | SAM 2 video propagation on mini-clip frames |
| `click_ball_manual()` | User click → SAM 2 image segmentation → ball centroid |
| `calculate_miss_simple()` | dx/dy/dist calculation from two points |
| `render_overlay_video()` | Write overlay MP4 matching visualize.py style (debug mode only) |
| `process_single_pitch_fast()` | Fast mode: image predictor on 2 frames, no overlay |
| `process_single_pitch_debug()` | Debug mode: full video propagation + overlay + result PNG |
| `create_mini_clip_sparse()` | Extract only target + arrival frames (fast mode) |
| `_sam_image_segment()` | Run SAM 2 image predictor on a single frame at a click point |
| `PitchTimer` / `RunTimer` | Per-pitch and per-run timing instrumentation |

### `src/calibrate.py`

| Function | Purpose |
|---|---|
| `interactive_calibrate()` | Click two plate edges → compute pixels_per_inch |
| `interactive_set_roi()` | Draw rectangle → save detection_roi to config.yaml |
| `save_calibration()` | Write ppi + plate_center_x to config.yaml |
| `save_roi()` | Write detection_roi to config.yaml |

### `src/export_csv.py`

CSV columns: `pitch_number`, `pitcher_name`, `pitcher_hand`, `pitch_type`, `target_frame`, `arrival_frame`, `target_x`, `target_y`, `ball_x`, `ball_y`, `total_miss_px`, `total_miss_inches`, `h_miss_px`, `h_miss_inches`, `h_direction`, `h_miss_signed`, `v_miss_px`, `v_miss_inches`, `v_direction`, `v_miss_signed`, `target_quadrant`, `result_quadrant`, `target_zone`, `timestamp`

Key: `h_miss_signed` is negative for arm-side, positive for glove-side. `v_miss_signed` is negative for high, positive for low.

### `src/sheets_sync.py`

Google Sheets structure:
- Worksheet "Players": `player_id`, `name`, `hand`, `team`, `position`, `notes`
- Worksheet "Arsenal": `player_id`, `pitch_type`, `abbreviation`, `avg_velo`, `usage_pct`

Auth: service account credentials at `data/credentials.json`. Synced data cached at `data/players.yaml`.

### `src/arsenals.py` (shared arsenal loader)

Loads `data/Arsenals.csv` and provides cached lookups:
- `get_player_name(player_id)` → str | None
- `get_player_hand(player_id)` → "R" | "L" | None
- `get_player_arsenal(player_id)` → list of `{abbreviation, pitch_type}` dicts
- `reload()` — force re-read of CSV

**CSV columns:** `player_id`, `player_name`, `pitcher_hand`, `pitch_type`, `abbreviation`

Used by `batch_process.py` (via `--arsenals-csv`) and `segment_pitches.py` (via `--player-id`). Falls back gracefully if file is missing.

**Two copies of Arsenals.csv exist:** `data/Arsenals.csv` (Python scripts) and `web/public/data/Arsenals.csv` (web app). Keep them in sync manually (export from Google Sheets → replace both).

## Coordinate System and Miss Direction (Canonical Definitions)

All directions are described from the center-field camera perspective: the camera looks from behind the pitcher toward home plate. "Right in image" = toward first base. "Left in image" = toward third base. "Up in image" = higher in the strike zone. "Down in image" = lower / toward the ground.

### Image Coordinate System

- **Origin:** top-left corner of the image/frame
- **+X:** rightward (toward first base)
- **+Y:** downward (toward the ground)

### Miss Calculation

```
dx = ball_x - target_x    (positive = ball is RIGHT of target in image = toward 1B)
dy = ball_y - target_y    (positive = ball is BELOW target in image = lower pitch)
```

- **Target position:** centroid of SAM 2 glove mask on the **target frame** (catcher's glove is set before the pitch is thrown)
- **Ball position:** centroid of SAM 2 ball segmentation on the **arrival frame** (ball reaches the catcher)

### Vertical Direction

| `dy` sign | Image meaning | Pitch meaning |
|---|---|---|
| `dy < 0` | Ball is ABOVE target | Pitch missed **HIGH** |
| `dy > 0` | Ball is BELOW target | Pitch missed **LOW** |

### Horizontal Direction (arm-side / glove-side)

"Arm-side" and "glove-side" describe which side of the target the ball missed, labeled relative to the pitcher's throwing arm. This is a standard baseball convention.

From the center-field camera:
- Rightward in image = toward first base
- Leftward in image = toward third base

A right-handed pitcher's throwing arm is on the first base side (right in image). A left-handed pitcher's throwing arm is on the third base side (left in image).

**RHP (right-handed pitcher):**
- Arm-side = first base side = rightward in image = **positive dx**
- Glove-side = third base side = leftward in image = **negative dx**

**LHP (left-handed pitcher):**
- Arm-side = third base side = leftward in image = **negative dx**
- Glove-side = first base side = rightward in image = **positive dx**

### Truth Table

| Pitcher Hand | `dx > 0` (ball right of target) | `dx < 0` (ball left of target) |
|---|---|---|
| **RHP** | **arm-side** | **glove-side** |
| **LHP** | **glove-side** | **arm-side** |

### Code Implementation

```python
arm_sign = 1 if pitcher_hand == "R" else -1
h_direction = "arm-side" if dx * arm_sign > 0 else "glove-side"
v_direction = "high" if dy < 0 else "low"
```

This logic is implemented identically in: `batch_process.py:calculate_miss_simple()`, `calculate_miss.py` (standalone), `export_csv.py:build_row()`, `visualize.py:classify_miss_direction()`.

### Signed Miss Convention (CSV)

- `h_miss_signed`: **negative = arm-side**, positive = glove-side
- `v_miss_signed`: **negative = high**, positive = low

This convention is set in `export_csv.py:build_row()`.

### Strike Zone Quadrant Codes

9-box grid with row codes `U/M/D` (up/middle/down) and column codes based on pitcher hand:

| Pitcher Hand | Left column (image, 3B side) | Middle | Right column (image, 1B side) |
|---|---|---|---|
| **RHP** | I (In) | M (Middle) | A (Away) |
| **LHP** | A (Away) | M (Middle) | I (In) |

"In" = toward the batter (same-handed matchup). "Away" = away from the batter. For RHP facing a right-handed batter: inside = toward the batter on the 3B side = left in image. This labeling uses the standard pitcher-vs-same-hand-batter convention.

## config.yaml Reference

```yaml
model:
  checkpoint: models/sam2.1_hiera_large.pt
  config: configs/sam2.1/sam2.1_hiera_l.yaml

paths:
  input_video: input/pitch.mov      # Standalone workflow only
  frames_dir: frames/               # Standalone workflow only
  output_dir: output/               # Standalone workflow only

video:
  fps: 30                           # Used for timestamp calculation

calibration:
  plate_width_inches: 17            # Standard home plate width
  pixels_per_inch: 5.8247           # From calibrate.py
  plate_center_x: 936.5            # Horizontal center of plate in pixels

detection_roi:                      # Crop region for mini-clips
  x: 374
  y: 343
  width: 353
  height: 343
```

The `detection_roi` defines the crop applied to frames before SAM 2 processing. Set it with `python3 src/calibrate.py --set-roi --video sourcevideo/inning.mov`. The right 40% of this ROI is considered the "catcher region" for auto glove detection.

## How to Resume (Claude Code)

### What to read first

1. This file (`claude.md`)
2. `config.yaml` — current calibration values, ROI
3. `data/players.yaml` — current player database
4. `src/batch_process.py` — main pipeline, most likely to need changes

### Validate the system

```bash
# Check syntax of all source files
python3 -c "import ast; ast.parse(open('src/batch_process.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('src/mark_pitches.py').read()); print('OK')"
python3 -c "import ast; ast.parse(open('src/visualize.py').read()); print('OK')"

# Check imports resolve (no missing modules)
python3 -c "from src.export_csv import build_row, write_row, next_pitch_number; print('OK')"
python3 -c "from src.sheets_sync import get_player, get_default_sheet_id; print('OK')"

# List available players
python3 src/sheets_sync.py --list

# Preview detection ROI
python3 src/batch_process.py --clips-dir outings/<DATE>/clips --player-id SLangan1 --output-csv /dev/null --show-roi
```

### Expected outputs per outing

```
outings/<date>/
├── clips/
│   ├── pitch_001.mp4
│   ├── pitch_002.mp4
│   └── ...
├── pitch_log.json
├── pitch_data.csv
└── results/
    ├── pitch_001_overlay.mp4
    ├── pitch_001_result.png
    ├── pitch_002_overlay.mp4
    ├── pitch_002_result.png
    └── ...
```

### If something fails

- **SAM 2 import error:** Ensure venv is activated (`source venv/bin/activate`) and `sam2` is installed
- **Model not found:** Check `models/sam2.1_hiera_large.pt` exists
- **No clips found:** Run `mark_pitches.py` first to create clips
- **Empty glove mask:** The click point was off-target. Re-run without `--batch` and click more precisely
- **MPS out of memory:** Mini-clips are ~10 frames; if still OOM, reduce pad or switch to CPU in `get_video_predictor()`

## Troubleshooting

### Ball not detected / wrong position
The user clicks on the ball manually. If the SAM 2 segmentation returns a bad mask, the centroid will be off. Causes:
- Click was not precisely on the ball
- Ball is occluded or blurred (motion blur at 30fps)
- Ball blends with background (white ball on white jersey/sign)

Fix: click more precisely, or consider upgrading to 60fps video.

### Glove drift in SAM 2 propagation
SAM 2 may lose the glove across frames if the initial click is poor or the glove moves rapidly. The critical frame is the **target frame** — the glove centroid from this frame defines the "target" position for miss calculation. The glove position on other frames is used only for the overlay video visualization.

Fix: ensure the target frame shows a stable, clearly visible glove.

### Auto glove detection fails (batch mode)
The HSV filter (`[8, 40, 80]` to `[25, 180, 220]`) targets tan/brown leather. Fails when:
- Glove is a non-standard color (black, grey, pink)
- Lighting changes significantly between innings
- Catcher's gear blends with glove color

Fix: run without `--batch` and click manually, or adjust HSV ranges in `auto_detect_glove()` in `batch_process.py`.

### Wrong frame selection
- **Target frame** = the frame where the catcher has set up (glove is in its intended target position, before the pitch is thrown)
- **Arrival frame** = the frame where the ball reaches the catcher's glove area

If T and A are swapped or off by many frames, the miss distance will be meaningless. At 30fps, 1 frame = ~33ms. A 90mph fastball covers ~17 inches per frame, so frame accuracy matters.

### FPS limitations
At 30fps, a 90mph fastball moves ~17 inches per frame. The arrival frame is the nearest frame to actual ball arrival, introducing up to ~8.5 inches of positional uncertainty along the ball's trajectory. Lateral (horizontal/vertical) miss is less affected because the ball's trajectory is mostly along the camera axis.

60fps video would halve this uncertainty.

### Detection ROI misconfigured
If the ROI doesn't cover the catcher area, mini-clips will miss the glove/ball. Preview with `--show-roi`. Re-set with `python3 src/calibrate.py --set-roi --video sourcevideo/inning.mov`.

### Calibration (pixels_per_inch) is wrong
All inch-based measurements depend on `pixels_per_inch`. If this is wrong, all miss distances in inches will be scaled incorrectly (px values remain accurate). Re-calibrate by clicking the two edges of home plate: `python3 src/calibrate.py`.

## Known Issues / Mismatches

1. **`get_zone_bounds()` is duplicated** across `calculate_miss.py`, `visualize.py`, and `export_csv.py` with slightly different implementations. The `visualize.py` version accepts a `zone_center_x` parameter; the others do not. `batch_process.py` imports from `visualize.py`.

2. **`classify_quadrant()` is duplicated** across `calculate_miss.py`, `visualize.py`, and `export_csv.py`. The implementations are functionally equivalent but the `visualize.py` version has more detailed docstrings.

3. **`track_ball.py` standalone uses `config["ball_detection"]` HSV thresholds** (`[0, 0, 200]` to `[180, 60, 255]`), but `batch_process.py` does not use `track_ball.py` at all — ball detection in the batch pipeline is user-click + SAM 2. The `ball_detection` config section is only relevant to the standalone workflow.

4. **`segment_pitches.py` produces a different `pitch_log.json` format** than `mark_pitches.py`. The auto-segmenter includes `delivery_frame`, `start_frame`, `end_frame`, `timestamp`, `motion_peak`. The manual marker includes `pitch`, `video_index`, `target_frame`, `arrival_frame`, `pitch_type`. `batch_process.py` expects the `mark_pitches.py` format only.

5. **`batch_process.py` `--batch` mode still requires user click for ball.** The `--batch` flag auto-detects glove only. Ball detection always requires a manual click + SAM 2 segmentation. Fully automatic batch processing is not implemented.

7. **Fast mode uses SAM 2 image predictor for glove instead of video predictor.** The glove centroid comes from a single-frame segmentation rather than multi-frame propagation. This is slightly less precise (no temporal smoothing) but produces the same centroid from the target frame. Miss measurements are equivalent for well-clicked points.

6. **Overlay video vs. result PNG coordinate spaces:** `render_overlay_video()` in `batch_process.py` draws circles/lines using **cropped ROI coordinates** (because the overlay video is built from cropped mini-clip frames). The result PNG (`_result.png`) draws on the **full-frame** image using full-frame coordinates. Miss distance values (inches, pixels) are always computed in full-frame space and are correct in both outputs.

## Next Features (Roadmap)

- **Heatmaps / aggregation:** Scatter plot of miss vectors across an outing, overlaid on a strike zone. Group by pitch type, zone, count.
- **Auto ball detection:** Re-introduce ball detection that doesn't require user click. Previous attempts (HSV + motion + SAM refinement) were removed for reliability. A trained ball detector or frame-differencing approach could work.
- **Auto target/arrival frame detection:** Detect when the glove stops moving (target) and when the ball enters the catcher region (arrival). Would reduce reliance on `mark_pitches.py` scrubber.
- **60fps support:** Higher frame rate reduces positional uncertainty. The pipeline already supports arbitrary FPS via `config.yaml`.
- **Pitch velocity estimation:** Using ball position across multiple frames + calibrated distance from mound to plate.
- **Automated PDF report export** from `generate_report.py` output.
