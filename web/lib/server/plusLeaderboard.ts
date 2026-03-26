import { promises as fs } from "fs";
import path from "path";
import Papa from "papaparse";
import { and, asc, isNotNull, like, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { stuffPlusOutings } from "@/db/schema";
import { players } from "@/lib/dataIndex";
import type { Pitch } from "@/app/types";
import { assignPitchTypes, type ArsenalEntry } from "@/lib/assignPitchType";
import {
  buildCommandPlusBaselines,
  computeCommandPlus,
  type CommandPlusBaselines,
  type CommandPlusResult,
} from "@/lib/commandPlus";
import {
  computePitchingPlus,
  type PitchingPlusPitchTypeReason,
  type PitchingPlusPitchTypeRow,
  type PitchingPlusResult,
  type PitchingPlusStuffPitch,
} from "@/lib/pitchingPlus";
import { computeTotalStuffPlus } from "@/lib/stuffPlusUtils";
import { parsePitchCsvText } from "@/lib/pitchCsv";
import { seasonFromDateId } from "@/lib/season";
import { loadStuffPlusData } from "@/lib/stuffPlusJson";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import {
  getCanonicalName,
  getCanonicalPlayerId,
  getHand,
} from "@/lib/canonicalPlayers";
import type {
  PlusLeaderboardPayload,
  PlusNotReadyReason,
  PlusPitchTypeRow,
  PlusPlayerRow,
  PlusSeasonFilter,
  PlusSessionRow,
} from "@/lib/plusLeaderboardTypes";
import {
  buildOneOffStuffFallbackRows,
  type LeaderboardStuffRow,
} from "@/lib/server/plusLeaderboardStuffFallback";

interface ArsenalRecord {
  playerId: string;
  playerName: string | null;
  throws: "R" | "L" | null;
  arsenal: ArsenalEntry[];
}

interface LoadedOutingTask {
  playerId: string;
  playerName: string;
  throws: "R" | "L" | null;
  outingId: string;
  dateId: string;
  season: number;
  pitches: Pitch[];
  commandResult: CommandPlusResult;
}

type StuffRow = LeaderboardStuffRow;

interface StuffAggregateValue {
  sum: number;
  count: number;
}

interface SeasonModel {
  playerId: string;
  playerName: string;
  throws: "R" | "L" | null;
  season: number;
  outingCount: number;
  trackedPitchCount: number;
  stuffSessionCount: number;
  commandResult: CommandPlusResult | null;
  stuffPitches: PitchingPlusStuffPitch[];
  stuffPlus: number | null;
  pitchingResult: PitchingPlusResult | null;
}

let arsenalPromise: Promise<Map<string, ArsenalRecord>> | null = null;

function selectedSeasons(filter: PlusSeasonFilter): number[] {
  return filter === "both" ? [2025, 2026] : [filter];
}

function normalizeThrow(value: string | null | undefined): "R" | "L" | null {
  if (value === "R" || value === "L") return value;
  return null;
}

function normalizeDateId(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/-/g, "_");
}

function combineKey(playerId: string, season: number): string {
  return `${playerId}:${season}`;
}

function dateKey(playerId: string, dateId: string): string {
  return `${playerId}:${dateId}`;
}

function safeNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function averageAggregateMap(
  aggregate: Map<string, StuffAggregateValue> | undefined,
): PitchingPlusStuffPitch[] {
  if (!aggregate) return [];
  return Array.from(aggregate.entries())
    .map(([pitchType, value]) => ({
      pitchType,
      meanStuffPlus: value.count > 0 ? value.sum / value.count : null,
    }))
    .filter((row) => row.meanStuffPlus !== null)
    .sort((a, b) => a.pitchType.localeCompare(b.pitchType));
}

