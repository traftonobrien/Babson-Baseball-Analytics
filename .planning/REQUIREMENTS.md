# Requirements: Babson Pitching Charting App

**Defined:** 2026-03-06
**Core Value:** One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.

## v1 Requirements

### Internal Access

- [ ] **AUTH-01**: Staff user can authenticate into the charting workflow with internal credentials
- [ ] **AUTH-02**: iPad app can load canonical Babson pitchers and previously charted games for the operator

### Game Setup

- [ ] **GAME-01**: User can create a game record with opponent, date, and basic chart metadata
- [ ] **GAME-02**: User can manually enter and edit the opponent hitter lineup before first pitch
- [ ] **GAME-03**: User can select the current Babson pitcher and switch pitchers during the game without creating a new game
- [ ] **GAME-04**: User can capture optional chart-header fields such as charter, weather, catchers, record, standing, tomorrow starter, next-day starter, and tomorrow opponent

### Live Charting

- [ ] **CHRT-01**: User can record pitch type using the six charting families `Fastball`, `Curveball`, `Slider`, `Changeup`, `Split/Cut`, and `Other`
- [ ] **CHRT-02**: User can record pitch location using a catcher-view 17-cell strike-zone/miss grid
- [ ] **CHRT-03**: User can record pitch result as `ball`, `called_strike`, `swinging_strike`, `foul`, `bunt_foul`, `in_play`, or `hit_by_pitch`
- [ ] **CHRT-04**: User can retain the count going into each pitch, including bunt context when relevant
- [ ] **CHRT-05**: User can close a plate appearance with a controlled chart result code such as `K`, `BB`, `HBP`, `1B`, `F8`, or `6-3`
- [ ] **CHRT-06**: User can undo or edit earlier pitches and plate appearances without corrupting the game state

### Offline & Sync

- [ ] **SYNC-01**: App persists the full game locally after every scoring action and restores it after relaunch
- [ ] **SYNC-02**: App queues unsynced changes while offline and syncs them automatically when connectivity returns
- [ ] **SYNC-03**: Server accepts revisioned game snapshots and safely rejects stale updates
- [ ] **SYNC-04**: User can finalize a game and lock it from accidental live edits

### Portal & Reporting

- [ ] **PORT-01**: Portal lists synced charting games with date, opponent, status, and pitchers used
- [ ] **PORT-02**: Portal shows chart header metadata, lineup, pitcher segments, plate appearances, and pitch log for a synced game
- [ ] **PORT-03**: Portal computes strike %, zone %, first-pitch strike %, count splits, and pitch-type usage from synced data
- [ ] **PORT-04**: Portal shows per-pitcher outing summaries within a charted game

### Export

- [ ] **EXPT-01**: User can export a structured CSV representation of a charted game
- [ ] **EXPT-02**: User can export a PDF approximating the current paper chart layout
- [ ] **EXPT-03**: User can manually override pitcher `R` and `ER` totals before final export

### Operations

- [ ] **OPS-01**: Internal staff can install and run the beta via TestFlight during the pilot
- [ ] **OPS-02**: System surfaces sync failures and recoverable charting errors clearly enough for internal pilot use

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
| GAME-01 | Phase 1 | Pending |
| SYNC-03 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| GAME-02 | Phase 2 | Pending |
| GAME-03 | Phase 2 | Pending |
| GAME-04 | Phase 2 | Pending |
| SYNC-01 | Phase 3 | Pending |
| CHRT-01 | Phase 4 | Pending |
| CHRT-02 | Phase 4 | Pending |
| CHRT-03 | Phase 4 | Pending |
| CHRT-04 | Phase 4 | Pending |
| CHRT-05 | Phase 4 | Pending |
| CHRT-06 | Phase 4 | Pending |
| SYNC-02 | Phase 5 | Pending |
| SYNC-04 | Phase 5 | Pending |
| EXPT-03 | Phase 5 | Pending |
| PORT-01 | Phase 6 | Pending |
| PORT-02 | Phase 6 | Pending |
| PORT-03 | Phase 6 | Pending |
| PORT-04 | Phase 6 | Pending |
| EXPT-01 | Phase 7 | Pending |
| EXPT-02 | Phase 7 | Pending |
| OPS-01 | Phase 8 | Pending |
| OPS-02 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
