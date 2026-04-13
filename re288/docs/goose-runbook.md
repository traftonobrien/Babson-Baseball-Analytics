# RE288 Goose Runbook

This is the canonical execution playbook for the standalone `re288/` workspace.

Use this document as the default operating guide. The goal is to remove ambiguity so work can proceed without follow-up questions.

## Mission
Build a durable conference-scale run expectancy pipeline using this architecture:

`registry -> scraper -> canonical game index -> PBP parse -> RE matrix`

Do **not** route this work back through the web app until the standalone pipeline is stable.

## Non-Negotiables
- Stay inside `/Users/traftonobrien/Desktop/pitch-tracker/re288` unless a task explicitly requires reading the parent repo for reference.
- Treat the canonical game index as the source of truth for downstream ingest.
- Do not invent one-off conference logic when a reusable Sidearm pattern will work.
- Add tests whenever scraper identity or parsing behavior changes.
- Update checklists/docs as boxes become done.

## Current Starting Point
These pieces are already working:

- conference registries:
  - `newmac`
  - `nescac`
  - `liberty-league`
- generic conference registry entrypoint:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/registry.ts`
- schedule scraping and normalization:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/scraper.ts`
- canonical game index builder:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/gameIndex.ts`
- CLI build entrypoint:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/scripts/build_sidearm_game_index.ts`
- standalone PBP parser / corpus builder:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/pbpParser.ts`
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/pbpFetch.ts`
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/scripts/build_pbp_corpus.ts`
- generated conference indexes:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/data/sidearm-game-index-newmac-2026.json`
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/data/sidearm-game-index-nescac-2026.json`
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/data/sidearm-game-index-liberty-league-2026.json`

## Current Verified Commands
Run these from `/Users/traftonobrien/Desktop/pitch-tracker/re288`:

```bash
npm test
npm run build:index:newmac
npm run build:index -- --conference nescac --season 2026
npm run build:index -- --conference liberty-league --season 2026
npm run build:pbp:newmac
npm run build:pbp:nescac
npm run build:pbp:liberty-league
```

## What To Do Next
Execute work in this order.

### 1. Preserve the Index Backbone
Before adding new ingestion logic:
- confirm `npm test` passes
- confirm the three index builds still pass
- do not change output contracts casually

Acceptance:
- tests green
- all three conference builds succeed

### 2. Standalone PBP Ingestion
This layer now exists.

Current files:
- `src/pbpParser.ts`
- `src/pbpFetch.ts`
- `scripts/build_pbp_corpus.ts`

Current artifact pattern:
- `data/pbp-corpus-<conference>-2026.json`

Acceptance already met:
- one conference can produce a deterministic standalone PBP corpus
- failed fetches are recorded, not silently dropped
- tests cover real-ish raw PBP parsing and fetch selection behavior

### 3. Build Multi-Conference Pooling
Once conference corpora work:
- allow pooled ingest across `newmac`, `nescac`, and `liberty-league`
- combine canonical indexes without losing conference identity
- preserve per-conference counts in output metadata

Suggested output:
- `data/sidearm-game-index-pooled-2026.json`
- or pooled PBP corpus metadata inside the corpus artifact

Acceptance:
- pooled build can report contributing conferences and total games
- conference identity remains queryable

### 4. Build Standalone RE Matrix Generation
Only after pooled PBP ingest is working:
- port or adapt the existing RE logic into `re288/`
- generate RE24 and RE288 observations from the standalone corpus
- do not depend on the web app scripts for correctness

Suggested files:
- `src/reMatrix.ts`
- `scripts/build_re_matrix.ts`
- `data/re-matrix-pooled-2026.json`

Acceptance:
- standalone RE matrix build runs from `re288/`
- output clearly states observation counts and conference coverage

### 5. Add More Conferences
After pooled RE works:
- add one conference at a time
- use the same exact path:
  - add JSON
  - register conference
  - run index build
  - spot-check mirrored games
  - add to pooled ingest

## How To Add A Conference
1. Add a new `*_baseball_programs.json` file under:
   - `/Users/traftonobrien/Desktop/pitch-tracker/re288/config/data_sources/`
2. Register it in:
   - `/Users/traftonobrien/Desktop/pitch-tracker/re288/src/registry.ts`
3. Run:

```bash
npm run build:index -- --conference <id> --season 2026
```

4. Spot-check for:
   - ranked opponent label noise
   - `Noon` vs `12:00 PM`
   - timezone suffixes (`ET`, `EST`, etc.)
   - alias mismatches like `(Mass.)`, `(MA)`, `St.` vs `Saint`
   - doubleheader identity (`g1`, `g2`)

5. If dedupe is wrong:
   - fix normalization in `src/scraper.ts`
   - fix aliases in the conference JSON
   - add a regression test

## Done Means
A task is complete only if:
- code is in `re288/`
- tests pass
- relevant build command passes
- docs/checklists are updated
- the next exact step is obvious from the state of the repo

## Do Not Ask Questions About
Default these choices without stopping:
- use `2026` unless explicitly told otherwise
- prefer reusable Sidearm normalization over conference-specific hacks
- write static JSON artifacts into `re288/data/`
- add tests whenever logic changes
- if one conference is ambiguous, continue using the existing starter pack and leave the new conference for later

## Reference Files
- architecture:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/docs/architecture.md`
- checklist:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/docs/checklist.md`
- conference registry:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/docs/conference-registry.md`
- workspace quickstart:
  - `/Users/traftonobrien/Desktop/pitch-tracker/re288/README.md`

## Immediate Next Step
The immediate next execution target is:

1. finish/verify the full three-conference PBP starter pack
2. build pooled ingest across `newmac + nescac + liberty-league`
3. then start standalone RE matrix generation from the pooled corpus

If no other instruction is given, start there.
