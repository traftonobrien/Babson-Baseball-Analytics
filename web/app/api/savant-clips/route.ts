import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/savant-clips?pitcherId=543037&pitchType=Curveball&year=2025&n=4
 *
 * Fetches recent pitch-level data from Savant's statcast_search CSV endpoint,
 * then resolves each pitch to a video playId UUID via the MLB Stats API.
 *
 * Returns: { clips: [{ playId, date, velo, pitchType }], fallbackUrl? }
 */

const SAVANT_BASE = "https://baseballsavant.mlb.com/statcast_search/csv";
const MLB_API = "https://statsapi.mlb.com/api/v1/game";
const SPORTY_VIDEOS = "https://baseballsavant.mlb.com/sporty-videos";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://baseballsavant.mlb.com/",
};

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

// ---------------------------------------------------------------------------
// In-memory cache: avoids hammering Savant/MLB for repeated requests
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: ClipResult;
  expires: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CacheEntry>();

interface Clip {
  playId: string;
  date: string;
  velo: string;
  pitchTypeAbbrev: string;
}

interface ClipResult {
  clips: Clip[];
  fallbackUrl?: string;
}

// ---------------------------------------------------------------------------
// CSV parsing (minimal — avoids adding a dependency)
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
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVRow(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Step 1: Fetch pitch-level rows from Savant statcast_search
// ---------------------------------------------------------------------------

interface StatcastPitch {
  game_pk: string;
  at_bat_number: string;
  pitch_number: string;
  game_date: string;
  release_speed: string;
  pitch_type: string;
}

async function fetchStatcastPitches(
  pitcherId: string,
  savantAbbrevs: string[],
  year: string,
  limit: number,
): Promise<StatcastPitch[]> {
  const hfPT = savantAbbrevs.map((a) => `${a}|`).join("");
  const params = new URLSearchParams({
    all: "true",
    hfSea: `${year}|`,
    hfPT: hfPT,
    player_type: "pitcher",
    "pitchers_lookup[]": pitcherId,
    type: "details",
    sort_col: "game_date",
    sort_order: "desc",
  });

  const resp = await fetch(`${SAVANT_BASE}?${params}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });

  if (!resp.ok) return [];

  const text = (await resp.text()).replace(/^\ufeff/, "");
  if (text.startsWith("<")) return [];

  const allRows = parseCSV(text);
  // Take the most recent pitches up to limit, spread across different games
  const seen = new Set<string>();
  const result: StatcastPitch[] = [];
  for (const row of allRows) {
    if (result.length >= limit) break;
    const gp = row.game_pk;
    const ab = row.at_bat_number;
    const pn = row.pitch_number;
    if (!gp || !ab || !pn) continue;
    const key = `${gp}-${ab}-${pn}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      game_pk: gp,
      at_bat_number: ab,
      pitch_number: pn,
      game_date: row.game_date ?? "",
      release_speed: row.release_speed ?? "",
      pitch_type: row.pitch_type ?? "",
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Step 2: Resolve game_pk + at_bat + pitch_number → playId UUID via MLB API
// ---------------------------------------------------------------------------

async function resolvePlayId(
  gamePk: string,
  atBatNumber: string,
  pitchNumber: string,
): Promise<string | null> {
  try {
    const resp = await fetch(`${MLB_API}/${gamePk}/playByPlay`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const plays = data?.allPlays;
    if (!Array.isArray(plays)) return null;

    // at_bat_number is 1-based, atBatIndex is 0-based
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
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const pitcherId = sp.get("pitcherId")?.trim();
  const pitchType = sp.get("pitchType")?.trim();
  const year = sp.get("year") ?? "2025";
  const n = Math.min(parseInt(sp.get("n") ?? "4", 10) || 4, 6);

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

  // Cache check
  const cacheKey = `${pitcherId}-${pitchType}-${year}-${n}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  const fallbackUrl = `https://baseballsavant.mlb.com/savant-player/${pitcherId}`;

  try {
    // Step 1: Get recent pitches from Savant
    const pitches = await fetchStatcastPitches(
      pitcherId,
      savantAbbrevs,
      year,
      n * 3, // Fetch extra since some may fail playId resolution
    );

    if (pitches.length === 0) {
      const result: ClipResult = { clips: [], fallbackUrl };
      cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
      return NextResponse.json(result);
    }

    // Step 2: Resolve playId UUIDs (batch by game_pk to minimize API calls)
    const gamePlayMap = new Map<string, Map<string, string | null>>();
    const clips: Clip[] = [];

    for (const pitch of pitches) {
      if (clips.length >= n) break;

      let playMap = gamePlayMap.get(pitch.game_pk);
      if (!playMap) {
        // Fetch playByPlay for this game once, resolve all pitches from it
        playMap = new Map();
        gamePlayMap.set(pitch.game_pk, playMap);
      }

      const lookupKey = `${pitch.at_bat_number}-${pitch.pitch_number}`;
      let playId = playMap.get(lookupKey);
      if (playId === undefined) {
        playId = await resolvePlayId(
          pitch.game_pk,
          pitch.at_bat_number,
          pitch.pitch_number,
        );
        playMap.set(lookupKey, playId);
      }

      if (playId) {
        clips.push({
          playId,
          date: pitch.game_date,
          velo: pitch.release_speed,
          pitchTypeAbbrev: pitch.pitch_type,
        });
      }
    }

    const result: ClipResult = { clips, fallbackUrl };
    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[savant-clips]", err);
    return NextResponse.json(
      { clips: [], fallbackUrl, error: String(err) },
      { status: 200 }, // Degrade gracefully — UI shows fallback link
    );
  }
}
