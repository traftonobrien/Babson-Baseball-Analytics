import {
  baserunnerStateFromPlateAppearance,
  isPAResultType,
  resolvePlateAppearanceInitialCount,
} from "@/lib/charting/live";
import type {
  ChartingBootstrapPitcher,
  ChartingBaserunnerState,
  ChartingGameSnapshot,
} from "@/lib/charting/types";

import type {
  HistoryPitcherOption,
  RecentPAGroup,
  RecentPitchRow,
} from "./types";

export const buildRecentPitchRows = (
  snapshot: ChartingGameSnapshot,
): RecentPitchRow[] => {
  const plateAppearancesById = new Map(
    snapshot.plateAppearances.map((plateAppearance) => [plateAppearance.id, plateAppearance]),
  );

  return [...snapshot.pitches]
    .sort((left, right) => left.pitchOrder - right.pitchOrder)
    .map((pitch) => {
      const plateAppearance = plateAppearancesById.get(pitch.paId);
      return {
        id: pitch.id,
        paId: pitch.paId,
        order: pitch.pitchOrder + 1,
        hitterName: plateAppearance?.hitterName ?? "Unknown Hitter",
        inning: plateAppearance?.inning ?? 1,
        count: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
        pitchType: pitch.pitchType,
        pitchResult: pitch.pitchResult,
        velocity: pitch.velocity,
        paResult: plateAppearance?.resultCode ?? null,
      };
    });
};

export const buildRecentPAGroups = (
  snapshot: ChartingGameSnapshot,
): RecentPAGroup[] => {
  const rows = buildRecentPitchRows(snapshot);
  const segmentsById = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
  const rowsByPlateAppearance = new Map<string, RecentPitchRow[]>();
  const rawPitchesByPlateAppearance = new Map<string, ChartingGameSnapshot["pitches"]>();

  for (const row of rows) {
    const currentRows = rowsByPlateAppearance.get(row.paId) ?? [];
    currentRows.push(row);
    rowsByPlateAppearance.set(row.paId, currentRows);
  }

  for (const pitch of snapshot.pitches) {
    const currentPitches = rawPitchesByPlateAppearance.get(pitch.paId) ?? [];
    currentPitches.push(pitch);
    rawPitchesByPlateAppearance.set(pitch.paId, currentPitches);
  }

  return [...snapshot.plateAppearances]
    .sort((left, right) => left.paOrder - right.paOrder)
    .filter((plateAppearance) => rowsByPlateAppearance.has(plateAppearance.id))
    .map((plateAppearance) => {
      const pitches = rowsByPlateAppearance.get(plateAppearance.id) ?? [];
      const segment = segmentsById.get(plateAppearance.segmentId);
      const rawPitches = rawPitchesByPlateAppearance.get(plateAppearance.id) ?? [];

      return {
        paId: plateAppearance.id,
        inning: plateAppearance.inning,
        isTopInning: plateAppearance.isTopInning,
        hitterName: plateAppearance.hitterName,
        pitcherId: segment?.playerId ?? "",
        pitcherName: segment?.displayName ?? "Unknown Pitcher",
        initialCount: resolvePlateAppearanceInitialCount(plateAppearance, rawPitches),
        paResult:
          plateAppearance.resultCode && isPAResultType(plateAppearance.resultCode)
            ? plateAppearance.resultCode
            : null,
        baserunners: baserunnerStateFromPlateAppearance(plateAppearance),
        pitches,
      };
    });
};

export const buildHistoryPitcherOptions = (
  snapshot: ChartingGameSnapshot,
  pitchers: ChartingBootstrapPitcher[],
): HistoryPitcherOption[] => {
  const options = new Map<string, HistoryPitcherOption>();

  for (const pitcher of pitchers) {
    options.set(pitcher.playerId, {
      playerId: pitcher.playerId,
      name: pitcher.name,
    });
  }

  for (const segment of snapshot.segments) {
    if (segment.playerId && !options.has(segment.playerId)) {
      options.set(segment.playerId, {
        playerId: segment.playerId,
        name: segment.displayName,
      });
    }
  }

  return [...options.values()].sort((left, right) => left.name.localeCompare(right.name));
};

export const formatBaserunnerSummary = (
  baserunners: ChartingBaserunnerState,
): string => {
  const pieces = [
    baserunners.runnerOnFirst ? `1B ${baserunners.runnerOnFirst}` : null,
    baserunners.runnerOnSecond ? `2B ${baserunners.runnerOnSecond}` : null,
    baserunners.runnerOnThird ? `3B ${baserunners.runnerOnThird}` : null,
  ].filter(Boolean);

  return pieces.length > 0 ? pieces.join(" • ") : "Bases empty";
};

export const findHistoryPitcherOptionByName = (
  options: HistoryPitcherOption[],
  name: string,
): HistoryPitcherOption | null => {
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedName) {
    return null;
  }

  return (
    options.find((option) => option.name.trim().toLowerCase() === normalizedName) ??
    null
  );
};
