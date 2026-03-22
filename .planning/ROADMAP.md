# Roadmap: Babson Pitching Charting App

## Overview

This roadmap takes the project from a brownfield repo with no live charting domain to a staff-usable internal iPad workflow plus portal reporting. The sequence is intentionally fine-grained so work can stop safely between sections, preserve context, and avoid overcommitting a single implementation run. After export fidelity, the next risk is charting-engine correctness, so internal pilot packaging is intentionally pushed behind a hardening phase.

## Phases

- [x] **Phase 1: Charting Domain Foundation** - Define the backend charting model, persistence schema, and revision-safe APIs
- [x] **Phase 2: Access and Game Setup** - Add operator access, bootstrap data, lineup setup, and pitcher-segment management
- [x] **Phase 3: Local iPad Persistence** - Create the native iPad app shell with autosaved offline storage and recovery
- [x] **Phase 4: Live Charting Workflow** - Build the touch-first pitch and plate-appearance capture experience
- [x] **Phase 5: Sync and Finalization** - Add offline queue replay, finalize flow, and manual totals override support
- [x] **Phase 6: Portal Charting Surfaces** - Add charting hub, game detail, and derived reporting views
- [x] **Phase 7: Export Fidelity** - Generate structured CSV and PDF outputs based on the stable chart model
- [x] **Phase 8: Charting Engine Hardening** - Make the live charting state machine deterministic, validated, and regression-tested
- [ ] **Phase 9: Pilot Hardening and TestFlight** - Prepare internal beta delivery, diagnostics, and operational guidance

---
## Milestone v2.0: Live AB Analytics

- [x] **Phase 10: Analytics Foundation** - Build shared stat engine for pitcher and hitter metrics from charting pitch/PA data
- [x] **Phase 11: Session Overview Enhancements** - Enrich /charting/games/[id] with per-pitcher and per-hitter breakdown sections
- [x] **Phase 12: Live AB Leaderboard** - New /charting/leaderboard with Pitchers + Hitters tabs, filters, and sortable columns
- [x] **Phase 12.1: Live AB Player Profile Integration** - Bring charted pitcher and hitter analytics into the main player profile tabs as a new Live AB surface
- [ ] **Phase 13: Integrated At-A-Glance Dashboard** - Redesign the game session overview into a dense, vertical-scrolling-free compact layout.

---
## Milestone v3.0: Market-Ready Platform

- [x] **Phase 14: Completion** - Finish Phase 12.1-03 mixed-role polish and merge the charting UAT branch
- [x] **Phase 15: Ops Foundations** - Fix middleware deployment, add error boundaries, verify env vars, add structured logging
- [x] **Phase 16: Code Decomposition** - Break ChartingEditor and LiveAbInsightsExplorer into modules under 500 lines each
- [ ] **Phase 17: Multi-Tenancy Part 1** - Replace Babson hardcoding with configurable team identity and add team_id to DB schema
- [ ] **Phase 17.5: Supabase Migration** - Migrate database and auth from Neon/custom to Supabase (RLS, Auth, Storage)
- [ ] **Phase 18: Multi-Tenancy Part 2** - Build admin settings surface, team-scoped player identity, and team-aware auth
- [ ] **Phase 19: UX Polish** - Mobile-responsive layout, skeleton loading states, touch targets, and keyboard accessibility
- [ ] **Phase 20: Demo and Marketing** - Public demo mode with seeded data and a landing page for unauthenticated visitors

## Phase Details

### Phase 1: Charting Domain Foundation
**Goal**: Establish a game-centric charting backend with explicit pitcher segments and revision-safe persistence.
**Depends on**: Nothing (first phase)
**Requirements**: [GAME-01, SYNC-03]
**Success Criteria** (what must be TRUE):
  1. Staff can create and fetch a charting game record through backend APIs.
  2. The data model supports multiple Babson pitchers inside one game.
  3. Stale chart updates are rejected safely using revision checks.
**Plans**: 3 plans

Plans:
- [x] 01-01: Define charting snapshot types, normalized tables, and fixture payloads
- [x] 01-02: Build create/read/update APIs with revision handling
- [x] 01-03: Add backend tests for revision safety and fixture round-trips

