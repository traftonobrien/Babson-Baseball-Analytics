---
phase: 21
slug: pbp-parser-foundation
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-04-11
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `web/vitest.config.mts` |
| **Quick run command** | `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts` |
| **Full suite command** | `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts lib/spraychart/zoneMapper.test.ts && npm --prefix web run build` |
| **Estimated runtime** | ~15s quick / ~45s full |

---

## Sampling Rate

- **After every task commit:** Run the task's focused verification command from the map below.
- **After every plan wave:** Run `npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts lib/spraychart/zoneMapper.test.ts && npm --prefix web run build`
- **Before `$gsd-verify-work`:** Run the full suite command plus the season validation gate command from 21-03
- **Max feedback latency:** ~15 seconds for targeted checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | PBP-01, PBP-05 | unit | `cd /Users/traftonobrien/Desktop/pitch-tracker && npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern \"raw extraction|dedup\"` | ❌ W0 | ⬜ pending |
| 21-01-02 | 01 | 1 | PBP-01 | build | `cd /Users/traftonobrien/Desktop/pitch-tracker && npm --prefix web run build` | ✅ | ⬜ pending |
| 21-02-01 | 02 | 1 | PBP-02, PBP-03 | unit | `cd /Users/traftonobrien/Desktop/pitch-tracker && npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern \"semicolon|base state|outs reset\"` | ❌ W0 | ⬜ pending |
| 21-02-02 | 02 | 1 | PBP-06 | unit | `cd /Users/traftonobrien/Desktop/pitch-tracker && npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern \"run-total validation|exclude failing inning\"` | ❌ W0 | ⬜ pending |
| 21-03-01 | 03 | 2 | PBP-04 | unit | `cd /Users/traftonobrien/Desktop/pitch-tracker && npm --prefix web exec vitest run lib/runExpectancy/pbpParser.test.ts --testNamePattern \"count snapshots|pitch sequence\"` | ❌ W0 | ⬜ pending |
| 21-03-02 | 03 | 2 | PBP-07 | file/data | `cd /Users/traftonobrien/Desktop/pitch-tracker && test -f web/public/data/run-expectancy/re_game_map.json && rg -n '\"suffix\"|\"homeAway\"|\"gameId\"' web/public/data/run-expectancy/re_game_map.json` | ❌ W0 | ⬜ pending |
| 21-03-03 | 03 | 2 | PBP-01, PBP-06, PBP-07 | integration | `cd /Users/traftonobrien/Desktop/pitch-tracker && npx tsx -e \"import { discoverGameUrls } from './web/lib/spraychart/scraper.ts'; import { buildSeasonRunExpectancyCorpus } from './web/lib/runExpectancy/pbpParser.ts'; const urls = await discoverGameUrls(2026); const result = await buildSeasonRunExpectancyCorpus(urls); console.log(JSON.stringify({ totalGames: result.totalGames, passingGames: result.passingGames, failedGames: result.failedGames }, null, 2)); if (result.passingGames < 15) process.exit(1);\"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `web/lib/runExpectancy/pbpParser.test.ts` — new parser/unit coverage for raw extraction, state transitions, count reconstruction, and validation reports
- [ ] `web/lib/runExpectancy/types.ts` — typed fixtures/contracts so tests do not rely on ad hoc object shapes

Existing infrastructure otherwise covers this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidearm live pages still return parseable markup for the known 2026 schedule | PBP-01 | HTML can drift without a code change and the unit suite uses fixtures | Spot-check 2-3 current Babson box score URLs in a browser, confirm the Play By Play section still exposes the same table/heading structure assumed by the parser |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 15s for targeted checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-11
