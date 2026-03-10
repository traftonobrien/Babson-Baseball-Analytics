import type { ChartingGame, ChartingGameSnapshot, ChartingPitch } from "./types";
import { PLAYER_ID_BY_ALIAS } from "../canonicalPlayersData";
import { resolvePlateAppearanceInitialCount } from "./live";

/**
 * Simplified charting CSV — 14 essential pitch-level columns.
 * Game-level metadata (date, opponent, etc.) lives in the filename, not every row.
 */
export const CHARTING_EXPORT_COLUMNS = [
  "inning",
  "pitcher_id",
  "pitcher",
  "hitter_id",
  "hitter",
  "lineup_slot",
  "pitch_number",
  "count",
  "pitch_type",
  "pitch_result",
  "location",
  "velocity",
  "pa_result",
  "initial_count",
] as const;

type ChartingExportColumn = (typeof CHARTING_EXPORT_COLUMNS)[number];
type ChartingExportCell = string | number | null;

export type ChartingExportRow = Record<ChartingExportColumn, ChartingExportCell>;

/** Resolve a hitter name to a player ID via the canonical alias map. */
function resolveHitterId(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return PLAYER_ID_BY_ALIAS[key] ?? "";
}

export function buildChartingExportRows(
  snapshot: ChartingGameSnapshot
): ChartingExportRow[] {
  const segmentById = new Map(snapshot.segments.map((s) => [s.id, s]));
  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));
  const pitchesByPaId = new Map<string, ChartingPitch[]>();

  for (const pitch of snapshot.pitches) {
    const existing = pitchesByPaId.get(pitch.paId) ?? [];
    existing.push(pitch);
    pitchesByPaId.set(pitch.paId, existing);
  }

  const orderedEntries: Array<{
    pitch: ChartingPitch;
    pitchNumberInPa: number | null;
  }> = [];
  const seenPitchIds = new Set<string>();

  for (const pa of snapshot.plateAppearances) {
    const paPitches = [...(pitchesByPaId.get(pa.id) ?? [])].sort(
      (a, b) => a.pitchOrder - b.pitchOrder
    );
    for (const [i, pitch] of paPitches.entries()) {
      orderedEntries.push({ pitch, pitchNumberInPa: i + 1 });
      seenPitchIds.add(pitch.id);
    }
  }

  // Orphan pitches (not tied to a PA)
  const orphans = [...snapshot.pitches]
    .filter((p) => !seenPitchIds.has(p.id))
    .sort((a, b) => a.pitchOrder - b.pitchOrder || a.id.localeCompare(b.id));
  for (const pitch of orphans) {
    orderedEntries.push({ pitch, pitchNumberInPa: null });
  }

  return orderedEntries.map(({ pitch, pitchNumberInPa }) => {
    const pa = paById.get(pitch.paId) ?? null;
    const segment = pa ? segmentById.get(pa.segmentId) ?? null : null;
    const paPitches = pa ? pitchesByPaId.get(pa.id) ?? [] : [];
    const isLastPitchInPA =
      pa && pitchNumberInPa != null
        ? pitchNumberInPa === paPitches.length
        : false;

    return {
      inning: pa?.inning ?? null,
      pitcher_id: segment?.playerId ?? "",
      pitcher: segment?.displayName ?? "",
      hitter_id: pa ? resolveHitterId(pa.hitterName) : "",
      hitter: pa?.hitterName ?? "",
      lineup_slot: pa?.lineupSlot ?? null,
      pitch_number: pitchNumberInPa,
      count: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
      pitch_type: pitch.pitchType,
      pitch_result: pitch.pitchResult,
      location: pitch.locationCell,
      velocity: pitch.velocity,
      pa_result: isLastPitchInPA && pa?.resultCode ? pa.resultCode : null,
      initial_count: pa ? resolvePlateAppearanceInitialCount(pa, paPitches) : null,
    };
  });
}

export function buildChartingExportCsv(snapshot: ChartingGameSnapshot): string {
  const rows = buildChartingExportRows(snapshot);
  const header = CHARTING_EXPORT_COLUMNS.join(",");
  const body = rows.map((row) =>
    CHARTING_EXPORT_COLUMNS.map((col) => formatCsvCell(row[col])).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function buildChartingExportFilename(
  game: Pick<ChartingGame, "gameDate" | "opponent">
): string {
  const opponentSlug = slugify(game.opponent);
  return `charting-${game.gameDate}-${opponentSlug}.csv`;
}

function formatCsvCell(value: ChartingExportCell): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "game";
}
