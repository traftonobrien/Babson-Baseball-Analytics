---
name: Mechanics Overhaul Resume
overview: "COMPLETE. Mechanics Engine Overhaul Phases 0–6 all finished. 241 tests pass. Published to web."
todos: []
isProject: false
---

# Mechanics Engine Overhaul — Resume Plan

**Context**: Previous session hit its limit during Phase 5. Phases 0–4 are complete; all 232 mechanics tests pass. Phase 5 created `scripts/mechanics_validate.py` and `tests/mechanics/manual_phases_template.json` but did not verify them or add tests. Phase 6 (Web UI) is not started.

**Reference**: [docs/Mechanics Overhaul.md](docs/Mechanics Overhaul.md), [docs/Mechanics Overhaul RESUME.md](docs/Mechanics Overhaul RESUME.md)

---

## Phase 5: Finish Validation Pipeline

### 5.1 Verify `mechanics_validate.py` runs

- Run: `python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases_template.json`
- Expected: Script runs; clips are skipped because `path/to/clip.mp4` does not exist. Confirm no crash and output is sensible.
- If `extract_poses_auto` signature differs, fix the call in [scripts/mechanics_validate.py](scripts/mechanics_validate.py) (lines 88–91).

### 5.2 Add unit test

- Create [tests/mechanics/test_mechanics_validate.py](tests/mechanics/test_mechanics_validate.py):
  - Test `_load_labels` parses valid JSON and returns clips
  - Test script exits 0 when labels file has no valid clips (template case)
  - Optional: use a real fixture clip if available to test full flow

### 5.3 Document usage

- Add a short "Validation" section to [docs/runbooks/mechanics_cv.md](docs/runbooks/mechanics_cv.md):
  - Copy template to `manual_phases.json`, fill in real `clip_path`, `hand`, `fps`, `phases.frame_idx`
  - Run `python scripts/mechanics_validate.py --labels manual_phases.json`

---

## Phase 6: Web UI Updates

### 6.1 Extend TypeScript types

In [web/lib/mechanics/types.ts](web/lib/mechanics/types.ts), add to `NotesJson`:

```ts
pose_backend?: string;      // "mediapipe" | "vitpose"
angle_validated?: boolean;
angle_confidence?: number;
```

Per-metric `metric_reliability` is already in `MetricResult` via coach_pack; add to `MetricResult` if missing:

```ts
metric_reliability?: string;  // "high" | "medium" | "low"
```

### 6.2 Update MechanicsConfidencePanel

In [web/app/components/mechanics/MechanicsConfidencePanel.tsx](web/app/components/mechanics/MechanicsConfidencePanel.tsx):

- Add a row or badge for **"Open-side validated"** when `notes.angle_validated === true`
- Add **"Pose: ViTPose"** or **"Pose: MediaPipe"** when `notes.pose_backend` is present
- Optionally show `angle_confidence` (e.g. as a small badge)

The panel already shows Camera View, Not Measurable, and Low Confidence; extend the grid to include these new fields.

### 6.3 Verify pipeline output

- [src/mechanics/coach_pack.py](src/mechanics/coach_pack.py) already writes `pose_backend`, `angle_validated`, `angle_confidence` (lines 1344, 1373–1376) and `metric_reliability` per metric (line 1305).
- Run a mechanics session on a real clip and confirm `notes.json` contains these fields.

---

## Verification Checklist

- [x] `python -m pytest tests/mechanics/ -v` — 241 pass
- [x] `python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases_template.json` — runs, exits 0
- [x] Web mechanics page loads — TypeScript compiles clean; new fields render when present
- [x] Published Trafton session with new engine output — efficiency 5.44 → 6.04

---

## Start Command for New Session

> Resume the Mechanics Engine Overhaul. Read `docs/Mechanics Overhaul RESUME.md` for context. Phases 0–4 done. Finish Phase 5 (verify mechanics_validate.py, add test, document). Then Phase 6 (extend NotesJson types, update MechanicsConfidencePanel). Run `pytest tests/mechanics/ -v` to confirm.
