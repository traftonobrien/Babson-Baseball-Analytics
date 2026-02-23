import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/savant-clips?pitcherId=543037&pitchType=Curveball&year=2025
 *
 * Returns a single pitch clip (swing-and-miss or called strike) with a
 * direct MP4 URL from sporty-clips.mlb.com.
 *
 * Pipeline:
 *   1. Statcast search CSV → find recent strike pitches (called_strike,
 *      swinging_strike, swinging_strike_blocked)
 *   2. MLB Stats API playByPlay → resolve to playId UUID
 *   3. Savant sporty-videos page → extract direct MP4 URL from page source
 *
 * Returns: { clip: { mp4Url, playId, date, velo } | null, fallbackUrl }
 */

const SAVANT_CSV = "https://baseballsavant.mlb.com/statcast_search/csv";
const SAVANT_VIDEO = "https://baseballsavant.mlb.com/sporty-videos";
const MLB_API = "https://statsapi.mlb.com/api/v1/game";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";
const HEADERS = { "User-Agent": UA, Referer: "https://baseballsavant.mlb.com/" };

const CANONICAL_TO_SAVANT: Record<string, string[]> = {
  Fastball: ["FF"],
  Sinker: ["SI"],
  Cutter: ["FC"],
  Splitter: ["FS"],
  Changeup: ["CH"],
  Curveball: ["CU", "KC"],
  Slider: ["SL"],
  Sweeper: ["ST"],
};

const STRIKE_DESCRIPTIONS = new Set([
  "called_strike",
  "swinging_strike",
  "swinging_strike_blocked",
]);

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: ClipResponse;
  expires: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

interface ClipData {
  mp4Url: string;
  playId: string;
  date: string;
  velo: string;
  pitchTypeAbbrev: string;
}

interface ClipResponse {
  clip: ClipData | null;
  fallbackUrl: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// CSV parser (minimal, no deps)
// ---------------------------------------------------------------------------

function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCSVRow(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j] ?? "";
    return row;
  });
}

// ---------------------------------------------------------------------------
// Step 1: Fetch strike pitches from Savant statcast CSV
// ---------------------------------------------------------------------------

interface StatcastPitch {
  game_pk: string;
  at_bat_number: string;
  pitch_number: string;
  game_date: string;
  release_speed: string;
  pitch_type: string;
  description: string;
}

async function fetchStrikePitches(
  pitcherId: string,
  savantAbbrevs: string[],
  year: string,
  limit: number,
): Promise<StatcastPitch[]> {
  const params = new URLSearchParams({
    all: "true",
    hfSea: `${year}|`,
    hfPT: savantAbbrevs.map((a) => `${a}|`).join(""),
    player_type: "pitcher",
    "pitchers_lookup[]": pitcherId,
    type: "details",
    sort_col: "game_date",
    sort_order: "desc",
  });

  const resp = await fetch(`${SAVANT_CSV}?${params}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return [];

  const text = (await resp.text()).replace(/^\ufeff/, "");
  if (text.startsWith("<")) return [];

  const allRows = parseCSV(text);
  const result: StatcastPitch[] = [];
  for (const row of allRows) {
    if (result.length >= limit) break;
    const desc = row.description ?? "";
    if (!STRIKE_DESCRIPTIONS.has(desc)) continue;
    const gp = row.game_pk;
    const ab = row.at_bat_number;
    const pn = row.pitch_number;
    if (!gp || !ab || !pn) continue;
    result.push({
      game_pk: gp,
      at_bat_number: ab,
      pitch_number: pn,
      game_date: row.game_date ?? "",
      release_speed: row.release_speed ?? "",
      pitch_type: row.pitch_type ?? "",
      description: desc,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 2: Resolve playId UUID via MLB Stats API
// ---------------------------------------------------------------------------

async function resolvePlayId(
  gamePk: string,
  atBatNumber: string,
  pitchNumber: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${MLB_API}/${gamePk}/playByPlay`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const plays = data?.allPlays;
    if (!Array.isArray(plays)) return null;

    const abIdx = parseInt(atBatNumber, 10) - 1;
    const play = plays.find(
      (p: { atBatIndex?: number }) => p.atBatIndex === abIdx,
    );
    if (!play) return null;

    const events = play.playEvents;
    if (!Array.isArray(events)) return null;

    const pNum = parseInt(pitchNumber, 10);
    const evt = events.find(
      (e: { pitchNumber?: number; isPitch?: boolean }) =>
        e.isPitch && e.pitchNumber === pNum,
    );
    return evt?.playId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Step 3: Extract direct MP4 URL from sporty-videos page
// ---------------------------------------------------------------------------

async function extractMp4Url(playId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${SAVANT_VIDEO}?playId=${playId}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(
      /(https:\/\/sporty-clips\.mlb\.com\/[^"<\s]+\.mp4[^"<\s]*)/,
    );
    if (!match) return null;
    // Unescape HTML entities (&#x3D; → =)
    return match[1]
      .replace(/&#x3D;/g, "=")
      .replace(/&amp;/g, "&")
      .replace(/&#x26;/g, "&");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const pitcherId = sp.get("pitcherId")?.trim();
  const pitchType = sp.get("pitchType")?.trim();
  const year = sp.get("year") ?? "2025";

  if (!pitcherId || !pitchType) {
    return NextResponse.json(
      { error: "pitcherId and pitchType required" },
      { status: 400 },
    );
  }

  const savantAbbrevs = CANONICAL_TO_SAVANT[pitchType];
  if (!savantAbbrevs) {
    return NextResponse.json(
      { error: `Unknown pitch type: ${pitchType}` },
      { status: 400 },
    );
  }

  const cacheKey = `${pitcherId}-${pitchType}-${year}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const fallbackUrl = `https://baseballsavant.mlb.com/savant-player/${pitcherId}`;

  try {
    // Fetch ~10 recent strike pitches; we only need 1, but some may fail resolution
    const pitches = await fetchStrikePitches(pitcherId, savantAbbrevs, year, 10);

    if (pitches.length === 0) {
      const result: ClipResponse = { clip: null, fallbackUrl };
      cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return NextResponse.json(result);
    }

    // Try pitches until we get one with a valid MP4 URL
    for (const pitch of pitches) {
      const playId = await resolvePlayId(
        pitch.game_pk,
        pitch.at_bat_number,
        pitch.pitch_number,
      );
      if (!playId) continue;

      const mp4Url = await extractMp4Url(playId);
      if (!mp4Url) continue;

      const clip: ClipData = {
        mp4Url,
        playId,
        date: pitch.game_date,
        velo: pitch.release_speed,
        pitchTypeAbbrev: pitch.pitch_type,
      };

      const result: ClipResponse = { clip, fallbackUrl };
      cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return NextResponse.json(result);
    }

    // All attempts failed
    const result: ClipResponse = { clip: null, fallbackUrl };
    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[savant-clips]", err);
    return NextResponse.json(
      { clip: null, fallbackUrl, error: String(err) } satisfies ClipResponse,
      { status: 200 },
    );
  }
}
