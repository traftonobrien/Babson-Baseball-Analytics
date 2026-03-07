---
phase: 08-charting-engine-hardening
plan: 01
subsystem: ios
tags: [charting, engine, state-machine]
one-liner: The iPad app now rebuilds live charting state from typed pitch and PA result rules instead of ad hoc counter repair inside GameStore
requirements-completed: [ENG-01, ENG-02]
completed: 2026-03-06
---

# Phase 8 Plan 01 Summary

**The iPad app now rebuilds live charting state from typed pitch and PA result rules instead of ad hoc counter repair inside `GameStore`**

## Accomplishments
- Added typed plate-appearance result semantics, closeout readiness states, and a deterministic live-state reducer in `Models.swift`.
- Refactored `GameStore` so count, outs, inning rollover, batter slot, active segment, and open-PA recovery all flow through the same reducer.
- Fixed bunt-foul strike-three handling and removed the demo-only out detection that previously recognized only a narrow subset of result codes.

## Decisions Made
- Kept the engine logic inside the existing iOS model layer so the reducer stays easy to test without touching project structure.
- Allowed terminal pitch states to surface as `4` balls or `3` strikes so the UI can clearly signal that a PA must be closed before another pitch.

## Next Phase Readiness
- The live charting UI can now consume typed closeout readiness instead of deriving button state from raw counters.
- Pitcher transitions, finalize flow, and workflow guardrails can be layered on top of the same deterministic state.
