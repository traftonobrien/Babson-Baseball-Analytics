---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live AB Analytics
current_phase: 12.1
current_phase_name: live-ab-player-profile-integration
current_plan: 12.1-03
status: ready_to_execute
stopped_at: Phase 12.1 plans 01 and 02 are implemented; final polish and validation for 12.1-03 are next.
last_updated: "2026-03-11T01:26:50.000Z"
last_activity: 2026-03-10
progress:
  total_phases: 14
  completed_phases: 11
  total_plans: 43
  completed_plans: 36
  percent: 84
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core Value:** One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.
**Current Focus:** Phase 12.1: Live AB player profile integration

## Current Position

**Current Phase:** 12.1
**Current Phase Name:** live-ab-player-profile-integration
**Total Phases:** 14
**Current Plan:** 12.1-03
**Total Plans in Phase:** 3
**Status:** Ready to execute
**Last Activity:** 2026-03-10
**Last Activity Description:** Phase 12.1 plans 01 and 02 implemented with a shared Live AB profile helper and player-profile tab integration
**Progress:** 84%

## Performance Metrics

**Velocity:**
- Total plans completed: 36 roadmap plans shipped across Phases 1-8 and 10-12.1
- Documented phase summaries on disk: 21
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Charting Domain Foundation | 3 | - | - |
| 2. Access and Game Setup | 3 | - | - |
| 3. Local iPad Persistence | 3 | - | - |
| 4. Live Charting Workflow | 3 | - | - |
| 5. Sync and Finalization | 3 | - | - |
| 6. Portal Charting Surfaces | 3 | - | - |
| 7. Export Fidelity | 3 | - | - |
| 8. Charting Engine Hardening | 3 | - | - |
| 10. Analytics Foundation | 4 | - | - |
| 11. Session Overview Enhancements | 3 | - | - |
| 12. Live AB Leaderboard | 3 | - | - |
| 12.1. Live AB Player Profile Integration | 3 | - | - |

**Recent Trend:**
- Last 5 plans: 12-01, 12-02, 12-03, 12.1-01, 12.1-02
- Trend: Stable

## Decisions Made

| Phase | Summary | Rationale |
|-------|---------|-----------|
| 4 | Use a landscape-first charting shell with an elastic top zone canvas and a bottom operator dock | Preserves the largest surface for spatial pitch location while leaving the control deck extensible as more charting actions are added |
| 4 | Match the zone selector to the 14-cell Trackman layout with custom outer L-brackets and a separate `PO` cell | Aligns the scorer's touch targets to the actual location model staff expects |
| 6 | Keep portal detail analytics and chart review on `/charting/games/[id]` using DB-backed synced snapshots | Staff needs one authoritative post-sync review surface inside the existing portal |
| 7 | Generate CSV and PDF exports from the shared chart snapshot contract | Export surfaces must stay aligned with the synced game model and finalized pitcher totals |
| 8 | Rebuild live charting state from typed pitch and PA result rules | Count, outs, batter order, and relaunch recovery need one deterministic source of truth |
| 8 | Enforce guardrails in both the store and the UI | The scorer should not be able to record contradictory actions even if one surface drifts later |
| 10 | Centralize Live AB analytics in `web/lib/charting/analytics.ts` with pure helpers plus async DB wrappers | Phase 11 and Phase 12 need one reusable analytics engine instead of duplicating page-local formulas |
| 10 | Keep the analytics module lazily connected to Neon | Pure Vitest coverage must run without requiring `DATABASE_URL`, while server routes can still query the real DB |
| 11 | Keep session review on the existing `/charting/games/[id]` route instead of splitting analytics onto a new page | Staff should review one charted game in one place before navigating into cross-session leaderboard views |
| 11 | Use a reusable discrete zone heat map for both pitcher and hitter cards | Phase 12 and Phase 12.1 should inherit one charting-specific coverage visual rather than forking new heatmap implementations |

## Accumulated Context

### Roadmap Evolution

- Phase 12.1 inserted after Phase 12: Live AB player profile integration (URGENT)

## Pending Todos

- Finish Phase 12.1-03 with mixed-role polish, review, and final validation
- Return to Phase 9 to finish TestFlight packaging, pilot diagnostics, and operator runbook coverage

## Blockers

None.

## Session

**Last Date:** 2026-03-10 21:26
**Stopped At:** Phase 12.1 plans 01 and 02 are implemented; final polish/review/validation remain in 12.1-03
**Resume File:** None