function bumpAggregate(
  map: Map<string, Map<string, StuffAggregateValue>>,
  key: string,
  pitchType: string,
  value: number,
): void {
  const byPitch = map.get(key) ?? new Map<string, StuffAggregateValue>();
  const next = byPitch.get(pitchType) ?? { sum: 0, count: 0 };
  next.sum += value;
  next.count += 1;
  byPitch.set(pitchType, next);
  map.set(key, byPitch);
}

async function loadArsenals(): Promise<Map<string, ArsenalRecord>> {
  if (arsenalPromise) return arsenalPromise;

  arsenalPromise = (async () => {
    const map = new Map<string, ArsenalRecord>();
    const csvPath = path.join(process.cwd(), "public", "data", "Arsenals.csv");
    const raw = await fs.readFile(csvPath, "utf-8");
    const parsed = Papa.parse<Record<string, string>>(raw, {
      header: true,
      skipEmptyLines: true,
    });

    for (const row of parsed.data) {
      const playerId = row.player_id?.trim();
      if (!playerId) continue;

      const existing = map.get(playerId) ?? {
        playerId,
        playerName: row.player_name?.trim() || null,
        throws: normalizeThrow(row.pitcher_hand?.trim()),
        arsenal: [],
      };

      if (!existing.playerName && row.player_name?.trim()) {
        existing.playerName = row.player_name.trim();
      }
      if (!existing.throws) {
        existing.throws = normalizeThrow(row.pitcher_hand?.trim());
      }

      const abbrev = row.abbreviation?.trim();
      const pitchName = row.pitch_type?.trim();
      if (abbrev && pitchName) {
        existing.arsenal.push({ abbrev, pitchName });
      }

      map.set(playerId, existing);
    }

    return map;
  })();

  return arsenalPromise;
}

