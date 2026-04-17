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
- [x] Deliver a `/charting/leaderboard` page with Pitchers and Hitters tabs, sortable columns, and date-range + session filters
- [ ] Integrate charted pitcher and hitter analytics into player profile tabs as a new Live AB surface

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

| Milestone v2.0: Live AB Analytics | Staff want cross-session pitcher and hitter insight from charted live ABs | Analytics foundation → session enhancements → leaderboard → player profile integration |

## Prior Milestone: v3.0 Market-Ready Platform (phases 14–20, partially complete)

**Goal:** Bring every aspect of the platform to production quality for commercialization as a D3 baseball analytics SaaS — multi-tenancy, code health, UX polish, ops reliability, and demo capability.

Phases 14–17 complete. Phases 17.5, 18, 19, 20 remain planned but deferred while v4.0 is built.

---

## Prior Milestone: v4.0 Run Expectancy Intelligence (phases 21–24, complete 2026-04-12)

**Goal:** Build a RE288 run expectancy matrix from Sidearm play-by-play data and integrate it into the 0-2 fastball coaching dashboard. All 4 phases shipped.

---

## Current Milestone: v5.0 Command Tracker v2 — Automated Pitch Detection and Glove Tracking

**Goal:** Reduce per-game command tracking time from 1–2 hours to 15–20 minutes by automating pitch onset detection and glove T/A frame selection, shifting the human role from finding frames to verifying proposals.

**Target features:**
- Calibration pre-work: measure glove area timeseries, leg lift timing, and T-frame tolerance on existing footage
- Pitch onset detector: MediaPipe Pose on pitcher ROI auto-generates pitch windows from full inning video
- Automated glove tracking: SAM3 text-prompted initialization replaces manual glove click; ByteTrack + SAMURAI for robust propagation
- Automated T/A detection: glove state machine detects target-set frame and reception-closure frame within each window
- Streamlined verification UX: strip view with single-keypress confirm/nudge replaces full-inning scrubber
- Charting integration: auto-match detected pitches to charting PA sequence, pre-fill pitch type

### Active (v5.0)

- [ ] CALIB-01: Glove area timeseries measured on 20+ existing ground-truthed pitches (open vs closed ratios documented)
- [ ] CALIB-02: Leg lift peak-to-release frame interval measured for Babson pitchers at current FPS
- [ ] CALIB-03: T-frame precision tolerance validated (max acceptable frame offset for correct miss vector)
- [ ] DETECT-01: System detects pitch onset windows from full inning video using MediaPipe Pose on pitcher ROI
- [ ] DETECT-02: System outputs pitch_windows.json with frame_start, frame_end, confidence per pitch
- [ ] DETECT-03: System achieves ≥90% pitch recall with ≤10% false positive rate on validation set
- [ ] DETECT-04: System handles both windup and stretch mechanics without false negatives
- [ ] DETECT-05: Optical flow fallback detects pitches when pose estimation is unreliable
- [ ] TRACK-01: SAM3 text prompt ("catcher's glove") initializes glove tracking without human click
- [ ] TRACK-02: ByteTrack maintains persistent glove ID across frames through occlusion
- [ ] TRACK-03: SAMURAI stabilizes glove mask during fast-motion reception frames
- [ ] TRACK-04: System outputs per-frame glove centroid and mask area timeseries for full inning
- [ ] AUTO-01: System automatically detects T frame (glove open, plateau stable) within each pitch window
- [ ] AUTO-02: System automatically detects A frame (glove closure event) within each pitch window
- [ ] AUTO-03: Auto-detected T is within ±3 frames of human-marked T in ≥85% of pitches
- [ ] AUTO-04: Auto-detected A is within ±3 frames of human-marked A in ≥85% of pitches
- [ ] AUTO-05: Each T/A detection includes a confidence score used to route low-confidence pitches to fallback
- [ ] VERIFY-01: Operator sees strip view (±3 frames) around auto-detected T and A per pitch
- [ ] VERIFY-02: Operator confirms or nudges T/A with single keypress
- [ ] VERIFY-03: Operator selects pitch type from arsenal via number keys (same as current)
- [ ] VERIFY-04: Low-confidence pitches fall back to full scrubber view automatically
- [ ] VERIFY-05: Average verification time ≤20 sec per pitch
- [ ] CHART-01: System matches auto-detected pitch clips to charting PA sequence by inning order
- [ ] CHART-02: Pitch type pre-filled from charting data when detected count matches charted count
- [ ] CHART-03: System surfaces exception UX when detected and charted pitch counts differ
- [ ] CHART-04: Full pipeline completes in <20 min for a standard 9-inning game

---
*Last updated: 2026-04-17 after starting milestone v5.0 Command Tracker v2*
