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
- [ ] **Phase 12: Live AB Leaderboard** - New /charting/leaderboard with Pitchers + Hitters tabs, filters, and sortable columns
- [ ] **Phase 13: Per-Player Drill-Down** - Session-by-session history pages for any pitcher (/pitcher/[playerId]) or hitter (/hitter/[name])

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
- [ ] 12-01: Build /charting/leaderboard route and shared filter/tab chrome
- [ ] 12-02: Build pitcher leaderboard table with sort and filter integration
- [ ] 12-03: Build hitter leaderboard table with sort and filter integration

### Phase 13: Per-Player Drill-Down
**Goal**: Deliver session-by-session history pages for any pitcher or hitter linked from the leaderboard.
**Depends on**: Phase 12
**Success Criteria** (what must be TRUE):
  1. /charting/leaderboard/pitcher/[playerId] shows career totals at the top plus a session-by-session breakdown table (date, pitch count, Strike%, Zone%, Whiff%, Chase%).
  2. /charting/leaderboard/hitter/[name] shows the same structure from the hitter side (PAs, Chase%, Contact%, K%, BB%).
  3. Each session row links directly to /charting/games/[id] for full game review.
  4. Both pages handle pitchers/hitters with only one session gracefully.
**Plans**: 2 plans

Plans:
- [ ] 13-01: Build per-pitcher drill-down page with career totals and session history
- [ ] 13-02: Build per-hitter drill-down page with career totals and session history

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
| 10. Analytics Foundation | 0/4 | Not started | - |
| 11. Session Overview Enhancements | 0/3 | Not started | - |
| 12. Live AB Leaderboard | 0/3 | Not started | - |
| 13. Per-Player Drill-Down | 0/2 | Not started | - |