### Phase 2: Access and Game Setup
**Goal**: Let an internal operator start a game, load canonical pitchers, enter hitters, and manage pitcher changes.
**Depends on**: Phase 1
**Requirements**: [AUTH-01, AUTH-02, GAME-02, GAME-03, GAME-04]
**Success Criteria** (what must be TRUE):
  1. A staff user can sign into the charting workflow and bootstrap required setup data.
  2. A scorer can enter a lineup and edit game metadata before charting starts.
  3. A scorer can switch pitchers during the game without breaking the chart.
**Plans**: 3 plans

Plans:
- [x] 02-01: Add internal charting auth and bootstrap endpoints
- [x] 02-02: Model lineup entry and editable game-header metadata
- [x] 02-03: Add pitcher-segment lifecycle and setup tests

### Phase 3: Local iPad Persistence
**Goal**: Create the native iPad app shell and guarantee local autosave + relaunch recovery.
**Depends on**: Phase 2
**Requirements**: [SYNC-01]
**Success Criteria** (what must be TRUE):
  1. The iPad app can open, authenticate, and navigate charting screens.
  2. Every chart change is saved locally without manual save actions.
  3. The app can reopen midgame and restore the current chart exactly.
**Plans**: 3 plans

Plans:
- [x] 03-01: Create SwiftUI app shell, navigation, and shared models
- [x] 03-02: Implement SwiftData persistence and autosave flow
- [x] 03-03: Add relaunch and recovery verification

### Phase 4: Live Charting Workflow
**Goal**: Deliver the fast touch workflow for pitch-by-pitch and plate-appearance entry.
**Depends on**: Phase 3
**Requirements**: [CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, CHRT-06]
**Success Criteria** (what must be TRUE):
  1. A scorer can enter pitch type, location, count context, and pitch result quickly for each pitch.
  2. A scorer can close each plate appearance with a valid chart result code.
  3. Earlier entries can be undone or edited without corrupting later game state.
**Plans**: 3 plans

Plans:
- [x] 04-01: Build live pitch-entry controls and zone grid interaction
- [x] 04-02: Implement count / PA state machine, result codes, and edit history
- [x] 04-03: Add sample-sheet-inspired live board rendering for scorer confidence

Implemented baseline:
- The iPad charting shell is landscape-first with the 14-cell Trackman zone selector occupying the elastic top canvas.
- Count, pitch type, pitch result, and plate-appearance closeout live in the bottom operator dock.
- Matchup and pitch history are supporting surfaces that should stay compact as future controls are added.

### Phase 5: Sync and Finalization
**Goal**: Make the workflow reliable when connectivity is poor and lock finalized games correctly.
**Depends on**: Phase 4
**Requirements**: [SYNC-02, SYNC-04, EXPT-03]
**Success Criteria** (what must be TRUE):
  1. A scorer can keep charting while offline and later sync without missing or duplicating events.
  2. Finalizing a game prevents accidental live edits.
  3. A scorer can set final pitcher `R` and `ER` overrides before export.
**Plans**: 3 plans

Plans:
- [x] 05-01: Build queued offline sync and replay behavior
- [x] 05-02: Add finalize flow and manual totals override UX
- [x] 05-03: Add sync diagnostics, stale-write handling, and tests

### Phase 6: Portal Charting Surfaces
**Goal**: Make synced charting games visible and useful inside the existing portal.
**Depends on**: Phase 5
**Requirements**: [PORT-01, PORT-02, PORT-03, PORT-04]
**Success Criteria** (what must be TRUE):
  1. Staff can browse a charting hub with synced game status and pitchers used.
  2. Staff can open a game and review its lineup, chart events, and pitcher segments.
  3. Portal analytics show strike %, zone %, first-pitch strike %, count splits, pitch mix, and per-pitcher summaries.
**Plans**: 3 plans

Plans:
- [x] 06-01: Build charting hub route and game listing
- [x] 06-02: Build game detail views and analytics summaries
- [x] 06-03: Add query, projection, and rendering tests

### Phase 7: Export Fidelity
**Goal**: Turn the stable chart data into staff-usable CSV and PDF outputs.
**Depends on**: Phase 6
**Requirements**: [EXPT-01, EXPT-02]
**Success Criteria** (what must be TRUE):
  1. Staff can download structured CSV data for a charted game.
  2. Staff can generate a PDF that is recognizably aligned with the current paper chart layout.
  3. Export output stays consistent with the underlying chart data and per-pitcher totals.
