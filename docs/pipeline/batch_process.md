## batch_process.py Reference

Main pipeline script. Processes marked pitches through SAM 2 to compute miss distance between the catcher's target and where the ball actually landed.

Source: `src/batch_process.py`

### Per-Pitch Flow

1. **Read pitch_log.json** -- Load pre-marked target (T) and arrival (A) frames from the pitch log. If no log exists, opens a scrubber for manual marking.
2. **Create mini-clip** -- Extract frames from `T - pad` to `A + pad`, crop to the detection ROI, write as JPEGs to a temp directory. In fast mode, only the target and arrival frames are extracted (`create_mini_clip_sparse()`).
3. **Glove detection** -- In interactive mode, user clicks on the glove in the target frame. In batch mode (`--batch`), auto-detects the glove via an HSV color filter targeting tan/brown leather (`auto_detect_glove()`).
4. **SAM 2 segmentation** -- Run SAM 2 on the click point to produce a glove mask. The centroid of the mask on the target frame is the "target position."
5. **Ball detection** -- User clicks on the ball in the arrival frame. SAM 2 image segmentation refines the click into a precise mask. The centroid is the "ball position." There is no automatic ball detection.
6. **Pitch type** -- Loaded from `pitch_log.json` if present. Otherwise, the clip plays in a preview window and the user selects from the pitcher's arsenal.
7. **Miss calculation** -- `dx = ball_x - target_x`, `dy = ball_y - target_y`. Horizontal direction (arm-side / glove-side) derived from dx and pitcher hand. Vertical direction (high / low) derived from dy.
8. **Outputs** -- CSV row appended, overlay MP4 rendered (if overlay-lite or debug), result PNG saved (if overlay-lite or debug).

### Speed Modes

#### Fast (default)

Uses SAM 2 image predictor on exactly two frames: target and arrival. No video propagation, no overlay video, no result PNG. Only the target and arrival frames are extracted to disk. This is the fastest mode.

Equivalent flags: no flags needed (default), `--no-overlay` (accepted as an alias for clarity).

#### Overlay-lite (`--overlay-lite`)

Same SAM 2 image-predictor-only approach as fast mode, but also renders an overlay MP4 and result PNG. The overlay uses static markers (target crosshair, ball circle, miss vector line, text box) rather than per-frame glove mask tracking. Dramatically faster than debug mode while still producing review-quality video.

Use `--no-result-png` to skip the result PNG and only produce the overlay video.

Recommended for game review.

#### Debug (`--debug`)

Full SAM 2 video propagation on the ~10-frame mini-clip. Produces per-frame glove masks, an overlay video with mask visualization, and a result PNG. Slow. Use only for deep visual inspection of a single pitch.

### SAM Performance Flags

These flags apply to fast and overlay-lite modes only.

| Flag | Default | Purpose |
|---|---|---|
| `--sam-crop-size N` | 0 (off) | Crop a square NxN region around the click point before SAM 2. Reduces `set_image()` cost. Recommended: 384. |
| `--sam-max-width N` | 0 (off) | Downscale the frame/crop to at most N pixels wide before inference. Applied after crop if both are set. Recommended: 800. |
| `--glove-crop-size N` | 0 (use `--sam-crop-size`) | Override crop size for glove segmentation. Glove is larger and may need a bigger crop. |
| `--ball-crop-size N` | 0 (use `--sam-crop-size`) | Override crop size for ball segmentation. Ball benefits from tighter crops. |

Centroids are mapped back to the original ROI-crop coordinate space before the existing `_to_full_coords()` translation, so miss calculations remain consistent regardless of crop/downscale settings.

Recommended fast invocation:

```bash
python3 src/batch_process.py --clips-dir ... --player-id ... --output-csv ... \
    --sam-crop-size 384 --sam-max-width 800
```

### SAM Mask Quality Guard

After each SAM 2 prediction, the mask area is checked against the crop area:

- If the mask is smaller than 0.05% of the crop area: WARNING printed.
- If the mask is larger than 40% of the crop area: WARNING printed.

In either case, one retry is attempted with `crop_size=0` (full ROI, no sub-crop). Only one retry is made. This prevents bad crops from silently corrupting centroids.

### Pitch Preview Window

During interactive mode (no `--batch`), each pitch clip plays in an OpenCV window ("Pitch Preview") that loops until the user presses Enter.

- Enter closes the window and proceeds to pitch type selection in the terminal.
- Manually closing the window also proceeds.
- On macOS, after the window closes, the app auto-activates Terminal (or iTerm2 if Terminal fails) via `osascript` so keyboard focus returns to the terminal prompt.
- Controlled by `--focus-terminal` (default ON on macOS, OFF elsewhere) and `--no-focus-terminal`.

### Timing

