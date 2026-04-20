# Reference: Glove Open (T Frames)

These are cropped images of the catcher's glove in the target/set position — the T frame.

Used as few-shot visual reference for the VLM ambiguity resolver (Phase 29).

## What a good T-frame crop looks like
- Glove is stationary, facing the pitcher
- Webbing is clearly visible and open
- No motion blur
- Frame is from within a known pitch window (not between pitches)

## Naming convention
`<catcher_id>_<outing_id>_pitch<NNN>_T.png`
Example: `CBurrows1_2026_03_26_pitch042_T.png`

## How to generate
During Phase 25 calibration, extract T frames from existing processed outings:
```bash
python command-v2/notebooks/extract_reference_frames.py \
  --outing <outing_id> \
  --frame_type T \
  --output command-v2/reference/glove-open/
```

## Current count
0 images — populated during Phase 25
Target: 20+ images across 2+ catchers