**Plans**: 3 plans

Plans:
- [x] 07-01: Build normalized CSV export
- [x] 07-02: Build paper-style PDF renderer
- [x] 07-03: Verify export output against the sample chart fixture

Current status:
- CSV export now ships from `/api/charting/games/[id]/export` and is linked directly from `/charting/games/[id]`.
- PDF export now ships from `/api/charting/games/[id]/export-pdf` and is linked directly from `/charting/games/[id]`.
- Fixture-backed export verification passed for both CSV and PDF outputs, including finalized pitcher totals.

### Phase 8: Charting Engine Hardening
**Goal**: Make the live charting engine deterministic enough to trust in real-game use before widening distribution.
**Depends on**: Phase 7
**Requirements**: [ENG-01, ENG-02, ENG-03, ENG-04]
**Success Criteria** (what must be TRUE):
  1. The app can reconstruct inning, outs, count, batter slot, and open plate appearance deterministically from the saved event log after undo, relaunch, or sync reload.
  2. Supported plate-appearance result codes advance outs, inning, batter order, and active pitcher state correctly without relying on ad hoc string checks.
  3. Scenario-based tests cover count progression, PA closure, undo, pitcher changes, relaunch recovery, and finalize locking.
**Plans**: 3 plans

Plans:
- [x] 08-01: Build deterministic charting-engine rules and state reconstruction
- [x] 08-02: Integrate engine rules into the live workflow with operator guardrails
- [x] 08-03: Add scenario-based regression coverage and verification fixtures

Current status:
- The iPad charting engine now derives inning, outs, count, batter slot, and closeout readiness from typed pitch and PA result rules rather than ad hoc counter repair.
- Live workflow guardrails now prevent extra pitches after terminal events, restrict PA closeout choices to valid results, block pitcher changes mid-PA, and prevent finalization with an open PA.
- Scenario-based charting engine tests now cover strike-three bunt fouls, ball four, inning rollover, double plays, in-play closeouts, and between-inning segment handoff.

### Phase 9: Pilot Hardening and TestFlight
**Goal**: Prepare the product for internal staff use in a controlled TestFlight pilot once the charting mechanics are trustworthy.
**Depends on**: Phase 8
**Requirements**: [OPS-01, OPS-02]
**Success Criteria** (what must be TRUE):
  1. Internal testers can install and run the app via TestFlight.
  2. Sync and validation failures are visible enough for staff to recover without losing trust in the chart.
  3. Staff has a short runbook for beta use and troubleshooting.
**Plans**: 3 plans

Plans:
- [ ] 09-01: Prepare internal TestFlight packaging and distribution checklist
- [ ] 09-02: Add pilot diagnostics, error surfacing, and retry guidance
- [ ] 09-03: Publish operator runbook and scoring quick reference

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Charting Domain Foundation | 3/3 | Complete | 2026-03-06 |
| 2. Access and Game Setup | 3/3 | Complete | 2026-03-06 |
| 3. Local iPad Persistence | 3/3 | Complete | 2026-03-06 |
| 4. Live Charting Workflow | 3/3 | Complete | 2026-03-06 |
| 5. Sync and Finalization | 3/3 | Complete | 2026-03-06 |
| 6. Portal Charting Surfaces | 3/3 | Complete | 2026-03-06 |
| 7. Export Fidelity | 3/3 | Complete | 2026-03-06 |
| 8. Charting Engine Hardening | 3/3 | Complete | 2026-03-06 |
| 9. Pilot Hardening and TestFlight | 0/3 | Not started | - |

---

## Milestone v2.0 Phase Details

### Phase 10: Analytics Foundation
**Goal**: Build a shared analytics engine that computes per-segment pitcher stats and per-hitter stats from existing charting pitch and PA data, with cross-session aggregation support.
**Depends on**: Phase 9 (or can run in parallel — no iOS dependency)
**Success Criteria** (what must be TRUE):
  1. `computeSegmentStats(segmentId)` returns Strike%, Zone%, Whiff%, Chase%, FPS%, pitch mix %, K%, BB% from pitch + PA records.
  2. `aggregatePitcherStats(playerId, options)` aggregates those values across multiple games with optional date-range and gameId filters.
  3. `computeHitterStats(hitterName, gameId)` returns Chase%, contact rate, whiff rate, K%, BB%, zone frequency map, and pitch-type split (vs Fastball/Breaking/Offspeed).
  4. `aggregateHitterStats(hitterName, options)` aggregates hitter stats across sessions with the same filter options as pitchers.
  5. All functions are pure/testable and consumed by Phase 11 and Phase 12 without duplication.
