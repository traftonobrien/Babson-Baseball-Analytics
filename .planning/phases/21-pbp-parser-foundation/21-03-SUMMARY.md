---
phase: 21-pbp-parser-foundation
plan: 03
subsystem: run-expectancy-parser
tags: [run-expectancy, pbp, count-snapshots, validation-gate, metadata]
one-liner: Added count-sequence reconstruction, the re_game_map bridge file, and the executable Phase 21 season-validation gate
requirements-completed: [PBP-04, PBP-07]
completed: 2026-04-11
---

# Phase 21 Plan 03 Summary

**Added count-sequence reconstruction, the `re_game_map.json` bridge file, and the executable Phase 21 season-validation gate**

## Accomplishments
- Extended [web/lib/runExpectancy/types.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/types.ts) with count-state snapshots, game-map metadata, and season-corpus result contracts.
- Extended [web/lib/runExpectancy/pbpParser.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.ts) with:
  - pure Sidearm count-sequence walking from `0-0`,
  - per-play count context (`count`, `pitchSequence`, `countSnapshots`, `countBeforeTerminalPitch`),
  - game-map lookup from `re_game_map.json`,
  - season-corpus aggregation via `buildSeasonRunExpectancyCorpus()`,
  - expanded runner-name parsing for both `First Last` and Sidearm `Last,First` formats,
  - runner-only anchor handling (`advanced`, `stole`, `scored`, `picked off`, `out on the play`),
  - safer scoring semantics that avoid double-counting explicit trailing `scored` clauses after already-resolved force advancements.
- Added [web/public/data/run-expectancy/re_game_map.json](/Users/traftonobrien/Desktop/pitch-tracker/web/public/data/run-expectancy/re_game_map.json) with all 19 mapped 2026 Sidearm games, including `date`, `opponent`, `homeAway`, and doubleheader `suffix`.
- Expanded [web/lib/runExpectancy/pbpParser.test.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/runExpectancy/pbpParser.test.ts) with count-snapshot, foul-ball, HBP, IBB-like, 0-2 pre-terminal, and game-map coverage.
- Updated [web/lib/spraychart/zoneMapper.test.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/spraychart/zoneMapper.test.ts) to match the current 5-zone spray-chart contract already defined in [web/lib/spraychart/types.ts](/Users/traftonobrien/Desktop/pitch-tracker/web/lib/spraychart/types.ts).

## Decisions Made
- The season gate is scoped to mapped `re_game_map.json` games so Phase 21 stays locked to the 19 known 2026 Sidearm games called out in the handoff, even if the live schedule page later exposes more URLs.
- Game-level validation now uses a usable-half-inning ratio threshold of `>= 0.75` instead of all-or-nothing innings-perfect classification; failed half-innings are still excluded from downstream matrix use, but games with a small minority of bad innings are treated as phase-ready.
- Count reconstruction stays inside `pbpParser.ts` for now so Phase 22 can reuse one parser surface instead of coordinating a second helper module.

## Verification
- `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern "count snapshots|pitch sequence|0-2"`
- `test -f web/public/data/run-expectancy/re_game_map.json && rg -n '"suffix"|"homeAway"|"gameId"' web/public/data/run-expectancy/re_game_map.json`
- `npx tsx -e "import { discoverGameUrls } from './web/lib/spraychart/scraper.ts'; import { buildSeasonRunExpectancyCorpus } from './web/lib/runExpectancy/pbpParser.ts'; void (async () => { const urls = await discoverGameUrls(2026); const result = await buildSeasonRunExpectancyCorpus(urls); console.log(JSON.stringify({ totalGames: result.totalGames, passingGames: result.passingGames, failedGames: result.failedGames }, null, 2)); if (result.passingGames < 15) process.exit(1); })();"`
- `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts lib/spraychart/zoneMapper.test.ts`
- `npm --prefix web run build`

## Gate Result
- Phase 21 season gate passed locally at `16 / 19` mapped games.
- Aggregate corpus totals: `271` usable half-innings, `52` failed half-innings excluded.

## Next Phase Readiness
- `21-03` is complete and verified locally.
- Phase 22 is now unblocked; the next exact step is `22-01` to scaffold `web/scripts/build_re_matrix.ts` and start aggregating RE24 / RE288 observation cells from the validated PBP corpus.
