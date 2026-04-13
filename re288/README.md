# RE288 Standalone Workspace

This package is the standalone data-pipeline workspace for conference-scale run expectancy ingestion.

Primary operator guide:
- `/Users/traftonobrien/Desktop/pitch-tracker/re288/docs/goose-runbook.md`

## Current Scope
- Sidearm schedule discovery
- conference registry
- canonical game index generation
- standalone PBP corpus generation
- scraper regression coverage

## Available Conferences
- `newmac`
- `nescac`
- `liberty-league`

## Quickstart

From `/Users/traftonobrien/Desktop/pitch-tracker/re288`:

```bash
npm test
npm run build:index:newmac
npm run build:index -- --conference nescac --season 2026
npm run build:index -- --conference liberty-league --season 2026
npm run build:pbp:newmac
npm run build:pbp:nescac
npm run build:pbp:liberty-league
```

Generated output:

```text
re288/data/sidearm-game-index-newmac-2026.json
re288/data/pbp-corpus-newmac-2026.json
re288/data/pbp-corpus-nescac-2026.json
re288/data/pbp-corpus-liberty-league-2026.json
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
