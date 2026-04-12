#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  NEWMAC_BASEBALL_PROGRAMS,
  discoverNewmacScheduleGames,
} from "../lib/spraychart/scraper";
import { buildSeasonRunExpectancyCorpus } from "../lib/runExpectancy/pbpParser";
import { buildMatrixFromCorpus } from "../lib/runExpectancy/reMatrix";
import type { ReMatrixFile } from "../lib/runExpectancy/types";

const SEASON = 2026;
const MIN_OBSERVATIONS = 5;
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../public/data/run-expectancy");
const OUTPUT_PATH = join(OUTPUT_DIR, `re-matrix-newmac-${SEASON}.json`);

async function main() {
  console.log(`\nNEWMAC RE Matrix Builder — ${SEASON} season`);
  console.log("=".repeat(50));

  console.log("\n[1/4] Discovering deduped NEWMAC schedule games...");
  const scheduleGames = await discoverNewmacScheduleGames(SEASON);
  const urls = scheduleGames.map((game) => game.url);
  console.log(`      Programs:             ${NEWMAC_BASEBALL_PROGRAMS.length}`);
  console.log(`      Deduped game URLs:    ${urls.length}`);

  console.log("\n[2/4] Fetching and parsing NEWMAC PBP corpus...");
  console.log("      (This fetches from Sidearm — allow several minutes)\n");
  const corpus = await buildSeasonRunExpectancyCorpus(urls, {
    scopeGameIds: null,
  });

  console.log(`      Parsed games:         ${corpus.totalGames}`);
  console.log(`      Passing games (≥75%): ${corpus.passingGames}`);
  console.log(`      Failed games:         ${corpus.failedGames}`);
  console.log(`      Usable half-innings:  ${corpus.totalUsableHalfInnings}`);
  console.log(`      Failed half-innings:  ${corpus.totalFailedHalfInnings}`);

  console.log("\n[3/4] Aggregating matrix cells...");
  const { re24, re288, obsRe24, obsRe288, countProgression } = buildMatrixFromCorpus(
    corpus,
    MIN_OBSERVATIONS,
  );

  console.log(`      RE24 observations:    ${obsRe24}`);
  console.log(`      RE288 observations:   ${obsRe288}`);

  console.log("\n[4/4] Writing matrix file...");
  const output: ReMatrixFile = {
    generatedAt: new Date().toISOString(),
    season: SEASON,
    corpusLabel: "newmac",
    sourcePrograms: NEWMAC_BASEBALL_PROGRAMS.map((program) => program.id),
    totalGamesInCorpus: corpus.totalGames,
    passingGamesInCorpus: corpus.passingGames,
    failedGamesInCorpus: corpus.failedGames,
    totalObservationsRe24: obsRe24,
    totalObservationsRe288: obsRe288,
    minObservations: MIN_OBSERVATIONS,
    re24,
    re288,
    countProgression,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err);
  process.exit(1);
});
