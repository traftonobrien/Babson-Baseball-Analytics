---
phase: 21-pbp-parser-foundation
plan: 01
subsystem: run-expectancy-parser
tags: [run-expectancy, pbp, sidearm, parser]
one-liner: Added the raw Sidearm PBP extraction layer, exported the reusable scraper helpers, and fixed inning-aware half-inning deduplication for the RE parser
requirements-completed: [PBP-01, PBP-05]
completed: 2026-04-11
---

# Phase 21 Plan 01 Summary

**Added the raw Sidearm PBP extraction layer, exported the reusable scraper helpers, and fixed inning-aware half-inning deduplication for the RE parser**

## Accomplishments
- Exported `fetchPlayByPlayHtml()` and `extractPlayLines()` from [web/lib/spraychart/scraper.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/spraychart/scraper.ts) without changing the existing `scrapeBoxScore()` call path.
- Extended `extractPlayLines()` so the new parser can run it against an isolated half-inning table chunk with dedup disabled, while the legacy full-page spray-chart path still dedups desktop/mobile duplicates.
- Added [web/lib/runExpectancy/types.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/types.ts) for raw play rows, half-innings, totals, and raw-game contracts.
- Added [web/lib/runExpectancy/pbpParser.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.ts) with raw half-inning extraction from real Sidearm `table.sidearm-table.play-by-play` markup, caption parsing, totals parsing, and inning-aware deduplication of repeated desktop/mobile tables.
- Added [web/lib/runExpectancy/pbpParser.test.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.test.ts) covering both-team extraction, duplicate table collapse, repeated play text across different innings, and source `gameId` capture from a boxscore URL.

## Decisions Made
- Switched the raw RE extractor to parse the actual Sidearm half-inning table structure (`<caption>Team - Top/Bottom of Nth</caption>`) instead of trying to reconstruct inning context from the old flat play list.
- Deduplicated at the half-inning table level using `inning + half + playLines`, which removes desktop/mobile duplication without collapsing identical play text from different innings.
- Kept the RE parser independent from spray-chart-only concepts such as Babson roster filtering and batted-ball classification.

## Verification
- `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts`
- `npm --prefix web run build`

## Next Phase Readiness
- `21-01` is complete and verified locally.
- `21-02` can now build the sequential base/out/run state machine on top of the new raw half-inning extraction layer.
