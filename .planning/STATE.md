---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 9
current_phase_name: pilot hardening and testflight
current_plan: 09-01
status: ready_to_execute
stopped_at: Phase 08.1 is complete; next step is execute 09-01 for the pilot shell, auth gating, and build/session visibility
last_updated: "2026-03-07T14:54:20-0500"
last_activity: 2026-03-07
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 18
  completed_plans: 15
  percent: 83
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-06)

**Core Value:** One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.
**Current Focus:** Phase 9: Pilot Hardening and TestFlight

## Current Position

**Current Phase:** 9
**Current Phase Name:** pilot hardening and testflight
**Total Phases:** 10
**Current Plan:** 09-01
**Total Plans in Phase:** 3
**Status:** Ready to execute
**Last Activity:** 2026-03-07
**Last Activity Description:** Phase 08.1 completed with a rebuilt live charting shell, `Live AB` and `Game` modes, confirm-first pitch entry, always-visible pitch totals, and arsenal-filtered pitch selection
**Progress:** 83%

## Performance Metrics

**Velocity:**
- Total plans completed: 27 roadmap plans shipped across Phases 1-8 and 08.1
- Documented phase summaries on disk: 15
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

**Recent Trend:**
- Last 5 plans: 09 planning, 08.1 insertion, 08.1 planning, 08.1 execution, 08.1 verification
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
| 08.1 | Rebuild live charting around a mode-aware, confirm-first workflow | Staff needs zone-first layout, manual practice AB setup, filtered pitch families, and explicit pitch confirmation before pilot distribution |
| 9 | Treat the discovered iPad snapshot-sync gap as pilot hardening work instead of deferring it | A TestFlight pilot is not credible unless the app persists the full chart snapshot and exposes recovery guidance |
| 9 | Keep pilot diagnostics in the app shell and operator surfaces | Internal scorers need build/session/sync context at the point of failure, not only in planning docs |

## Accumulated Context

### Roadmap Evolution

- Phase 08.1 inserted after Phase 8: Charting UX and Mode Workflow (URGENT)

## Pending Todos

- Execute 09-01 to restore the intentional pilot shell, auth gating, and build/session visibility
- Execute 09-02 to close the full snapshot sync gap and add pilot diagnostics/recovery
- Execute 09-03 to publish the operator runbook, checklist, and verification handoff
- Decide whether the Phase 9 runbook should also surface as a compact in-app quick reference

## Blockers

None.

## Active Risks

- The current iPad sync queue PATCH payload does not yet match the server route's persistence behavior for child snapshot records; this is the primary Phase 9 implementation risk and is explicitly scoped into 09-02.
- `Live AB` practice charting is intentionally local-first for now; broader storage and sharing behavior remains deferred until after charting mechanics and pilot hardening.

## Session

**Last Date:** 2026-03-07 09:20
**Stopped At:** Phase 08.1 completed after rebuilding the live charting shell, local Live AB setup flow, confirm-first pitch entry, arsenal filtering, and verification
**Resume File:** .planning/phases/09-pilot-hardening-and-testflight/09-CONTEXT.md
