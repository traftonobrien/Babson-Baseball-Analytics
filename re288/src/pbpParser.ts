import { extractPlayLines } from "./scraper.ts";

export type HalfInningSide = "top" | "bottom";

export interface RawPbpPlay {
  inning: number;
  halfInning: HalfInningSide;
  playIndex: number;
  playText: string;
  dedupKey: string;
}

export interface RawPbpTotals {
  runs: number | null;
  hits: number | null;
  errors: number | null;
  leftOnBase: number | null;
}

export interface RawPbpHalfInning {
  key: string;
  caption: string;
  inning: number;
  halfInning: HalfInningSide;
  offenseTeam: string;
  playLines: string[];
  plays: RawPbpPlay[];
  totals: RawPbpTotals;
}

export interface RawPbpGame {
  gameId: string | null;
  sourceUrl: string | null;
  halfInnings: RawPbpHalfInning[];
}

const PLAY_BY_PLAY_SECTION_REGEX =
  /<section id="play-by-play">([\s\S]*?)(?:<section id="composite-stats">|<\/section>\s*<\/div>)/i;
const PLAY_BY_PLAY_TABLE_REGEX =
  /(<table class="sidearm-table play-by-play">[\s\S]*?<\/table>)(?:\s*(<dl class="special-stats[\s\S]*?<\/dl>))?/gi;
const CAPTION_REGEX = /<caption>([\s\S]*?)<\/caption>/i;
const CAPTION_DETAILS_REGEX = /^(.*?)\s*-\s*(Top|Bottom) of (\d+)(?:st|nd|rd|th)$/i;
const DT_DD_REGEX = /<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/dd>/gi;

export function parseRawPbpGameFromHtml(
  html: string,
  sourceUrl?: string,
): RawPbpGame {
  return {
    gameId: sourceUrl ? parseGameIdFromUrl(sourceUrl) : null,
    sourceUrl: sourceUrl ?? null,
    halfInnings: parseRawHalfInningsFromHtml(html),
  };
}

export function parseRawHalfInningsFromHtml(html: string): RawPbpHalfInning[] {
  const sectionHtml = extractPlayByPlaySectionHtml(html);
  if (!sectionHtml) {
    return [];
  }

  const uniqueHalfInnings = new Map<string, RawPbpHalfInning>();

  for (const match of sectionHtml.matchAll(PLAY_BY_PLAY_TABLE_REGEX)) {
    const tableHtml = match[1] ?? "";
    const totalsHtml = match[2] ?? "";
    const caption = extractCaption(tableHtml);
    const details = parseCaptionDetails(caption);

    if (!details) {
      continue;
    }

    const playLines = extractPlayLines(tableHtml, { dedupe: false });
    if (playLines.length === 0) {
      continue;
    }

    const plays = playLines.map((playText, index) => ({
      inning: details.inning,
      halfInning: details.halfInning,
      playIndex: index,
      playText,
      dedupKey: buildPlayDedupKey(details.inning, details.halfInning, playText, index),
    }));

    const halfInningKey = buildHalfInningKey(details.inning, details.halfInning, playLines);
    if (uniqueHalfInnings.has(halfInningKey)) {
      continue;
    }

    uniqueHalfInnings.set(halfInningKey, {
      key: halfInningKey,
      caption,
      inning: details.inning,
      halfInning: details.halfInning,
      offenseTeam: details.offenseTeam,
      playLines,
      plays,
      totals: parseHalfInningTotals(totalsHtml),
    });
  }

  return [...uniqueHalfInnings.values()].sort(compareHalfInnings);
}

function parseGameIdFromUrl(url: string): string | null {
  const match = url.match(/boxscore\/(\d+)/i);
  return match?.[1] ?? null;
}

function extractPlayByPlaySectionHtml(html: string): string {
  const normalized = html.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sectionMatch = normalized.match(PLAY_BY_PLAY_SECTION_REGEX);
  return sectionMatch?.[1] ?? "";
}

function extractCaption(tableHtml: string): string {
  const captionMatch = tableHtml.match(CAPTION_REGEX);
  return stripHtml(captionMatch?.[1] ?? "");
}

function parseCaptionDetails(
  caption: string,
): { offenseTeam: string; halfInning: HalfInningSide; inning: number } | null {
  const match = caption.match(CAPTION_DETAILS_REGEX);
  if (!match) {
    return null;
  }

  return {
    offenseTeam: match[1]!.trim(),
    halfInning: match[2]!.toLowerCase() as HalfInningSide,
    inning: Number.parseInt(match[3]!, 10),
  };
}

function parseHalfInningTotals(totalsHtml: string): RawPbpTotals {
  const stats = new Map<string, number>();

  for (const match of totalsHtml.matchAll(DT_DD_REGEX)) {
    const label = stripHtml(match[1] ?? "").toLowerCase();
    const rawValue = stripHtml(match[2] ?? "");
    const value = Number.parseInt(rawValue, 10);

    if (Number.isFinite(value)) {
      stats.set(label, value);
    }
  }

  return {
    runs: stats.get("runs") ?? null,
    hits: stats.get("hits") ?? null,
    errors: stats.get("errors") ?? null,
    leftOnBase: stats.get("left on base") ?? null,
  };
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

function buildHalfInningKey(
  inning: number,
  halfInning: HalfInningSide,
  playLines: string[],
): string {
  return `${inning}:${halfInning}:${playLines.join("||")}`;
}

function buildPlayDedupKey(
  inning: number,
  halfInning: HalfInningSide,
  playText: string,
  playIndex: number,
): string {
  return `${inning}:${halfInning}:${playIndex}:${playText}`;
}

function compareHalfInnings(left: RawPbpHalfInning, right: RawPbpHalfInning): number {
  if (left.inning !== right.inning) {
    return left.inning - right.inning;
  }

  if (left.halfInning === right.halfInning) {
    return 0;
  }

  return left.halfInning === "top" ? -1 : 1;
}
