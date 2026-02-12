export type LinkedGame = {
  gameId: string;
  season: number;
  opponent: string | null;
  date: string | null;
};

export type OutingMeta = {
  outingId: string;
  linkedGames: LinkedGame[];
  updatedAt: string;
};

export type BattingLine = {
  name: string;
  pos: string | null;
  ab: number | null;
  r: number | null;
  h: number | null;
  rbi: number | null;
  bb: number | null;
  so: number | null;
  hr: number | null;
  sb: number | null;
  hbp: number | null;
  avg: number | null;
};

export type PitchingLine = {
  name: string;
  ip: string | null;
  h: number | null;
  r: number | null;
  er: number | null;
  bb: number | null;
  so: number | null;
  hr: number | null;
  bf: number | null;
  pitches: number | null;
  strikes: number | null;
  era: number | null;
};

export type PlayerGameStats = {
  season: number;
  gameId: string;
  playerKey: string;
  playerDisplay: string;
  team: "babson" | "opponent";
  batting: BattingLine | null;
  pitching: PitchingLine | null;
  source: { url: string; importedAt: string };
};

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function loadOutingMeta(
  playerId: string,
  dateId: string,
): Promise<OutingMeta | null> {
  return fetchJson<OutingMeta>(`/data/${playerId}/${dateId}/outing_meta.json`);
}

export async function loadPlayerGameStats(
  slug: string,
  season: number,
  gameId: string,
): Promise<PlayerGameStats | null> {
  return fetchJson<PlayerGameStats>(`/stats/players/${slug}/${season}/${gameId}.json`);
}

export async function loadPlayerSlugIndex(): Promise<Record<string, string> | null> {
  return fetchJson<Record<string, string>>(`/stats/players/index.json`);
}
