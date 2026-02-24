# Mechanics CV — Learning Guide

Computer vision pipeline for pitcher mechanics analysis from an open-side camera.

---

## What this pipeline does

Takes a single video clip of a pitcher (filmed from the open side — 3B side for RHP, 1B side for LHP) and produces:

• A pose skeleton overlay video showing 33 body landmarks per frame
• A phases.json with timestamps for the 5 key moments of the delivery
• A metrics.json with coaching-style measurements
• A report.png collage of key frames with the skeleton and metrics

It does not require any cloud service, trained model download beyond MediaPipe, or GPU. It runs entirely locally on CPU.

---

## Learning ladder — 4 steps

### Step A — Video I/O + frame scrubber

**What the code does.**
`src/mechanics/video_io.py` wraps OpenCV's `VideoCapture` into three functions: `read_video_meta` (returns FPS, resolution, frame count), `iter_frames` (generator that yields frame index + numpy array), and `save_frame`.

**What you learn.**
Every pixel in a video frame is a numpy array of shape `(height, width, 3)` in BGR order (not RGB). OpenCV always uses BGR. MediaPipe and most other libraries expect RGB. You convert with `cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)`.

**Run it.**
```bash
python scripts/mechanics_video_viewer.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"
```
Controls: SPACE play/pause, D/→ step forward, A/← step back, S save frame, Q quit.

**Assumptions.**
• Video codec is readable by OpenCV on macOS (AVFoundation handles .mp4, .mov, .avi).
• `CAP_PROP_FRAME_COUNT` can be inaccurate for variable-bitrate videos. If frame count looks wrong, run: `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets <file>`.

---

### Step B — Pose estimation overlay

**What the code does.**
`src/mechanics/pose.py` runs Google's MediaPipe Pose model on every frame. It returns a `PoseResult` per frame: a `(33, 3)` numpy array of `[x_norm, y_norm, visibility]` values. Frames with no detected person get NaN-filled arrays.

**What MediaPipe Pose gives you.**
33 landmarks: nose, eyes, ears, shoulders, elbows, wrists, hips, knees, ankles, heels, and toe tips. All positions are normalized `[0, 1]` by image size. Multiply by `width` or `height` to get pixel coordinates.

**Run it.**
```bash
python scripts/mechanics_pose_overlay.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"
```
Output: `output/mechanics_debug/pitch_test/pose_overlay.mp4`

Add `--debug` to see visibility scores per joint printed on each frame.

**Why MediaPipe first (not YOLO, ViTPose, etc.).**
• Zero-config: one pip install, no model download step.
• CPU real-time: 30+ fps on a modern laptop.
• Good enough for heuristic coaching metrics.

**Limitations.**
• Landmark accuracy degrades when limbs are occluded (e.g., lead leg passing behind drive leg at foot strike).
• Wrist tracking is unreliable during arm acceleration (motion blur).
• MediaPipe always picks the most prominent person in the frame. If a catcher, umpire, or batter is closer to the camera, they may get detected instead.

**When to upgrade.**
ViTPose and HRNet give significantly better accuracy in occlusion scenarios. Worth adding once you have ground-truth labels to compare against.

**Troubleshooting bad detection.**
• Try lowering `min_detection_confidence` to 0.3 in `extract_poses`.
• Crop the video to keep only the pitcher visible.
• Ensure the clip starts with the pitcher facing the camera (not walking in from the side).

---

### Step C — Pitch phase detection

**What the code does.**
`src/mechanics/phases.py` takes the list of `PoseResult` objects and applies five heuristic detectors to find the key moments of the delivery:

| Phase | Heuristic |
|---|---|
| set | Idle→motion transition from robust motion energy (rolling window + MAD threshold + consecutive-frame gate) |
| first_movement | Same frame as `set` when transition is found; fallback uses lead-knee velocity |
| peak_leg_lift | Frame where lead knee Y is at its minimum (highest in the room) |
| foot_strike | Frame where lead ankle velocity drops after a descent phase |
| ball_release | Frame with peak throwing wrist speed after foot strike |

