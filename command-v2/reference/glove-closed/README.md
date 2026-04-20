# Reference: Glove Closed (A Frames)

These are cropped images of the catcher's glove at the moment of reception — the A frame.

Used as few-shot visual reference for the VLM ambiguity resolver (Phase 29).

## What a good A-frame crop looks like
- Glove is closing around or has just closed around the ball
- Webbing is folded/compressed
- Some motion blur is acceptable — this is a fast event
- Frame is the first clear closure frame within the pitch window

## Naming convention
`<catcher_id>_<outing_id>_pitch<NNN>_A.png`
Example: `CBurrows1_2026_03_26_pitch042_A.png`

## How to generate
During Phase 25 calibration, extract A frames from existing processed outings:
```bash
python command-v2/notebooks/extract_reference_frames.py \
  --outing <outing_id> \
  --frame_type A \
  --output command-v2/reference/glove-closed/
```

## Current count
0 images — populated during Phase 25
Target: 20+ images across 2+ catchers
