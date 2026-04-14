#!/usr/bin/env ts-node-esm
/**
 * Build RE24 matrix from a pooled PBP corpus.
 *
 * Usage:
 *   npm run build:re_matrix                              # starter-pack default
 *   npm run build:re_matrix -- --corpus data/pbp-corpus-starter-pack-2026.json
 *   npm run build:re_matrix -- --corpus data/pbp-corpus-newmac-2026.json --out data/re-matrix-newmac-2026.json
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildRE24Matrix, printMatrix } from "../src/reMatrix.ts";
import type { PooledCorpus } from "../src/reMatrix.ts";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);

function getArg(flag: string, fallback: string): string {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
}

const corpusPath = resolve(
  getArg("--corpus", "data/pbp-corpus-starter-pack-2026.json"),
);
const outPath = resolve(
  getArg("--out", corpusPath.replace("pbp-corpus-", "re-matrix-").replace(/pbp-corpus/, "re-matrix")),
);

// ---------------------------------------------------------------------------
// Load corpus
// ---------------------------------------------------------------------------

console.log(`Loading corpus: ${corpusPath}`);
let corpus: PooledCorpus;
try {
  const raw = readFileSync(corpusPath, "utf-8");
  const parsed = JSON.parse(raw);
  // Support both { games: [...] } and bare array
  corpus = Array.isArray(parsed) ? { games: parsed } : parsed;
} catch (err) {
  console.error(`Failed to load corpus: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

console.log(`  Games in corpus: ${corpus.games?.length ?? 0}`);

// ---------------------------------------------------------------------------
// Build matrix
// ---------------------------------------------------------------------------

console.log("Building RE24 matrix...");
const matrix = buildRE24Matrix(corpus);

// ---------------------------------------------------------------------------
// Print summary
// ---------------------------------------------------------------------------

printMatrix(matrix);

// ---------------------------------------------------------------------------
// Write output
// ---------------------------------------------------------------------------

writeFileSync(outPath, JSON.stringify(matrix, null, 2), "utf-8");
console.log(`Written: ${outPath}`);
