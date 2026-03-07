---
phase: 05-sync-and-finalization
plan: 01
subsystem: sync
tags: [offline, replay, finalization]
one-liner: Queued offline replay, finalized-game locking, and manual pitcher total overrides made the chart safe to trust after poor connectivity
requirements-completed: [SYNC-02, SYNC-04, EXPT-03]
completed: 2026-03-06
---

# Phase 5: Sync and Finalization Summary

**Queued offline replay, finalized-game locking, and manual pitcher total overrides made the chart safe to trust after poor connectivity**

## Accomplishments
- Built queued sync replay from the local SwiftData snapshot back to the server.
- Added finalized-game locking so live edits stop once the outing is closed.
- Shipped manual `R` and `ER` override support before export.

## Decisions Made
- Rebuilt outbound sync from an aggregated game snapshot rather than incremental event patching.
- Forced a sync attempt on launch so pending writes flush quickly when connectivity returns.

## Next Phase Readiness
- Phase 6 can safely expose portal analytics because synced games now have durable conflict handling and final totals.
- No blockers from this phase.
