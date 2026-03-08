# Roadmap: Babson Pitching Charting App

## Overview

This roadmap takes the project from a brownfield repo with no live charting domain to a staff-usable internal iPad workflow plus portal reporting. The sequence is intentionally fine-grained so work can stop safely between sections, preserve context, and avoid overcommitting a single implementation run. After export fidelity, the next risk is charting-engine correctness, so internal pilot packaging is intentionally pushed behind a hardening phase. Phase 9 planning also surfaced one remaining sync-contract gap between the iPad snapshot payload and the server PATCH route, so pilot hardening now explicitly includes closing that operational hole before TestFlight. Phase 08.1 has now reset the iPad charting experience around a zone-first, confirm-before-save workflow before that pilot work begins.

## Phases

- [x] **Phase 1: Charting Domain Foundation** - Define the backend charting model, persistence schema, and revision-safe APIs
- [x] **Phase 2: Access and Game Setup** - Add operator access, bootstrap data, lineup setup, and pitcher-segment management
- [x] **Phase 3: Local iPad Persistence** - Create the native iPad app shell with autosaved offline storage and recovery
- [x] **Phase 4: Live Charting Workflow** - Build the touch-first pitch and plate-appearance capture experience
- [x] **Phase 5: Sync and Finalization** - Add offline queue replay, finalize flow, and manual totals override support
- [x] **Phase 6: Portal Charting Surfaces** - Add charting hub, game detail, and derived reporting views
- [x] **Phase 7: Export Fidelity** - Generate structured CSV and PDF outputs based on the stable chart model
- [x] **Phase 8: Charting Engine Hardening** - Make the live charting state machine deterministic, validated, and regression-tested
- [x] **Phase 08.1: Charting UX and Mode Workflow** - Rebuild live charting around zone-first layout, mode-aware setup, and explicit pitch confirmation
- [ ] **Phase 9: Pilot Hardening and TestFlight** - Prepare internal beta delivery, diagnostics, and operational guidance

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

### Phase 08.1: Charting UX and Mode Workflow (INSERTED)

**Goal:** Rebuild the live charting experience so it mirrors the real scoring workflow, supports both `Live AB` and `Game` modes, and removes accidental tap-to-save pitch entry.
**Requirements**: [CHRT-01, CHRT-02, CHRT-03, CHRT-04, CHRT-05, ENG-03]
**Depends on:** Phase 8
**Plans:** 3 plans

Plans:
- [x] 08.1-01: Rebuild the live charting shell around zone-first layout and hidden history
- [x] 08.1-02: Add `Live AB` and `Game` mode workflow
- [x] 08.1-03: Implement confirm-first pitch entry, arsenal filtering, and verification

Current status:
- `LiveChartingView` now uses a compact top utility bar, dominant left-side zone workspace, right-side count/type/action stack, and a hidden history sheet.
- The iPad app now supports local `Live AB` setup alongside lineup-driven `Game` mode, with queued next-AB correction in game flow.
- Pitch action taps now build a pending pitch that must be explicitly confirmed, while the main screen always shows pitcher, inning, and game pitch totals.
- Bootstrap pitchers now carry arsenal-filtered pitch families into iOS so the pitch-type picker can reduce clutter per pitcher.

### Phase 9: Pilot Hardening and TestFlight
**Goal**: Prepare the product for internal staff use in a controlled TestFlight pilot once the charting mechanics are trustworthy.
**Depends on**: Phase 08.1
**Requirements**: [OPS-01, OPS-02]
**Success Criteria** (what must be TRUE):
  1. Internal testers can install and run the app via TestFlight.
  2. Sync and validation failures are visible enough for staff to recover without losing trust in the chart.
  3. Staff has a short runbook for beta use and troubleshooting.
**Plans**: 3 plans

Plans:
- [ ] 09-01: Restore intentional pilot shell, auth gating, and build/session visibility
- [ ] 09-02: Close full snapshot sync gap and add pilot diagnostics/recovery
- [ ] 09-03: Publish operator runbook, checklist, and verification handoff

Current planning status:
- `09-CONTEXT.md`, `09-01-PLAN.md`, `09-02-PLAN.md`, and `09-03-PLAN.md` are now on disk.
- Phase 9 execution should start with the iPad auth shell and the sync-contract repair, because the discovered PATCH-route mismatch is the main blocker to a credible TestFlight pilot.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 08.1 → 9

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
| 08.1. Charting UX and Mode Workflow | 3/3 | Complete | 2026-03-07 |
| 9. Pilot Hardening and TestFlight | 0/3 | Planned | - |
