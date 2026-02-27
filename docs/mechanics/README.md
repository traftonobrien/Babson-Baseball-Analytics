# Mechanics Engine — Documentation Index

Single entry point for all mechanics-related documentation.

---

## Quick reference

| What you want to do | Doc |
|---|---|
| **Run a mechanics session** | [`docs/runbooks/mechanics_cv.md`](../runbooks/mechanics_cv.md) — "Step E" and "Single-clip entrypoint" sections |
| **Publish results to the web app** | [`docs/runbooks/publish_mechanics_session.md`](../runbooks/publish_mechanics_session.md) |
| **Understand the engine architecture** | [`docs/runbooks/mechanics_cv.md`](../runbooks/mechanics_cv.md) — learning ladder (Steps A–E) |
| **Validate phase detection accuracy** | [`docs/runbooks/mechanics_cv.md`](../runbooks/mechanics_cv.md) — "Validation" section |
| **Fix inaccurate phase timing** | See "Manual Phase Anchors" below |
| **See the overhaul plan (Phases 0–6)** | [`docs/mechanics/overhaul_plan.md`](overhaul_plan.md) |

---

## How the system works (summary)

### Pipeline

```
Video clip + hand (R/L)
    │
    ├─ Angle validation (optional)    → reject non-open-side clips
    ├─ Pose estimation (MediaPipe/ViTPose)  → 33 landmarks per frame
    ├─ Phase detection                → SET, PEAK_LEG_LIFT, FOOT_STRIKE, BALL_RELEASE
    ├─ Benchmarks (6 official metrics) → scored 0–10 with confidence
    └─ Coach pack                     → notes.json, key-frame PNGs, videos
```

**Entrypoint:**

```bash
.venv/bin/python scripts/mechanics_coach_pack.py \
  --video "<clip>" --hand R --view open_side --slowmo --hold-review
```

Output: `output/mechanics/<player_slug>/<session_slug>/coach_pack/`

### Official open-side metrics (v3)

| Metric | What it measures |
|---|---|
| `lead_leg_block_v3` | Front-side brace (knee firmness, shin verticality, forward leak) |
| `hip_shoulder_sep_v3` | Separation timing (shoulder burst vs pelvis burst) |
| `front_side_closedness_v2` | Glove-side containment PLL→REL |
| `release_extension_v2` | Composite extension (reach + angle + forward intent) |
| `timing` | Tempo from SET → FOOT_STRIKE |
| `swivel_stabilize` | Glove-side containment at release |

### Confidence architecture

- `CONF_BLIND = 0.15` — below this, metric becomes `insufficient_data`
- `CONF_FULL = 0.60` — above this, full confidence
- Per-metric: `score_raw` (unpenalized), `score_eff` (confidence-scaled), `metric_reliability` (high/medium/low)
- Per-metric `reasons` vocabulary: `missing_landmarks`, `occluded`, `window_too_small`, `high_jitter`, `outlier_jump`, `low_motion`, `phase_uncertain`

### Manual Phase Anchors & Interactive Scrubber

If the auto-detected phases (like foot strike) are a few frames off, you can manually annotate them. The engine will pick these up automatically and use them with `confidence=1.0`.

1. Run the interactive OpenCV scrubber on a specific pitch:
   ```bash
   .venv/bin/python scripts/select_phases.py --manual-clips "path/to/manual_clips.json" --pitch 1
   ```
2. Scrub to the exact frames using the trackbar or left/right arrows.
3. Press `1` for Peak Leg Lift, `2` for Foot Strike, and `3` for Ball Release.
4. Press `ENTER` to save the timestamps back to `manual_clips.json`.
5. Re-export the clips and re-run the mechanics session. The engine will read the `phase_anchors` and update all downstream benchmarks.

### Web publishing

Mechanics data lives in `web/public/mechanics/`:

```
web/public/mechanics/
  index.json                     ← hub index (drives /mechanics page)
  <player_slug>/
    <session_slug>/
      notes.json                 ← full session data
      set.png, peak_leg_lift.png, foot_strike.png, release.png
      slowmo_review.mp4
```

See [`docs/runbooks/publish_mechanics_session.md`](../runbooks/publish_mechanics_session.md) for the full publish workflow.

---

## Key source files

| File | Purpose |
|---|---|
| `src/mechanics/pose.py` | MediaPipe pose extraction + `extract_poses_auto()` backend switch |
| `src/mechanics/pose_vitpose.py` | ViTPose wrapper (optional, GPU) |
| `src/mechanics/phases.py` | Heuristic phase detection (SET, PLL, FS, REL) |
| `src/mechanics/benchmarks.py` | 6 official metrics + confidence + scoring |
| `src/mechanics/confidence.py` | Confidence architecture (combine, scale, finalize) |
| `src/mechanics/coach_pack.py` | `build_coach_pack()` — full output generation |
| `src/mechanics/angle_validator.py` | Open-side camera angle validation |
| `scripts/mechanics_coach_pack.py` | CLI entrypoint (single clip or folder) |
| `scripts/run_mechanics_session.py` | Session runner (multi-clip, manual overrides, ingest mapping) |
| `scripts/select_phases.py` | Interactive OpenCV GUI for annotating manual phase anchors |
| `scripts/mechanics_validate.py` | Phase detection validation vs ground truth |
| `web/lib/mechanics/types.ts` | TypeScript types: `NotesJson`, `MetricResult` |
| `web/app/mechanics/` | Web UI components (Hub, Session, Player views) |

---

## Overhaul history

The mechanics engine was overhauled in Phases 0–6 (Feb 2026). All phases complete.

| Phase | What was added |
|---|---|
| 0 | Angle validation (`angle_validator.py`) |
| 1 | ViTPose backend (`pose_vitpose.py`, `extract_poses_auto()`) |
| 2 | Phase detection refinements (per-phase confidence, reasons) |
| 3 | Confidence architecture (angle-aware, pose-backend-aware) |
| 4 | Metric refinements (`metric_reliability`, `METRIC_OPEN_SIDE_ONLY`) |
| 5 | Validation pipeline (`mechanics_validate.py`, ground-truth comparison) |
| 6 | Web UI (extended `NotesJson`, `MechanicsConfidencePanel` badges) |

Full details: [`overhaul_plan.md`](overhaul_plan.md) and [`overhaul_resume.md`](overhaul_resume.md)

---

## Tests

```bash
.venv/bin/python -m pytest tests/mechanics/ -v    # 241 tests
```

All tests use synthetic keypoint sequences — no video file or GPU required.