**SET / delivery-start definition (current).**
- Motion energy uses a stable keypoint subset: `mid_hips`, `mid_shoulders`, both wrists, both ankles.
- Energy is baseline-normalized with median absolute deviation (MAD): transition triggers when energy exceeds `baseline + k*MAD` for `N` consecutive frames.
- The first `0.5s` is ignored by default to avoid startup jitter.
- If the clip starts mid-motion (no clear idle->motion edge), detector falls back to the earliest stable frame window.
- `SET` and `FIRST_MOVEMENT` are intentionally aligned when transition is detected.

**Why heuristic rules (not a classifier).**
Rules are fast and transparent. You can print the velocity series and see exactly why a phase was assigned. The tradeoff is brittleness: unusual deliveries, short clips, or heavy occlusion will break them. Once you have 20+ clips with ground-truth labels, replace these with a small MLP or 1D-CNN.

**Run it.**
```bash
python scripts/mechanics_detect_phases.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --hand R
```
Output: `output/mechanics/jason_finkelstein/pitch_test/phases.json`

Add `--debug-dump` to also save the raw per-frame keypoint arrays for offline debugging.

**Understanding image coordinates.**
Origin is top-left. +X goes right, +Y goes down. "Lead knee at highest point" means its Y-pixel value is at its **minimum** (smallest number). Rising motion = decreasing Y. This trips up almost everyone the first time.

**Troubleshooting.**
• `set` detected too late → clip probably starts mid-delivery. Trim to start a second before the pitcher begins moving.
• `peak_leg_lift` is wrong → check that lead knee visibility is above 0.3 during the leg lift using `--debug-dump` and inspecting keypoints.json.
• `ball_release` is wrong (most common) → wrist velocity from pose landmarks is noisy. The actual release moment is best detected by tracking the ball directly with YOLO.

---

### Step D — Metric extraction

**What the code does.**
`src/mechanics/metrics.py` computes five coaching metrics at specific phase frames:

**stride_length_px / stride_length_norm.**
Pixel distance between lead ankle and drive ankle at foot strike. Normalized by shoulder width (a stable proxy for body size from this camera angle). Pro starters typically achieve ~1.6x–1.9x shoulder width. This measurement is camera-distance-dependent: two clips filmed at different distances will give different pixel values even for the same athlete.

**trunk_lean_deg.**
Angle of the mid-hip → mid-shoulder vector from vertical at foot strike. Computed from the dot product with (0, −1) (pointing up). Forward lean is positive. Healthy range for most pitchers: 15°–30°.

**hip_shoulder_sep_deg.**
Angle between the hip-axis vector and the shoulder-axis vector at foot strike. A larger angle means the hips have rotated farther than the shoulders — this is the "separation" coaches talk about. Computed from the 2D projections seen by the side camera.

**arm_slot_deg.**
Elevation angle of the upper arm (shoulder → elbow) from horizontal at ball release. Positive = elbow above shoulder (over the top tendency). Near 0 = sidearm appearance. Negative = submarine.

**⚠ 2D projection caveat.** All angle metrics are computed from the 2D side-view projection. The true 3D angles require either a second camera (front or overhead) or skeleton-based 3D reconstruction. Use these numbers for trend tracking across sessions, not as absolute biomechanical ground truth.

**Run it — all steps in one command.**
```bash
python scripts/mechanics_extract_metrics.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"
```

**Run it — using pre-computed phases.**
```bash
python scripts/mechanics_extract_metrics.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --phases output/mechanics/jason_finkelstein/pitch_test/phases.json
```

Outputs:
```
output/mechanics/jason_finkelstein/pitch_test/
    metrics.json
    report.png
```

---

### Step E — Mechanical benchmarks (Phase 1)

**What the code does.**
`src/mechanics/benchmarks.py` computes seven scored metrics modeled on Mustard-style coaching rubrics. Each metric returns a raw value, a score from 0–10, a pass/fail flag, and optional sub-values. `src/mechanics/report_benchmarks.py` builds an annotated PNG with callouts on four key frames and a summary strip.

