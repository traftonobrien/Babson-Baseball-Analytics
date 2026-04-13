# RE288 Standalone Workspace

This package is the standalone data-pipeline workspace for conference-scale run expectancy ingestion.

Primary operator guide:
- `/Users/traftonobrien/Desktop/pitch-tracker/re288/docs/goose-runbook.md`

## Current Scope
- Sidearm schedule discovery
- conference registry
- canonical game index generation
- standalone PBP corpus generation
- manifest-driven native CLI
- pooled conference artifacts
- scraper regression coverage

## Available Conferences
- `newmac`
- `nescac`
- `liberty-league`

## Quickstart

From `/Users/traftonobrien/Desktop/pitch-tracker/re288`:

```bash
npm test
npm run manifest:validate:starter-pack
npm run build:index:newmac
npm run build:index:nescac
npm run build:index:liberty-league
npm run build:pbp:newmac
npm run build:pbp:nescac
npm run build:pbp:liberty-league
npm run build:pool:starter-pack
```

Or use the native CLI directly:

```bash
node ./bin/re288.mjs manifest validate --file manifests/starter-pack-2026.json
node ./bin/re288.mjs master update --manifest manifests/starter-pack-2026.json
```

Generated output:

```text
re288/data/sidearm-game-index-newmac-2026.json
re288/data/sidearm-game-index-nescac-2026.json
re288/data/sidearm-game-index-liberty-league-2026.json
re288/data/pbp-corpus-newmac-2026.json
re288/data/pbp-corpus-nescac-2026.json
re288/data/pbp-corpus-liberty-league-2026.json
re288/data/sidearm-game-index-starter-pack-2026.json
re288/data/pbp-corpus-starter-pack-2026.json
```

## Add Another Conference
1. Add a programs JSON file under `re288/config/data_sources/`
2. Register it in `re288/src/registry.ts`
3. Run `npm run build:index -- --conference <id> --season 2026`
4. Spot-check mirrored games before using the output for RE matrix generation

## Current Contract
The canonical index uses:
- `date`
- `homeTeam`
- `awayTeam`
- stable matchup-day game ordinal (`g1`, `g2`, ...)

It intentionally does **not** trust raw schedule time strings as the primary identity signal because mirrored Sidearm pages often disagree on `Noon` vs `12:00 PM`, timezone suffixes, and similar label noise.

## Native CLI Contract
The native `re288` CLI is the operator surface for agents.

Supported commands:
- `re288 manifest validate --file <manifest.json>`
- `re288 index build --conference <id> [--season 2026]`
- `re288 index build --manifest <manifest.json> [--season 2026]`
- `re288 pbp build --conference <id> [--season 2026]`
- `re288 pbp build --manifest <manifest.json> [--season 2026]`
- `re288 pool build --manifest <manifest.json> [--season 2026]`
- `re288 master update --manifest <manifest.json> [--season 2026]`

Manifest-first operation keeps the workspace aligned with the GitHub repo structure:
- `re288/config/data_sources/` for conference program packs
- `re288/manifests/` for operator input
- `re288/data/` for generated artifacts
- `re288/src/` for reusable library code
- `re288/bin/` for the executable CLI entrypoint
