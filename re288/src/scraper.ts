/**
 * Scrapes play-by-play (PBP) data from babsonathletics.com box score pages
 * and extracts balls-in-play events for Babson hitters.
 *
 * The PBP section uses Sidearm Sports markup. The actual play text lives inside
 * the play-by-play tab's HTML, which we need to parse from the full page.
 */

import type { SprayChartEvent, SprayChartGame } from "./types.ts";
import newmacBaseballPrograms from "../config/data_sources/newmac_baseball_programs.json" with { type: "json" };
import {
  classifyBattedBallType,
  classifyHitResult,
  classifyZone,
  totalBasesForResult,
  isHitResult,
  extractRbi,
  extractCountAndSequence,
} from "./zoneMapper.ts";

export interface SidearmBaseballProgram {
  id: string;
  school: string;
  nickname: string;
  aliases: string[];
  conference: string;
  provider: "sidearm";
  baseUrl: string;
  schedulePathTemplate: string;
}

export interface SidearmScheduleGame {
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

export const NEWMAC_BASEBALL_PROGRAMS = newmacBaseballPrograms as SidearmBaseballProgram[];
export const BABSON_BASEBALL_PROGRAM =
  NEWMAC_BASEBALL_PROGRAMS.find((program) => program.id === "babson")
  ?? NEWMAC_BASEBALL_PROGRAMS[0]!;

// ── HTML fetch + PBP extraction ───────────────────────────────────────

/**
 * Fetches the boxscore HTML and extracts the play-by-play text blocks.
 * Returns an array of play description strings for Babson batting halves.
 */
export async function fetchPlayByPlayHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "BabsonAnalytics/1.0 (internal tool)",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} fetching ${url}`);
  }
  return response.text();
}

/**
 * Extracts individual play text lines from the box score HTML.
 *
 * Sidearm Sports renders each play inside a `<td>` cell that optionally
 * contains a `<span>` with the inning prefix (e.g. "2nd - "). The play
 * text itself is raw text content inside the same `<td>`. The HTML uses
 * `\r\n` line endings, so we normalize those first.
 */
export function extractPlayLines(
  html: string,
  options?: { dedupe?: boolean },
): string[] {
  // Normalize line endings
  const normalized = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Isolate the PBP section. The page contains "play-by-play" both as
  // nav links (early) and as the actual data section (later). The data
  // section starts at the <h3>Play By Play</h3> heading. Use the LAST
  // "composite-stats" as the end boundary. If a subsection/table HTML
  // is passed in directly, operate on that chunk instead.
  const pbpStart = normalized.indexOf("Play By Play</h3>");
  const pbpEnd = normalized.lastIndexOf("composite-stats");
  const pbpHtml = pbpStart === -1
    ? normalized
    : pbpEnd > pbpStart
      ? normalized.substring(pbpStart, pbpEnd)
      : normalized.substring(pbpStart, pbpStart + 200000);

  const plays: string[] = [];

  // Match each <td> block — allow newlines inside by using [^] (any char)
  const tdRegex = /<td\b[^>]*>([^]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = tdRegex.exec(pbpHtml)) !== null) {
    const raw = match[1] ?? "";
    const text = stripHtml(raw).trim();
    if (text.length > 15 && isPlayDescription(text)) {
      plays.push(text);
    }
  }

  if (options?.dedupe === false) {
    return plays;
  }

  // Deduplicate — the full page often repeats plays in desktop/mobile views
  return [...new Set(plays)];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Quick check if a text string looks like a PBP action description.
 */
function isPlayDescription(text: string): boolean {
  // Must contain a player-like name followed by an action verb
  return /\b(singled|doubled|tripled|homered|grounded|flied|lined|popped|reached|walked|struck out|hit by pitch|stole|advanced|scored|out at|picked off|caught stealing)/i.test(text);
}

// ── Parse plays for a single game ─────────────────────────────────────

/**
 * Determines if a play line is for a Babson batter based on the inning context.
 * In home games Babson bats bottom, in away games Babson bats top.
 * We detect this from the page's team ordering.
 */
function extractBatterName(playText: string): string | null {
  // PBP format: "FirstName LastName action..."
  // But sometimes it's "LastName, FirstName action..."
  // The babsonathletics format uses "FirstName LastName"
  const match = playText.match(
    /^([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)+)\s+(?:singled|doubled|tripled|homered|grounded|flied|lined|popped|reached|hit into|bunted|fouled)/
  );
  return match ? match[1]!.trim() : null;
}

// ── Main scrape function ──────────────────────────────────────────────

export interface ScrapeResult {
  gameId: string;
  date: string;
  opponent: string;
  url: string;
  events: SprayChartEvent[];
  totalPlays: number;
  babsonBipCount: number;
}

/**
 * Scrapes a single box score page and returns BIP events for Babson hitters.
 * Uses the local players.json roster to identify Babson batters.
 */
export async function scrapeBoxScore(
  url: string,
  babsonRoster: Set<string>,
): Promise<ScrapeResult> {
  const html = await fetchPlayByPlayHtml(url);

  // Extract game metadata
  const gameId = url.match(/boxscore\/(\d+)/)?.[1] ?? "unknown";
  const opponentSlug = url.match(/stats\/\d{4}\/([^/]+)\//)?.[1] ?? "unknown";
  const opponent = opponentSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^\s*-?\d+-?\s*/, ""); // strip leading rank numbers

  // Extract date from the page title or meta
  const dateMatch = html.match(
    /on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );
  const date = dateMatch
    ? `${dateMatch[3]}-${dateMatch[1]!.padStart(2, "0")}-${dateMatch[2]!.padStart(2, "0")}`
    : "2026-01-01";

  const playLines = extractPlayLines(html);

  const events: SprayChartEvent[] = [];
  let currentInning = 1;

  for (const line of playLines) {
    // Track inning changes
    const inningMatch = line.match(/^(\d+)(?:st|nd|rd|th)\s+inning/i);
    if (inningMatch) {
      currentInning = parseInt(inningMatch[1]!, 10);
      continue;
    }

    // Try to parse as a BIP event
    const batterName = extractBatterName(line);
    if (!batterName) continue;

    // Only track Babson hitters
    if (!isBabsonPlayer(batterName, babsonRoster)) continue;

    const result = classifyHitResult(line);
    if (result === null) continue; // not a BIP (walk, K, HBP, etc.)

    const zone = classifyZone(line);
    if (zone === null) continue; // couldn't determine zone

    const { count, pitchSequence } = extractCountAndSequence(line);

    events.push({
      batter: batterName,
      result,
      battedBallType: classifyBattedBallType(line),
      zone,
      isHit: isHitResult(result),
      totalBases: totalBasesForResult(result),
      rbi: extractRbi(line),
      inning: currentInning,
      gameDate: date,
      opponent,
      isHomeRun: result === "home_run",
      count,
      pitchSequence,
    });
  }

  return {
    gameId,
    date,
    opponent,
    url,
    events,
    totalPlays: playLines.length,
    babsonBipCount: events.length,
  };
}

// ── Roster from local data files ──────────────────────────────────────

interface PlayersJsonEntry {
  slug: string;
  name: string;
  team: string;
  role: string;
}

/**
 * Loads the Babson roster from multiple local data sources.
 * Combines players.json (pitcher-heavy) and roster.json (full team)
 * to build a comprehensive set of last names for matching.
 */
export function loadBabsonRoster(dataDir: string): Set<string> {
  const names = new Set<string>();

  // 1. players.json — has display names like "Bobby Burk"
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const players: PlayersJsonEntry[] = require(`${dataDir}/players.json`);
    for (const p of players) {
      addPlayerName(names, p.name);
    }
  } catch { /* file may not exist */ }

  // 2. roster.json — has keys like "teator_zander"
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const roster: Record<string, unknown> = require(`${dataDir}/roster.json`);
    for (const key of Object.keys(roster)) {
      // Convert "teator_zander" → "Zander Teator" (first last)
      const parts = key.split("_");
      if (parts.length >= 2) {
        const displayName = parts
          .reverse()
          .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
          .join(" ");
        addPlayerName(names, displayName);
      }
    }
  } catch { /* file may not exist */ }

  return names;
}

function addPlayerName(set: Set<string>, displayName: string) {
  set.add(displayName.toLowerCase());
  const parts = displayName.split(" ");
  if (parts.length >= 2) {
    set.add(parts[parts.length - 1]!.toLowerCase());
  }
}

/**
 * Supplements the roster with names extracted from the boxscore HTML.
 * This catches players not in local data files (mid-season additions, etc.)
 */
export function supplementRosterFromHtml(html: string, roster: Set<string>): void {
  const rosterLinkPattern = /roster\/([a-z][a-z'-]+(?:-[a-z][a-z'-]+)+)\/\d+/gi;
  for (const match of html.matchAll(rosterLinkPattern)) {
    const slug = match[1]!;
    const name = slug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    addPlayerName(roster, name);
  }
}

/**
 * Check if a batter name from PBP text matches a Babson roster entry.
 * Matches by full name OR last name.
 */
function isBabsonPlayer(pbpName: string, roster: Set<string>): boolean {
  const normalized = pbpName.toLowerCase().trim();
  if (roster.has(normalized)) return true;

  // Check last name match
  const parts = normalized.split(" ");
  if (parts.length >= 2) {
    const lastName = parts[parts.length - 1]!;
    if (roster.has(lastName)) return true;
  }
  return false;
}

// ── Schedule URL discovery ────────────────────────────────────────────

export function buildScheduleUrl(
  program: SidearmBaseballProgram,
  season: number,
): string {
  return `${program.baseUrl.replace(/\/$/, "")}${program.schedulePathTemplate.replace(
    "{season}",
    String(season),
  )}`;
}

export function extractBoxScoreUrlsFromScheduleHtml(
  html: string,
  baseUrl: string,
): string[] {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const escapedBaseUrl = escapeRegExp(normalizedBaseUrl);
  const urls = new Set<string>();

  const absolutePattern = new RegExp(
    `${escapedBaseUrl}\\/sports\\/baseball\\/stats\\/\\d{4}\\/[^"'\\s)]+\\/boxscore\\/\\d+`,
    "g",
  );
  for (const match of html.matchAll(absolutePattern)) {
    urls.add(match[0]);
  }

  const relativePattern = /\/sports\/baseball\/stats\/\d{4}\/[^"'\s)]+\/boxscore\/\d+/g;
  for (const match of html.matchAll(relativePattern)) {
    urls.add(`${normalizedBaseUrl}${match[0]}`);
  }

  const hrefPattern = /href="([^"]*boxscore\/\d+(?:\?[^"]*)?)"/g;
  for (const match of html.matchAll(hrefPattern)) {
    const href = match[1]!;
    const cleanedHref = href.replace(/\?.*$/, "");
    urls.add(cleanedHref.startsWith("http") ? cleanedHref : `${normalizedBaseUrl}${cleanedHref}`);
  }

  return [...urls].sort();
}

export function extractScheduleGamesFromHtml(
  html: string,
  program: SidearmBaseballProgram,
): SidearmScheduleGame[] {
  const normalizedBaseUrl = program.baseUrl.replace(/\/$/, "");
  const games = new Map<string, Omit<SidearmScheduleGame, "dedupKey" | "gameNumber">>();
  const linkPattern = /<a\b[^>]*href="([^"]*boxscore\/\d+(?:\?[^"]*)?)"[^>]*aria-label="([^"]+)"[^>]*>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1] ?? "";
    const ariaLabel = stripHtml(match[2] ?? "");
    const cleanedHref = href.replace(/\?.*$/, "");
    const url = cleanedHref.startsWith("http")
      ? cleanedHref
      : `${normalizedBaseUrl}${cleanedHref}`;
    const parsed = parseScheduleAriaLabel(ariaLabel, program);

    const game: Omit<SidearmScheduleGame, "dedupKey" | "gameNumber"> = {
      programId: program.id,
      programSchool: program.school,
      url,
      opponent: parsed?.opponent ?? null,
      date: parsed?.date ?? null,
      timeLabel: parsed?.timeLabel ?? null,
      homeTeam: parsed?.homeTeam ?? null,
      awayTeam: parsed?.awayTeam ?? null,
    };

    games.set(game.url, game);
  }

  if (games.size > 0) {
    return assignScheduleIdentity([...games.values()]);
  }

  return extractBoxScoreUrlsFromScheduleHtml(html, normalizedBaseUrl).map((url) => ({
    programId: program.id,
    programSchool: program.school,
    url,
    opponent: null,
    date: null,
    timeLabel: null,
    homeTeam: null,
    awayTeam: null,
    gameNumber: null,
    dedupKey: `url:${url}`,
  }));
}