**The seven metrics.**

| # | Name | Phase | What's measured | View mode |
|---|---|---|---|---|
| 1 | Timing | SET → FOOT STRIKE | Elapsed seconds between SET and FOOT STRIKE | Both |
| 2 | Balance | RELEASE | Trunk-lean angle from vertical (mid-hip → mid-shoulder vector) | Both |
| 3 | Posture | SET → RELEASE | Head (nose) vertical travel as % of body height proxy | Both |
| 4 | Lift & Thrust | PEAK LEG LIFT | Angle of the lead-knee ascent vector above horizontal | Both |
| 5 | Swivel & Stabilize | RELEASE | Glove-side wrist x-position inside torso x-bounds | Both |
| 6 | Trunk Stability | FOOT STRIKE → RELEASE | Trunk lean delta (mid-hip → mid-shoulder angle change) | **open_side** |
| 6 | Stack & Track | SET → RELEASE | Change in shoulder-line angle (rotation proxy) | **front** |
| 7 | Torque Retention | FOOT STRIKE vs RELEASE | Ratio of shoulder-open angle at FS to RELEASE | **front only** |

**Scoring thresholds.**

| Metric | Best → Score 10 | Worst → Score 0 |
|---|---|---|
| Timing | ≤ 1.05 s | > 1.15 s (clamped to 3) |
| Balance | ≤ 6° lean | ≥ 40° lean |
| Posture | ≤ 1% head travel | ≥ 10% head travel |
| Lift & Thrust | ≥ 25° above horizontal | ≤ 3° (flat lift) |
| Swivel & Stabilize | Wrist inside torso → 10 | Wrist outside torso → 3 |
| Trunk Stability | ≤ 5° delta | ≥ 25° delta |
| Stack & Track | ≤ 3° rotation | ≥ 33° rotation |
| Torque Retention | Ratio ≤ 0.10 | Ratio ≥ 0.80 |

Pass threshold: score ≥ 6.

**Score color semantics.**
• Green (≥ 8): elite range
• Yellow (5–7): acceptable, coachable
• Red (≤ 4): priority to address

**View modes.**
The `--view` flag controls which metrics are used for slot 6 and 7:

• `--view open_side` (default): uses Trunk Stability (trunk lean delta FS→Release) for slot 6. Front-view-only metrics (`stack_track`, `torque_retention`) are marked not measurable from this view and excluded from scoring/callouts. This is the correct mode for a side camera (3B side for RHP, 1B side for LHP).

• `--view front`: uses Stack & Track (shoulder-line rotation proxy) and Torque Retention (shoulder-open ratio). Only appropriate when filming from the front or rear.

---

## Mechanics Breakdown v3 (open-side official model)

Built for single open-side clips first, with confidence-aware scoring and coaching-first visuals.

**Official open-side metric set (v3, locked):**

- `lead_leg_block_v3` — open-side visual brace model using robust FS/REL windows:
  - release knee firmness (absolute angle),
  - shin verticality,
  - hip-over-heel alignment,
  - post-FS forward leak (mid-hip drift),
  - extension-delta bonus as a secondary signal,
  - visual brace override floor for clearly posted/braced deliveries.
- `hip_shoulder_sep_v3` — open-side separation proxy from temporal burst logic:
  - shoulder rotation burst timing from smoothed shoulder-angle velocity,
  - pelvis forward burst timing from smoothed pelvis translation velocity,
  - penalties for early pelvis dump / collapse-before-rotate.
- `front_side_closedness_v2` — glove-side containment and front-side strength from PLL->REL with FS->REL opening-drop penalty.
- `release_extension_v2` — composite extension score:
  - `A` reach depth proxy (stabilised)
  - `B` release-angle proxy (shoulder->wrist relative to trunk line)
  - `C` forward intent (smoothed wrist x-velocity pre-release)
  - `extension_v2 = 0.55*A + 0.25*B + 0.20*C`
