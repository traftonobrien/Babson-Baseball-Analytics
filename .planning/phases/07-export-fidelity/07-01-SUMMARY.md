---
phase: 07-export-fidelity
plan: 01
subsystem: web
tags: [csv, export, nextjs]
one-liner: The portal now exposes a normalized CSV download for charted games from a shared export pipeline and direct detail-page button
requirements-completed: [EXPT-01]
completed: 2026-03-06
---

# Phase 7 Plan 01 Summary

**The portal now exposes a normalized CSV download for charted games from a shared export pipeline and direct detail-page button**

## Accomplishments
- Added shared chart snapshot and CSV serialization utilities so export and portal review read the same normalized game state.
- Shipped `/api/charting/games/[id]/export` and linked it directly from `/charting/games/[id]`.
- Added fixture-backed coverage for the CSV export shape.

## Decisions Made
- Kept export generation server-side in the web app so staff can download directly from the portal without reserializing data in the iPad client.
- Anchored export to the shared snapshot loader to avoid portal/export drift.

## Next Phase Readiness
- Phase 7 can now focus on the paper-style PDF renderer and end-to-end export verification.
- No blockers beyond the remaining Phase 7 work.
