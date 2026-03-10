---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live AB Analytics
current_phase: 12
current_phase_name: live ab leaderboard
current_plan: Not started
status: ready_to_plan
stopped_at: Phase 11 Session Overview Enhancements completed and verified. Phase 12 leaderboard work is next while Phase 9 TestFlight work remains independently pending.
last_updated: "2026-03-10T03:10:00.000Z"
last_activity: 2026-03-10
progress:
  total_phases: 13
  completed_phases: 10
  total_plans: 39
  completed_plans: 31
  percent: 79
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core Value:** One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.
**Current Focus:** Phase 12: Live AB Leaderboard

## Current Position

**Current Phase:** 12
**Current Phase Name:** live ab leaderboard
**Total Phases:** 13
**Current Plan:** Not started
**Total Plans in Phase:** 3
**Status:** Ready to plan
**Last Activity:** 2026-03-10
**Last Activity Description:** Phase 11 complete and verified with per-pitcher and per-hitter breakdown cards, reusable zone heat maps, and a clean web build
**Progress:** 79%

## Performance Metrics

**Velocity:**
- Total plans completed: 31 roadmap plans shipped across Phases 1-8, 10, and 11
- Documented phase summaries on disk: 19
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

**Recent Trend:**
- Last 5 plans: 10-02, 10-03, 11-01, 11-02, 11-03
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
| 11 | Use a reusable discrete zone heat map for both pitcher and hitter cards | Phase 12 and Phase 13 should inherit one charting-specific coverage visual rather than forking new heatmap implementations |

## Pending Todos

- Plan Phase 12 around `/charting/leaderboard` tabs, sortable tables, and date/session filters
- Decide how the charting leaderboard should link into the existing `/charting/games/[id]` review surface and upcoming player drill-down pages
- Return to Phase 9 to finish TestFlight packaging, pilot diagnostics, and operator runbook coverage

## Blockers

None.

## Session

**Last Date:** 2026-03-10 03:10
**Stopped At:** Phase 11 complete and verified; the session overview page now shows pitcher and hitter breakdown sections backed by the shared analytics engine
**Resume File:** None