**Plans**: 4 plans

Plans:
- [x] 10-00-PLAN.md — Create analytics-fixtures.ts and failing test stubs (Wave 0 RED state)
- [x] 10-01-PLAN.md — Implement pitcher analytics: computeSegmentStats_pure, computeSegmentStats, aggregatePitcherStats
- [x] 10-02-PLAN.md — Implement hitter analytics: computeHitterStats_pure, computeHitterStats, aggregateHitterStats
- [x] 10-03-PLAN.md — Full test suite green, TypeScript build clean, phase gate verification

Current status:
- Shared analytics now lives in `web/lib/charting/analytics.ts` with 29 dedicated analytics tests, a green full web test suite, and a clean production build as of 2026-03-10.

### Phase 11: Session Overview Enhancements
**Goal**: Enrich the existing /charting/games/[id] page with a full per-pitcher breakdown section and a full per-hitter breakdown section below the current summary.
**Depends on**: Phase 10
**Success Criteria** (what must be TRUE):
  1. Below the existing stat card row, each Babson pitcher who appeared in the game has a breakdown card showing their pitch mix, Strike%, Zone%, Whiff%, Chase%, FPS%, and PA outcomes (K/BB/HBP/hits/outs).
  2. Each pitcher card includes a 14-cell zone frequency heat map (catcher-view) colored by pitch frequency.
  3. Below the pitcher section, each hitter who batted has a breakdown showing pitches seen, Chase%, Contact%, K/BB result, and a zone coverage map.
  4. Both sections degrade gracefully when no pitches or PAs are recorded.
**Plans**: 3 plans

Plans:
- [x] 11-01: Build per-pitcher breakdown section with stat cards and pitch mix
- [x] 11-02: Build 14-cell zone heat map component (reusable for pitchers and hitters)
- [x] 11-03: Build per-hitter breakdown section with zone coverage and pitch-type splits

Current status:
- `/charting/games/[id]` now shows per-pitcher and per-hitter breakdown cards powered by the shared Phase 10 analytics engine, including reusable zone coverage maps and session-overview helper tests as of 2026-03-10.

### Phase 12: Live AB Leaderboard
**Goal**: Deliver /charting/leaderboard with two tabs (Pitchers | Hitters), sortable stat columns, and filters for date range and specific session.
**Depends on**: Phase 10
**Success Criteria** (what must be TRUE):
  1. /charting/leaderboard renders with Pitchers and Hitters tabs; each tab shows a sortable table of all players who have appeared in any charting session.
  2. Pitcher columns: Name, Sessions, Pitches, Strike%, Zone%, Whiff%, Chase%, FPS%, K%, BB%.
  3. Hitter columns: Name, Sessions, PAs, Chase%, Contact%, K%, BB%, plus Fastball/Breaking/Offspeed whiff%.
  4. Filters: Last 7 days / Last 30 days / All time + a session picker that limits stats to a single session.
  5. Visual style matches the existing /leaderboards page chrome (LeaderboardPanel, LeaderboardPill, etc.).
**Plans**: 3 plans

Plans:
- [x] 12-01: Build /charting/leaderboard route and shared filter/tab chrome
- [x] 12-02: Build pitcher leaderboard table with sort and filter integration
- [x] 12-03: Build hitter leaderboard table with sort and filter integration

### Phase 12.2: NCAA leaderboard sync redesign (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 12
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 12.2 to break down)

### Phase 12.1: Live AB player profile integration (INSERTED)

**Goal:** Integrate cross-session Live AB analytics into the existing player profile experience so coaches can evaluate charted pitcher and hitter performance from each player page.
**Requirements**: [PORT-05]
**Depends on:** Phase 12
**Success Criteria** (what must be TRUE):
  1. Player profiles expose a new Live AB tab within the existing profile tab system.
  2. Pitcher-capable players show a Live AB overview and recent-session history built from shared charting analytics.
  3. Hitter-capable players show a Live AB overview and recent-session history built from shared charting analytics.
  4. Two-way players and no-data states are handled cleanly without requiring separate profile routes.
