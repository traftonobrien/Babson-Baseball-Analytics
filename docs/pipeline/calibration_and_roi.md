## Calibration and ROI Reference

Covers `calibrate.py` (pixels-per-inch measurement and ROI selection) and the `config.yaml` settings that drive the pipeline.

Source: `src/calibrate.py`

### Calibration (pixels_per_inch)

The calibration step converts pixel distances to real-world inches. The user clicks the two edges of home plate (17 inches standard width) in a frame, and the script computes `pixels_per_inch`.

```bash
python3 src/calibrate.py
```

This opens an OpenCV window showing a frame from the `frames/` directory (standalone workflow). Click two points on the edges of home plate, then press any key. The script computes the pixel distance between the two clicks, divides by 17 inches, and saves the result to `config.yaml`.

To skip the interactive UI and set a known value directly:

```bash
python3 src/calibrate.py --ppi 3.8831
```

#### Per-Outing Calibration

For command outings, calibration can now be stored per outing instead of only in `config.yaml`.

```bash
python3 src/calibrate.py \
  --video outings/<playerId>/<dateId>/inning1.mp4 \
  --frame 0 \
  --outing-dir outings/<playerId>/<dateId>
```

This writes:

- `<outing_dir>/calibration.json`
- `pitch_log.json` top-level `"calibration"` key when that file exists

You can also write a known value directly to an outing:

```bash
python3 src/calibrate.py \
  --ppi 6.42 \
  --plate-center-x 938.0 \
  --outing-dir outings/<playerId>/<dateId>
```

#### What Gets Saved

- `calibration.pixels_per_inch` -- The computed PPI value.
- `calibration.plate_center_x` -- The horizontal midpoint of the two clicked plate edges, in pixels.

All inch-based miss measurements depend on this value. If calibration is wrong, inch values are wrong. Pixel values remain correct regardless.

#### Calibration Resolution in batch_process.py

The batch pipeline now resolves calibration in this order:

1. `config.yaml` `calibration` block (fallback base)
2. `pitch_log.json` top-level `"calibration"` key
3. `<outing_dir>/calibration.json`
4. `--calibration-file`
5. CLI overrides like `--ppi` and `--plate-center-x`

This means a single bad global calibration no longer has to apply to every outing.

The `config.yaml` default should match the standard Babson home-field AWRE export. For Trinity or any other field/camera setup, do not reuse the home-field default blindly; save a per-outing calibration instead.

### Detection ROI

The detection ROI defines the crop region applied to video frames before SAM 2 processing. It should tightly enclose the pitcher-catcher corridor, excluding crowd, signs, and dugouts.

#### Setting the ROI

```bash
python3 src/calibrate.py --set-roi --video sourcevideo/inning.mov
```

This opens a frame from the video and lets you draw a rectangle. The right 40% of the rectangle is labeled "CATCHER" and the rest is labeled "PITCHER" as a visual guide. Press Enter to confirm.

The ROI is saved to `config.yaml` under `detection_roi` with keys `x`, `y`, `width`, `height`.

For outing-specific processing, you can save the ROI directly into the outing instead:

```bash
python3 src/calibrate.py \
  --set-roi \
  --video outings/<playerId>/<dateId>/inning1.mp4 \
  --outing-dir outings/<playerId>/<dateId>
```

That writes `<outing_dir>/roi.json` and updates `pitch_log.json` top-level `"roi"` when available.

Without `--video`, the script uses frames from the `frames/` directory (standalone workflow).

#### How the ROI is Used

- **Mini-clip creation:** `batch_process.py` crops each extracted frame to the ROI before writing to the mini-clip temp directory. SAM 2 operates on these cropped frames.
- **Auto glove detection:** In `--batch` mode, the right 40% of the ROI is treated as the "catcher region" for HSV-based glove detection.
- **Coordinate mapping:** After SAM 2 produces centroids in cropped coordinates, `_to_full_coords()` maps them back to full-frame space for miss calculation.

#### ROI Resolution in batch_process.py

The batch pipeline resolves ROI from per-outing sources only (config.yaml is NOT consulted):