- `timing` — tempo from `SET -> FOOT_STRIKE` using delivery-start SET detection (idle prefix ignored).
- `swivel_stabilize` — glove-side containment proxy at release.

Open-side debug-only (excluded from efficiency, priority fixes, and default badges/callouts):
`balance`, `posture`, `lift_thrust`, `tilt_consistency`, `trunk_stability_v2`, legacy `trunk_stability`, legacy `release_extension_proxy`, `drift_forward`, `front_knee_flexion_fs`, `front_knee_extension_rel`, `forward_leak_proxy`, older `lead_leg_block_v2`, `hip_shoulder_sep_v2`, `front_side_closedness`.

**Confidence architecture (v3.1, graceful degradation).**

- Constants:
  - `CONF_BLIND = 0.15`
  - `CONF_FULL = 0.60`
- Metrics now expose both:
  - `score_raw` (unpenalized metric score),
  - `score_eff` (confidence-scaled score used for pass/fail, ranking, and overlays).
- Scaling:
  - `conf_scaled = clamp((conf - CONF_BLIND) / (CONF_FULL - CONF_BLIND), 0, 1)`
  - `score_eff = score_raw * (0.35 + 0.65 * conf_scaled)`
- Blind rule:
  - `conf < CONF_BLIND` => `status="insufficient_data"`
  - otherwise metric remains `status="ok"` (with LOW CONF styling if needed).

**Component-level confidence (official open-side composites).**
- Composite metrics compute subcomponent `{value_raw, score_raw, conf, reasons}`.
- Aggregation uses shared subcomponent weights and re-normalizes on non-blind components.
- If fewer than 2 subcomponents are non-blind, metric becomes `insufficient_data`.
- This is used in `lead_leg_block_v3`, `hip_shoulder_sep_v3`, and `release_extension_v2`.

**Standard low-confidence reasons (controlled vocabulary).**
- `missing_landmarks`
- `occluded`
- `window_too_small`
- `high_jitter`
- `outlier_jump`
- `low_motion`
- `phase_uncertain`

**Windowing defaults for FS/REL metrics.**
- Uses symmetric phase windows with `radius=2` (target 5 frames).
- Requires at least 3 valid landmark frames per critical window/component.
- Jitter/outlier penalties reduce confidence before any hard blind decision.

**Efficiency score (official open-side metrics only).**
- Eligible metrics: `status=="ok"` and `conf >= CONF_BLIND`.
- Uses weighted mean of `score_eff` (confidence scaling already applied at metric level).
- Open-side v3 weights:
  - `lead_leg_block_v3 2.0`
  - `hip_shoulder_sep_v3 1.8`
  - `front_side_closedness_v2 1.6`
  - `release_extension_v2 1.0`
  - `timing 0.7`
  - `swivel_stabilize 0.5`
- `efficiency_low_confidence=true` when fewer than 4 official metrics are eligible.

**Coach-pack prioritisation + visuals (default mode).**
- Only official v3 metrics appear in badges, strip, and priority fixes.
- Top 3 trusted issues only (lowest scores among eligible metrics).
- Low-confidence failures are de-emphasized to a footer (`LOW CONF - review manually`).
- Open-side overlays focus on diagnostic geometry:
  - drift hip path + phase deltas at foot strike,
  - trunk fitted lines FS vs REL,
  - extension reach line + wrist velocity arrow + release-angle badge,
  - knee-angle lines at FS/REL,
  - head-path trace with short smoothed tail.

**Outputs layout (per clip):**
```
output/mechanics/<player_slug>/<clip_slug>/coach_pack/
  set.png, peak_leg_lift.png, foot_strike.png, release.png
  strip.png
  set_to_fs.mp4, fs_to_release.mp4, release.mp4
  slowmo_review.mp4       # optional, via --slowmo
  hold_review.mp4         # phase-hold review export (2.0s at SET/PLL/FS/REL)
  notes.json              # includes confidence + camera_limitations + official metric-set metadata
output/mechanics/<player_slug>/<clip_slug>/
  manual_template.json    # coach-entered manual checkpoint template
```

