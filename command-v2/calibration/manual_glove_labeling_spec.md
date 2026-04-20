# Manual Glove Labeling Spec (YOLO)

Use this when manually clipping still frames from pitch clips for glove training.

## Goal
Build a robust glove detector for home-field center-field camera footage across:
- different catchers
- day/night lighting
- glove colors
- partial occlusion and motion blur

## Source
Use clips from:
- `outings/<playerId>/<dateId>/clips/pitch_*.mp4`

Prefer home-field angle only for this phase.

## Frame Selection Per Pitch
For each sampled pitch, export 4-6 frames:
1. `T-2` (just before target set)
2. `T` (target/set frame)
3. `T+2`
4. `A-2` (just before reception)
5. `A` (reception/closure)
6. `A+2` (optional, post-reception)

Use `target_frame` and `arrival_frame` from `pitch_log.json`.

## Label Format (YOLO Detect)
One object class for this phase:
- class `0` = `glove`

Annotation file per image: same filename with `.txt`
Line format:
`<class_id> <x_center> <y_center> <width> <height>`
All coordinates normalized to `[0,1]`.

## Bounding Box Rules
- Tight box around visible catcher glove only.
- Do not include forearm unless inseparable from glove in the frame.
- Ignore pitcher glove entirely.
- If glove is heavily occluded but still identifiable, box visible glove region.
- If glove is not visible/identifiable, skip frame (no label file content).

## Naming Convention
Image filename:
`<playerId>_<dateId>_pitch<NNN>_f<FRAME>.jpg`

Examples:
- `CBurrows1_2026_03_01_pitch012_f0010.jpg`
- `CDoan1_2026_03_26_pitch004_f0056.jpg`

## Train/Val Split Target
- 80% train / 20% val
- Stratify by catcher and outing
- Keep similar lighting represented in both sets

## Minimum Starter Set
- 2 outings minimum
- 20 pitches minimum
- 100+ labeled frames total (preferred 150-250)

## Quality Gate Before Training
- Randomly inspect 30 labels
- Zero mislabeled pitcher gloves
- Box tightness consistent across catchers
- No empty/missing txt files for labeled images
