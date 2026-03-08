# Research: Features

**Date:** 2026-03-06
**Project:** Babson Pitching Charting App

## Table Stakes

These are the features users will expect from a digital replacement of the current charting workflow.

### Live Entry
- Fast pitch-type entry with a very small option set
- One-tap pitch location capture on a strike-zone/miss grid
- Count progression that stays visible and correct
- Plate appearance result codes that match how coaches already think and write
- Undo/edit of recent entries without losing the rest of the game

### Game Context
- Game header fields
- Manual lineup entry
- Pitcher changes inside one game
- Per-pitcher totals and summaries

### Reliability
- Autosave after every action
- App relaunch recovery
- Offline use with later sync
- Clear synced / pending / failed state

### Output
- Structured data for analytics and portal views
- Exportable chart artifact that staff can compare to the current paper sheet

## Differentiators

Useful advantages over the current paper workflow and generic scorekeeping apps.

- Immediate portal availability after sync
- Automatic strike %, zone %, first-pitch strike %, count splits, and pitch mix
- Clean linkage to existing Babson player identity and portal surfaces
- Post-game export without retyping paper charts
- Future extension path into player profiles and outing comparison

## Anti-Features

Things that are easy to overbuild and should be deliberately deferred.

- Full baserunner engine
- Full official scorebook replacement for offense and defense
- Multi-user real-time collaboration in v1
- Trying to capture every possible baseball stat from the first release
- Exact visual cloning before the underlying workflow is stable

## Complexity Notes

- **Low / Medium**: manual lineup entry, game metadata, pitcher switching
- **Medium**: offline autosave, count/PA state machine, portal metrics
- **High**: sync conflict handling, export fidelity, TestFlight-ready operational polish
- **Very High**: full scorebook logic, baserunner advancement engine, multi-editor concurrency

## Dependency Notes

- Portal analytics depend on a clean normalized backend model
- PDF export depends on the chart snapshot schema being stable
- TestFlight pilot depends on strong offline persistence and sync visibility

---
*Research note: feature expectations for digital charting products*
