/**
 * Scrapes play-by-play (PBP) data from babsonathletics.com box score pages
 * and extracts balls-in-play events for Babson hitters.
 *
 * The PBP section uses Sidearm Sports markup. The actual play text lives inside
 * the play-by-play tab's HTML, which we need to parse from the full page.
 */

import type { SprayChartEvent, SprayChartGame } from "./types";
import {
  classifyBattedBallType,
  classifyHitResult,
  classifyZone,
  totalBasesForResult,
  isHitResult,
  extractRbi,
  extractCountAndSequence,
} from "./zoneMapper";

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

/**
 * Fetches the Babson baseball schedule page and extracts all box score URLs.
 */
export async function discoverGameUrls(season: number = 2026): Promise<string[]> {
  const BASE = "https://babsonathletics.com";
  const scheduleUrl = `${BASE}/sports/baseball/schedule/${season}`;

  try {
    const response = await fetch(scheduleUrl, {
      headers: { "User-Agent": "BabsonAnalytics/1.0 (internal tool)" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const urls = new Set<string>();

    // Match both absolute and relative boxscore URLs
    const absPattern = /https:\/\/babsonathletics\.com\/sports\/baseball\/stats\/\d{4}\/[^"'\s)]+\/boxscore\/\d+/g;
    for (const match of html.matchAll(absPattern)) urls.add(match[0]);

    // Relative paths: /sports/baseball/stats/YYYY/slug/boxscore/ID  
    const relPattern = /\/sports\/baseball\/stats\/\d{4}\/[^"'\s)]+\/boxscore\/\d+/g;
    for (const match of html.matchAll(relPattern)) urls.add(`${BASE}${match[0]}`);

    // href="...boxscore/ID" variants
    const hrefPattern = /href="([^"]*boxscore\/\d+)"/g;
    for (const match of html.matchAll(hrefPattern)) {
      const href = match[1]!;
      urls.add(href.startsWith("http") ? href : `${BASE}${href}`);
    }

    if (urls.size > 0) return [...urls].sort();
  } catch (err) {
    console.warn("  ⚠️  Schedule fetch failed, using known game list:", err);
  }

  // Fallback: known 2026 game URLs
  return KNOWN_2026_GAME_URLS;
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
