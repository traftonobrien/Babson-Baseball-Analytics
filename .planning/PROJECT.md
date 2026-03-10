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

### Shipped Foundation

- [x] Add a full-game pitching chart domain that supports Babson pitcher changes inside a single game session
- [x] Build an offline-first native iPad workflow for pitch-by-pitch and plate-appearance charting
- [x] Sync charted games into the existing portal through a DB-backed path rather than the legacy static publish flow
- [x] Deliver portal charting hub, game detail review, and derived analytics from synced data
- [x] Deliver both structured CSV and paper-style PDF exports directly from the portal charting detail view
- [x] Harden the live charting engine with deterministic state reconstruction, typed PA result rules, workflow guardrails, and scenario-based regression coverage

### Active Completion Work

- [ ] Preserve the live charting rough layout baseline as the page grows: top zone canvas, bottom operator dock, compact secondary rails
- [ ] Prepare the iPad app and support tooling for internal pilot/TestFlight use after the charting mechanics are trustworthy

### Active — Milestone v2.0: Live AB Analytics

- [x] Build a shared analytics engine that computes per-segment pitcher stats and per-hitter stats from charting pitch/PA data
- [x] Enrich the session overview page with per-pitcher and per-hitter breakdown sections (stat cards, pitch mix, zone heat map, outcomes)
- [ ] Deliver a `/charting/leaderboard` page with Pitchers and Hitters tabs, sortable columns, and date-range + session filters
- [ ] Deliver per-player drill-down pages showing session-by-session history for any pitcher or hitter

### Out of Scope

- Full baserunner engine — excluded from v1 to keep scoring speed high and reduce game-state complexity
- Full defensive scorebook automation — v1 only needs PA result codes such as `K`, `BB`, `1B`, `F8`, `6-3`
- Command grading — v1 records physical location cells, not execution scores
- Multi-editor live collaboration — one live scorer only in v1
- Exact 1:1 clone of the current paper sheet — structural fidelity matters, not pixel-perfect duplication

## Context

This is a brownfield repo with two major existing systems: Python baseball-analysis pipelines in `src/` and `scripts/`, and a Next.js portal in `web/`. The current product is static-file-first: command outings, TrackMan sessions, mechanics outputs, and imported game stats are mostly generated offline and committed into `web/public/`, with a smaller Neon/Drizzle layer for newer leaderboard features. The new charting workflow does not fit that legacy publish pattern because it needs live iPad capture, offline persistence, queued sync, and mutable game sessions.

The current paper workflow is represented by [Charting Example.pdf](/Users/traftonobrien/Desktop/pitch-tracker/Charting%20Example.pdf). That sample confirms several product truths that shape the implementation: the chart is game-centric rather than pitcher-centric, pitcher changes happen within one sheet, hitters are repeated by lineup slot, pitch family entry is intentionally minimal, and the bottom summary table expects per-pitcher totals. The portal already has canonical Babson pitcher identity and game-stat concepts that the new charting domain should reuse rather than duplicate.

## Current Shipping Baseline

- The portal ships a working `/charting` hub and `/charting/games/[id]` detail surface backed by synced Drizzle data and derived analytics.
- The iPad live charting screen is landscape-first, with the zone selector as the elastic top canvas and the operational controls in a bottom dock.
- `ZoneGridView` matches the 14-cell Trackman layout using custom SwiftUI `Path` L-brackets around the central 3x3 grid, plus a separate `PO` cell.
- CSV and PDF export now exist as portal download paths.
- The iPad charting engine now derives inning, outs, count, batter slot, and closeout readiness from typed pitch and PA result rules instead of demo-grade counter repair.
- The workflow now blocks contradictory actions such as recording extra pitches after a terminal event, changing pitchers mid-PA, or finalizing with an open plate appearance.
- Scenario-based engine tests lock in strikeout, walk, inning rollover, double-play, in-play closeout, and between-inning segment handoff behavior.

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
| Build charting as a new subsystem inside the existing repo | Reuses Babson identity data, portal auth context, and existing baseball product surfaces | Implemented via new Drizzle-backed charting APIs, native iPad client, and portal charting routes |
| Use a game-centric data model with pitcher segments | The sample sheet tracks multiple Babson pitchers within one game | Locked and implemented across the backend snapshot schema, SwiftData models, and portal projections |
| Treat live charting as DB-backed instead of static published files | Live sync and offline replay require mutable records and conflict handling | Locked and implemented through revisioned sync APIs and queued app-side replay |
| Use manual hitter entry for v1 | Fastest way to ship without waiting on lineup-import infrastructure | Locked for v1; lineup import stays in v2 |
| Use fine-grained phases | Smaller sections reduce context risk and make handoffs safer | Locked; current roadmap is split into nine sequential phases |
| Run future phases sequentially | Safer handoffs and easier recovery when context windows are tight | Locked; current work proceeds phase-by-phase |
| Match the iPad zone selector to the 14-cell Trackman layout with custom L-bracket geometry | Staff expects physical location capture to mirror the real charting model, not a generic 3x3 strike zone | Implemented in `ZoneGridView` with custom `Path` shapes and a separate `PO` cell |
| Reserve the top charting canvas for zone selection and the bottom dock for operational controls | Maximizes the most valuable spatial surface while keeping the control deck extensible for future charting features | Locked as the rough layout baseline for the iPad app |
| Generate CSV exports from a shared chart snapshot loader | The detail page and export output must stay in sync as the charting model evolves | Implemented via shared snapshot/export utilities and `/api/charting/games/[id]/export` |
| Generate paper-style PDF exports from the same shared chart snapshot as CSV | PDF output must stay recognizable to staff without diverging from the synced chart data | Implemented via `pdf-lib` renderer and `/api/charting/games/[id]/export-pdf` |
| Harden charting mechanics before pilot/TestFlight work | Staff trust depends more on deterministic count/outs/PA logic than on early beta packaging | Implemented in Phase 8 before pilot delivery work begins |

| Milestone v2.0: Live AB Analytics | Staff want cross-session pitcher and hitter insight from charted live ABs | Analytics foundation → session enhancements → leaderboard → per-player drill-down |

---
*Last updated: 2026-03-10 after Phase 11 session overview enhancements completion*
