/**
 * RE24 matrix aggregation from a pooled PBP corpus.
 *
 * RE24: 24-cell run expectancy matrix (8 base states × 3 out counts).
 * Each cell holds the average runs expected to score for the remainder
 * of the half-inning given that base/out state.
 */

import { parseHalfInning, extractRE24Observations } from "./stateMachine.ts";
import type { BaseStateCode } from "./stateMachine.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export const ALL_BASE_STATES: BaseStateCode[] = [
  "000", "100", "010", "001", "110", "101", "011", "111",
];

export const ALL_OUTS = [0, 1, 2] as const;
export type OutsCount = 0 | 1 | 2;

export interface RE24Cell {
  baseState: BaseStateCode;
  outs: OutsCount;
  n: number;
  avgRunsToEnd: number;
}

export interface RE24Matrix {
  generatedAt: string;
  conferenceIds: string[];
  season: number;
  totalGames: number;
  usableGames: number;
  usableHalfInnings: number;
  failedHalfInnings: number;
  totalObservations: number;
  cells: RE24Cell[];
}

// ---------------------------------------------------------------------------
// Corpus types (mirrors what build_pbp_corpus.ts writes)
// ---------------------------------------------------------------------------

interface CorpusPlay {
  inning: number;
  halfInning: "top" | "bottom";
  playIndex: number;
  playText: string;
  dedupKey: string;
}

interface CorpusTotals {
  runs: number | null;
  hits: number | null;
  errors: number | null;
  leftOnBase: number | null;
}

interface CorpusHalfInning {
  key: string;
  caption: string;
  inning: number;
  halfInning: "top" | "bottom";
  offenseTeam: string;
  playLines: string[];
  plays: CorpusPlay[];
  totals: CorpusTotals;
}

interface CorpusRawGame {
  gameId: string | null;
  sourceUrl: string | null;
  halfInnings: CorpusHalfInning[];
}

interface CorpusGame {
  canonicalGameId: string;
  conferenceId?: string;
  status: string;
  rawGame: CorpusRawGame;
}

export interface PooledCorpus {
  generatedAt?: string;
  manifestId?: string;
  conferences?: string[];
  season?: number;
  games: CorpusGame[];
}

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildRE24Matrix(corpus: PooledCorpus): RE24Matrix {
  // Accumulators: key = "baseCode-outs"
  const totals = new Map<string, { sum: number; n: number }>();

  // Initialize all 24 cells
  for (const base of ALL_BASE_STATES) {
    for (const outs of ALL_OUTS) {
      totals.set(`${base}-${outs}`, { sum: 0, n: 0 });
    }
  }

  let usableGames = 0;
  let usableHalfInnings = 0;
  let failedHalfInnings = 0;
  let totalObservations = 0;

  const games = corpus.games ?? (corpus as unknown as CorpusGame[]);

  for (const game of games) {
    if (!game.rawGame?.halfInnings?.length) continue;

    let gameUsable = 0;
    let gameFailed = 0;

    for (const rawHI of game.rawGame.halfInnings) {
      const parsed = parseHalfInning(rawHI);

      if (!parsed.usable) {
        gameFailed++;
        continue;
      }

      gameUsable++;
      const observations = extractRE24Observations(parsed);

      for (const obs of observations) {
        const key = `${obs.baseCode}-${obs.outs}`;
        const cell = totals.get(key);
        if (!cell) continue;
        cell.sum += obs.runsToEndOfInning;
        cell.n++;
        totalObservations++;
      }
    }

    usableHalfInnings += gameUsable;
    failedHalfInnings += gameFailed;

    const totalHI = gameUsable + gameFailed;
    if (totalHI > 0 && gameUsable / totalHI >= 0.75) {
      usableGames++;
    }
  }

  const cells: RE24Cell[] = [];
  for (const base of ALL_BASE_STATES) {
    for (const outs of ALL_OUTS) {
      const key = `${base}-${outs}`;
      const acc = totals.get(key)!;
      cells.push({
        baseState: base,
        outs,
        n: acc.n,
        avgRunsToEnd: acc.n > 0 ? Math.round((acc.sum / acc.n) * 1000) / 1000 : 0,
      });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    conferenceIds: corpus.conferences ?? [],
    season: corpus.season ?? 2026,
    totalGames: games.length,
    usableGames,
    usableHalfInnings,
    failedHalfInnings,
    totalObservations,
    cells,
  };
}

// ---------------------------------------------------------------------------
// Pretty printer for CLI output
// ---------------------------------------------------------------------------

export function printMatrix(matrix: RE24Matrix): void {
  console.log(`\nRE24 Matrix — ${matrix.conferenceIds.join("+") || "pooled"} ${matrix.season}`);
  console.log(`Games: ${matrix.usableGames}/${matrix.totalGames} usable`);
  console.log(`Half-innings: ${matrix.usableHalfInnings} usable / ${matrix.failedHalfInnings} failed`);
  console.log(`Observations: ${matrix.totalObservations}\n`);

  // Table header
  console.log("Base State | 0 outs       | 1 out        | 2 outs");
  console.log("-----------|--------------|--------------|-------------");

  for (const base of ALL_BASE_STATES) {
    const cells = ALL_OUTS.map((outs) => {
      const cell = matrix.cells.find((c) => c.baseState === base && c.outs === outs);
      if (!cell || cell.n === 0) return "   —   (n=0)";
      return `${cell.avgRunsToEnd.toFixed(3).padStart(5)} (n=${cell.n})`;
    });
    console.log(`    ${base}    | ${cells[0]!.padEnd(12)} | ${cells[1]!.padEnd(12)} | ${cells[2]}`);
  }
  console.log("");
}
