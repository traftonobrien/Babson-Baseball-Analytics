import type {
  CanonicalGameIndex,
  CanonicalGameIndexEntry,
} from "./gameIndex.ts";
import type {
  PbpCorpusFile,
  PbpCorpusGame,
} from "./pbpFetch.ts";

export interface PooledCanonicalGameIndex {
  generatedAt: string;
  season: number;
  poolId: string;
  conferenceIds: string[];
  conferenceNames: string[];
  totalPrograms: number;
  totalGames: number;
  games: CanonicalGameIndexEntry[];
}

export interface PooledPbpCorpusFile {
  generatedAt: string;
  season: number;
  poolId: string;
  conferenceIds: string[];
  conferenceNames: string[];
  totalPrograms: number;
  totalGames: number;
  parsedGames: number;
  failedGames: number;
  totalHalfInnings: number;
  failureReasons: Record<string, number>;
  games: PbpCorpusGame[];
}

export function buildPooledCanonicalGameIndex(
  poolId: string,
  indexes: CanonicalGameIndex[],
): PooledCanonicalGameIndex {
  const gamesById = new Map<string, CanonicalGameIndexEntry>();

  for (const index of indexes) {
    for (const game of index.games) {
      const existing = gamesById.get(game.canonicalGameId);
      if (!existing) {
        gamesById.set(game.canonicalGameId, game);
        continue;
      }

      gamesById.set(game.canonicalGameId, mergeCanonicalGameEntries(existing, game));
    }
  }

  const games = [...gamesById.values()].sort((left, right) =>
    left.canonicalGameId.localeCompare(right.canonicalGameId));

  return {
    generatedAt: new Date().toISOString(),
    season: indexes[0]?.season ?? new Date().getFullYear(),
    poolId,
    conferenceIds: indexes.map((index) => index.conferenceId),
    conferenceNames: indexes.map((index) => index.conferenceName),
    totalPrograms: indexes.reduce((sum, index) => sum + index.totalPrograms, 0),
    totalGames: games.length,
    games,
  };
}

export function buildPooledPbpCorpus(
  poolId: string,
  corpora: PbpCorpusFile[],
): PooledPbpCorpusFile {
  const gamesById = new Map<string, PbpCorpusGame>();
  const failureReasons = new Map<string, number>();

  for (const corpus of corpora) {
    for (const game of corpus.games) {
      const existing = gamesById.get(game.canonicalGameId);
      if (!existing) {
        gamesById.set(game.canonicalGameId, game);
      } else {
        gamesById.set(game.canonicalGameId, mergePbpCorpusGames(existing, game));
      }
    }

    for (const [reason, count] of Object.entries(corpus.failureReasons)) {
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + count);
    }
  }

  const games = [...gamesById.values()].sort((left, right) =>
    left.canonicalGameId.localeCompare(right.canonicalGameId));
  const parsedGames = games.filter((game) => game.status === "parsed").length;
  const totalHalfInnings = games.reduce(
    (sum, game) => sum + (game.rawGame?.halfInnings.length ?? 0),
    0,
  );

  return {
    generatedAt: new Date().toISOString(),
    season: corpora[0]?.season ?? new Date().getFullYear(),
    poolId,
    conferenceIds: corpora.map((corpus) => corpus.conferenceId),
    conferenceNames: corpora.map((corpus) => corpus.conferenceName),
    totalPrograms: corpora.reduce((sum, corpus) => sum + corpus.totalPrograms, 0),
    totalGames: games.length,
    parsedGames,
    failedGames: games.length - parsedGames,
    totalHalfInnings,
    failureReasons: Object.fromEntries(
      [...failureReasons.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    games,
  };
}

function mergeCanonicalGameEntries(
  left: CanonicalGameIndexEntry,
  right: CanonicalGameIndexEntry,
): CanonicalGameIndexEntry {
  const sourcesByUrl = new Map(
    [...left.sources, ...right.sources].map((source) => [source.url, source]),
  );

  return {
    ...left,
    sourceCount: sourcesByUrl.size,
    sourceProgramIds: [...new Set([...left.sourceProgramIds, ...right.sourceProgramIds])].sort(),
    sources: [...sourcesByUrl.values()].sort((a, b) => a.url.localeCompare(b.url)),
  };
}

function mergePbpCorpusGames(
  left: PbpCorpusGame,
  right: PbpCorpusGame,
): PbpCorpusGame {
  if (left.status === "parsed") {
    return {
      ...left,
      fetchAttempts: mergeFetchAttempts(left.fetchAttempts, right.fetchAttempts),
    };
  }

  if (right.status === "parsed") {
    return {
      ...right,
      fetchAttempts: mergeFetchAttempts(left.fetchAttempts, right.fetchAttempts),
    };
  }

  return {
    ...left,
    fetchAttempts: mergeFetchAttempts(left.fetchAttempts, right.fetchAttempts),
    failureReason: left.failureReason ?? right.failureReason,
  };
}

function mergeFetchAttempts<
  T extends { url: string; selected: boolean },
>(left: T[], right: T[]): T[] {
  const attemptsByUrl = new Map<string, T>();

  for (const attempt of [...left, ...right]) {
    const existing = attemptsByUrl.get(attempt.url);
    if (!existing || attempt.selected) {
      attemptsByUrl.set(attempt.url, attempt);
    }
  }

  return [...attemptsByUrl.values()].sort((a, b) => a.url.localeCompare(b.url));
}
