import { createHash } from "node:crypto";
import type {
  CanonicalGameIndex,
  CanonicalGameIndexEntry,
  CanonicalGameSource,
} from "./gameIndex.ts";
import {
  parseRawPbpGameFromHtml,
  type RawPbpGame,
} from "./pbpParser.ts";

const REQUEST_TIMEOUT_MS = 15000;

export interface PbpFetchAttempt {
  url: string;
  programId: string;
  programSchool: string;
  ok: boolean;
  statusCode: number | null;
  error: string | null;
  htmlBytes: number | null;
  htmlHash: string | null;
  halfInningsFound: number;
  selected: boolean;
}

export interface PbpCorpusGame {
  canonicalGameId: string;
  dedupKey: string;
  date: string | null;
  timeLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  gameNumber: number | null;
  sourceCount: number;
  sourceProgramIds: string[];
  selectedSourceUrl: string | null;
  selectedSourceProgramId: string | null;
  selectedHtmlHash: string | null;
  status: "parsed" | "failed";
  failureReason: string | null;
  fetchAttempts: PbpFetchAttempt[];
  rawGame: RawPbpGame | null;
}

export interface PbpCorpusFile {
  generatedAt: string;
  season: number;
  conferenceId: string;
  conferenceName: string;
  totalPrograms: number;
  totalGames: number;
  parsedGames: number;
  failedGames: number;
  totalHalfInnings: number;
  failureReasons: Record<string, number>;
  games: PbpCorpusGame[];
}

export async function fetchCanonicalGamePbp(
  game: CanonicalGameIndexEntry,
): Promise<PbpCorpusGame> {
  const fetchAttempts: PbpFetchAttempt[] = [];
  let selectedRawGame: RawPbpGame | null = null;
  let selectedSource: CanonicalGameSource | null = null;
  let selectedHtmlHash: string | null = null;

  for (const source of game.sources) {
    const attempt = await fetchPbpFromSource(source);
    fetchAttempts.push(attempt.attempt);

    if (attempt.rawGame && attempt.rawGame.halfInnings.length > 0) {
      selectedRawGame = attempt.rawGame;
      selectedSource = source;
      selectedHtmlHash = attempt.attempt.htmlHash;
      attempt.attempt.selected = true;
      break;
    }
  }

  const failureReason = selectedRawGame
    ? null
    : inferFailureReason(fetchAttempts);

  return {
    canonicalGameId: game.canonicalGameId,
    dedupKey: game.dedupKey,
    date: game.date,
    timeLabel: game.timeLabel,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    gameNumber: game.gameNumber,
    sourceCount: game.sourceCount,
    sourceProgramIds: game.sourceProgramIds,
    selectedSourceUrl: selectedSource?.url ?? null,
    selectedSourceProgramId: selectedSource?.programId ?? null,
    selectedHtmlHash,
    status: selectedRawGame ? "parsed" : "failed",
    failureReason,
    fetchAttempts,
    rawGame: selectedRawGame,
  };
}

export async function buildPbpCorpusFromIndex(
  index: CanonicalGameIndex,
): Promise<PbpCorpusFile> {
  const failureReasons = new Map<string, number>();
  const games: PbpCorpusGame[] = [];
  let parsedGames = 0;
  let totalHalfInnings = 0;

  for (const game of index.games) {
    const corpusGame = await fetchCanonicalGamePbp(game);
    games.push(corpusGame);

    if (corpusGame.status === "parsed" && corpusGame.rawGame) {
      parsedGames += 1;
      totalHalfInnings += corpusGame.rawGame.halfInnings.length;
    } else {
      const reason = corpusGame.failureReason ?? "Unknown PBP fetch failure";
      failureReasons.set(reason, (failureReasons.get(reason) ?? 0) + 1);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    season: index.season,
    conferenceId: index.conferenceId,
    conferenceName: index.conferenceName,
    totalPrograms: index.totalPrograms,
    totalGames: index.totalGames,
    parsedGames,
    failedGames: index.totalGames - parsedGames,
    totalHalfInnings,
    failureReasons: Object.fromEntries(
      [...failureReasons.entries()].sort(([left], [right]) => left.localeCompare(right)),
    ),
    games,
  };
}

async function fetchPbpFromSource(
  source: CanonicalGameSource,
): Promise<{ attempt: PbpFetchAttempt; rawGame: RawPbpGame | null }> {
  try {
    const response = await fetch(source.url, {
      headers: {
        "User-Agent": "BabsonAnalytics/1.0 (internal tool)",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      return {
        attempt: {
          url: source.url,
          programId: source.programId,
          programSchool: source.programSchool,
          ok: false,
          statusCode: response.status,
          error: `HTTP ${response.status}`,
          htmlBytes: null,
          htmlHash: null,
          halfInningsFound: 0,
          selected: false,
        },
        rawGame: null,
      };
    }

    const html = await response.text();
    const rawGame = parseRawPbpGameFromHtml(html, source.url);

    return {
      attempt: {
        url: source.url,
        programId: source.programId,
        programSchool: source.programSchool,
        ok: true,
        statusCode: response.status,
        error: null,
        htmlBytes: Buffer.byteLength(html, "utf8"),
        htmlHash: createHash("sha256").update(html).digest("hex"),
        halfInningsFound: rawGame.halfInnings.length,
        selected: false,
      },
      rawGame,
    };
  } catch (error) {
    return {
      attempt: {
        url: source.url,
        programId: source.programId,
        programSchool: source.programSchool,
        ok: false,
        statusCode: null,
        error: error instanceof Error ? error.message : String(error),
        htmlBytes: null,
        htmlHash: null,
        halfInningsFound: 0,
        selected: false,
      },
      rawGame: null,
    };
  }
}

function inferFailureReason(fetchAttempts: PbpFetchAttempt[]): string {
  if (fetchAttempts.length === 0) {
    return "No source URLs available";
  }

  const successfulWithoutPbp = fetchAttempts.find((attempt) => attempt.ok && attempt.halfInningsFound === 0);
  if (successfulWithoutPbp) {
    return "Fetched HTML but found no play-by-play tables";
  }

  return fetchAttempts.at(-1)?.error ?? "Unknown PBP fetch failure";
}
