import type { ChartingGame, ChartingGameSnapshot, ChartingPitch } from "./types";

export const CHARTING_EXPORT_COLUMNS = [
  "game_id",
  "game_date",
  "opponent",
  "game_status",
  "revision",
  "charter",
  "weather",
  "home_catcher",
  "away_catcher",
  "babson_record",
  "standing",
  "tomorrow_starter",
  "tomorrow_opponent",
  "notes",
  "segment_id",
  "segment_order",
  "pitcher_player_id",
  "pitcher_name",
  "segment_entered_inning",
  "segment_exited_inning",
  "runs_override",
  "earned_runs_override",
  "pa_id",
  "pa_order",
  "inning",
  "hitter_name",
  "lineup_slot",
  "bunt_context",
  "pa_result_code",
  "pitch_id",
  "game_pitch_sequence",
  "pitch_number_in_pa",
  "pitch_order",
  "count_before",
  "balls_before",
  "strikes_before",
  "pitch_type",
  "location_cell",
  "pitch_result",
  "velocity",
] as const;

type ChartingExportColumn = (typeof CHARTING_EXPORT_COLUMNS)[number];
type ChartingExportCell = string | number | boolean | null;

export type ChartingExportRow = Record<ChartingExportColumn, ChartingExportCell>;

export function buildChartingExportRows(
  snapshot: ChartingGameSnapshot
): ChartingExportRow[] {
  const segmentById = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
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
      (left, right) => left.pitchOrder - right.pitchOrder
    );

    for (const [index, pitch] of paPitches.entries()) {
      orderedEntries.push({
        pitch,
        pitchNumberInPa: index + 1,
      });
      seenPitchIds.add(pitch.id);
    }
  }

  const orphanPitches = [...snapshot.pitches]
    .filter((pitch) => !seenPitchIds.has(pitch.id))
    .sort((left, right) => {
      if (left.pitchOrder !== right.pitchOrder) {
        return left.pitchOrder - right.pitchOrder;
      }
      return left.id.localeCompare(right.id);
    });

  for (const pitch of orphanPitches) {
    orderedEntries.push({
      pitch,
      pitchNumberInPa: null,
    });
  }

  return orderedEntries.map(({ pitch, pitchNumberInPa }, index) => {
    const pa = paById.get(pitch.paId) ?? null;
    const segment = pa ? segmentById.get(pa.segmentId) ?? null : null;

    return {
      game_id: snapshot.game.id,
      game_date: snapshot.game.gameDate,
      opponent: snapshot.game.opponent,
      game_status: snapshot.game.status,
      revision: snapshot.game.revision,
      charter: snapshot.game.charter,
      weather: snapshot.game.weather,
      home_catcher: snapshot.game.homeCatcher,
      away_catcher: snapshot.game.awayCatcher,
      babson_record: snapshot.game.babsonRecord,
      standing: snapshot.game.standing,
      tomorrow_starter: snapshot.game.tomorrowStarter,
      tomorrow_opponent: snapshot.game.tomorrowOpponent,
      notes: snapshot.game.notes,
      segment_id: segment?.id ?? pa?.segmentId ?? "",
      segment_order: segment?.segmentOrder ?? null,
      pitcher_player_id: segment?.playerId ?? "",
      pitcher_name: segment?.displayName ?? "",
      segment_entered_inning: segment?.enteredInning ?? null,
      segment_exited_inning: segment?.exitedInning ?? null,
      runs_override: segment?.runsOverride ?? null,
      earned_runs_override: segment?.earnedRunsOverride ?? null,
      pa_id: pa?.id ?? pitch.paId,
      pa_order: pa?.paOrder ?? null,
      inning: pa?.inning ?? null,
      hitter_name: pa?.hitterName ?? "",
      lineup_slot: pa?.lineupSlot ?? null,
      bunt_context: pa?.buntContext ?? null,
      pa_result_code: pa?.resultCode ?? null,
      pitch_id: pitch.id,
      game_pitch_sequence: index + 1,
      pitch_number_in_pa: pitchNumberInPa,
      pitch_order: pitch.pitchOrder,
      count_before: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
      balls_before: pitch.ballsBefore,
      strikes_before: pitch.strikesBefore,
      pitch_type: pitch.pitchType,
      location_cell: pitch.locationCell,
      pitch_result: pitch.pitchResult,
      velocity: pitch.velocity,
    };
  });
}

export function buildChartingExportCsv(snapshot: ChartingGameSnapshot): string {
  const rows = buildChartingExportRows(snapshot);
  const header = CHARTING_EXPORT_COLUMNS.join(",");
  const body = rows.map((row) =>
    CHARTING_EXPORT_COLUMNS.map((column) => formatCsvCell(row[column])).join(",")
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
  if (value === null || value === undefined) {
    return "";
  }

  const normalized =
    typeof value === "boolean" ? (value ? "true" : "false") : String(value);

  if (!/[",\r\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, '""')}"`;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "game";
}
