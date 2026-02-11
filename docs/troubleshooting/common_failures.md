## Common Failures and Fixes

### SAM 2 import error

Ensure venv is activated (`source venv/bin/activate`) and `sam2` is installed.

### Model not found

Check `models/sam2.1_hiera_large.pt` exists.

### No clips found

Run `mark_pitches.py` first to create clips.

### Empty glove mask

The click point was off-target. Re-run without `--batch` and click more precisely.

### MPS out of memory

Mini-clips are ~10 frames. If still OOM, reduce pad or switch to CPU in `get_video_predictor()`.

### Ball not detected / wrong position

User clicks on ball manually. Bad SAM 2 mask causes centroid drift. Causes: imprecise click, motion blur, ball blending with background. Fix: click more precisely, or use 60fps video.

### Glove drift in SAM 2 propagation

SAM 2 may lose the glove if the initial click is poor or glove moves rapidly. The critical frame is the target frame. Fix: ensure target frame shows a stable, clearly visible glove.

### Auto glove detection fails (batch mode)

HSV filter targets tan/brown leather. Fails with non-standard glove colors or lighting changes. Fix: run without `--batch` and click manually.

### Wrong frame selection

- **Target frame** = catcher has set up, glove in intended position, before pitch
- **Arrival frame** = ball reaches the catcher

At 30fps, 1 frame = ~33ms. A 90mph fastball covers ~17 inches per frame.

### Detection ROI misconfigured

If ROI doesn't cover catcher area, mini-clips miss glove/ball. Preview with `--show-roi`. Re-set with `python3 src/calibrate.py --set-roi --video sourcevideo/inning.mov`.

### Calibration wrong

All inch values depend on `pixels_per_inch`. Pixel values are always correct. Re-calibrate: `python3 src/calibrate.py`.

### Batch process opens scrubber UI again

pitch_log.json not found in clips folder, or stale copy in outing root. Ensure it exists at `outings/<playerId>/<dateId>/clips/pitch_log.json`.

### Multiple lockfiles Next.js warning

Harmless. Caused by both pnpm-lock.yaml and package-lock.json existing. Safe to ignore.

### Zsh bracket error

Zsh treats `[playerId]` as a glob. Quote bracket paths: `"web/app/player/[playerId]/page.tsx"`.

### Count mismatch (clips vs overlays vs CSV)

A pitch was skipped or files are misnumbered. Recheck CSV pitch_number column and file names. Rerun batch_process.py if needed.
