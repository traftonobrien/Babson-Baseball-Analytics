import {
  discoverProgramScheduleGames,
  type SidearmBaseballProgram,
  type SidearmScheduleGame,
} from "./scraper.ts";
import { getSidearmConferenceDefinition } from "./registry.ts";

export interface CanonicalGameSource {
  programId: string;
  programSchool: string;
  url: string;
  opponent: string | null;
  date: string | null;
  timeLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  gameNumber: number | null;
  dedupKey: string;
}

export interface CanonicalGameIndexEntry {
  canonicalGameId: string;
  dedupKey: string;
  date: string | null;
  timeLabel: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  gameNumber: number | null;
  sourceCount: number;
  sourceProgramIds: string[];
  sources: CanonicalGameSource[];
}

export interface CanonicalGameIndex {
  generatedAt: string;
  season: number;
  conferenceId: string;
  conferenceName: string;
  totalPrograms: number;
  totalGames: number;
  games: CanonicalGameIndexEntry[];
}

export function buildCanonicalGameId(game: {
  dedupKey: string;
  date: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  gameNumber: number | null;
}): string {
  if (!game.date || !game.homeTeam || !game.awayTeam) {
    return `fallback__${sanitizeSegment(game.dedupKey)}`;
  }

  return [
    game.date,
    slugifyTeamLabel(game.awayTeam),
    "at",
    slugifyTeamLabel(game.homeTeam),
    `g${game.gameNumber ?? 1}`,
  ].join("__");
}

export function buildCanonicalGameIndexFromScheduleGames(
  games: SidearmScheduleGame[],
): CanonicalGameIndexEntry[] {
  const grouped = new Map<string, CanonicalGameSource[]>();

  for (const game of games) {
    const source: CanonicalGameSource = {
      programId: game.programId,
      programSchool: game.programSchool,
      url: game.url,
      opponent: game.opponent,
      date: game.date,
      timeLabel: game.timeLabel,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      gameNumber: game.gameNumber,
      dedupKey: game.dedupKey,
    };

    const bucket = grouped.get(game.dedupKey);
    if (bucket) {
      bucket.push(source);
    } else {
      grouped.set(game.dedupKey, [source]);
    }
  }

  return [...grouped.entries()]
    .map(([dedupKey, sources]) => {
      const sortedSources = sources
        .slice()
        .sort((left, right) =>
          left.programId.localeCompare(right.programId) || left.url.localeCompare(right.url));
      const representative = sortedSources[0]!;
      const sourceProgramIds = [...new Set(sortedSources.map((source) => source.programId))].sort();

      return {
        canonicalGameId: buildCanonicalGameId({
          dedupKey,
          date: representative.date,
          homeTeam: representative.homeTeam,
          awayTeam: representative.awayTeam,
          gameNumber: representative.gameNumber,
        }),
        dedupKey,
        date: representative.date,
        timeLabel: representative.timeLabel,
        homeTeam: representative.homeTeam,
        awayTeam: representative.awayTeam,
        gameNumber: representative.gameNumber,
        sourceCount: sortedSources.length,
        sourceProgramIds,
        sources: sortedSources,
      };
    })
    .sort((left, right) =>
      compareNullable(left.date, right.date)
      || compareNullableNumber(left.gameNumber, right.gameNumber)
      || compareNullable(left.timeLabel, right.timeLabel)
      || compareNullable(left.homeTeam, right.homeTeam)
      || compareNullable(left.awayTeam, right.awayTeam)
      || left.canonicalGameId.localeCompare(right.canonicalGameId));
}

export async function buildConferenceCanonicalGameIndex(
  conferenceId: string,
  season: number,
): Promise<CanonicalGameIndex> {
  const conference = getSidearmConferenceDefinition(conferenceId);
  return buildCanonicalGameIndexForConference({
    id: conference.id,
    name: conference.name,
    programs: conference.programs,
  }, season);
}

export async function buildCanonicalGameIndexForConference(
  conference: {
    id: string;
    name: string;
    programs: SidearmBaseballProgram[];
  },
  season: number,
): Promise<CanonicalGameIndex> {
  const programs: SidearmBaseballProgram[] = conference.programs;
  const games: SidearmScheduleGame[] = [];

  for (const program of programs) {
    const scheduleGames = await discoverProgramScheduleGames(program, season);
    games.push(...scheduleGames);
  }

  const entries = buildCanonicalGameIndexFromScheduleGames(games);

  return {
    generatedAt: new Date().toISOString(),
    season,
    conferenceId: conference.id,
    conferenceName: conference.name,
    totalPrograms: programs.length,
    totalGames: entries.length,
    games: entries,
  };
}

export async function buildNewmacCanonicalGameIndex(
  season: number,
): Promise<CanonicalGameIndex> {
  return buildConferenceCanonicalGameIndex("newmac", season);
}

function slugifyTeamLabel(label: string): string {
  return sanitizeSegment(label);
}

function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
}
