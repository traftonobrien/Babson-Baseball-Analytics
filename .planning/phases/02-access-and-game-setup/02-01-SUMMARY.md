---
phase: 02-access-and-game-setup
plan: 01
subsystem: api
tags: [auth, bootstrap, lineup]
one-liner: Internal auth, game bootstrap data, editable lineup setup, and pitcher-segment controls established the operator workflow
requirements-completed: [AUTH-01, AUTH-02, GAME-02, GAME-03, GAME-04]
completed: 2026-03-06
---

# Phase 2: Access and Game Setup Summary

**Internal auth, game bootstrap data, editable lineup setup, and pitcher-segment controls established the operator workflow**

## Accomplishments
- Added internal charting auth and bootstrap endpoints for the iPad workflow.
- Shipped editable lineup entry and richer chart-header metadata capture.
- Implemented pitcher-segment lifecycle management without forcing a new game record.

## Decisions Made
- Reused portal-adjacent auth patterns with a dedicated charting cookie.
- Stored lineup entries separately so the scorer can replace or patch slots safely.

## Next Phase Readiness
- Phase 3 can attach the native iPad shell to real backend setup flows and canonical pitcher data.
- No blockers from this phase.
