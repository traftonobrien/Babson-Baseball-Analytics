# Research: Architecture

**Date:** 2026-03-06
**Project:** Babson Pitching Charting App

## Recommended Components

### iPad App
- Operator auth/session
- Game setup and lineup entry
- Live chart board
- Local persistence store
- Sync queue and retry manager
- Finalize/export request surface

### Backend
- Bootstrap endpoints for pitchers and prior games
- Game create/read/update/finalize APIs
- Revision validation for stale-write protection
- Snapshot store plus normalized projections
- Export generation endpoints

### Portal
- Charting hub
- Game detail view
- Analytics summaries
- Download/export actions

## Recommended Data Flow

1. Operator creates a game on iPad
2. App stores snapshot locally immediately
3. Every pitch/PA mutation increments local revision and autosaves
4. When online, sync queue posts latest snapshot revision
5. Server stores revisioned snapshot and rebuilds read models
6. Portal reads normalized game data for summaries and exports
7. Finalize locks live edits and enables final outputs

## Build Order Implications

- Start with backend contracts and fixture data first
- Then build local app persistence before polishing live UI
- Add portal reads after the sync contract is stable
- Leave export fidelity until the chart schema stops moving
- Leave TestFlight/pilot polish for the end

## Suggested Boundaries

### Snapshot boundary
- The iPad app owns a single complete `ChartingGameSnapshot`
- Backend treats snapshot writes as authoritative per revision

### Projection boundary
- Portal metrics and exports read normalized tables/materialized views
- Avoid computing reporting logic independently in the app and portal

### Identity boundary
- Babson pitchers come from canonical repo data
- Opponent hitters remain game-local manual entries in v1

## Recommended State Model

- Game
  - metadata
  - lineup
  - pitcher segments
  - plate appearances
  - pitches
  - totals overrides
  - revision
  - sync state
  - finalized state

## Major Architectural Risks

- Using per-pitch writes instead of snapshot revisions will complicate offline replay
- Reusing the static publish model will block live sync and mutable sessions
- Letting iPad and portal each invent their own metrics will create drift

---
*Research note: architecture guidance for phased implementation*