**Plans:** 3 plans

Plans:
- [x] 12.1-01: Build role-aware Live AB profile aggregation and hitter identity resolution helpers
- [x] 12.1-02: Integrate the Live AB tab into `/players/[slug]` with pitcher and hitter profile overviews
- [x] 12.1-03: Polish mixed-role states, session links, and final validation coverage

Current status:
- `/players/[slug]` now exposes a Live AB tab backed by shared charting profile data, including pitcher/hitter overview cards and recent session links.
- Final mixed-role polish and the broader validation gate remain before Phase 12.1 can be closed.

### Phase 13: Integrated At-A-Glance Dashboard
**Goal**: Maintain the aggressive, dark, data-dense aesthetic while eliminating vertical scrolling by packing all key pitcher and hitter insights into compact, single-screen cards within a two-column layout.
**Depends on**: Phase 11
**Success Criteria** (what must be TRUE):
  1. The page header is a single horizontal row housing back navigation, session actions dropdown, and editable titles.
  2. The left 25% of the page holds a consolidated sidebar with Game Details, weather/catchers, and the Live Pitcher vs Hitter matchup.
  3. The right 75% of the page contains an integrated grid of Pitcher Outing Cards and Hitter Summary Cards.
  4. Pitcher Outing Cards feature a horizontal stacked bar for true outcomes, grouped stats/pitch mix, and a micro modal-triggering heatmap.
  5. Hitter Summary Cards feature horizontal stacked outcomes, approach metrics, result trails, and a micro modal-triggering heatmap.
**Plans**:
- [ ] 13-01: Redesign the page layout with a compacted top bar, 25% left Game Details sidebar, and a 75% right card canvas.
- [ ] 13-02: Implement the Outcome Funnel (horizontal stacked bar) and Vertical Stat/Mix containers for Pitchers and Hitters.
- [ ] 13-03: Implement the 3x3 Micro-Map and link it to the full 14-cell Zone Coverage modal.

## Updated Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Charting Domain Foundation | 3/3 | Complete | 2026-03-06 |
| 2. Access and Game Setup | 3/3 | Complete | 2026-03-06 |
| 3. Local iPad Persistence | 3/3 | Complete | 2026-03-06 |
| 4. Live Charting Workflow | 3/3 | Complete | 2026-03-06 |
| 5. Sync and Finalization | 3/3 | Complete | 2026-03-06 |
| 6. Portal Charting Surfaces | 3/3 | Complete | 2026-03-06 |
| 7. Export Fidelity | 3/3 | Complete | 2026-03-06 |
| 8. Charting Engine Hardening | 3/3 | Complete | 2026-03-06 |
| 9. Pilot Hardening and TestFlight | 0/3 | Not started | - |
| 10. Analytics Foundation | 4/4 | Complete | 2026-03-10 |
| 11. Session Overview Enhancements | 3/3 | Complete | 2026-03-10 |
| 12. Live AB Leaderboard | 3/3 | Complete | 2026-03-09 |
| 12.1. Live AB Player Profile Integration | 3/3 | Complete | 2026-03-21 |
| 13. Integrated At-A-Glance Dashboard | 0/3 | Not started | - |

---

## Milestone v3.0 Phase Details

### Phase 14: Completion
**Goal**: Close all in-flight work before the v3.0 platform push begins — finish the mixed-role Live AB polish and merge the charting UAT branch to main.
**Depends on**: Phase 13
**Requirements**: DONE-01, DONE-02
**Success Criteria** (what must be TRUE):
  1. Phase 12.1-03 is complete — mixed-role Live AB player profiles (pitcher-only, hitter-only, and two-way players) all render correctly with no blank or broken states.
  2. The codex/game-charting-structure branch passes manual browser UAT across all scenarios: new game creation, pitch recording, PA close, lineup entry, baserunner entry, history edit, and export.
  3. The charting UAT branch is merged to main with a clean build and no regressions.
**Plans**: 3 plans