`notes.json` now includes:
- `official_metric_set` (e.g., `open_side_pro_v3`)
- `official_metrics` (locked list used for open-side scoring and priority fixes)
- `official_open_side_metrics_v3` (explicit open-side v3 metric list)
- `excluded_metrics_reason` (why non-official metrics are excluded)

**Single-clip entrypoint (recommended):**
```bash
python scripts/mechanics_coach_pack.py \
  --video "/path/to/clip.mp4" \
  --hand R \
  --view open_side \
  --slowmo \
  --hold-review
```

Optional debug metric dump in notes/overlays:
```bash
python scripts/mechanics_coach_pack.py \
  --video "/path/to/clip.mp4" \
  --hand R --view open_side --slowmo --hold-review \
  --debug-metrics
```

Manual merge hook:
```bash
python scripts/mechanics_merge_manual.py \
  --clip-dir output/mechanics/<player_slug>/<clip_slug>
```

**Hold review video (`hold_review.mp4`).**
- Uses `slowmo_review.mp4` as the playback timeline template.
- Re-applies a lightweight skeleton overlay on every frame.
- Inserts a 2.0-second frame hold at each breakpoint (SET, PEAK LEG LIFT, FOOT STRIKE, BALL RELEASE).
- During each hold, displays a phase card with phase label, timestamp, and only measurable open-side metric badges (confidence >= 0.30).
- Peak-leg-lift hold may show title only if no official open-side metric is eligible for that phase.
- No audio track is written (view-only coaching export).
- CLI: `--hold-review` enables it explicitly. When `--slowmo` is passed, hold review is enabled by default unless `--no-hold-review` is set.

**Folder mode (optional batch):**
```bash
python scripts/mechanics_coach_pack.py \
  --folder "/path/to/player_clips_root" \
  --hand R \
  --view open_side
```
Processes all `.mp4` under the folder tree. Writes per-player `index.json` summarizing each clip's efficiency score and top 3 issues.

---

## Multi-angle ingest workflow

When one source file contains multiple camera views, use ingest first, then run mechanics per selected pitch-angle clip.

### 1) Ingest + auto-split all angles

```bash
python scripts/ingest_multi_angle.py \
  --video "/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis/Trafton OBrien/All Angles Test.mov" \
  --player "Trafton OBrien" \
  --session "all_angles_test" \
  --hand R \
  --verbose
```

Output structure:

```text
output/ingest/<player_slug>/<session_slug>/
  index.json
  <angle_class>/
    pitch_001.mp4
    pitch_001.json
    pitch_002.mp4
    ...
```

`index.json` includes:
- detected segments with start/end frames and angle-class confidence
- per-pitch clip timing and confidence
- grouped pitch candidates and recommended best clip per pitch

Supported angle classes:
- `behind_home`
- `behind_center`
- `open_side_RHP`
- `open_side_LHP`
- `hitter_view_RHH`
- `hitter_view_LHH`
- `unknown`

### 2) Run mechanics session from ingest

```bash
python scripts/run_mechanics_session.py \
  --ingest-index "output/ingest/trafton_obrien/all_angles_test/index.json" \
  --hand R \
  --slowmo \
  --hold-review \
  --verbose
```

Or one-step (ingest + mechanics from video):

```bash
python scripts/run_mechanics_session.py \
  --video "/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis/Trafton OBrien/All Angles Test.mov" \
  --hand R \
  --slowmo \
  --hold-review
```

Selection logic (per pitch-group candidate set):
- angle priority: matching open-side > other open-side > behind_home > behind_center > hitter_view > unknown
- then clip confidence, visibility score (pose validity/visibility), FPS, and resolution
- if chosen angle is behind-home/center and visibility is strong, runner uses `front` mode; otherwise `open_side`

Session outputs:

