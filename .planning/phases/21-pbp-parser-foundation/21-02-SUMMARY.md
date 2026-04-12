---
phase: 21-pbp-parser-foundation
plan: 02
subsystem: run-expectancy-parser
tags: [run-expectancy, pbp, sidearm, state-machine, validation]
one-liner: Added the sequential base/out/run state machine and explicit half-inning validation reporting for the RE parser
requirements-completed: [PBP-02, PBP-03, PBP-06]
completed: 2026-04-11
---

# Phase 21 Plan 02 Summary

**Added the sequential base/out/run state machine and explicit half-inning validation reporting for the RE parser**

## Accomplishments
- Extended [web/lib/runExpectancy/types.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/types.ts) with parsed base-state, parsed-play, parsed-half-inning, parsed-game, and validation-report contracts.
- Extended [web/lib/runExpectancy/pbpParser.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.ts) from raw extraction into a sequential half-inning parser that:
  - tracks occupied bases by runner name,
  - applies semicolon-delimited sub-events in order,
  - updates outs and runs across walks, HBP, singles/doubles/triples/homers, sacrifice flies, fielder’s choices, runner advances, steals, and runner outs,
  - skips non-play substitution lines,
  - emits explicit half-inning validation results and excludes failed innings from the `usableForMatrix` collection.
- Expanded [web/lib/runExpectancy/pbpParser.test.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.test.ts) with synthetic state-machine coverage for semicolon runner movement, sacrifice fly scoring, HBP/force chains, double plays, half-inning reset behavior, and failed-inning exclusion.

## Decisions Made
- Parsed state is layered on top of the raw half-inning extractor rather than replacing it, so future phases can still inspect both raw and validated views.
- Double-play handling uses the trailing `out on the play` clause when present so outs are not double-counted on Sidearm lines like `grounded into double play ...; Runner out on the play`.
- Validation is half-inning scoped and represented directly in the parsed output so Phase 22 can consume `usableHalfInnings` without re-deriving failure rules.

## Verification
- `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern 'semicolon|base state|outs reset'`
- `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern 'run-total validation|exclude failing inning'`
- `npm --prefix web run build`

## Next Phase Readiness
- `21-02` is complete and verified locally.
- `21-03` can now add count snapshots, `re_game_map.json`, and the executable `>=15/19` season-validation gate on top of the validated parser output.
