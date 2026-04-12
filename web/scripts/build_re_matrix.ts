#!/usr/bin/env npx tsx
/**
 * RE Matrix Builder — Phase 22
 *
 * Fetches the 2026 Babson season PBP corpus via buildSeasonRunExpectancyCorpus(),
 * aggregates raw observations per (count, base_state, outs) cell, computes
 * mean run-expectancy and out-probability values, and writes the result to:
 *   web/public/data/run-expectancy/re-matrix-2026.json
 *
 * Usage:
 *   npm --prefix web run re:rebuild
 *   npx tsx web/scripts/build_re_matrix.ts
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { discoverGameUrls } from "../lib/spraychart/scraper";
import { buildSeasonRunExpectancyCorpus } from "../lib/runExpectancy/pbpParser";
import { buildMatrixFromCorpus } from "../lib/runExpectancy/reMatrix";
import type { ReMatrixFile } from "../lib/runExpectancy/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SEASON = 2026;
const MIN_OBSERVATIONS = 5;
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../public/data/run-expectancy");
const OUTPUT_PATH = join(OUTPUT_DIR, `re-matrix-${SEASON}.json`);

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nRE Matrix Builder — ${SEASON} season`);
  console.log("=".repeat(50));

  // 1. Discover game URLs
  console.log("\n[1/4] Discovering game URLs...");
  const allUrls = await discoverGameUrls(SEASON);
  console.log(`      Found ${allUrls.length} total game URLs`);

  // 2. Build the season corpus (scoped to re_game_map.json entries)
  console.log("\n[2/4] Fetching and parsing PBP corpus...");
  console.log("      (This fetches from Sidearm — allow 60-120 seconds)\n");
  const corpus = await buildSeasonRunExpectancyCorpus(allUrls);

  console.log(`      Total games mapped:   ${corpus.totalGames}`);
  console.log(`      Passing games (≥75%): ${corpus.passingGames}`);
  console.log(`      Failed games:         ${corpus.failedGames}`);
  console.log(`      Usable half-innings:  ${corpus.totalUsableHalfInnings}`);
  console.log(`      Failed half-innings:  ${corpus.totalFailedHalfInnings}`);

  if (corpus.passingGames < 15) {
    console.error(
      `\n✗ Season gate failed: only ${corpus.passingGames}/19 games passed (need ≥ 15). Aborting.`,
    );
    process.exit(1);
  }

  // 3. Aggregate and compute matrix cells
  console.log("\n[3/4] Aggregating observations and computing cells...");
  const { re24, re288, obsRe24, obsRe288 } = buildMatrixFromCorpus(
    corpus,
    MIN_OBSERVATIONS,
  );

  const nullRe24 = re24.filter((c) => c.meanRe === null).length;
  const nullRe288 = re288.filter((c) => c.meanRe === null).length;

  console.log(`      RE24  observations:  ${obsRe24}`);
  console.log(`      RE288 observations:  ${obsRe288}`);
  console.log(
    `      RE24  cells: ${re24.length} total, ${nullRe24} null (n < ${MIN_OBSERVATIONS})`,
  );
  console.log(
    `      RE288 cells: ${re288.length} total, ${nullRe288} null (n < ${MIN_OBSERVATIONS})`,
  );

  // 4. Write output
  console.log("\n[4/4] Writing matrix file...");

  const output: ReMatrixFile = {
    generatedAt: new Date().toISOString(),
    season: SEASON,
    totalObservationsRe24: obsRe24,
    totalObservationsRe288: obsRe288,
    minObservations: MIN_OBSERVATIONS,
    re24,
    re288,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
  console.log(
    `  RE24:  ${re24.length} cells (${re24.length - nullRe24} with data)`,
  );
  console.log(
    `  RE288: ${re288.length} cells (${re288.length - nullRe288} with data)`,
  );
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err);
  process.exit(1);
});
