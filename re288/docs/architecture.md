# RE288 Pipeline: Scraper Implementation

## Overview
The RE288 scraper is responsible for extracting play-by-play (PBP) data and schedule information from Sidearm Sports websites. This is a critical component of the Run Expectancy (RE) pipeline.

## Current Implementation Details
- **Source Logic:** Extracted from `web/lib/spraychart/scraper.ts` and now being hardened inside `re288/`.
- **Target Data:**
  - Schedule metadata (opponent, date, time, home/away orientation).
  - Canonical game identity across mirrored conference schedule pages.
  - Play-by-play (PBP) events.
- **Key Functions:**
  - `discoverProgramScheduleGames()`: pulls one program's raw Sidearm schedule rows.
  - `buildConferenceCanonicalGameIndex()`: groups mirrored rows into one canonical game list.
  - `build_sidearm_game_index.ts`: executable index builder that writes static JSON artifacts.

## Architectural Goal: The Canonical Game Index
The current scraper-based deduplication is fragile. The active goal is now a real `Registry -> Scraper -> Canonical Game Index -> RE Matrix` flow.

1. **Registry:** A list of known conferences and their local program registries.
2. **Scraper:** Pulls raw data.
3. **Canonical Game Index:** A new layer that uses stable metadata to create a single "Source of Truth" for every game, decoupling deduplication from the scraper. In the current `re288/` package this means:
   - scraping raw schedule entries per program
   - normalizing noisy schedule labels (rankings, `Noon`, timezone suffixes)
   - grouping mirrored host pages by matchup-day + stable game ordinal (`g1`, `g2`, ...)
   - assigning a canonical game id
   - preserving all source URLs/programs on the same game record
4. **RE Matrix:** Consumes the indexed games to generate expectancy values.

## Current Backbone
- `src/scraper.ts`: Sidearm registry + schedule/PBP scraping
- `src/registry.ts`: conference registry entrypoint
- `src/gameIndex.ts`: canonical game index grouping and id generation
- `scripts/build_sidearm_game_index.ts`: first executable index builder (`NEWMAC`)
- `src/pbpParser.ts`: raw Sidearm half-inning / play table extraction
- `src/pbpFetch.ts`: deterministic fetch + provenance + corpus assembly
- `scripts/build_pbp_corpus.ts`: standalone PBP corpus builder
- `data/sidearm-game-index-newmac-2026.json`: canonical game index output
- `data/pbp-corpus-newmac-2026.json`: raw parsed PBP corpus output

## Current Output Contract
Each generated index contains:
- `conferenceId`
- `conferenceName`
- `season`
- `totalPrograms`
- `totalGames`
- `games[]`

Each `games[]` record contains:
- `canonicalGameId`
- `dedupKey`
- `date`
- `timeLabel`
- `homeTeam`
- `awayTeam`
- `gameNumber`
- `sourceCount`
- `sourceProgramIds`
- `sources[]`

The canonical identity is intentionally based on `date + home + away + gameNumber`, not raw time text, because mirrored Sidearm pages frequently disagree on cosmetic time labels.

## Current PBP Corpus Contract
Each generated corpus contains:
- `conferenceId`
- `conferenceName`
- `season`
- `totalPrograms`
- `totalGames`
- `parsedGames`
- `failedGames`
- `totalHalfInnings`
- `failureReasons`
- `games[]`

Each `games[]` record contains:
- canonical game metadata copied from the index
- `selectedSourceUrl`
- `selectedSourceProgramId`
- `selectedHtmlHash`
- `status`
- `failureReason`
- `fetchAttempts[]`
- `rawGame`

The fetch layer tries each canonical source URL in deterministic order and selects the first one that yields at least one play-by-play half-inning. Failed fetches and empty-PBP fetches stay visible in the artifact.

## Operator Commands
From `/Users/traftonobrien/Desktop/pitch-tracker/re288`:

```bash
npm test
npm run build:index:newmac
npm run build:pbp:newmac
```

Or generic:

```bash
npm run build:index -- --conference newmac --season 2026
npm run build:pbp -- --conference newmac --season 2026
```

## Development Rules
- **No UI/Frontend:** All work is backend/data-focused.
- **Conference-by-Conference:** Implement and validate one conference at a time.
- **Maintain Test Coverage:** Use Vitest for all scraping logic.
