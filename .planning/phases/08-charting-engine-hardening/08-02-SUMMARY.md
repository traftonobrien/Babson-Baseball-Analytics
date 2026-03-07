---
phase: 08-charting-engine-hardening
plan: 02
subsystem: ios-ui
tags: [charting, guardrails, workflow]
one-liner: The live charting workflow now enforces valid next actions, typed PA closeouts, and safer pitcher/finalize transitions without changing the rough layout baseline
requirements-completed: [ENG-03]
completed: 2026-03-06
---

# Phase 8 Plan 02 Summary

**The live charting workflow now enforces valid next actions, typed PA closeouts, and safer pitcher/finalize transitions without changing the rough layout baseline**

## Accomplishments
- Rebuilt `PAResultControls` around typed result definitions so only valid closeouts are enabled for the current open PA.
- Locked pitch recording after terminal events and surfaced engine-driven guidance text directly in the operator dock.
- Added guardrails for pitcher changes and finalization so staff cannot switch pitchers mid-PA or finalize with an unresolved plate appearance.

## Decisions Made
- Preserved the top-zone / bottom-dock layout while tightening the operator flow, since correctness mattered more than another visual rearrangement.
- Kept validation in both the store and the UI so impossible actions are blocked even if one surface drifts later.

## Next Phase Readiness
- The scenario suite can now verify the workflow against the exact same guardrails the UI exposes.
- Pilot hardening can build on a charting surface that already rejects contradictory input paths.
