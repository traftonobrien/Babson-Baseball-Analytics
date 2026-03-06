# Roadmap: Babson Pitching Charting App

## Overview

This roadmap takes the project from a brownfield repo with no live charting domain to a staff-usable internal iPad workflow plus portal reporting. The sequence is intentionally fine-grained so work can stop safely between sections, preserve context, and avoid overcommitting a single implementation run.

## Phases

- [ ] **Phase 1: Charting Domain Foundation** - Define the backend charting model, persistence schema, and revision-safe APIs
- [ ] **Phase 2: Access and Game Setup** - Add operator access, bootstrap data, lineup setup, and pitcher-segment management
- [ ] **Phase 3: Local iPad Persistence** - Create the native app shell with autosaved offline storage and recovery
- [ ] **Phase 4: Live Charting Workflow** - Build the touch-first pitch and plate-appearance capture experience
- [ ] **Phase 5: Sync and Finalization** - Add offline queue replay, finalize flow, and manual totals override support
- [ ] **Phase 6: Portal Charting Surfaces** - Add charting hub, game detail, and derived reporting views
- [ ] **Phase 7: Export Fidelity** - Generate structured CSV and PDF outputs based on the stable chart model
- [ ] **Phase 8: Pilot Hardening and TestFlight** - Prepare internal beta delivery, diagnostics, and operational guidance

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
- [ ] 01-01: Define charting snapshot types, normalized tables, and fixture payloads
- [ ] 01-02: Build create/read/update APIs with revision handling
- [ ] 01-03: Add backend tests for revision safety and fixture round-trips

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
- [ ] 02-01: Add internal charting auth and bootstrap endpoints
- [ ] 02-02: Model lineup entry and editable game-header metadata
- [ ] 02-03: Add pitcher-segment lifecycle and setup tests

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
- [ ] 03-01: Create SwiftUI app shell, navigation, and shared models
- [ ] 03-02: Implement SwiftData persistence and autosave flow
- [ ] 03-03: Add relaunch and recovery verification

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
- [ ] 04-01: Build live pitch-entry controls and zone grid interaction
- [ ] 04-02: Implement count / PA state machine, result codes, and edit history
- [ ] 04-03: Add sample-sheet-inspired live board rendering for scorer confidence

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
- [ ] 05-01: Build queued offline sync and replay behavior
- [ ] 05-02: Add finalize flow and manual totals override UX
- [ ] 05-03: Add sync diagnostics, stale-write handling, and tests

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
- [ ] 06-01: Build charting hub route and game listing
- [ ] 06-02: Build game detail views and analytics summaries
- [ ] 06-03: Add query, projection, and rendering tests

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
- [ ] 07-01: Build normalized CSV export
- [ ] 07-02: Build paper-style PDF renderer
- [ ] 07-03: Verify export output against the sample chart fixture

### Phase 8: Pilot Hardening and TestFlight
**Goal**: Prepare the product for internal staff use in a controlled TestFlight pilot.
**Depends on**: Phase 7
**Requirements**: [OPS-01, OPS-02]
**Success Criteria** (what must be TRUE):
  1. Internal testers can install and run the app via TestFlight.
  2. Sync and validation failures are visible enough for staff to recover without losing trust in the chart.
  3. Staff has a short runbook for beta use and troubleshooting.
**Plans**: 3 plans

Plans:
- [ ] 08-01: Prepare internal TestFlight packaging and distribution checklist
- [ ] 08-02: Add pilot diagnostics, error surfacing, and retry guidance
- [ ] 08-03: Publish operator runbook and scoring quick reference

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Charting Domain Foundation | 0/3 | Not started | - |
| 2. Access and Game Setup | 0/3 | Not started | - |
| 3. Local iPad Persistence | 0/3 | Not started | - |
| 4. Live Charting Workflow | 0/3 | Not started | - |
| 5. Sync and Finalization | 0/3 | Not started | - |
| 6. Portal Charting Surfaces | 0/3 | Not started | - |
| 7. Export Fidelity | 0/3 | Not started | - |
| 8. Pilot Hardening and TestFlight | 0/3 | Not started | - |