/**
 * Fetches the Babson baseball schedule page and extracts all box score URLs.
 */
export async function discoverGameUrls(season: number = 2026): Promise<string[]> {
  const urls = await discoverProgramGameUrls(BABSON_BASEBALL_PROGRAM, season);
  if (urls.length > 0) {
    return urls;
  }

  return KNOWN_2026_GAME_URLS;
}

export async function discoverProgramGameUrls(
  program: SidearmBaseballProgram,
  season: number = 2026,
): Promise<string[]> {
  return (await discoverProgramScheduleGames(program, season)).map((game) => game.url);
}

export async function discoverProgramScheduleGames(
  program: SidearmBaseballProgram,
  season: number = 2026,
): Promise<SidearmScheduleGame[]> {
  const scheduleUrl = buildScheduleUrl(program, season);

  try {
    const response = await fetch(scheduleUrl, {
      headers: { "User-Agent": "BabsonAnalytics/1.0 (internal tool)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const games = extractScheduleGamesFromHtml(html, program);
    if (games.length > 0) return games;
  } catch (err) {
    console.warn(`  ⚠️  Schedule fetch failed for ${program.school}:`, err);
  }

  return [];
}

export async function discoverConferenceGameUrls(
  programs: SidearmBaseballProgram[],
  season: number = 2026,
): Promise<string[]> {
  return (await discoverConferenceScheduleGames(programs, season)).map((game) => game.url);
}

export async function discoverConferenceScheduleGames(
  programs: SidearmBaseballProgram[],
  season: number = 2026,
): Promise<SidearmScheduleGame[]> {
  const gamesByKey = new Map<string, SidearmScheduleGame>();

  for (const program of programs) {
    const scheduleGames = await discoverProgramScheduleGames(program, season);
    for (const game of scheduleGames) {
      const existing = gamesByKey.get(game.dedupKey);
      if (!existing || game.url < existing.url) {
        gamesByKey.set(game.dedupKey, game);
      }
    }
  }

  return [...gamesByKey.values()].sort((left, right) => left.dedupKey.localeCompare(right.dedupKey));
}

export async function discoverNewmacGameUrls(season: number = 2026): Promise<string[]> {
  return discoverConferenceGameUrls(NEWMAC_BASEBALL_PROGRAMS, season);
}

export async function discoverNewmacScheduleGames(
  season: number = 2026,
): Promise<SidearmScheduleGame[]> {
  return discoverConferenceScheduleGames(NEWMAC_BASEBALL_PROGRAMS, season);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseScheduleAriaLabel(
  ariaLabel: string,
  program: SidearmBaseballProgram,
): {
  opponent: string;
  date: string;
  timeLabel: string | null;
  homeTeam: string;
  awayTeam: string;
} | null {
  const normalizedLabel = ariaLabel.trim();
  const match = normalizedLabel.match(
    /^Box score of Baseball\s+(at|vs\.?)\s+(.+?)\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})(?:\s+at\s+(.+))?$/i,
  );
  if (!match) {
    return null;
  }

  const locationWord = match[1]!.toLowerCase();
  const opponent = canonicalizeTeamLabel(match[2]!.trim());
  const date = parseScheduleDate(match[3]!.trim());
  const timeLabel = canonicalizeTimeLabel(match[4]?.trim() ?? null);
  const isAway = locationWord === "at";
  const homeTeam = canonicalizeTeamLabel(isAway ? opponent : program.school);
  const awayTeam = canonicalizeTeamLabel(isAway ? program.school : opponent);

  return {
    opponent,
    date,
    timeLabel,
    homeTeam,
    awayTeam,
  };
}

function parseScheduleDate(rawDate: string): string {
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return rawDate;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function canonicalizeTeamLabel(label: string): string {
  const normalized = normalizeTeamKey(label);
  const matchedProgram = NEWMAC_BASEBALL_PROGRAMS.find((program) =>
    [program.school, ...program.aliases].some((alias) => normalizeTeamKey(alias) === normalized),
  );
  return matchedProgram?.school ?? stripRankingTokens(label).replace(/\s+/g, " ").trim();
}

function normalizeTeamKey(label: string): string {
  return stripRankingTokens(label)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()]/g, " ")
    .replace(/&/g, " and ")
    .replace(/\bst[.]?\b/g, "saint")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeTimeKey(timeLabel: string | null): string {
  const canonical = canonicalizeTimeLabel(timeLabel);
  return canonical
    ? canonical.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
    : "notime";
}

function canonicalizeTimeLabel(timeLabel: string | null): string | null {
  if (!timeLabel) {
    return null;
  }

  const normalized = timeLabel
    .trim()
    .toLowerCase()
    .replace(/\b(?:et|est|edt|ct|cst|cdt|mt|mst|mdt|pt|pst|pdt)\b/g, " ")
    .replace(/\s*\/\s*.*$/, "")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return null;
  }

  if (normalized === "noon") {
    return "12:00 PM";
  }

  if (normalized === "midnight") {
    return "12:00 AM";
  }

  const timeMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (!timeMatch) {
    return timeLabel.replace(/\s+/g, " ").trim();
  }

  const hour = Number.parseInt(timeMatch[1]!, 10);
  const minute = Number.parseInt(timeMatch[2] ?? "00", 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return timeLabel.replace(/\s+/g, " ").trim();
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${timeMatch[3]!.toUpperCase()}`;
}

function stripRankingTokens(label: string): string {
  return label
    .replace(/#[0-9]+(?:\s*\/\s*[0-9]+)?/g, " ")
    .replace(/\b[0-9]+\s*\/\s*[0-9]+\b/g, " ")
    .replace(/\b[0-9]+\s*-\s*[0-9]+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function assignScheduleIdentity(
  scheduleGames: Omit<SidearmScheduleGame, "dedupKey" | "gameNumber">[],
): SidearmScheduleGame[] {
  const gamesByMatchup = new Map<string, Omit<SidearmScheduleGame, "dedupKey" | "gameNumber">[]>();
  const finalizedGames: SidearmScheduleGame[] = [];

  for (const game of scheduleGames) {
    const matchupDayKey = buildMatchupDayKey(game);
    if (!matchupDayKey) {
      finalizedGames.push({
        ...game,
        gameNumber: null,
        dedupKey: `url:${game.url}`,
      });
      continue;
    }

    const bucket = gamesByMatchup.get(matchupDayKey);
    if (bucket) {
      bucket.push(game);
    } else {
      gamesByMatchup.set(matchupDayKey, [game]);
    }
  }

  for (const [matchupDayKey, games] of gamesByMatchup.entries()) {
    const sortedGames = games
      .slice()
      .sort((left, right) =>
        compareTimeLabels(left.timeLabel, right.timeLabel)
        || left.url.localeCompare(right.url));

    for (const [index, game] of sortedGames.entries()) {
      finalizedGames.push({
        ...game,
        gameNumber: index + 1,
        dedupKey: `${matchupDayKey}|g${index + 1}`,
      });
    }
  }

  return finalizedGames.sort((left, right) => left.dedupKey.localeCompare(right.dedupKey));
}

function buildMatchupDayKey(
  game: Pick<SidearmScheduleGame, "date" | "homeTeam" | "awayTeam">,
): string | null {
  if (!game.date || !game.homeTeam || !game.awayTeam) {
    return null;
  }

  return `${game.date}|${normalizeTeamKey(game.homeTeam)}|${normalizeTeamKey(game.awayTeam)}`;
}

function compareTimeLabels(left: string | null, right: string | null): number {
  const leftMinutes = timeLabelToSortMinutes(left);
  const rightMinutes = timeLabelToSortMinutes(right);

  if (leftMinutes !== rightMinutes) {
    return leftMinutes - rightMinutes;
  }

  return normalizeTimeKey(left).localeCompare(normalizeTimeKey(right));
}

function timeLabelToSortMinutes(timeLabel: string | null): number {
  const canonical = canonicalizeTimeLabel(timeLabel);
  if (!canonical) {
    return Number.MAX_SAFE_INTEGER;
  }

  const match = canonical.match(/^(\d{2}):(\d{2})\s(AM|PM)$/);
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  let hour = Number.parseInt(match[1]!, 10) % 12;
  const minute = Number.parseInt(match[2]!, 10);
  if (match[3] === "PM") {
    hour += 12;
  }

  return hour * 60 + minute;
}

/** Hardcoded list of known 2026 box score URLs, discovered via schedule page scrape. */
const KNOWN_2026_GAME_URLS = [
  "https://babsonathletics.com/sports/baseball/stats/2026/-1-6-trinity-texas-/boxscore/16011",
  "https://babsonathletics.com/sports/baseball/stats/2026/-1-6-trinity-texas-/boxscore/16012",
  "https://babsonathletics.com/sports/baseball/stats/2026/-1-6-trinity-texas-/boxscore/16013",
  "https://babsonathletics.com/sports/baseball/stats/2026/-3-4-johns-hopkins/boxscore/16046",
  "https://babsonathletics.com/sports/baseball/stats/2026/amherst/boxscore/16044",
  "https://babsonathletics.com/sports/baseball/stats/2026/bowdoin/boxscore/16042",
  "https://babsonathletics.com/sports/baseball/stats/2026/coast-guard/boxscore/16017",
  "https://babsonathletics.com/sports/baseball/stats/2026/coast-guard/boxscore/16018",
  "https://babsonathletics.com/sports/baseball/stats/2026/franklin-marshall/boxscore/16048",
  "https://babsonathletics.com/sports/baseball/stats/2026/roger-williams/boxscore/16016",
  "https://babsonathletics.com/sports/baseball/stats/2026/rutgers-newark/boxscore/16047",
  "https://babsonathletics.com/sports/baseball/stats/2026/saint-joseph-conn-/boxscore/16043",
  "https://babsonathletics.com/sports/baseball/stats/2026/scranton/boxscore/16045",
  "https://babsonathletics.com/sports/baseball/stats/2026/suffolk/boxscore/16015",
  "https://babsonathletics.com/sports/baseball/stats/2026/trinity-conn-/boxscore/16020",
  "https://babsonathletics.com/sports/baseball/stats/2026/umass-boston/boxscore/16022",
  "https://babsonathletics.com/sports/baseball/stats/2026/umass-boston/boxscore/16023",
  "https://babsonathletics.com/sports/baseball/stats/2026/wheaton/boxscore/16014",
  "https://babsonathletics.com/sports/baseball/stats/2026/wheaton/boxscore/16019",
];