Plans:
- [x] 14-01: Complete Phase 12.1-03 mixed-role polish and final validation
- [x] 14-02: Execute charting UAT browser test script and document results
- [x] 14-03: Phase 14 closeout — update ROADMAP, STATE, and write 14-SUMMARY

### Phase 15: Ops Foundations
**Goal**: Make the deployed platform reliable and diagnosable — authentication gates protect page routes, uncaught errors show recovery UI, environment variables are confirmed, and server errors are captured with context.
**Depends on**: Phase 14
**Requirements**: OPS-01, OPS-02, OPS-03, OPS-04
**Success Criteria** (what must be TRUE):
  1. Navigating directly to any protected page route without a valid session redirects to login — the middleware is actually running on Vercel.
  2. When a major page surface throws an uncaught render error, the user sees a recoverable error UI instead of a blank screen.
  3. All three required environment variables (PT_PASSWORD, MECHANICS_PASSWORD, DATABASE_URL) are confirmed present and correct on the live Vercel deployment.
  4. Server-side errors are logged with enough context (route, user action, stack) to diagnose failures without local reproduction.
**Plans**: 4 plans

Plans:
- [x] 15-01: Move proxy.ts auth logic into middleware.ts and verify deployment
- [x] 15-02: Add React error boundaries to all major page surfaces
- [x] 15-03: Audit and confirm Vercel environment variables; document verification steps
- [x] 15-04: Implement structured server-side error logging

### Phase 16: Code Decomposition
**Goal**: Break the two mega-files down into focused modules so the codebase is safely navigable and no single file in web/ exceeds 1000 lines.
**Depends on**: Phase 15
**Requirements**: CODE-01, CODE-02, CODE-03
**Success Criteria** (what must be TRUE):
  1. ChartingEditor.tsx no longer exists as a single file — its logic, hooks, and sub-components are split into modules each under 500 lines, and all charting tests still pass.
  2. LiveAbInsightsExplorer.tsx no longer exists as a single file — pitcher panels, hitter panels, filter logic, and synthesis helpers are in separate modules each under 500 lines.
  3. No file in web/ exceeds 1000 lines after both decomposition passes complete.
**Plans**: 3 plans

Plans:
- [x] 16-01: Decompose ChartingEditor.tsx into extracted hooks, sub-components, and logic modules
- [x] 16-02: Decompose LiveAbInsightsExplorer.tsx into pitcher/hitter panels, filter logic, and synthesis helpers
- [ ] 16-03: Audit all remaining files in web/ for the 1000-line ceiling and decompose any that exceed it

### Phase 17: Multi-Tenancy Part 1
**Goal**: Remove all Babson-specific hardcoding from the product UI and add team_id to the DB schema so the platform is structurally multi-tenant even before the admin surface exists.
**Depends on**: Phase 16
**Requirements**: TEAM-01, TEAM-02
**Success Criteria** (what must be TRUE):
  1. No page in the portal displays the literal string "Babson" as a hardcoded team name — all references read from a configurable team name source.
  2. The DB schema includes a team_id column on charting games and related records; existing Babson records are migrated to a default team_id without data loss.
  3. A new deployment can be configured with a different team name without code changes.
**Plans**: 3 plans

Plans:
- [ ] 17-01-PLAN.md — Audit all hardcoded "Babson" strings in web/ and replace with TEAM_NAME from teamConfig.ts
- [ ] 17-02-PLAN.md — Add team_id to DB schema (charting_games and related tables) and run migration for existing records
- [ ] 17-03-PLAN.md — Verification pass: grep audit, DB column confirmed, build clean, Vercel env var set

### Phase 18: Multi-Tenancy Part 2
**Goal**: Give each team a self-serve admin settings surface, team-scoped player identity to prevent cross-team data leakage, and a login flow that authenticates each team against only their own data.
**Depends on**: Phase 17
**Requirements**: TEAM-03, TEAM-04, TEAM-05
**Success Criteria** (what must be TRUE):
  1. An admin user can navigate to a settings surface and update their team name, logo, and colors — changes are reflected across the portal without a code deploy.
  2. Player rosters, slugs, and playerIds are scoped to team_id — a player from Team A cannot appear in Team B's charting sessions or profile views.
  3. Logging in with Team A's credentials cannot access Team B's data — the auth flow is team-aware.
**Plans**: 3 plans

