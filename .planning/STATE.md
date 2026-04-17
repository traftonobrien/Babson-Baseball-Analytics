---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: Command Tracker v2 — Automated Pitch Detection and Glove Tracking
current_phase: 25
status: Ready to plan
last_updated: "2026-04-17"
progress:
  total_phases: 33
  completed_phases: 20
  total_plans: TBD
  completed_plans: 41
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-17)

**Core value:** Reduce per-game command tracking from 1–2 hours to 15–20 minutes by automating pitch detection and glove T/A frame selection — human role shifts from finding frames to verifying proposals.
**Current focus:** Phase 25 — Calibration and Ground Truth

## Current Position

Phase: 25 of 30 (v5.0 phases) — Phase 25: Calibration and Ground Truth
Plan: 0 of 3 in current phase
Status: Ready to plan
Last activity: 2026-04-17 — v5.0 roadmap created; Phase 25 is the entry point

Progress (v5.0): [░░░░░░░░░░░░░░░░░░░░] 0% (0/6 v5.0 phases complete)

## Performance Metrics

**Velocity:**
- Total plans completed (all milestones): 41
- v4.0 milestone: 12 plans across 4 phases (all complete 2026-04-11/12)

**By Phase (v4.0 reference):**

| Phase | Plans | Status |
|-------|-------|--------|
| 21. PBP Parser | 3/3 | Complete |
| 22. RE Matrix | 3/3 | Complete |
| 23. Delta-RE Join | 3/3 | Complete |
| 24. 0-2 Dashboard | 3/3 | Complete |

*v5.0 metrics will populate as phases execute*

## Accumulated Context

### Decisions

- Phase 25 is research-only: outputs are config constants and calibration data, not production code
- `mark_pitches.py` is preserved as-is; `verify_pitches.py` is the new entry point after auto-detection
- `batch_process.py` is preserved unchanged — only the T/A input source changes
- `track_glove.py` is archived (not deleted) until `track_glove_v2.py` is validated
- SAM3 text prompt "catcher's glove" is the planned initialization; prompt may need tuning per camera/lighting
- Phase 25 calibration constants are committed to `config/ct2_calibration.yaml` and consumed by all later phases

### Pending Todos

None yet.

### Blockers / Concerns

- SAM3 may still require cloning from Meta's GitHub rather than PyPI — check release status before Phase 27 begins
- MediaPipe Pose reliability from center-field angle at current video resolution is unvalidated — Phase 26 must address this before tuning thresholds
- Phase 25 requires access to existing processed outings with known ground-truth T/A frames — confirm which outings are available before starting plan 25-01

## Session Continuity

Last session: 2026-04-17
Stopped at: Roadmap created for v5.0 (Phases 25–30); Phase 25 ready to plan
Resume file: None