```text
output/mechanics/<player_slug>/<session_slug>/
  index.json
  pitch_001/
    benchmarks.json
    coach_pack/
      set.png
      peak_leg_lift.png
      foot_strike.png
      release.png
      strip.png
      set_to_fs.mp4
      fs_to_release.mp4
      release.mp4
      slowmo_review.mp4
      hold_review.mp4
      notes.json
```

`output/mechanics/<player_slug>/<session_slug>/index.json` summarizes chosen angle, view mode, efficiency score, top issues, and output paths per pitch.

## Manual Multi-Angle Clipper (Command-style)

Use this when you want full control over clip boundaries and angle labels.

### 1) Mark clips interactively

```bash
.venv/bin/python scripts/manual_angle_clipper.py \
  --video "/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis/Trafton OBrien/All Angles Test.mov" \
  --player "Trafton OBrien" \
  --session "all_angles_test"
```

Hotkeys:
- Playback: `Space` play/pause, `h/l` -1/+1 frame, `j/k` -10/+10 frames, `0/9` -1s/+1s
- Markers: `s` start, `e` end, `c` commit, `u` undo
- Pitch index: `n` next, `p` previous
- Angle: `1=open_side`, `2=front`, `3=back`, `4=behind_home`, `5=center`, `6=unknown`
- Save/quit: `w` save, `q` quit (save prompt if dirty)

Writes:
`output/ingest/<player_slug>/<session_slug>/manual_clips.json`

### 2) Export marked clips

```bash
.venv/bin/python scripts/export_manual_clips.py \
  --manual-clips "/Users/traftonobrien/Desktop/pitch-tracker/output/ingest/trafton_obrien/all_angles_test/manual_clips.json"
```

Writes:
- `output/ingest/<player_slug>/<session_slug>/clips/pitch_###/<angle>.mp4`
- `output/ingest/<player_slug>/<session_slug>/index.json` (grouped by `pitch_idx` with `preferred_angle`)

### 3) Run mechanics session from manual clips

```bash
.venv/bin/python scripts/run_mechanics_session.py \
  --manual-clips "/Users/traftonobrien/Desktop/pitch-tracker/output/ingest/trafton_obrien/all_angles_test/manual_clips.json" \
  --hand R \
  --view open_side \
  --slowmo \
  --hold-review
```

Notes:
- `--manual-clips` auto-exports clips unless `--no-export` is provided.
- `preferred_angle` per pitch follows: `open_side > front > back > behind_home > center > unknown`.
- `--view` can force `open_side` or `front`; default is `auto`.

**What to fix first (interpretation guide):**
1) Address any red metrics with high confidence (≥0.6) — those are reliable and high leverage.
2) Yellow metrics next; use callouts as cues for drills (e.g., firm front side, glove stability).
3) Open-side limits: `stack_track` and `torque_retention` are not measurable from this view and are excluded from scoring/callouts.
4) Treat low-confidence metrics as observational only; re-film with clearer lighting/angle before acting.

**Camera limitations (open-side):**
- True shoulder rotation / torque requires a front view. `stack_track` and `torque_retention` are listed under camera limitations in open-side mode and excluded from issue ranking.
- Wrist extension depth is a side-view proxy; absolute values depend on camera distance.
- Motion blur during arm acceleration can reduce wrist visibility; confidence will drop accordingly.

Trunk Stability reliably measures trunk lean change from the side camera. Stack & Track and Torque Retention use shoulder-line angle, which is noise-dominated from the side (both shoulders project to nearly the same x-coordinate).

**Run it.**
```bash
python scripts/mechanics_benchmarks.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --hand R --view open_side
```

Outputs:
```
output/mechanics/jason_finkelstein/pitch_test/
    benchmarks.json
    report_benchmarks.png
```

**Run it — using pre-computed phases (faster).**
```bash
python scripts/mechanics_benchmarks.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --phases output/mechanics/jason_finkelstein/pitch_test/phases.json \
    --hand R --view open_side
```

**Run it — front view mode.**
```bash
python scripts/mechanics_benchmarks.py \
    --video path/to/front_clip.mp4 \
    --hand R --view front
```