async function loadCommandOutings(
  seasons: number[],
  arsenals: Map<string, ArsenalRecord>,
): Promise<LoadedOutingTask[]> {
  const tasks = players.flatMap((player) =>
    player.outings
      .map((outing) => {
        const dateId = outing.id.split("/")[1];
        const season = seasonFromDateId(dateId);
        if (!season || !seasons.includes(season)) return null;
        return {
          playerId: player.id,
          playerName: player.name,
          throws: player.throws,
          outingId: outing.id,
          dateId,
          season,
          csvPath: outing.csvPath,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  );

  const baselines: Record<number, Pitch[]> = {};
  const loaded = await Promise.all(
    tasks.map(async (task) => {
      try {
        const csvPath = path.join(process.cwd(), "public", task.csvPath.replace(/^\//, ""));
        const text = await fs.readFile(csvPath, "utf-8");
        const parsed = parsePitchCsvText(text);
        const arsenal = arsenals.get(task.playerId)?.arsenal ?? [];
        const pitches = assignPitchTypes(parsed, task.playerId, arsenal);
        baselines[task.season] ??= [];
        baselines[task.season].push(...pitches);
        return {
          ...task,
          pitches,
        };
      } catch (err) {
        console.warn("[plus-leaderboard] Failed to read outing", task.outingId, err);
        return null;
      }
    }),
  );

  const baselinesBySeason: Record<number, CommandPlusBaselines> = {};
  for (const season of seasons) {
    baselinesBySeason[season] = buildCommandPlusBaselines(baselines[season] ?? []);
  }

  return loaded
    .filter((task): task is NonNullable<typeof task> => task !== null)
    .map((task) => {
      const throws =
        arsenals.get(task.playerId)?.throws ??
        task.throws ??
        null;
      const playerName =
        arsenals.get(task.playerId)?.playerName ??
        task.playerName;
      return {
        playerId: task.playerId,
        playerName,
        throws,
        outingId: task.outingId,
        dateId: task.dateId,
        season: task.season,
        pitches: task.pitches,
        commandResult: computeCommandPlus(
          task.pitches,
          baselinesBySeason[task.season] ?? {},
        ),
      };
    });
}

async function loadStuffRows(seasons: number[]): Promise<StuffRow[]> {
  const yearMatch = (season: number) =>
    or(
      like(stuffPlusOutings.date, `${season}_%`),
      like(stuffPlusOutings.date, `${season}-%`),
    );

  const seasonCondition =
    seasons.length === 1
      ? yearMatch(seasons[0])
      : or(...seasons.map((season) => yearMatch(season)));

  const rows = await db
    .select({
      playerId: stuffPlusOutings.playerId,
      playerName: stuffPlusOutings.playerName,
      throws: stuffPlusOutings.throws,
      date: stuffPlusOutings.date,
      pitchType: stuffPlusOutings.pitchType,
      stuffPlus: stuffPlusOutings.stuffPlus,
    })
    .from(stuffPlusOutings)
    .where(
      and(
        isNotNull(stuffPlusOutings.stuffPlus),
        ne(stuffPlusOutings.pitchType, "Other"),
        seasonCondition,
      ),
    )
    .orderBy(asc(stuffPlusOutings.playerId), asc(stuffPlusOutings.date));

  return rows
    .map((row) => {
      const value = safeNumber(row.stuffPlus);
      const dateId = normalizeDateId(row.date);
      const season = seasonFromDateId(dateId);
      const canonicalPlayerId =
        getCanonicalPlayerId(row.playerId) ??
        getCanonicalPlayerId(row.playerName ?? "") ??
        row.playerId.trim();
      const canonicalName =
        getCanonicalName(canonicalPlayerId || row.playerName || row.playerId);
      const canonicalThrows =
        getHand(canonicalPlayerId) ??
        normalizeThrow(row.throws);

      if (value === null || !dateId || !season) return null;
      return {
        playerId: canonicalPlayerId,
        playerName: canonicalName || row.playerName?.trim() || null,
        throws: canonicalThrows,
        dateId,
        season,
        pitchType: row.pitchType,
        stuffPlus: value,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function topReason(
  reasons: Map<Exclude<PitchingPlusPitchTypeReason, null>, number>,
): Exclude<PitchingPlusPitchTypeReason, null> | null {
  let winner: Exclude<PitchingPlusPitchTypeReason, null> | null = null;
  let winnerCount = -1;
  for (const [reason, count] of reasons) {
    if (count > winnerCount) {
      winner = reason;
      winnerCount = count;
    }
  }
  return winner;
}

function compareMetric(a: number | null, b: number | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

function buildPitchRows(
  playerId: string,
  commandResult: CommandPlusResult,
  stuffPitches: PitchingPlusStuffPitch[],
  pitchingResult: PitchingPlusResult,
): PitchingPlusPitchTypeRow[] {
  if (pitchingResult.pitchTypeRows.length > 0) {
    return pitchingResult.pitchTypeRows;
  }

  const eligibleRows = commandResult.pitchTypeScores.filter(
    (row) => row.eligible && row.score !== null && row.subjectCount > 0,
  );
  if (eligibleRows.length === 0) {
    return [];
  }

  if (stuffPitches.length === 0) {
    return eligibleRows.map((row) => ({
      commandPitchType: row.pitchType,
      stuffPitchTypes: [],
      commandCount: row.subjectCount,
      usageShare: 0,
      hybridWeight: 0,
      stuffPlus: null,
      commandPlus: row.score,
      pitchingPlus: null,
      included: false,
      reason: "missing_stuff",
    }));
  }

  return eligibleRows.map((row) => ({
    commandPitchType: row.pitchType,
    stuffPitchTypes: [],
    commandCount: row.subjectCount,
    usageShare: 0,
    hybridWeight: 0,
    stuffPlus: null,
    commandPlus: row.score,
    pitchingPlus: null,
    included: false,
    reason: "missing_stuff",
  }));
}

function playerSort(a: PlusPlayerRow, b: PlusPlayerRow): number {
  return (
    compareMetric(a.pitchingPlus, b.pitchingPlus) ||
    compareMetric(a.commandPlus, b.commandPlus) ||
    compareMetric(a.stuffPlus, b.stuffPlus) ||
    b.trackedPitchCount - a.trackedPitchCount ||
    a.playerName.localeCompare(b.playerName)
  );
}

function pitchTypeSort(a: PlusPitchTypeRow, b: PlusPitchTypeRow): number {
  return (
    compareMetric(a.pitchingPlus, b.pitchingPlus) ||
    compareMetric(a.commandPlus, b.commandPlus) ||
    compareMetric(a.stuffPlus, b.stuffPlus) ||
    b.commandCount - a.commandCount ||
    a.playerName.localeCompare(b.playerName) ||
    a.pitchLabel.localeCompare(b.pitchLabel)
  );
}

function sessionSort(a: PlusSessionRow, b: PlusSessionRow): number {
  return (
    compareMetric(a.pitchingPlus, b.pitchingPlus) ||
    compareMetric(a.commandPlus, b.commandPlus) ||
    compareMetric(a.stuffPlus, b.stuffPlus) ||
    b.dateId.localeCompare(a.dateId) ||
    a.playerName.localeCompare(b.playerName)
  );
}

export async function loadPlusLeaderboard(
  seasonFilter: PlusSeasonFilter,
): Promise<PlusLeaderboardPayload> {
  const seasons = selectedSeasons(seasonFilter);
  const arsenals = await loadArsenals();
  const [commandTasks, queriedStuffRows, stuffPlusData] = await Promise.all([
    loadCommandOutings(seasons, arsenals),
    loadStuffRows(seasons),
    loadStuffPlusData(),
  ]);
  const rawStuffRows = queriedStuffRows.concat(
    buildOneOffStuffFallbackRows({
      seasons,
      existingRows: queriedStuffRows,
      outings: stuffPlusData.outings,
    }),
  );

  const playerNames = new Map<string, string>();
  const playerThrows = new Map<string, "R" | "L" | null>();

  for (const player of players) {
    playerNames.set(player.id, player.name);
    playerThrows.set(player.id, player.throws);
  }
  for (const record of arsenals.values()) {
    if (record.playerName) playerNames.set(record.playerId, record.playerName);
    if (record.throws) playerThrows.set(record.playerId, record.throws);
  }
  for (const task of commandTasks) {
    playerNames.set(task.playerId, task.playerName);
    if (task.throws) playerThrows.set(task.playerId, task.throws);
  }
  for (const row of rawStuffRows) {
    if (row.playerName) playerNames.set(row.playerId, row.playerName);
    if (row.throws) playerThrows.set(row.playerId, row.throws);
  }

  const commandByPlayerSeason = new Map<string, LoadedOutingTask[]>();
  for (const task of commandTasks) {
    const key = combineKey(task.playerId, task.season);
    const next = commandByPlayerSeason.get(key) ?? [];
    next.push(task);
    commandByPlayerSeason.set(key, next);
  }

  const seasonBaselines: Record<number, CommandPlusBaselines> = {};
  for (const season of seasons) {
    seasonBaselines[season] = buildCommandPlusBaselines(
      commandTasks
        .filter((task) => task.season === season)
        .flatMap((task) => task.pitches),
    );
  }

  const stuffByPlayerSeason = new Map<string, Map<string, StuffAggregateValue>>();
  const stuffByPlayerDate = new Map<string, Map<string, StuffAggregateValue>>();
  const stuffDatesByPlayerSeason = new Map<string, Set<string>>();

  for (const row of rawStuffRows) {
    const displayPitchType = getStuffPlusDisplayPitchType(
      row.playerId,
      row.pitchType,
    );
    const seasonKey = combineKey(row.playerId, row.season);
    bumpAggregate(stuffByPlayerSeason, seasonKey, displayPitchType, row.stuffPlus);
    bumpAggregate(
      stuffByPlayerDate,
      dateKey(row.playerId, row.dateId),
      displayPitchType,
      row.stuffPlus,
    );
    const nextDates = stuffDatesByPlayerSeason.get(seasonKey) ?? new Set<string>();
    nextDates.add(row.dateId);
    stuffDatesByPlayerSeason.set(seasonKey, nextDates);
  }

  const playerIds = new Set<string>();
  for (const task of commandTasks) playerIds.add(task.playerId);
  for (const row of rawStuffRows) playerIds.add(row.playerId);

  const seasonModels = new Map<string, SeasonModel>();
  for (const playerId of playerIds) {
    for (const season of seasons) {
      const key = combineKey(playerId, season);
      const tasks = commandByPlayerSeason.get(key) ?? [];
      const pitches = tasks.flatMap((task) => task.pitches);
      const commandResult =
        pitches.length > 0
          ? computeCommandPlus(
              pitches,
              seasonBaselines[season] ?? {},
            )
          : null;
      const stuffPitches = averageAggregateMap(stuffByPlayerSeason.get(key));
      const stuffPlus = computeTotalStuffPlus(stuffPitches);
      const pitchingResult =
        commandResult !== null
          ? computePitchingPlus(playerId, commandResult, stuffPitches)
          : null;

      if (tasks.length === 0 && stuffPitches.length === 0) {
        continue;
      }

      seasonModels.set(key, {
        playerId,
        playerName: playerNames.get(playerId) ?? playerId,
        throws: playerThrows.get(playerId) ?? null,
        season,
        outingCount: tasks.length,
        trackedPitchCount: pitches.length,
        stuffSessionCount: stuffDatesByPlayerSeason.get(key)?.size ?? 0,
        commandResult,
        stuffPitches,
        stuffPlus,
        pitchingResult,
      });
    }
  }

  const playerRows: PlusPlayerRow[] = [];
  for (const playerId of playerIds) {
    const seasonEntries = seasons
      .map((season) => seasonModels.get(combineKey(playerId, season)))
      .filter((value): value is SeasonModel => value !== undefined);
    if (seasonEntries.length === 0) continue;

    const combinedStuff = new Map<string, StuffAggregateValue>();
    let outingCount = 0;
    let trackedPitchCount = 0;
    let stuffSessionCount = 0;
    let commandWeighted = 0;
    let commandWeight = 0;
    let pitchingWeighted = 0;
    let pitchingWeight = 0;
    let stuffComponentWeighted = 0;
    let commandComponentWeighted = 0;
    const overlapTypes = new Set<string>();
    const eligibleTypes = new Set<string>();

    for (const entry of seasonEntries) {
      outingCount += entry.outingCount;
      trackedPitchCount += entry.trackedPitchCount;
      stuffSessionCount += entry.stuffSessionCount;

      for (const row of entry.stuffPitches) {
        const next = combinedStuff.get(row.pitchType) ?? { sum: 0, count: 0 };
        if (row.meanStuffPlus !== null) {
          next.sum += row.meanStuffPlus;
          next.count += 1;
          combinedStuff.set(row.pitchType, next);
        }
      }

      const commandResult = entry.commandResult;
      if (
        commandResult &&
        commandResult.overall !== null &&
        commandResult.qualifiedPitchCount > 0
      ) {
        commandWeighted +=
          commandResult.overall * commandResult.qualifiedPitchCount;
        commandWeight += commandResult.qualifiedPitchCount;
      }

      if (entry.pitchingResult) {
        for (const pitchRow of entry.pitchingResult.pitchTypeRows) {
          eligibleTypes.add(pitchRow.commandPitchType);
          if (pitchRow.included) {
            overlapTypes.add(pitchRow.commandPitchType);
          }
        }
      }

      if (
        entry.pitchingResult?.ready &&
        entry.pitchingResult.overall !== null &&
        entry.pitchingResult.overlapPitchCount > 0
      ) {
        pitchingWeighted +=
          entry.pitchingResult.overall * entry.pitchingResult.overlapPitchCount;
        pitchingWeight += entry.pitchingResult.overlapPitchCount;
        if (entry.pitchingResult.stuffComponent !== null) {
          stuffComponentWeighted +=
            entry.pitchingResult.stuffComponent *
            entry.pitchingResult.overlapPitchCount;
        }
        if (entry.pitchingResult.commandComponent !== null) {
          commandComponentWeighted +=
            entry.pitchingResult.commandComponent *
            entry.pitchingResult.overlapPitchCount;
        }
      }
    }

    const combinedStuffPitches = averageAggregateMap(combinedStuff);
    const combinedStuffPlus = computeTotalStuffPlus(combinedStuffPitches);
    const ready = pitchingWeight > 0;
    let notReadyReason: PlusNotReadyReason | null = null;
    if (!ready) {
      if (commandWeight === 0) {
        notReadyReason = "missing_live_command";
      } else if (combinedStuffPitches.length === 0) {
        notReadyReason = "missing_stuff";
      } else {
        notReadyReason = "no_overlap";
      }
    }

    playerRows.push({
      playerId,
      playerName: playerNames.get(playerId) ?? playerId,
      throws: playerThrows.get(playerId) ?? null,
      outingCount,
      trackedPitchCount,
      stuffSessionCount,
      stuffPlus: combinedStuffPlus,
      commandPlus: commandWeight > 0 ? commandWeighted / commandWeight : null,
      pitchingPlus: ready ? pitchingWeighted / pitchingWeight : null,
      stuffComponent: ready ? stuffComponentWeighted / pitchingWeight : null,
      commandComponent: ready ? commandComponentWeighted / pitchingWeight : null,
      overlapPitchCount: pitchingWeight,
      overlapPitchTypeCount: overlapTypes.size,
      qualifiedCommandPitchTypeCount: eligibleTypes.size,
      qualifiedStuffPitchTypeCount: combinedStuffPitches.length,
      ready,
      notReadyReason,
    });
  }

  const pitchTypeAccumulator = new Map<
    string,
    {
      row: Omit<PlusPitchTypeRow, "usageShare" | "stuffPlus" | "commandPlus" | "pitchingPlus" | "reason">;
      stuffWeighted: number;
      stuffWeight: number;
      commandWeighted: number;
      commandWeight: number;
      pitchingWeighted: number;
      pitchingWeight: number;
      reasonCounts: Map<Exclude<PitchingPlusPitchTypeReason, null>, number>;
    }
  >();

  for (const entry of seasonModels.values()) {
    if (!entry.commandResult) continue;
    const pitchingResult =
      entry.pitchingResult ??
      computePitchingPlus(entry.playerId, entry.commandResult, entry.stuffPitches);
    const pitchRows = buildPitchRows(
      entry.playerId,
      entry.commandResult,
      entry.stuffPitches,
      pitchingResult,
    );

    for (const pitchRow of pitchRows) {
      const key = `${entry.playerId}:${pitchRow.commandPitchType}`;
      const existing = pitchTypeAccumulator.get(key) ?? {
        row: {
          playerId: entry.playerId,
          playerName: entry.playerName,
          throws: entry.throws,
          commandPitchType: pitchRow.commandPitchType,
          pitchLabel:
            pitchRow.stuffPitchTypes.length === 1
              ? pitchRow.stuffPitchTypes[0]
              : pitchRow.stuffPitchTypes.length > 1
                ? `${pitchRow.stuffPitchTypes[0]} +${pitchRow.stuffPitchTypes.length - 1}`
                : pitchRow.commandPitchType,
          commandCount: 0,
          includedInPitchingPlus: false,
        },
        stuffWeighted: 0,
        stuffWeight: 0,
        commandWeighted: 0,
        commandWeight: 0,
        pitchingWeighted: 0,
        pitchingWeight: 0,
        reasonCounts: new Map<Exclude<PitchingPlusPitchTypeReason, null>, number>(),
      };

      existing.row.commandCount += pitchRow.commandCount;
      existing.row.includedInPitchingPlus =
        existing.row.includedInPitchingPlus || pitchRow.included;

      if (pitchRow.stuffPitchTypes.length > 0) {
        existing.row.pitchLabel =
          pitchRow.stuffPitchTypes.length === 1
            ? pitchRow.stuffPitchTypes[0]
            : `${pitchRow.stuffPitchTypes[0]} +${pitchRow.stuffPitchTypes.length - 1}`;
      }

      if (pitchRow.stuffPlus !== null) {
        existing.stuffWeighted += pitchRow.stuffPlus * pitchRow.commandCount;
        existing.stuffWeight += pitchRow.commandCount;
      }
      if (pitchRow.commandPlus !== null) {
        existing.commandWeighted += pitchRow.commandPlus * pitchRow.commandCount;
        existing.commandWeight += pitchRow.commandCount;
      }
      if (pitchRow.pitchingPlus !== null) {
        existing.pitchingWeighted += pitchRow.pitchingPlus * pitchRow.commandCount;
        existing.pitchingWeight += pitchRow.commandCount;
      }
      if (pitchRow.reason) {
        const next = existing.reasonCounts.get(pitchRow.reason) ?? 0;
        existing.reasonCounts.set(pitchRow.reason, next + 1);
      }

      pitchTypeAccumulator.set(key, existing);
    }
  }

  const includedCountsByPlayer = new Map<string, number>();
  for (const value of pitchTypeAccumulator.values()) {
    if (!value.row.includedInPitchingPlus) continue;
    const next = includedCountsByPlayer.get(value.row.playerId) ?? 0;
    includedCountsByPlayer.set(value.row.playerId, next + value.row.commandCount);
  }

  const pitchTypeRows: PlusPitchTypeRow[] = Array.from(pitchTypeAccumulator.values()).map(
    (value) => ({
      ...value.row,
      usageShare:
        value.row.includedInPitchingPlus &&
        (includedCountsByPlayer.get(value.row.playerId) ?? 0) > 0
          ? value.row.commandCount /
            (includedCountsByPlayer.get(value.row.playerId) as number)
          : 0,
      stuffPlus:
        value.stuffWeight > 0 ? value.stuffWeighted / value.stuffWeight : null,
      commandPlus:
        value.commandWeight > 0
          ? value.commandWeighted / value.commandWeight
          : null,
      pitchingPlus:
        value.pitchingWeight > 0
          ? value.pitchingWeighted / value.pitchingWeight
          : null,
      reason: value.row.includedInPitchingPlus ? null : topReason(value.reasonCounts),
    }),
  );

  const sessionRows: PlusSessionRow[] = commandTasks
    .map((task) => {
      const stuffPitches = averageAggregateMap(
        stuffByPlayerDate.get(dateKey(task.playerId, task.dateId)),
      );
      const stuffPlus = computeTotalStuffPlus(stuffPitches);
      const pitchingResult = computePitchingPlus(
        task.playerId,
        task.commandResult,
        stuffPitches,
      );

      return {
        playerId: task.playerId,
        playerName: task.playerName,
        throws: task.throws,
        outingId: task.outingId,
        dateId: task.dateId,
        season: task.season,
        trackedPitchCount: task.pitches.length,
        stuffSessionPitchTypeCount: stuffPitches.length,
        stuffPlus,
        commandPlus: task.commandResult.overall,
        pitchingPlus: pitchingResult.ready ? pitchingResult.overall : null,
        overlapPitchCount: pitchingResult.ready
          ? pitchingResult.overlapPitchCount
          : 0,
        overlapPitchTypeCount: pitchingResult.ready
          ? pitchingResult.overlapPitchTypeCount
          : 0,
        ready: pitchingResult.ready,
        notReadyReason: pitchingResult.ready ? null : pitchingResult.reason,
      };
    })
    .sort(sessionSort);

  playerRows.sort(playerSort);
  pitchTypeRows.sort(pitchTypeSort);

  return {
    generatedAt: new Date().toISOString(),
    seasonFilter,
    players: playerRows,
    pitchTypes: pitchTypeRows,
    sessions: sessionRows,
  };
}
