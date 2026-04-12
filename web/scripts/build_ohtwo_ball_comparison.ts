#!/usr/bin/env npx tsx

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  discoverGameUrls,
  discoverNewmacScheduleGames,
} from "../lib/spraychart/scraper";
import { buildSeasonRunExpectancyCorpus } from "../lib/runExpectancy/pbpParser";
import {
  aggregateHalfInnings,
  buildOhTwoBallStateMix,
  evaluateOhTwoBallStateMix,
  re288Key,
} from "../lib/runExpectancy/reMatrix";
import type {
  CountProgressionStateMixEntry,
  MatrixCellAccumulator,
  OhTwoBallComparisonFile,
  OutsCount,
} from "../lib/runExpectancy/types";

const SEASON = 2026;
const SCRIPT_DIR = __dirname;
const OUTPUT_DIR = resolve(SCRIPT_DIR, "../public/data/run-expectancy");
const OUTPUT_PATH = join(OUTPUT_DIR, `ohtwo-ball-comparison-${SEASON}.json`);

async function main() {
  console.log(`\n0-2 Ball Comparison Builder — ${SEASON}`);
  console.log("=".repeat(50));

  console.log("\n[1/4] Building validated Babson corpus...");
  const babsonUrls = await discoverGameUrls(SEASON);
  const babsonCorpus = await buildSeasonRunExpectancyCorpus(babsonUrls);
  const babsonHalfInnings = babsonCorpus.games
    .filter((game) => game.parsedGame)
    .flatMap((game) => game.parsedGame!.usableHalfInnings);
  const babsonAgg = aggregateHalfInnings(babsonHalfInnings);
  const babsonBallStateMix = buildOhTwoBallStateMix(babsonHalfInnings);
  const babsonWeighted = evaluateOhTwoBallStateMix(
    babsonBallStateMix,
    babsonAgg.re24Map,
    babsonAgg.re288Map,
  );

  console.log("\n[2/4] Building deduped NEWMAC corpus...");
  const newmacUrls = (await discoverNewmacScheduleGames(SEASON)).map((game) => game.url);
  const newmacCorpus = await buildSeasonRunExpectancyCorpus(newmacUrls, {
    scopeGameIds: null,
  });
  const newmacHalfInnings = newmacCorpus.games
    .filter((game) => game.parsedGame)
    .flatMap((game) => game.parsedGame!.usableHalfInnings);
  const newmacAgg = aggregateHalfInnings(newmacHalfInnings);
  const newmacWeighted = evaluateOhTwoBallStateMix(
    babsonBallStateMix,
    newmacAgg.re24Map,
    newmacAgg.re288Map,
  );
  const newmacValuePerConversionOnBabsonStates = evaluateConversionValueOnStateMix(
    babsonBallStateMix,
    newmacAgg.re24Map,
    newmacAgg.re288Map,
  );

  console.log("\n[3/4] Building per-state comparison...");
  const states = babsonBallStateMix.map((entry) => {
    const babsonPreRe = lookupRe(
      babsonAgg.re288Map,
      re288Key("0-2", entry.baseState, entry.outs),
    );
    const babsonPostRe = lookupRe(
      babsonAgg.re288Map,
      re288Key("1-2", entry.baseState, entry.outs),
    );
    const newmacPreRe = lookupRe(
      newmacAgg.re288Map,
      re288Key("0-2", entry.baseState, entry.outs),
    );
    const newmacPostRe = lookupRe(
      newmacAgg.re288Map,
      re288Key("1-2", entry.baseState, entry.outs),
    );

    return {
      baseState: entry.baseState,
      outs: entry.outs,
      babsonN: entry.n,
      babsonPreRe,
      babsonPostRe,
      babsonDelta:
        babsonPreRe !== null && babsonPostRe !== null
          ? babsonPostRe - babsonPreRe
          : null,
      newmacPreRe,
      newmacPostRe,
      newmacDelta:
        newmacPreRe !== null && newmacPostRe !== null
          ? newmacPostRe - newmacPreRe
          : null,
    };
  });

  console.log("\n[4/4] Writing comparison file...");
  const output: OhTwoBallComparisonFile = {
    generatedAt: new Date().toISOString(),
    season: SEASON,
    totalBabsonBalls: babsonWeighted.totalObserved,
    babsonWeightedDelta: babsonWeighted.reDelta,
    newmacWeightedDeltaOnBabsonStates: newmacWeighted.reDelta,
    newmacValuePerConversionOnBabsonStates,
    states,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✓ Wrote ${OUTPUT_PATH}`);
  console.log(`  Babson 0-2 balls: ${output.totalBabsonBalls}`);
  console.log(`  Babson weighted delta: ${fmt(output.babsonWeightedDelta)}`);
  console.log(`  NEWMAC weighted delta on Babson states: ${fmt(output.newmacWeightedDeltaOnBabsonStates)}`);
  console.log(`  NEWMAC value per conversion on Babson states: ${fmt(output.newmacValuePerConversionOnBabsonStates)}`);
}

function lookupRe(
  map: Map<string, MatrixCellAccumulator>,
  key: string,
): number | null {
  const cell = map.get(key);
  return cell && cell.n > 0 ? cell.sumRe / cell.n : null;
}

function fmt(value: number | null): string {
  return value === null ? "null" : value.toFixed(3);
}

function evaluateConversionValueOnStateMix(
  stateMix: CountProgressionStateMixEntry[],
  re24Map: Map<string, MatrixCellAccumulator>,
  re288Map: Map<string, MatrixCellAccumulator>,
): number | null {
  let ballPostSum = 0;
  let strikeoutPostSum = 0;
  let total = 0;

  for (const state of stateMix) {
    const ballPost = lookupRe(
      re288Map,
      re288Key("1-2", state.baseState, state.outs),
    );
    const strikeoutPost = state.outs >= 2
      ? 0
      : lookupRe(
          re24Map,
          `${state.baseState}-${(state.outs + 1) as OutsCount}`,
        );

    if (ballPost === null || strikeoutPost === null) {
      continue;
    }

    ballPostSum += ballPost * state.n;
    strikeoutPostSum += strikeoutPost * state.n;
    total += state.n;
  }

  if (total === 0) {
    return null;
  }

  return ballPostSum / total - strikeoutPostSum / total;
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err);
  process.exit(1);
});
