#!/usr/bin/env npx tsx
/**
 * Game Base-States Index Builder — Phase 23-01
 *
 * Fetches the 2026 Babson season PBP corpus, then emits a flat array of
 * PA-level base-state records to:
 *   web/public/data/run-expectancy/game-base-states-2026.json
 *
 * Each record carries (gameId, date, opponent, inning, halfInning, paIndex,
 * baseStateBefore, outsBefore, baseStateAfter, outsAfter, runsScored) and
 * is used by the delta-RE join in Phase 23-02.
 *
 * Usage:
 *   npm --prefix web run re:base-states
 *   npx tsx web/scripts/build_game_base_states.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverGameUrls } from "../lib/spraychart/scraper";
import { buildSeasonRunExpectancyCorpus } from "../lib/runExpectancy/pbpParser";
import { buildGameBaseStatesIndex } from "../lib/runExpectancy/gameBaseStates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEASON = 2026;
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../public/data/run-expectancy");
const OUTPUT_PATH = join(OUTPUT_DIR, `game-base-states-${SEASON}.json`);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nGame Base-States Index Builder — ${SEASON} season`);
  console.log("=".repeat(50));

  // 1. Discover game URLs
  console.log("\n[1/3] Discovering game URLs...");
  const allUrls = await discoverGameUrls(SEASON);
  console.log(`      Found ${allUrls.length} total game URLs`);

  // 2. Build season corpus (scoped to re_game_map.json entries)
  console.log("\n[2/3] Fetching and parsing PBP corpus...");
  console.log("      (This fetches from Sidearm — allow 60-120 seconds)\n");
  const corpus = await buildSeasonRunExpectancyCorpus(allUrls);

  console.log(`      Total games mapped:   ${corpus.totalGames}`);
  console.log(`      Passing games (≥75%): ${corpus.passingGames}`);
  console.log(`      Usable half-innings:  ${corpus.totalUsableHalfInnings}`);
  console.log(`      Failed half-innings:  ${corpus.totalFailedHalfInnings}`);

  if (corpus.passingGames < 15) {
    console.error(
      `\n✗ Season gate failed: only ${corpus.passingGames}/19 games passed (need ≥ 15). Aborting.`,
    );
    process.exit(1);
  }

  // 3. Build index and write
  console.log("\n[3/3] Building PA index and writing file...");
  const index = buildGameBaseStatesIndex(corpus, SEASON);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2));

  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
  console.log(`  Games with PBP:  ${index.totalGames}`);
  console.log(`  Total PAs:       ${index.totalPas}`);
  console.log(
    `  PAs per game:    ${(index.totalPas / Math.max(index.totalGames, 1)).toFixed(1)} avg`,
  );
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err);
  process.exit(1);
});