**benchmarks.json structure (open_side mode).**
```json
{
  "hand": "R",
  "view_mode": "open_side",
  "efficiency_score": 7.8,
  "metrics": {
    "timing":            { "status": "ok", "raw_value": 1.07, "unit": "s",   "score": 8.0, "pass_fail": true,  "sub_values": {} },
    "balance":           { "status": "ok", "raw_value": 11.2, "unit": "deg", "score": 8.5, "pass_fail": true,  "sub_values": {} },
    "posture":           { "status": "ok", "raw_value": 2.1,  "unit": "%",   "score": 8.7, "pass_fail": true,  "sub_values": {} },
    "lift_thrust":       { "status": "ok", "raw_value": 18.4, "unit": "deg", "score": 7.1, "pass_fail": true,  "sub_values": {} },
    "swivel_stabilize":  { "status": "ok", "raw_value": 1.0,  "unit": "boolean", "score": 10, "pass_fail": true, "sub_values": { "inside": true } },
    "trunk_stability_v2":{ "status": "ok", "raw_value": 4.2,  "unit": "deg", "score": 9.6, "pass_fail": true,  "sub_values": { "trunk_angle_fs_deg": 18.3, "trunk_angle_rel_deg": 22.5, "delta_abs_deg": 4.2 } },
    "torque_retention":  { "status": "requires_front_view", "raw_value": null, "unit": "", "score": null, "pass_fail": null, "sub_values": {} }
  },
  "phases": { "set": { "frame_idx": 45, "time_s": 1.50 }, "..." : "..." }
}
```
(Values above are illustrative; actual values depend on the clip. In `front` mode, slot 6 is `stack_track` and slot 7 is `torque_retention` with full scores.)

**Troubleshooting.**
• `insufficient data` on multiple metrics → phases were not detected. Run `mechanics_detect_phases.py` first and pass the result via `--phases`.
• Timing score always 3 → SET or FOOT STRIKE not detected. Check pose visibility around the start of the clip.
• Timing shows 3+ seconds → old SET detection was grabbing idle frames. The motion-energy detector should fix this. If the clip has unusually long idle time before the delivery, the detector will find the transition.
• Stack & Track shows 0° → shoulder landmarks low visibility at both phases; try lowering `min_detection_confidence` in `extract_poses`.
• `requires_front_view` on Torque Retention → expected in open_side mode. It appears in limitations only and is not used for open-side scoring/callouts.

---

## Full run sequence — first time

Run all five steps against the test clip:

```bash
# Step A: explore the clip
python scripts/mechanics_video_viewer.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

# Step B: pose overlay (generates pose_overlay.mp4)
python scripts/mechanics_pose_overlay.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4"

# Step C: phase detection (generates phases.json)
python scripts/mechanics_detect_phases.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --hand R

# Step D: metrics + report (generates metrics.json and report.png)
python scripts/mechanics_extract_metrics.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --phases output/mechanics/jason_finkelstein/pitch_test/phases.json

# Step E: benchmarks (generates benchmarks.json and report_benchmarks.png)
python scripts/mechanics_benchmarks.py \
    --video "Mechanics Analysis/Jason Finkelstein/Pitch Test.mp4" \
    --phases output/mechanics/jason_finkelstein/pitch_test/phases.json \
    --hand R --view open_side
```

All outputs land in `output/mechanics/jason_finkelstein/pitch_test/`.

---

## Output bundle structure

```
output/mechanics/<player_slug>/<clip_slug>/
    phases.json             — phase frame indices and timestamps
    metrics.json            — computed metrics (stride, trunk lean, arm slot, etc.)
    report.png              — 2x2 key-frame collage + metrics strip
    benchmarks.json         — 7 scored mechanical benchmarks + efficiency score
    report_benchmarks.png   — annotated 4-panel report with callouts and summary strip
    debug/                  — optional; keypoints.json if --debug-dump used
```

`output/mechanics_debug/<clip_slug>/` is used by Steps A and B for quick per-frame outputs.

---