Plans:
- [ ] 18-01: Build admin settings route and team profile configuration surface
- [ ] 18-02: Scope player identity (roster, slugs, playerIds) to team_id throughout data access layer
- [ ] 18-03: Update auth flow to be team-aware — credentials authenticate against team-scoped records only

### Phase 19: UX Polish
**Goal**: Make the portal usable on mobile screens, eliminate blank-content flashes with skeleton loading states, ensure interactive elements meet touch target standards, and make modals and panels keyboard-navigable.
**Depends on**: Phase 18
**Requirements**: UX-01, UX-02, UX-03, UX-04
**Success Criteria** (what must be TRUE):
  1. Core pages (player list, charting hub, leaderboards, player profile) are fully usable on a 320px-wide screen — no horizontal overflow, no clipped content.
  2. Any page that fetches data shows skeleton placeholder content during loading instead of a blank area or content flash.
  3. Every button, filter, and dropdown has a minimum 44px touch target — verified on a mobile viewport.
  4. All modal and panel surfaces can be opened, navigated, and closed using keyboard alone (Tab, Escape, Enter).
**Plans**: 3 plans

Plans:
- [ ] 19-01: Responsive pass on player list, charting hub, leaderboards, and player profile pages
- [ ] 19-02: Add skeleton loading states to all data-fetching surfaces
- [ ] 19-03: Audit and fix touch target sizes on all interactive elements
- [ ] 19-04: Add keyboard navigation and focus management to modals and panels

### Phase 20: Demo and Marketing
**Goal**: Enable sales and marketing use by providing a public, read-only demo seeded with realistic data and a landing page that explains the product to unauthenticated visitors.
**Depends on**: Phase 19
**Requirements**: DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. An unauthenticated visitor can access a read-only demo portal without entering credentials — the demo shows realistic seeded data across charting, analytics, and player profiles.
  2. A demo visitor cannot modify any data — all write operations are blocked in demo mode, and seeded data is not affected by visitor sessions.
  3. The root URL (/) shows a landing/marketing page for unauthenticated visitors explaining the product, its features, and linking to the demo.
**Plans**: 3 plans

Plans:
- [ ] 20-01: Implement demo mode flag and read-only enforcement across all write paths
- [ ] 20-02: Seed demo dataset with realistic charting games, analytics, and player data; add auto-reset guard
- [ ] 20-03: Build landing page at / for unauthenticated visitors with product overview and demo link

---

## Milestone v3.0 Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 14. Completion | 3/3 | Complete | 2026-03-21 |
| 15. Ops Foundations | 4/4 | Complete | 2026-03-21 |
| 16. Code Decomposition | 3/3 | Complete | 2026-03-21 |
| 17. Multi-Tenancy Part 1 | 0/3 | Not started | - |
| 17.5. Supabase Migration | 0/TBD | Not started | - |
| 18. Multi-Tenancy Part 2 | 0/3 | Not started | - |
| 19. UX Polish | 0/4 | Not started | - |
| 20. Demo and Marketing | 0/3 | Not started | - |

### Phase 17.5: Supabase Migration (INSERTED)

**Goal:** Migrate the platform from Neon + custom password auth to Supabase — swap the database driver, enable Row Level Security with team_id policies, migrate to Supabase Auth, and move static team file storage to Supabase Storage. This makes Phase 18 (admin surface + team-aware auth) dramatically simpler to build.
**Depends on:** Phase 17 (team_id columns must exist before RLS policies are written)
**Requirements**: TEAM-02 (team_id scoping), OPS-01 (auth reliability)
**Success Criteria** (what must be TRUE):
  1. The app reads and writes all charting data through the Supabase Postgres client — no neon-http dependency remains in production code.
  2. Row Level Security policies on all charting tables enforce team_id scoping automatically — no application-layer WHERE team_id filtering required.
  3. Login flow uses Supabase Auth — existing PT_PASSWORD/MECHANICS_PASSWORD approach is replaced with email-based team credentials.
  4. The `web/public/data/` static publish workflow is replaced with Supabase Storage — outing publish writes to a bucket, the web app reads from it.
  5. `npm run build` passes and all existing tests pass against the new driver.
**Plans**: TBD — run /gsd:plan-phase 17.5 to break down

Plans:
- [ ] TBD (run /gsd:plan-phase 17.5 to break down)
