# Mechanics Engine Overhaul — Resume Plan

**Status: COMPLETE** — All phases (0–6) finished. 241 tests pass. Published to web.

**Reference**: `docs/Mechanics Overhaul.md` (full plan)

---

## Completed (Phases 0–4)

- **Phase 0**: Angle validation — `src/mechanics/angle_validator.py`, `validate_open_side()`, integrated into `run_mechanics_session.py` and `mechanics_coach_pack.py`
- **Phase 1**: ViTPose — `src/mechanics/pose_vitpose.py`, `extract_poses_auto()` in `pose.py`, `--pose-backend vitpose` flag
- **Phase 2**: Phase detection refinements (heuristic only; ML classifier skipped)
- **Phase 3**: Confidence architecture — angle-aware, pose-backend, passed to coach_pack
- **Phase 4**: Metric refinements — `metric_reliability` property, `METRIC_OPEN_SIDE_ONLY` dict, `metric_reliability` in notes.json

**All 232 mechanics tests pass.**

---

## Phase 5: Validation Pipeline — Remaining Work

1. **Verify `mechanics_validate.py` runs**
   - `manual_phases_template.json` lives at `tests/mechanics/manual_phases_template.json`
   - Script expects `--labels path/to/manual_phases.json` (user copies template and fills in real clip paths)
   - Run: `python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases_template.json`
   - With placeholder `path/to/clip.mp4` it will skip (clip not found). Confirm behavior: prints "No labeled clips found" or "SKIP clip not found".

2. **Fix if `extract_poses_auto` signature differs**
   - Script calls: `extract_poses_auto(clip_path, backend=pose_backend, verbose=False)`
   - Confirm `src/mechanics/pose.py` `extract_poses_auto` accepts these args.

3. **Add unit test for validation script**
   - `tests/mechanics/test_mechanics_validate.py`: mock labels with a synthetic clip or use a fixture clip; assert script exits 0 when MAE is within threshold.

4. **Document usage**
   - Add a short section to `docs/runbooks/mechanics_cv.md` under "Validation" describing:
     - Copy `tests/mechanics/manual_phases_template.json` → `manual_phases.json`
     - Fill in real `clip_path`, `hand`, `fps`, and `phases.frame_idx` per clip
     - Run `python scripts/mechanics_validate.py --labels manual_phases.json`

---

## Phase 6: Web UI Updates

1. **Extend `web/lib/mechanics/types.ts`**
   - Add to `NotesJson`:
     - `pose_backend?: string` (e.g. `"mediapipe"` | `"vitpose"`)
     - `angle_validated?: boolean`
     - `angle_confidence?: number`
     - `metric_reliability?: Record<string, string>` (or per-metric in `metrics` — already added as `metric_reliability` per metric in coach_pack)

2. **Update `MechanicsConfidencePanel.tsx`**
   - Show "Open-side validated" when `angle_validated === true`
   - Show "Pose: ViTPose" or "Pose: MediaPipe" when `pose_backend` is present
   - Optionally show `angle_confidence` as a small badge

3. **Ensure `notes.json` includes new fields**
   - Confirm `_build_notes` in `coach_pack.py` writes `pose_backend`, `angle_validated`, `angle_confidence` into the JSON (run_mechanics_session passes these; verify coach_pack consumes them).

---

## Quick Verification Checklist

- [x] `python -m pytest tests/mechanics/ -v` — 241 pass
- [x] `python scripts/mechanics_validate.py --labels tests/mechanics/manual_phases_template.json` — runs, skips placeholder, exits 0
- [x] Run `mechanics_coach_pack.py` on Trafton clip — `notes.json` contains `pose_backend`, `metric_reliability` per metric
- [x] Web mechanics session page loads — TypeScript compiles clean, new fields render

---

## Files to Touch

| File | Action |
|------|--------|
| `scripts/mechanics_validate.py` | Verify runs; fix `extract_poses_auto` call if needed |
| `tests/mechanics/test_mechanics_validate.py` | Add (new) — smoke test for validation script |
| `docs/runbooks/mechanics_cv.md` | Add validation usage section |
| `web/lib/mechanics/types.ts` | Add `pose_backend`, `angle_validated`, `angle_confidence` to NotesJson |
| `web/app/components/mechanics/MechanicsConfidencePanel.tsx` | Show pose_backend, angle_validated, angle_confidence |
| `src/mechanics/coach_pack.py` | Confirm `_build_notes` writes new fields (may already be done) |

---

## Start Command for New Session

> "Resume the Mechanics Engine Overhaul. Read `docs/Mechanics Overhaul RESUME.md` for context. Completed: Phases 0–4. Remaining: finish Phase 5 (verify mechanics_validate.py, add test, document). Then Phase 6 (Web UI: extend NotesJson types, update MechanicsConfidencePanel). Run `pytest tests/mechanics/ -v` to confirm."
