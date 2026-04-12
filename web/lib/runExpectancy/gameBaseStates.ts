/**
 * Game base-state index builder — Phase 23-01.
 *
 * Converts the Phase 21 PBP corpus into a flat array of PA-level records,
 * each keyed by (gameId, inning, halfInning, paIndex) so charted 0-2 fastball
 * PAs can be joined to a base-state and outs context for delta-RE computation.
 */

import type {
  BaseStateCode,
  GameBaseStatesIndex,
  HalfInningSide,
  OutsCount,
  PaBaseStateRecord,
  ParsedPbpHalfInning,
  SeasonRunExpectancyCorpus,
} from "./types";
import { baseStateCode, isValidOuts } from "./reMatrix";

// ---------------------------------------------------------------------------
// Core extraction
// ---------------------------------------------------------------------------

/**
 * Extracts PA base-state records from a single usable half-inning.
 *
 * @param halfInning - A validated, usable half-inning from the PBP corpus.
 * @param gameId - Sidearm game ID (from re_game_map.json).
 * @param date - ISO date string (e.g., "2026-02-14").
 * @param opponent - Opponent team name.
 * @param homeAway - Whether Babson was home or away.
 * @param suffix - Doubleheader suffix (null for single games).
 */
export function extractHalfInningPas(
  halfInning: ParsedPbpHalfInning,
  gameId: string,
  date: string,
  opponent: string,
  homeAway: "home" | "away",
  suffix: string | null,
): PaBaseStateRecord[] {
  const records: PaBaseStateRecord[] = [];
  const plays = halfInning.plays.filter((p) => !p.ignored);

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i];

    if (!isValidOuts(play.outsBefore) || !isValidOuts(play.outsAfter)) {
      continue;
    }

    const bsBeforeCode = baseStateCode(
      play.baseStateBefore.first,
      play.baseStateBefore.second,
      play.baseStateBefore.third,
    );
    const bsAfterCode = baseStateCode(
      play.baseStateAfter.first,
      play.baseStateAfter.second,
      play.baseStateAfter.third,
    );

    records.push({
      gameId,
      date,
      opponent,
      homeAway,
      suffix,
      inning: halfInning.rawHalfInning.inning,
      halfInning: halfInning.rawHalfInning.halfInning as HalfInningSide,
      paIndex: i,
      baseStateBefore: bsBeforeCode as BaseStateCode,
      outsBefore: play.outsBefore as OutsCount,
      baseStateAfter: bsAfterCode as BaseStateCode,
      outsAfter: play.outsAfter as OutsCount,
      runsScored: play.runsScored,
      count: play.count,
      pitchSequence: play.pitchSequence,
    });
  }

  return records;
}

/**
 * Builds the full flat PA index from a season corpus.
 * Only games with a parsedGame (i.e., fetchable) and metadata (i.e., in
 * re_game_map.json) contribute records. Only usableHalfInnings are included.
 */
export function buildGameBaseStatesIndex(
  corpus: SeasonRunExpectancyCorpus,
  season: number,
): GameBaseStatesIndex {
  const pas: PaBaseStateRecord[] = [];
  let totalGames = 0;

  for (const gameResult of corpus.games) {
    const { parsedGame, metadata } = gameResult;
    if (!parsedGame || !metadata) continue;

    totalGames++;

    for (const halfInning of parsedGame.usableHalfInnings) {
      const records = extractHalfInningPas(
        halfInning,
        metadata.gameId,
        metadata.date,
        metadata.opponent,
        metadata.homeAway,
        metadata.suffix,
      );
      pas.push(...records);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    season,
    totalGames,
    totalPas: pas.length,
    pas,
  };
}

// ---------------------------------------------------------------------------
// Lookup helper (used by 23-02 delta-RE join)
// ---------------------------------------------------------------------------

export type PaLookupKey = string;

/**
 * Builds a Map from a lookup key to PaBaseStateRecord, for O(1) joins.
 *
 * The key format is: `${gameId}|${inning}|${halfInning}|${paIndex}`
 *
 * Callers use `makePaLookupKey()` to construct keys for both indexing and
 * querying, so the format is defined in one place.
 */
export function buildPaLookupMap(
  index: GameBaseStatesIndex,
): Map<PaLookupKey, PaBaseStateRecord> {
  const map = new Map<PaLookupKey, PaBaseStateRecord>();
  for (const pa of index.pas) {
    map.set(makePaLookupKey(pa.gameId, pa.inning, pa.halfInning, pa.paIndex), pa);
  }
  return map;
}

export function makePaLookupKey(
  gameId: string,
  inning: number,
  halfInning: HalfInningSide,
  paIndex: number,
): PaLookupKey {
  return `${gameId}|${inning}|${halfInning}|${paIndex}`;
}
