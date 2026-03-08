# Requirements: Babson Pitching Charting App

**Defined:** 2026-03-06
**Core Value:** One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.

## v1 Requirements

### Internal Access

- [x] **AUTH-01**: Staff user can authenticate into the charting workflow with internal credentials
- [x] **AUTH-02**: iPad app can load canonical Babson pitchers and previously charted games for the operator

### Game Setup

- [x] **GAME-01**: User can create a game record with opponent, date, and basic chart metadata
- [x] **GAME-02**: User can manually enter and edit the opponent hitter lineup before first pitch
- [x] **GAME-03**: User can select the current Babson pitcher and switch pitchers during the game without creating a new game
- [x] **GAME-04**: User can capture optional chart-header fields such as charter, weather, catchers, record, standing, tomorrow starter, next-day starter, and tomorrow opponent

### Live Charting

- [x] **CHRT-01**: User can record pitch type using the six charting families `Fastball`, `Curveball`, `Slider`, `Changeup`, `Split/Cut`, and `Other`
- [x] **CHRT-02**: User can record pitch location using the catcher-view 14-cell Trackman grid, plus the separate `PO` location cell used by the live charting workflow
- [x] **CHRT-03**: User can record pitch result as `ball`, `called_strike`, `swinging_strike`, `foul`, `bunt_foul`, `in_play`, or `hit_by_pitch`
- [x] **CHRT-04**: User can retain the count going into each pitch, including bunt context when relevant
- [x] **CHRT-05**: User can close a plate appearance with a controlled chart result code such as `K`, `BB`, `HBP`, `1B`, `F8`, or `6-3`
- [x] **CHRT-06**: User can undo or edit earlier pitches and plate appearances without corrupting the game state

### Charting Engine Hardening

- [x] **ENG-01**: App can deterministically reconstruct inning, outs, count, lineup slot, active pitcher segment, and open plate appearance from persisted chart events after relaunch, undo, or sync refresh
- [x] **ENG-02**: Plate-appearance result handling is driven by a controlled ruleset for out counts and state transitions rather than ad hoc string comparisons
- [x] **ENG-03**: Live charting UI prevents impossible or contradictory scoring actions and keeps the scorer oriented on the next required input
- [x] **ENG-04**: Automated scenario tests cover pitch count progression, inning rollover, undo/reopen flows, pitcher changes, and finalize/recovery behavior

### Charting UX Baseline

- The zone selector owns the dominant left-side canvas in landscape mode and remains the primary spatial work surface.
- Matchup, inning, outs, and mode controls live in a compact top utility bar instead of a large permanent side card.
- Count/totals, pitch type, action, and pending-pitch confirmation live in a right-side control stack ordered to match the scorer's real workflow.
- Pitch history is secondary and should stay behind a drawer or modal reveal instead of occupying permanent primary screen space.
- The screen supports both lineup-driven `Game` mode and pre-AB `Live AB` setup mode.
- Pitch entry uses `select -> review -> confirm`, not immediate save on action tap.
- Pitch type selection should be filtered to the active pitcher's arsenal plus `Other` whenever arsenal data is available.

### Offline & Sync

- [x] **SYNC-01**: App persists the full game locally after every scoring action and restores it after relaunch
- [x] **SYNC-02**: App queues unsynced changes while offline and syncs them automatically when connectivity returns
- [x] **SYNC-03**: Server accepts revisioned game snapshots and safely rejects stale updates
- [x] **SYNC-04**: User can finalize a game and lock it from accidental live edits

### Portal & Reporting

- [x] **PORT-01**: Portal lists synced charting games with date, opponent, status, and pitchers used
- [x] **PORT-02**: Portal shows chart header metadata, lineup, pitcher segments, plate appearances, and pitch log for a synced game
- [x] **PORT-03**: Portal computes strike %, zone %, first-pitch strike %, count splits, and pitch-type usage from synced data
- [x] **PORT-04**: Portal shows per-pitcher outing summaries within a charted game

### Export

- [x] **EXPT-01**: User can export a structured CSV representation of a charted game
- [x] **EXPT-02**: User can export a PDF approximating the current paper chart layout
- [x] **EXPT-03**: User can manually override pitcher `R` and `ER` totals before final export

### Operations

- [ ] **OPS-01**: Internal staff can install and run the beta via TestFlight during the pilot
- [ ] **OPS-02**: System surfaces sync failures and recoverable charting errors clearly enough for internal pilot use after the charting engine is hardened, including durable full-snapshot sync, revision adoption, retry, and refresh guidance

## v2 Requirements

### Setup & Collaboration

- **GAME-05**: User can import lineup data instead of entering hitters manually
- **COLLAB-01**: Multiple staff users can view or edit the same game safely
- **AUTH-03**: Role-based charting access is managed per user rather than by shared password

### Expanded Scoring

- **CHRT-07**: User can track baserunner advancement and inherited runners
- **CHRT-08**: User can track substitutions and broader defensive scoring state
- **EXPT-04**: Export matches the current paper sheet nearly exactly

### Portal Expansion

- **PORT-05**: Charted games appear directly in player profile tabs and other portal hubs

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full baserunner engine | Too much complexity for the first shipping version |
| Full offensive/defensive scorebook replacement | Not required to replace the current pitching chart workflow |
| Multi-editor real-time collaboration | One-scorer pilot is the fastest way to validate the workflow |
| Command/execution grading | v1 only needs location capture and downstream reporting |
| Web-only/PWA implementation | Native iPad + TestFlight is the requested delivery model |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GAME-01 | Phase 1 | Complete |
| SYNC-03 | Phase 1 | Complete |
| AUTH-01 | Phase 2 | Complete |
| AUTH-02 | Phase 2 | Complete |
| GAME-02 | Phase 2 | Complete |
| GAME-03 | Phase 2 | Complete |
| GAME-04 | Phase 2 | Complete |
| SYNC-01 | Phase 3 | Complete |
| CHRT-01 | Phase 4 | Complete |
| CHRT-02 | Phase 4 | Complete |
| CHRT-03 | Phase 4 | Complete |
| CHRT-04 | Phase 4 | Complete |
| CHRT-05 | Phase 4 | Complete |
| CHRT-06 | Phase 4 | Complete |
| ENG-01 | Phase 8 | Complete |
| ENG-02 | Phase 8 | Complete |
| ENG-03 | Phase 8 | Complete |
| ENG-04 | Phase 8 | Complete |
| SYNC-02 | Phase 5 | Complete |
| SYNC-04 | Phase 5 | Complete |
| EXPT-03 | Phase 5 | Complete |
| PORT-01 | Phase 6 | Complete |
| PORT-02 | Phase 6 | Complete |
| PORT-03 | Phase 6 | Complete |
| PORT-04 | Phase 6 | Complete |
| EXPT-01 | Phase 7 | Complete |
| EXPT-02 | Phase 7 | Complete |
| OPS-01 | Phase 9 | Pending |
| OPS-02 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-07 after Phase 08.1 charting UX/workflow implementation completed*
