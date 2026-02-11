## segment_pitches.py Reference

Segments full inning video(s) into individual pitch clips. Supports two modes: interactive manual scrubber (default) and automatic motion-based detection.

Source: `src/segment_pitches.py`

### Manual Mode (default)

Opens an interactive scrubber for each video. The user marks target and arrival frames, exports each clip immediately on finalize, and can undo mistakes.

#### Hotkeys

| Key | Action |
|---|---|
| **Space** | Pause / play |
| **j** or Left arrow | Step back 1 frame (paused only) |
| **l** or Right arrow | Step forward 1 frame (paused only) |
| **J** (shift) | Step back 10 frames (paused only) |
| **L** (shift) | Step forward 10 frames (paused only) |
| **t** | Set target frame for current pitch |
| **a** | Set arrival frame for current pitch |
| **n** | Finalize pitch (requires T and A set, T must be before A). Exports the clip immediately. |
| **u** | Undo last finalized pitch. Deletes the exported clip file and restores T/A values. |
| **q** | Quit and write pitch_log.json |

Clips are exported immediately on finalize (not batched at the end). This means the clips directory is populated incrementally, and undo deletes the file from disk.

Pitch numbering auto-detects from existing clips in the output directory. If `clips/pitch_001.mp4` through `pitch_005.mp4` already exist, the next pitch starts at 6. This supports multi-inning workflows where you process one video at a time.

The pitch_log.json merges with any existing log in the output directory, preserving previously finalized pitches and any existing ROI entry.

#### Manual Mode Clip Padding

Controlled by `--pad-before` (default 10) and `--pad-after` (default 10). Each clip spans from `target_frame - pad_before` to `arrival_frame + pad_after`.

### Auto Mode (`--auto`)

Detects pitches automatically via motion analysis. Uses frame differencing within an ROI around the pitching mound to build a motion signal, then finds peaks that correspond to pitch deliveries.

The algorithm:
1. Compute per-frame motion magnitude within the mound ROI (frame differencing + Gaussian blur).
2. Smooth the motion signal (~0.3 second window).
3. Find peaks above an adaptive threshold (percentage of max motion).
4. Enforce minimum gap between detections.
5. Extract clips with 2-second padding before and after each delivery frame.

#### Auto Mode Parameters

| Flag | Default | Purpose |
|---|---|---|
| `--min-gap` | 3.0 | Minimum seconds between detected pitches. Prevents double-counting. |
| `--threshold-pct` | 30 | Motion threshold as a percentage of peak motion. Lower = more sensitive. |
| `--roi X Y W H` | auto | ROI around the mound for motion analysis. If omitted, auto-computed as the center region of the frame. |
| `--no-clips` | off | Skip clip extraction. Only detect and write pitch_log.json. |

### Review Mode (`--review`)

Implies `--auto`. After auto-detection, opens each candidate in the system video player. The user confirms or rejects each candidate in the terminal (y/n/q). Rejected candidates are discarded before clip export.

### Outputs

All outputs go to `--output-dir`:

- **`clips/pitch_001.mp4`, `pitch_002.mp4`, ...** -- Individual pitch clips.
- **`pitch_log.json`** -- Structured log compatible with `batch_process.py`.
- **`motion_signal.png`** (auto mode) -- Motion signal plot with detected pitch markers. One per video if processing multiple videos.

### pitch_log.json Format Differences

Manual mode and auto mode produce different pitch log entry formats.

**Manual mode entries:**

```json
{
  "pitch": 1,
  "clip": "pitch_001.mp4",
  "target_frame": 5,
  "arrival_frame": 15,
  "source_video": "inning1.mp4",
  "target_frame_abs": 245,
  "arrival_frame_abs": 260,
  "clip_start_frame_abs": 235,
  "clip_end_frame_abs": 270,
  "fps": 30.0
}
```

Manual mode entries include `target_frame` and `arrival_frame` (relative to the clip), which is what `batch_process.py` expects.

**Auto mode entries:**

```json
{
  "pitch": 1,
  "clip": "pitch_001.mp4",
  "source_video": "inning1.mp4",
  "delivery_frame": 250,
  "start_frame": 190,
  "end_frame": 310,
  "timestamp": 8.333,
  "motion_peak": 12.45
}
```

Auto mode entries have `delivery_frame`, `start_frame`, `end_frame`, `timestamp`, and `motion_peak`, but lack `target_frame` and `arrival_frame`. This means `batch_process.py` will open its scrubber to let the user mark T/A frames for auto-detected clips.

### CLI Arguments

```
--video FILE            Single video file (mutually exclusive with --videos)
--videos FILE1 FILE2    Multiple video files, processed in order (mutually exclusive with --video)
--output-dir DIR        Output directory for clips/ and pitch_log.json (required)
--auto                  Use auto motion-based detection (default: manual scrubber)
--review                Auto-detect + interactive review of each candidate (implies --auto)
--pad-before N          Frames to pad before target (manual mode, default: 10)
--pad-after N           Frames to pad after arrival (manual mode, default: 10)
--min-gap SECONDS       Minimum seconds between pitches in auto mode (default: 3.0)
--threshold-pct N       Motion threshold as percentage of peak (auto mode, default: 30)
--roi X Y W H           Mound ROI for motion analysis (auto mode, default: auto-computed)
--no-clips              Skip clip extraction, only detect and log (auto mode)
--player-id ID          Player ID for metadata in pitch_log.json
--pitcher-hand R|L      Pitcher hand (auto-resolved from Arsenals.csv if --player-id given)
--arsenals-csv PATH     Path to Arsenals.csv (default: data/Arsenals.csv)
```

### Multi-Video Support

Both modes support `--videos` for multiple inning segments. Pitch numbering continues across videos.

In manual mode, each video opens its own scrubber window sequentially. The pitch_log.json accumulates pitches across all videos.

In auto mode, detection runs on each video separately, clips are numbered continuously, and a combined pitch_log.json is written at the end.

Example:

```bash
python3 src/segment_pitches.py \
    --videos outings/DJames1/03_26_25/inning*.mp4 \
    --output-dir outings/DJames1/03_26_25 \
    --player-id DJames1
```
