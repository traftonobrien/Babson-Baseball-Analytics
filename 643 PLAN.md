# Claude Code Handoff Package: 6-4-3 Style Babson Charting App

## Handoff Instructions
Use this at the top of every Claude Code prompt:

- Repo: `/Users/traftonobrien/Desktop/pitch-tracker`
- Sample artifact: [Charting Example.pdf](/Users/traftonobrien/Desktop/pitch-tracker/Charting%20Example.pdf)
- Build this in sections. Implement exactly one section per run, then stop.
- Before coding, inspect the existing repo structure and relevant files. Do not invent parallel systems if the repo already has a canonical source.
- Do not edit unrelated areas. Do not change existing command/Trackman/mechanics behavior unless the section explicitly requires it.
- Live charting is a new DB-backed workflow. Do not use the repo’s static `web/public` publish flow as the primary storage path.
- v1 scope is fixed:
  - Full game charting with Babson pitcher changes
  - One live scorer
  - Manual hitter entry
  - Offline-first iPad workflow
  - Portal sync when online
  - Approximate export matching the sample chart
  - No baserunner engine
  - No defensive scoring engine beyond PA result codes
  - No command grading
- Use canonical Babson player identity already in repo sources.
- At the end of each section:
  - run relevant tests
  - summarize what changed
  - list blockers or assumptions
  - stop without starting the next section

## Summary
Build a native iPad TestFlight app plus a new portal charting module for Babson baseball pitching charts. The app captures pitch-by-pitch and plate-appearance outcomes for a full game, including pitcher changes, stores locally offline, syncs to Neon-backed APIs, and exports a chart sheet approximating the sample PDF.

## Section 1: Backend and Data Contract
Implement first.

- Add new live-charting tables in [web/db/schema.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/db/schema.ts):
  - `charting_games`
  - `charting_revisions`
  - `charting_pitcher_segments`
  - `charting_plate_appearances`
  - `charting_pitches`
  - `charting_pitcher_totals`
- Define the core snapshot contract used by both app and API:
  - `ChartingGameSnapshot`
  - `PitcherSegment`
  - `PlateAppearance`
  - `PitchEvent`
  - `PitcherTotalsOverride`
- Store full snapshot JSON plus normalized projections rebuilt transactionally on sync.
- Add APIs for:
  - bootstrap data
  - create game
  - fetch game
  - update game by revision
  - list games
  - finalize game
- Use canonical Babson pitcher sources already in repo for pitcher selection.
- Hitter source for v1 is manual entry only.
- Raw pitch fields:
  - pitch type: `Fastball`, `Curveball`, `Slider`, `Changeup`, `Split/Cut`, `Other`
  - location cell: 17-cell catcher-view grid
  - pitch result: `ball`, `called_strike`, `swinging_strike`, `foul`, `bunt_foul`, `in_play`, `hit_by_pitch`
  - count before pitch
  - swing flag
  - optional notes
- PA fields:
  - batter display name
  - lineup slot
  - pitcher segment id
  - result code like `K`, `BB`, `HBP`, `1B`, `F8`, `6-3`
  - structured result category for analytics
- Finalization locks the game from live edits unless explicitly reopened later.
- Stop condition: one fixture game can be created, updated by revision, fetched, and finalized through API tests.

## Section 2: iPad App Shell
Implement second, after Section 1 is complete.

- Create a new native iPad app in a separate `ios/` workspace.
- Use SwiftUI + SwiftData + `URLSession`.
- Store auth/session securely; persist game state locally.
- Screens required:
  - login
  - new game setup
  - lineup entry
  - live charting
  - pitcher change modal
  - edit/history
  - finalize/export
- Live charting behavior:
  - one active PA at a time
  - quick pitch-type buttons matching sample legend mental model
  - tap catcher-view location grid
  - record pitch result
  - auto-advance count
  - support undo/edit
  - support pitcher switch midgame
- Autosave after each action.
- App must work fully offline and queue sync.
- Because v1 excludes baserunners, include manual editable pitcher totals for `R` and `ER` before finalization.
- Stop condition: a scorer can chart a full game offline, close/reopen the app, and retain all progress.

## Section 3: Portal Views and Export
Implement third.

- Add a new `/charting` hub and `/charting/games/[gameId]` detail route in `web/app`.
- Hub shows:
  - date
  - opponent
  - status
  - pitchers used
  - sync/finalized state
- Detail view shows:
  - header metadata
  - lineup
  - pitcher segments
  - pitch log
  - strike %
  - zone %
  - first-pitch strike %
  - count splits
  - pitch-type usage
  - per-pitcher outing summaries
- Add export output in both:
  - structured CSV
  - PDF approximating [Charting Example.pdf](/Users/traftonobrien/Desktop/pitch-tracker/Charting%20Example.pdf)
- PDF should include:
  - header block
  - hitter rows
  - PA tiles with location marks and pitch sequence
  - bottom pitcher totals table
- Do not integrate into player profile tabs in v1 unless trivial after core routes are stable.
- Stop condition: a synced game renders in the portal and exports a readable sheet matching the sample’s structure.

## Section 4: Pilot Hardening and TestFlight
Implement last.

- Add sync diagnostics, basic crash logging, and operator-facing error states.
- Prepare internal TestFlight only first.
- Add small in-app scoring guide for pitch result and PA result code entry.
- Verify behavior for:
  - inning loss of internet
  - app relaunch midgame
  - duplicate sync attempts
  - pitcher change boundaries
  - finalize flow
- Stop condition: one internal pilot game can be charted live, synced later, viewed in portal, and exported without missing or duplicated pitches.

## Test Plan
- Unit tests for count transitions, strike/ball totals, pitch-result mapping, pitcher-switch boundaries, and finalize lock behavior.
- API tests for revision monotonicity, snapshot rebuild idempotency, list/fetch/create/update/finalize flows.
- iPad tests for offline persistence, undo/edit, relaunch recovery, and queued sync replay.
- Portal tests for hub filters, detail metrics, and export generation.
- Use one typed fixture game based on the sample PDF and reuse it across backend, app, and export tests.

## Assumptions and Defaults
- One live scorer only.
- Manual hitter entry only.
- Babson pitcher identity comes from existing canonical repo data.
- Catcher-view physical location is stored directly; handedness-derived labels are optional later.
- Live charting is separate from current static `web/public` publish workflows.
- Exact paper-chart parity is not required; structural fidelity is required.

## Recommended Prompt Sequence
1. `Implement Section 1 only. Inspect the repo first, then add the backend/data contract, tests, and stop.`
2. `Implement Section 2 only, assuming Section 1 is complete. Build the iPad shell, offline storage, sync queue, and stop.`
3. `Implement Section 3 only, assuming Sections 1-2 are complete. Build the portal routes and export flow, then stop.`
4. `Implement Section 4 only, assuming Sections 1-3 are complete. Harden sync/pilot behavior and stop.`

