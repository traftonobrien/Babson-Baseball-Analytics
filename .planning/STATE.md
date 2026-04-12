---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: Run Expectancy Intelligence
status: executing
stopped_at: Milestone v4.0 complete — all 4 phases (21-24), 12 plans done
last_updated: "2026-04-11T02:00:00.000Z"
last_activity: 2026-04-11
progress:
  total_phases: 4
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-11)

**Core value:** Coaches can quantify the run-value impact of every pitching decision using a live, game-data-backed run expectancy model.
**Current focus:** Milestone v4.0 — Phase 21 (PBP Parser Foundation)

## Current Position

**Phase:** Complete — Milestone v4.0 fully done
**Plan:** All 12 plans across phases 21-24 complete
**Status:** Milestone v4.0 Run Expectancy Intelligence shipped
**Last Activity:** 2026-04-11

Progress: [██░░░░░░░░] 17% (v4.0)

## Performance Metrics

**Velocity (v3.0):**
- Plans completed: 9
- Plans total: 22 (estimated across 7 phases)

**Prior milestone (v2.0):** 38 plans completed across 13 phases

## Accumulated Context

### Key Decisions Entering v4.0

- RE matrix stored as static JSON (`web/public/data/run-expectancy/re-matrix-2026.json`) — consistent with all other derived data in this repo; zero latency, no Supabase reads at request time
- Phase numbering starts at 21 — phases 1-20 belong to prior milestones
- 4 phases derive directly from the natural dependency chain: parser → matrix → join → dashboard
- Null rule: cells with n < 5 stored as null, displayed with "limited sample" indicator — prevents false precision on sparse D3 data
- Delta-RE sign convention: `RE(post) - RE(pre) + runs_scored`; positive = pitcher hurt, negative = pitcher helped (to be hand-verified in Phase 23-03)
- Match rate gate: Phase 23 is complete only when >= 80% of charted 0-2 fastball PAs from games with Sidearm PBP are matched
- `npm run re:rebuild` is the single command to re-scrape all games and regenerate both matrix files

### Key Decisions — Phase 21 Planning

- Reuse `discoverGameUrls()` plus exported `fetchPlayByPlayHtml()` / `extractPlayLines()` from `web/lib/spraychart/scraper.ts`; do not create a second Sidearm discovery stack
- Keep `web/scripts/scrape_spray_charts.ts` unchanged; Phase 21 touches `web/lib/spraychart/scraper.ts` only to export the two reusable helpers
- Build the new parser under `web/lib/runExpectancy/` with typed raw-row, parsed-PA, validation-report, and count-snapshot contracts
- Semicolon-separated clauses inside one Sidearm row are processed sequentially as runner/base-state mutations within the same PA
- Half-inning run-total validation against the box score `r` column is a hard gate; failed innings are excluded and surfaced explicitly
- `web/public/data/run-expectancy/re_game_map.json` must map Sidearm `gameId` to `{ date, opponent, homeAway, suffix }`, preserving doubleheader identity for later charting joins
- Phase 21 completion requires an executable season gate proving at least 15 of the approximately 19 known 2026 games pass validation before Phase 22 begins

### Key Decisions — Phase 21 Execution

- Parse the real Sidearm play-by-play markup by half-inning table (`table.sidearm-table.play-by-play` + caption) instead of flattening the full Play By Play section immediately
- Deduplicate duplicated desktop/mobile half-innings by `inning + half + playLines`, not by plain play text
- Keep `extractPlayLines()` backward-compatible for spray charts while adding an opt-out dedupe mode for the RE parser's isolated table parsing
- Track occupied bases by runner name so semicolon sub-events can move or score the correct runner instead of only flipping anonymous occupancy bits
- Emit explicit `usableHalfInnings` vs `failedHalfInnings` from the parsed game output so failed run-total validation is impossible to ignore downstream
- Scope the season-validation gate to the 19 mapped `re_game_map.json` games and treat a game as phase-ready when at least 75% of its half-innings validate; failed half-innings remain excluded from downstream matrix computation

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

**Last Date:** 2026-04-11
**Stopped At:** Roadmap created for v4.0 — 4 phases defined (21-24), 21 requirements mapped, ready to run /gsd:plan-phase 21
**Resume File:** None