Each pitch reports three timing values:

- **compute** -- Sum of: frames extraction, glove_seg, ball_seg, miss_calc, csv_write, overlay_render, result_png.
- **user** -- Sum of: time waiting for glove click, ball click, and pitch type selection.
- **wall** -- Total elapsed time (compute + user).

At the end of a run, a summary breaks down compute and user phases separately, including per-phase totals, averages, fastest/slowest pitch, and percentage breakdown of compute phases.

### Outputs

| Output | Location | Modes |
|---|---|---|
| CSV row | `--output-csv` path | All modes |
| Overlay MP4 | `{outing_dir}/results/pitch_NNN_overlay.mp4` | Overlay-lite, debug |
| Result PNG | `{outing_dir}/results/pitch_NNN_result.png` | Overlay-lite (unless `--no-result-png`), debug |

The overlay video and result PNG use different coordinate spaces:
- Overlay video draws on cropped ROI frames (mini-clip coordinates).
- Result PNG draws on the full-frame image using full-frame coordinates.
- Miss distance values (inches, pixels) are always computed in full-frame space and are correct in both outputs.

### Key Functions

| Function | Purpose |
|---|---|
| `create_mini_clip()` | Extract + crop frames around T/A into a temp directory for SAM 2 video propagation (debug mode). |
| `create_mini_clip_sparse()` | Extract only the target and arrival frames (fast/overlay-lite modes). |
| `get_video_predictor()` | Lazy-load and cache the SAM 2 video predictor (debug mode). |
| `get_image_predictor()` | Lazy-load and cache the SAM 2 image predictor (fast/overlay-lite modes). |
| `auto_detect_glove()` | HSV color filter for tan/brown leather. Returns centroid + confidence. Used in `--batch` mode. |
| `track_glove_mini()` | SAM 2 video propagation on mini-clip frames. Returns per-frame glove masks (debug mode). |
| `click_ball_manual()` | User click on arrival frame. SAM 2 image segmentation refines to ball centroid. |
| `_sam_image_segment()` | Run SAM 2 image predictor on a single frame at a click point. Handles crop, downscale, and quality guard. |
| `calculate_miss_simple()` | Compute dx, dy, total distance, arm-side/glove-side, high/low from two coordinate pairs. |
| `render_overlay_video()` | Write overlay MP4 with per-frame glove masks, circles, lines, text box (debug mode only). |
| `render_overlay_lite()` | Write overlay MP4 with static markers only (overlay-lite mode). |
| `process_single_pitch_fast()` | Fast mode entry point: image predictor on 2 frames, no overlay. |
| `process_single_pitch_debug()` | Debug mode entry point: full video propagation + overlay + result PNG. |
| `PitchTimer` | Accumulates per-phase timings for a single pitch. |
| `RunTimer` | Accumulates timings across all pitches in a run. |

### CLI Arguments

```
--clips-dir DIR          Directory containing pitch_NNN.mp4 clips (required)
--player-id ID           Pitcher identifier, e.g. SLangan1 (required)
--output-csv PATH        CSV output path (required)
--pitcher-hand R|L       Pitcher throwing hand (default: R)
--zone-height INCHES     Strike zone height in inches (default: 23)
--start-at N             Start at pitch N for resuming (default: 1)
--batch                  Fully automatic batch mode (auto-detect glove, still requires ball click)
--sheet-id ID            Google Sheet ID for player data
--arsenals-csv PATH      Path to Arsenals.csv (default: data/Arsenals.csv)
--show-roi               Preview the configured detection ROI and exit
--debug                  Full SAM 2 video propagation + overlay + result PNG
--overlay-lite           Render overlay MP4 with static markers (no video propagation)
--no-overlay             Alias for fast mode (default behavior)
--no-result-png          Skip result PNG (only relevant with --overlay-lite)
--sam-crop-size N        Crop square around click point before SAM 2 (0=off)
--sam-max-width N        Downscale to this width before SAM 2 (0=off)
--glove-crop-size N      Override crop size for glove segmentation
--ball-crop-size N       Override crop size for ball segmentation
--roi "x,y,w,h"         Detection ROI as comma-separated ints
--roi-file PATH          Path to JSON file with ROI keys
--require-roi            Require ROI before processing (default: True)
--no-require-roi         Allow processing without ROI
--focus-terminal         Auto-focus Terminal after preview (default ON on macOS)
--no-focus-terminal      Disable auto-focus of Terminal
```

### ROI Resolution Order

The detection ROI is resolved in this priority order (per-outing, config.yaml is not consulted):

1. `--roi` CLI flag
2. `--roi-file` CLI flag
3. `<outing_dir>/roi.json`
4. `pitch_log.json` top-level `"roi"` key
5. Interactive selection on the first clip frame (fallback)
