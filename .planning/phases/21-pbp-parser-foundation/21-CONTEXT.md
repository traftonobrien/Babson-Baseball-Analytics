# Phase 21: PBP Parser Foundation - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning
**Source:** `tasks/codex-handoff-re288.md` + milestone v4.0 planning artifacts

<domain>
## Phase Boundary

Phase 21 establishes a trustworthy Sidearm play-by-play parser that reconstructs every plate appearance into sequential game-state records before any run-expectancy math is introduced.

This phase covers:
- extending the existing Sidearm scraper surface just enough to reuse its HTML fetch + raw play extraction,
- building a new run-expectancy parser/state machine under `web/lib/runExpectancy/`,
- reconstructing half-inning base state, outs, runs scored, and per-pitch count snapshots from Sidearm play text,
- validating parsed half-inning run totals against the box score `r` column,
- producing the `re_game_map.json` metadata file required for later charting joins.

This phase does not build the RE24/RE288 matrices, does not touch `/charting/ohtwo`, and does not rewrite the existing spray chart pipeline.

</domain>

<decisions>
## Implementation Decisions

### Scope and file boundaries
- Add the new parser under `web/lib/runExpectancy/`; do not fold run-expectancy logic into `web/lib/spraychart/`.
- Keep `web/scripts/scrape_spray_charts.ts` unchanged.
- In `web/lib/spraychart/scraper.ts`, only export the two existing helpers needed by the new parser; do not redesign the spray chart code path during this phase.

### Sidearm parsing rules
- Treat the parenthetical count block as the final count of the PA, not a pre-pitch snapshot.
- Walk the pitch sequence character by character from `0-0` to derive intermediate count states.
- Treat semicolon-separated sub-events inside one play line as sequential state transitions that all affect the same PA outcome.
- Deduplicate raw play rows by `(inning, halfInning, playText)`, never by `playText` alone.

### Validation contract
- Half-inning run-total validation against the box score `r` column is a hard gate, not advisory logging.
- Failed innings must be excluded from downstream matrix computation and recorded explicitly for review.
- Phase 21 is not complete until at least 15 of the roughly 19 known 2026 games pass validation.

### Join-prep metadata
- `web/public/data/run-expectancy/re_game_map.json` must map Sidearm `gameId` to `{ date, opponent, homeAway, suffix }`.
- Doubleheader suffixes must be preserved because charting opponent-name normalization already strips `(G1)/(G2)` in commit `b776bde`.

### Claude's Discretion
- Exact type shapes for raw rows, parsed half-innings, validation reports, and per-pitch snapshots.
- Exact function names and module decomposition inside `web/lib/runExpectancy/`, as long as the public API is testable and Phase 22 can consume it cleanly.
- Whether validation logging is represented as structured arrays, maps, or typed report objects.

</decisions>

<specifics>
## Specific Ideas

- Reuse `discoverGameUrls()` from the spray chart scraper for season box score discovery instead of inventing a second schedule crawler.
- Reuse the existing Sidearm HTML isolation approach as a starting point, but do not carry forward the current plain-text `Set(plays)` dedup bug into the RE parser.
- Start from a raw extraction layer that preserves inning and half-inning context before applying any baseball-state rules.
- Use the real Sidearm examples from the handoff as the first fixture cases:
  - `Robert Christensen doubled to left field, RBI (2-2 BKFB); Gabe Cushner advanced to third; Ryan Grace scored.`
  - `Ryan Hvozdovic hit by pitch (3-2 KFBBH).`
- Front-load the known edge cases into tests: DP, sac fly, IBB, HBP, repeated play text in different innings, and doubleheader metadata.

</specifics>

<code_context>
## Existing Code Insights

### Reusable assets
- `web/lib/spraychart/scraper.ts` already knows how to fetch Sidearm schedule pages and box score HTML, and already isolates the PBP section from the full page.
- `web/lib/spraychart/zoneMapper.ts` already parses the `(count sequence)` suffix for spray-chart purposes; its behavior is a useful reference for Phase 21 count parsing even though RE needs richer per-pitch snapshots.
- `web/scripts/scrape_spray_charts.ts` is the existing season-wide Sidearm ingestion path and should remain behavior-stable.

### Established patterns
- Derived datasets in this repo ship as static JSON under `web/public/data/`.
- Unit coverage lives beside the domain module in `web/lib/**.test.ts` and runs through `npm --prefix web exec vitest run ...`.
- Brownfield additions favor new feature-local modules over broad rewrites of older data pipelines.

### Integration points
- Phase 22 will consume Phase 21 parser output and the validation/game-map artifacts directly, so the Phase 21 types should be stable and explicit.
- Phase 23 depends on `re_game_map.json` to bridge Sidearm `gameId` and charting game identity.
- Phase 24 depends on the Phase 21 count snapshots being trustworthy enough to identify the pre-pitch state for 0-2 fastballs.

</code_context>

<deferred>
## Deferred Ideas

- `web/scripts/build_re_matrix.ts` and any `npm run re:rebuild` wiring belong to Phase 22.
- `game-base-states-2026.json` and charting PA joins belong to Phase 23.
- Any additive changes to `web/lib/charting/ohtwo.ts` or `web/app/charting/ohtwo/page.tsx` belong to Phase 24 only.

</deferred>

---

*Phase: 21-pbp-parser-foundation*
*Context gathered: 2026-04-11 via handoff + roadmap/requirements/state*