1. `--roi` CLI flag (comma-separated: `"x,y,w,h"`)
2. `--roi-file` CLI flag (path to JSON with x/y/w/h keys)
3. `<outing_dir>/roi.json` file
4. `pitch_log.json` top-level `"roi"` key
5. Interactive selection on the first clip frame (fallback if `--require-roi` is set, which is the default)

Use `--no-require-roi` to skip the interactive fallback and process without any crop.

#### Previewing the ROI

```bash
python3 src/batch_process.py --clips-dir outings/<playerId>/<dateId>/clips \
    --player-id SLangan1 --output-csv /dev/null --show-roi
```

This opens a window showing the first clip frame with the ROI rectangle overlaid, then exits.

#### If the ROI is Misconfigured

If the ROI does not cover the catcher area, the mini-clip frames will miss the glove and/or ball. Symptoms:

- Empty glove masks (SAM 2 finds nothing in the crop).
- Ball click lands outside the cropped region, producing wrong centroids.
- Miss distances are nonsensical.

Fix: re-set the ROI with `--set-roi`, or pass `--roi "x,y,w,h"` on the command line.

### config.yaml Reference

```yaml
model:
  checkpoint: models/sam2.1_hiera_large.pt    # SAM 2.1 model checkpoint
  config: configs/sam2.1/sam2.1_hiera_l.yaml  # SAM 2.1 model config

paths:
  input_video: input/pitch.mov    # Standalone workflow only
  frames_dir: frames/             # Standalone workflow only
  output_dir: output/             # Standalone workflow only

video:
  fps: 30                         # Used for timestamp calculation

calibration:
  plate_width_inches: 17          # Standard home plate width
  pixels_per_inch: 3.8831         # AWRE home-field default
  plate_center_x: 624.3           # AWRE home-field plate center in pixels

detection_roi:                    # Crop region for mini-clips
  x: 374
  y: 343
  width: 353
  height: 343
```

#### Key Sections

| Section | Purpose |
|---|---|
| `model` | Paths to the SAM 2.1 checkpoint and model config. Both must exist or SAM 2 will fail to load. |
| `paths` | Input/output directories for the standalone (legacy) workflow. Not used by `batch_process.py`. |
| `video.fps` | Frames per second. Used for timestamp calculation. Should match the source video FPS. |
| `calibration.plate_width_inches` | Standard home plate width (17 inches). Used during interactive calibration. |
| `calibration.pixels_per_inch` | The computed PPI. All inch measurements derive from this. |
| `calibration.plate_center_x` | Horizontal pixel position of plate center. Used for strike zone quadrant classification. |
| `detection_roi` | The crop rectangle applied to frames before SAM 2 processing. Set with `calibrate.py --set-roi`. |

#### ball_detection Section (standalone only)

```yaml
ball_detection:
  hsv_lower: [0, 0, 200]
  hsv_upper: [180, 60, 255]
  min_radius: 5
  max_radius: 40
  min_circularity: 0.4
  motion_threshold: 25
```

This section is used only by `track_ball.py` in the standalone (legacy) workflow. `batch_process.py` does not use classical ball detection. Ball detection in the batch pipeline is always user-click + SAM 2 segmentation.

### calibrate.py CLI Arguments

```
--ppi FLOAT               Set pixels_per_inch directly (skip interactive click)
--plate-center-x FLOAT   Set plate_center_x directly with --ppi
--plate-width-inches F   Override plate width inches for calibration metadata
--frame N                Frame index to use for calibration display (default: 0)
--set-roi                Interactively set the detection ROI (draw rectangle)
--outing-dir DIR         Save ROI/calibration to the outing instead of config.yaml
--pitch-log FILE         Optional pitch_log.json path to update with outing metadata
--video FILE             Video file to grab a frame from (for calibration or --set-roi)
```

### calibrate.py Functions

| Function | Purpose |
|---|---|
| `interactive_calibrate(frame, plate_width_inches)` | Opens window for user to click two plate edges. Returns (ppi, center_x). |
| `interactive_set_roi(frame)` | Opens window for user to draw ROI rectangle. Returns (x, y, width, height). |
| `save_calibration(ppi, plate_center_x)` | Writes pixels_per_inch and plate_center_x to config.yaml. |
| `save_roi(x, y, w, h)` | Writes detection_roi to config.yaml. |
