# Babson Pitching Charting App

## What This Is

This project adds a new 6-4-3-style Babson baseball pitching charting system to the existing Pitch Tracker repo. The product is a native iPad charting app plus a new portal module that lets one staff member chart a full game with pitcher changes, work offline, sync into the existing Babson portal, and export a sheet close to the current paper example in [Charting Example.pdf](/Users/traftonobrien/Desktop/pitch-tracker/Charting%20Example.pdf).

## Core Value

One coach can chart an entire Babson outing on one iPad and trust that the result survives offline use, syncs cleanly, and exports well enough to replace the current paper workflow.

## Requirements

### Validated

- ✓ Babson pitching command outings can already be published and reviewed in the existing portal — existing
- ✓ TrackMan sessions and derived leaderboard data already exist in the portal — existing
- ✓ Game stats can already be imported and linked to outings through deterministic JSON workflows — existing
- ✓ Canonical Babson player identity already exists across `Arsenals.csv`, roster files, and portal helpers — existing

### Active

- [ ] Add a full-game pitching chart domain that supports Babson pitcher changes inside a single game session
- [ ] Build an offline-first native iPad workflow for pitch-by-pitch and plate-appearance charting
- [ ] Sync charted games into the existing portal through a DB-backed path rather than the legacy static publish flow
- [ ] Produce portal-ready analytics and exports, including a PDF that approximates the current paper chart layout
- [ ] Keep the v1 workflow fast enough for one live scorer during a real game

### Out of Scope

- Full baserunner engine — excluded from v1 to keep scoring speed high and reduce game-state complexity
- Full defensive scorebook automation — v1 only needs PA result codes such as `K`, `BB`, `1B`, `F8`, `6-3`
- Command grading — v1 records physical location cells, not execution scores
- Multi-editor live collaboration — one live scorer only in v1
- Exact 1:1 clone of the current paper sheet — structural fidelity matters, not pixel-perfect duplication

## Context

This is a brownfield repo with two major existing systems: Python baseball-analysis pipelines in `src/` and `scripts/`, and a Next.js portal in `web/`. The current product is static-file-first: command outings, TrackMan sessions, mechanics outputs, and imported game stats are mostly generated offline and committed into `web/public/`, with a smaller Neon/Drizzle layer for newer leaderboard features. The new charting workflow does not fit that legacy publish pattern because it needs live iPad capture, offline persistence, queued sync, and mutable game sessions.

The current paper workflow is represented by [Charting Example.pdf](/Users/traftonobrien/Desktop/pitch-tracker/Charting%20Example.pdf). That sample confirms several product truths that shape the implementation: the chart is game-centric rather than pitcher-centric, pitcher changes happen within one sheet, hitters are repeated by lineup slot, pitch family entry is intentionally minimal, and the bottom summary table expects per-pitcher totals. The portal already has canonical Babson pitcher identity and game-stat concepts that the new charting domain should reuse rather than duplicate.

## Constraints

- **Platform**: iPad-first native app — TestFlight delivery is part of the initial rollout target
- **Workflow**: One live scorer — v1 must optimize for speed and low cognitive overhead during real games
- **Connectivity**: Offline-first — field Wi-Fi cannot be assumed
- **Architecture**: New live charting path must be DB-backed — the existing `web/public` publish flow is not suitable for live mutable records
- **Data Scope**: Manual hitters in v1 — opponent lineups are entered by hand
- **Scoring Scope**: No baserunner engine — pitcher `R` and `ER` totals need manual override support before final export

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build charting as a new subsystem inside the existing repo | Reuses Babson identity data, portal auth context, and existing baseball product surfaces | — Pending |
| Use a game-centric data model with pitcher segments | The sample sheet tracks multiple Babson pitchers within one game | — Pending |
| Treat live charting as DB-backed instead of static published files | Live sync and offline replay require mutable records and conflict handling | — Pending |
| Use manual hitter entry for v1 | Fastest way to ship without waiting on lineup-import infrastructure | — Pending |
| Use fine-grained phases | The user explicitly wants smaller sections to reduce stoppage from usage limits | — Pending |
| Run future phases sequentially | Safer handoffs and easier recovery when context windows are tight | — Pending |

---
*Last updated: 2026-03-06 after initialization*