## Validation — comparing detected phases to ground truth

Use `scripts/mechanics_validate.py` to measure phase detection accuracy against manually labeled clips.

**1. Create a labels file** by copying the template:

```bash
cp tests/mechanics/manual_phases_template.json manual_phases.json
```

**2. Fill in ground truth** for each clip — set `clip_path` to the real video, `hand` to R or L, `fps`, and the `frame_idx` for each phase you can identify (leave `null` for phases you can't pinpoint):

```json
{
  "clips": [
    {
      "clip_path": "Mechanics Analysis/Player/pitch.mp4",
      "hand": "R",
      "fps": 30.0,
      "phases": {
        "set":            { "frame_idx": 12, "notes": "" },
        "first_movement": { "frame_idx": 12, "notes": "" },
        "peak_leg_lift":  { "frame_idx": 38, "notes": "" },
        "foot_strike":    { "frame_idx": 55, "notes": "" },
        "ball_release":   { "frame_idx": 62, "notes": "" }
      }
    }
  ]
}
```

**3. Run validation:**

```bash
.venv/bin/python scripts/mechanics_validate.py --labels manual_phases.json
```

Options:
- `--pose-backend vitpose` — use ViTPose instead of MediaPipe
- `--fail-threshold 5.0` — fail if any phase MAE exceeds N frames (default 5.0)
- `--verbose` — print per-clip details

Output is a per-phase MAE report with PASS/FAIL per threshold. Clips whose `clip_path` doesn't exist on disk are skipped.

---

## Running the tests

```bash
# All mechanics tests
python -m pytest tests/mechanics/ -v

# Quick smoke test (no real video needed)
python -m pytest tests/mechanics/ -v -x
```

Tests use synthetic keypoint sequences — no video file required.

---

## Project architecture

```
src/mechanics/
    __init__.py
    video_io.py           — VideoMeta, iter_frames, save_frame
    pose.py               — PoseResult, extract_poses, draw_skeleton
    phases.py             — PitchPhases, detect_phases and helpers
    metrics.py            — Metrics, extract_metrics
    benchmarks.py         — BenchmarkResult, BenchmarkReport, compute_benchmarks (7 metrics)
    report_benchmarks.py  — build_benchmark_report (annotated 4-panel PNG)
    utils.py              — slugify, add_text_overlay, phase_color

scripts/
    mechanics_video_viewer.py      — Step A
    mechanics_pose_overlay.py      — Step B
    mechanics_detect_phases.py     — Step C
    mechanics_extract_metrics.py   — Step D
    mechanics_benchmarks.py        — Step E
```

Scripts are thin wrappers. All logic is in `src/mechanics/`. This means you can import any function in a notebook or REPL without running a script.

---

## What to learn next

### Ball and glove tracking with YOLO
The biggest improvement to phase detection and release-point accuracy. YOLO (v8 or v11) can detect and track the ball in flight. This replaces the noisy wrist-velocity heuristic with an actual ball position series. Train on a small labeled dataset of ~200 frames from your clips. Start with YOLOv8-nano for speed.

### Multi-view calibration
A second camera (front or high-third-base) lets you triangulate 3D positions. With two calibrated cameras you get real arm slot, hip-shoulder separation in 3D, and actual stride length in feet rather than pixels. OpenCV provides `cv2.calibrateCamera` and `cv2.triangulatePoints`.

### Tracking across multiple pitches per clip
If a clip has multiple pitches, you need pitch segmentation before phase detection. The simplest approach: detect the pitcher returning to the set position (low motion state) between pitches, then split the clip there.

### Temporal models for phase detection
Replace the heuristic rules with a 1D-CNN or Transformer operating on the keypoint time series. With 20+ labeled clips you can train a model that generalizes better to unusual deliveries and occlusion patterns.

### Normalization and longitudinal tracking
Store metrics in a database (even a CSV) with date and player. Compare arm slot across sessions to catch mechanical drift early. Normalize all pixel metrics to the shoulder-width body unit so cross-session comparisons are valid.
