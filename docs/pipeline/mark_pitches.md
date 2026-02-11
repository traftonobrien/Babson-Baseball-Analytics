## mark_pitches.py Reference

Manual pitch marking tool. Opens a scrubber UI on full inning video(s), lets the user mark target and arrival frames for each pitch, then batch-cuts individual clips.

Source: `src/mark_pitches.py`

### Scrubber UI

The scrubber opens an OpenCV window with a frame trackbar. The user scrubs through the video and marks each pitch using keyboard shortcuts:

| Key | Action |
|---|---|
| **T** | Set the current frame as the target frame (catcher's glove is set in target position, before pitch is thrown) |
| **A** | Set the current frame as the arrival frame (ball reaches the catcher) |
| **1-9** | Set pitch type from the pitcher's arsenal (mapped to arsenal order from Arsenals.csv) |
| **Enter** | Confirm the current pitch (requires both T and A to be set) |
| **N** | Reset/undo the current in-progress pitch (clears T, A, and pitch type) |
| **Q** | Done marking. Close the video and proceed to clip cutting. |

The HUD displays:
- Current frame number and total frames
- Current pitch number and count of pitches already marked
- Target frame (green) and arrival frame (orange) if set
- Pitch type if set
- Arsenal key mapping at the bottom (if `--player-id` provided)

When the current frame matches the target or arrival frame, a colored border appears around the entire frame for visual confirmation.

### Outputs

All outputs go to `--output-dir`:

- **`clips/pitch_001.mp4`, `pitch_002.mp4`, ...** -- Individual pitch clips. Each clip spans from `target_frame - pad` to `arrival_frame + pad`.
- **`pitch_log.json`** -- Structured log of all marked pitches. Contains a `videos` array (source filenames) and a `pitches` array.

Each pitch entry in `pitch_log.json`:

```json
{
  "pitch": 1,
  "video_index": 0,
  "target_frame": 245,
  "arrival_frame": 260,
  "pitch_type": "FF"
}
```

The `video_index` corresponds to the position in the `--videos` list (0-indexed). Frame numbers are absolute within the source video.

### CLI Arguments

```
--video FILE          Single video file (mutually exclusive with --videos)
--videos FILE1 FILE2  Multiple video files, processed in order (mutually exclusive with --video)
--output-dir DIR      Output directory for clips/ and pitch_log.json (required)
--pad N               Frames to pad before target and after arrival (default: 5)
--player-id ID        Player ID for arsenal-based pitch type selection via number keys
--sheet-id ID         Google Sheet ID for player data lookup
```

### Multi-Video Support

Pass `--videos` to process multiple inning segments in sequence. Pitch numbering continues across videos. For example, if the first video has 12 pitches, the second video starts at pitch 13.

Each video opens in its own scrubber window. Press Q to finish one video and move to the next.

Example:

```bash
python3 src/mark_pitches.py \
    --videos sourcevideo/inning1.mov sourcevideo/inning2.mov \
    --output-dir outings/SLangan1/2024_01_15 \
    --player-id SLangan1 \
    --pad 5
```

### Arsenal Integration

When `--player-id` is provided, the tool loads the pitcher's arsenal from Google Sheets (or local cache) and maps pitch types to number keys 1-9. The arsenal HUD appears at the bottom of the scrubber window.

If no arsenal is found for the player, pitch type selection is skipped (pitches will have an empty `pitch_type` field in the log).

### Relationship to batch_process.py

`mark_pitches.py` produces the `pitch_log.json` and `clips/` directory that `batch_process.py` consumes. The target_frame and arrival_frame values in the log tell batch_process which frames to use for glove and ball detection without opening a scrubber.
