# Phase 21: PBP Parser Foundation - Research

**Researched:** 2026-04-11
**Domain:** Sidearm play-by-play extraction and baseball state reconstruction for run expectancy
**Confidence:** HIGH

---

<user_constraints>
## User Constraints

### Locked decisions
- No new npm packages.
- Keep `web/scripts/scrape_spray_charts.ts` unchanged.
- Keep `web/lib/charting/ohtwo.ts` and `web/app/charting/ohtwo/page.tsx` untouched until Phase 24.
- Modify `web/lib/spraychart/scraper.ts` minimally: export only the two existing helpers needed by the RE parser.
- `re_game_map.json` must live at `web/public/data/run-expectancy/re_game_map.json`.
- Half-inning run-total validation is a hard phase gate, not a best-effort metric.
- Phase 21 must prove at least 15 of the approximately 19 known 2026 games pass validation before Phase 22 starts.

### Critical pitfalls
- Semicolon compound plays must be processed sequentially inside one PBP row.
- Deduplication must include inning and half-inning, not plain play text.
- Sidearm count strings encode the final count of the PA; per-pitch count must be reconstructed from the sequence string.
- Doubleheaders need explicit metadata in `re_game_map.json` so later joins do not collapse Game 1 and Game 2.
- Failed innings must be excluded and surfaced, not silently folded into the dataset.

### Claude's discretion
- Exact public API names for parser entrypoints and typed report objects.
- Whether the raw HTML extraction returns innings, half-innings, or flat rows plus markers, as long as downstream parsing is deterministic.
- Whether count-sequence parsing uses a dedicated helper module or stays inside `pbpParser.ts`.

</user_constraints>

---

## Summary

Phase 21 should be built as a thin extension of the existing Sidearm ingestion path, not as a rewrite of the spray chart system. The lowest-risk architecture is:

1. Reuse `discoverGameUrls()` plus exported HTML/raw-play helpers from `web/lib/spraychart/scraper.ts`.
2. Add `web/lib/runExpectancy/types.ts` for raw PBP rows, parsed PA records, base-state snapshots, inning validation reports, and game-map metadata.
3. Add `web/lib/runExpectancy/pbpParser.ts` with three layers:
   - raw extraction and half-inning grouping,
   - sequential base/out/run state transitions over semicolon sub-events,
   - per-pitch count snapshot derivation from Sidearm sequence strings.
4. Validate against real box score run totals at the half-inning level and make the season gate explicit in a callable season-build function.

The major engineering risk is not HTML scraping. It is state correctness when one textual play row encodes multiple runner movements, outs, and runs. That argues for a state-machine approach with typed intermediate events instead of a loose regex-only parser.

The existing spray chart scraper is useful but not sufficient as-is because it:
- deduplicates by raw play text only,
- filters down to Babson balls in play,
- does not preserve half-inning structure or base/out state,
- does not validate run totals.

The safest Phase 21 execution order is the same as the roadmap slice:
- raw extraction first,
- base/out/run transitions second,
- count snapshots + game map + season gate last.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | project default | parser types and pure state-machine logic | repo standard |
| native `fetch` | runtime standard | Sidearm schedule + box score HTML retrieval | already used in `web/lib/spraychart/scraper.ts` |
| vitest | ^4.0.18 | parser/unit validation | already configured in `web/package.json` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| existing Sidearm helpers in `web/lib/spraychart/scraper.ts` | repo local | schedule discovery and raw HTML/PBP extraction | Phase 21-01 foundation |

### Alternatives considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| extend existing scraper helpers | brand-new RE scraper stack | duplicates Sidearm discovery logic and increases drift risk |
| typed state machine | one-pass regex mutation over full lines | faster to sketch, much harder to trust on compound plays and edge cases |
| half-inning validation reports | silent filtering or console-only warnings | hides data quality failures and weakens the Phase 22 matrix |

---

## Architecture Patterns

### Pattern 1: Separate raw extraction from baseball-state parsing

Raw HTML extraction should preserve enough structure to say "this row belonged to top/bottom X inning" before any interpretation of baseball outcomes begins.

Why:
- It fixes the current dedup bug at the right layer.
- It makes the state machine deterministic and testable on structured inputs.
- It lets later tests exercise parsing without refetching live HTML.

### Pattern 2: Normalize one Sidearm row into multiple ordered sub-events

Split one play row on semicolons, but keep the first clause as the plate-appearance anchor and the later clauses as ordered runner-state mutations.

Why:
- `doubled; runner to third; run scored` is one PA and several state transitions.
- The parser needs both the PA result and the resulting base/out/run state.

### Pattern 3: Validate by half-inning, not only by full game

Compare parsed runs in each half-inning against the box score `r` column for that half-inning.

Why:
- It localizes failures to a recoverable unit.
- It lets Phase 22 exclude only bad innings instead of entire games.
- It directly matches the gate the user set for Phase 21.

### Pattern 4: Treat count reconstruction as a pure sequence walk

Use the Sidearm count suffix only as the final-state checksum, not the primary source of intermediate pitch states.

Why:
- `BKFB` is enough to derive `0-0 -> 1-0 -> 1-1 -> 1-2 -> 2-2`.
- Phase 23 needs the state immediately before the logged 0-2 fastball, which only the sequence walk can supply.

---

## Recommended public API shape

Suggested exports for `web/lib/runExpectancy/pbpParser.ts`:

- `parseRawHalfInningsFromHtml(html: string): RawPbpHalfInning[]`
- `parseRunExpectancyGameFromHtml(html: string, metadata: RunExpectancyGameMetadata): ParsedRunExpectancyGame`
- `deriveCountSnapshots(finalCount: string | null, pitchSequence: string | null): CountSnapshot[]`
- `buildSeasonRunExpectancyCorpus(urls: string[]): Promise<SeasonRunExpectancyCorpus>`

Suggested exports to add from `web/lib/spraychart/scraper.ts`:

- `fetchPlayByPlayHtml`
- `extractPlayLines`

This keeps the spray chart scraper as the HTML/source adapter and the new RE module as the baseball-state layer.

---

## Anti-Patterns to Avoid

- Reusing the spray chart scraper's `Set(plays)` dedup logic for Phase 21.
- Letting Phase 21 write matrix files or dashboard data structures prematurely.
- Encoding doubleheader identity only in human-readable opponent strings.
- Treating walks/HBP/IBB as non-PA events because they are not balls in play.
- Coupling parser correctness to live network access in every unit test.

---

## Phase 21 execution recommendation

Build the phase around one typed parser module plus one test file. Do not scatter parsing rules across scripts. The script-level orchestration can wait until Phase 22, but the callable season corpus function should already exist by the end of 21-03 so the `>=15/19` validation gate is executable immediately.
