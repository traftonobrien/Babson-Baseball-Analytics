---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Live AB Analytics
status: executing
stopped_at: Completed 17-03-PLAN.md — Phase 17 Multi-Tenancy Part 1 complete
last_updated: "2026-03-22T19:30:00.000Z"
last_activity: 2026-03-22 — Phase 17 complete; NEXT_PUBLIC_TEAM_NAME confirmed in Vercel, live deployment verified
progress:
  total_phases: 23
  completed_phases: 16
  total_plans: 41
  completed_plans: 38
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-20)

**Core value:** One coach can chart an entire outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow — now extensible to any D3 team.
**Current focus:** Milestone v3.0 — Phase 17 complete; next: Phase 17.5 (Supabase Migration) or Phase 18 (Multi-Tenancy Part 2)

## Current Position

**Phase:** 17 of 20 (Multi-Tenancy Part 1) — COMPLETE
**Plan:** 17-03 of 3 — COMPLETE
**Status:** Phase 17 complete; Phase 17.5 or Phase 18 is next
**Last Activity:** 2026-03-22 — Phase 17 complete; NEXT_PUBLIC_TEAM_NAME confirmed in Vercel; live deployment at babsonanalytics.com verified

Progress: [█████████░] 90% (v3.0)

## Performance Metrics

**Velocity (v3.0):**
- Plans completed: 9
- Plans total: 22 (estimated across 7 phases)

**Prior milestone (v2.0):** 38 plans completed across 13 phases

## Accumulated Context

### Key Decisions Entering v3.0

- Phases derived from natural requirement clusters: completion work first, then ops, code health, multi-tenancy (two phases), UX, demo
- TEAM split into two phases: Part 1 (parameterize identity + DB schema) before Part 2 (admin UI + scoped identity + auth) to avoid building admin UI before the schema supports it
- CODE decomposition placed after ops (Phase 16 after 15) so error boundaries and middleware are not split across pre/post decomposition states
- Phase 9 (TestFlight) remains Not Started — unblocked but deferred per current priorities
- charting snapshot PATCH fix (db.transaction → db.batch) shipped in commit 5f99c7e — drizzle-orm/neon-http does not support transactions but does support db.batch() via Neon HTTP batch API (atomic)

### Key Decisions — Phase 15

- 15-01: middleware.ts default export replaces proxy.ts named export — identical auth gate logic, only the export name changes to satisfy Next.js convention (commits bcf8370, 985b8b0)
- 15-01: proxy.ts deleted entirely (not stubbed) — avoids ambiguity about which file is the active auth gate
- 15-02: Segment error.tsx files re-export from app/error.tsx — one UI definition, consistent retry experience across charting/mechanics/command/players
- 15-02: global-error.tsx includes own html/body wrapper — required by Next.js when root layout itself crashes
- 15-03: Production env vars and live middleware redirects verified against `https://babsonanalytics.com`; charting hub loads after login
- 15-04: `logApiError()` established as the standard server-route logging pattern; charting API routes now emit JSON-compatible Vercel logs with route/method/status/action/context

### Key Decisions — Phase 16

- 16-discuss: Use a strict behavior-freeze posture — decomposition is structural first, not a UX or workflow rewrite
- 16-discuss: Prefer feature-colocated extraction over aggressive cross-surface centralization
- 16-discuss: Slice execution one major file per plan (`ChartingEditor`, `LiveAbInsightsExplorer`) followed by a final ceiling audit plan
- 16-discuss: `ChartingEditor` should split primarily by workflow panels, with hook/helper extraction only as needed to support a thin root file
- 16-discuss: `LiveAbInsightsExplorer` should split into route-local panels and helpers while preserving current URL/query behavior
- 16-discuss: Verification should be focused — targeted charting/comparison suites, build, and explicit source-only line-count checks
- 16-01: `ChartingEditor.tsx` was kept as the thin orchestration shell while workflow panels/modals/helpers moved into `web/app/charting/_components/charting-editor/`
- 16-02: `LiveAbInsightsExplorer.tsx` was kept as the thin route-local composition shell while controls, zone canvas, summary table, empty state, and helper modules moved into `web/app/charting/insights/_components/` and `_lib/`

### Key Decisions — Phase 17

- 17-01: NEXT_PUBLIC_TEAM_NAME is the single env var — inlined at build for client, runtime for server; default "Babson" keeps existing deployments unchanged
- 17-01: teamConfig.ts is the single import source for TEAM_NAME across all call sites — no direct process.env reads in components
- 17-01: ChartingCreateForm.tsx variable names (babsonVenueSide, babsonStartingPitcher) left untouched — internal state identifiers, not rendered strings
- 17-01: api/ routes, pdf.ts, test fixtures, college-stats type names (BabsonPitcherRow etc.) left untouched — not rendered UI strings
- 17-02: team_id is plain text (no FK to teams table) — Phase 18 adds teams table and constraint
- 17-02: Migration uses ADD COLUMN nullable + back-fill + SET NOT NULL pattern to avoid table rewrite lock
- 17-02: DEFAULT 'babson' on both column and Drizzle schema — new inserts auto-scoped without application code changes in Phase 17
- 17-03: NEXT_PUBLIC_TEAM_NAME=Babson set in Vercel for Production, Preview, and Development — live deployment confirmed correct at babsonanalytics.com

### Known Gaps

- OPS-01 RESOLVED: middleware.ts now runs at Vercel edge (was proxy.ts dead code)
- OPS-02 RESOLVED: Error boundaries on all major page surfaces (15-02)
- OPS-03 RESOLVED: Production env vars and middleware behavior verified live (15-03)
- OPS-04 RESOLVED: Structured server logging added to charting API routes (15-04)
- CODE-01 RESOLVED locally: `ChartingEditor.tsx` reduced to 941 lines; extracted modules are each under 500 lines
- CODE-02 RESOLVED locally: `LiveAbInsightsExplorer.tsx` reduced to 993 lines; extracted modules are each under 500 lines
- CODE-03 REMAINS: some `web/` files still exceed the 1000-line ceiling and must be handled in `16-03`
- TEAM-01 RESOLVED: All rendered "Babson" literals replaced with TEAM_NAME from teamConfig.ts (17-01)
- TEAM-02 RESOLVED: team_id column added to all five charting tables; back-filled to 'babson'; NOT NULL + DEFAULT 'babson' (17-02)
- TEAM-VERCEL RESOLVED: NEXT_PUBLIC_TEAM_NAME=Babson confirmed in Vercel; live deployment verified (17-03)
- No demo mode (Phase 20)

### Blockers

None.

## Session Continuity

**Last Date:** 2026-03-22T18:53:43.033Z
**Stopped At:** Completed 17-03-PLAN.md — Phase 17 Multi-Tenancy Part 1 complete
**Resume File:** None
