import {
  computeHitterStats_pure,
  computeSegmentStats_pure,
  type HitterStats,
  type SegmentStats,
} from "./analytics";
import type {
  ChartingMatchupSide,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  PitchType,
} from "./types";

const HIT_RESULT_CODES = new Set(["1B", "2B", "3B", "HR"]);

export interface OutcomeSummary {
  strikeouts: number;
  walks: number;
  hitByPitch: number;
  hits: number;
  outs: number;
  closedPas: number;
  openPas: number;
  results: string[];
}

export interface PitchMixEntry {
  pitchType: PitchType;
  count: number;
  pct: number;
}

export interface PitcherOverviewModel {
  pitcherKey: string;
  pitcherId: string | null;
  teamSide: ChartingMatchupSide;
  displayName: string;
  segments: ChartingPitcherSegment[];
  pitches: ChartingPitch[];
  plateAppearances: ChartingPlateAppearance[];
  stats: SegmentStats | null;
  pitchMixEntries: PitchMixEntry[];
  zoneFrequency: Partial<Record<number, number>>;
  outcomes: OutcomeSummary;
}

export interface HitterOverviewModel {
  hitterKey: string;
  teamSide: ChartingMatchupSide;
  hitterName: string;
  lineupSlot: number;
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
  stats: HitterStats | null;
  zoneFrequency: Partial<Record<number, number>>;
  outcomes: OutcomeSummary;
}

export function buildZoneFrequency(
  pitches: ChartingPitch[],
): Partial<Record<number, number>> {
  return pitches.reduce<Partial<Record<number, number>>>((frequency, pitch) => {
    if (pitch.locationCell === null) {
      return frequency;
    }

    frequency[pitch.locationCell] = (frequency[pitch.locationCell] ?? 0) + 1;
    return frequency;
  }, {});
}

export function summarizeOutcomes(
  plateAppearances: ChartingPlateAppearance[],
): OutcomeSummary {
  const summary: OutcomeSummary = {
    strikeouts: 0,
    walks: 0,
    hitByPitch: 0,
    hits: 0,
    outs: 0,
    closedPas: 0,
    openPas: 0,
    results: [],
  };

  for (const plateAppearance of plateAppearances) {
    const resultCode = plateAppearance.resultCode;
    if (!resultCode) {
      summary.openPas += 1;
      continue;
    }

    summary.closedPas += 1;
    summary.results.push(resultCode);

    if (resultCode === "K" || resultCode === "KL") {
      summary.strikeouts += 1;
      continue;
    }

    if (resultCode === "BB") {
      summary.walks += 1;
      continue;
    }

    if (resultCode === "HBP") {
      summary.hitByPitch += 1;
      continue;
    }

    if (HIT_RESULT_CODES.has(resultCode)) {
      summary.hits += 1;
      continue;
    }

    summary.outs += 1;
  }

  return summary;
}

function buildPitchMixEntries(stats: SegmentStats | null): PitchMixEntry[] {
  if (!stats) {
    return [];
  }

  return (Object.entries(stats.pitchMix) as Array<[PitchType, number]>)
    .filter(([, count]) => count > 0)
    .map(([pitchType, count]) => ({
      pitchType,
      count,
      pct: stats.pitchMixPct[pitchType] ?? 0,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.pitchType.localeCompare(right.pitchType);
    });
}

function buildPitchesByPaId(
  pitches: ChartingPitch[],
): Map<string, ChartingPitch[]> {
  const pitchesByPaId = new Map<string, ChartingPitch[]>();

  for (const pitch of pitches) {
    const group = pitchesByPaId.get(pitch.paId) ?? [];
    group.push(pitch);
    pitchesByPaId.set(pitch.paId, group);
  }

  return pitchesByPaId;
}

function orderedPitchesForPlateAppearances(
  plateAppearances: ChartingPlateAppearance[],
  pitchesByPaId: Map<string, ChartingPitch[]>,
): ChartingPitch[] {
  return plateAppearances.flatMap((plateAppearance) =>
    [...(pitchesByPaId.get(plateAppearance.id) ?? [])].sort(
      (left, right) => left.pitchOrder - right.pitchOrder,
    ),
  );
}

function pitcherGroupKey(segment: ChartingPitcherSegment): string {
  const playerId = segment.playerId?.trim() ?? "";
  if (playerId) {
    return `player:${playerId}`;
  }

  const normalizedName = segment.displayName.trim().toLowerCase();
  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return `segment:${segment.id}`;
}

export function buildPitcherOverviewModels(
  segments: ChartingPitcherSegment[],
  plateAppearances: ChartingPlateAppearance[],
  pitches: ChartingPitch[],
): PitcherOverviewModel[] {
  const pitchesByPaId = buildPitchesByPaId(pitches);
  const orderedSegments = [...segments].sort(
    (left, right) => left.segmentOrder - right.segmentOrder,
  );
  const segmentsByPitcher = new Map<string, ChartingPitcherSegment[]>();

  for (const segment of orderedSegments) {
    const key = pitcherGroupKey(segment);
    const group = segmentsByPitcher.get(key) ?? [];
    group.push(segment);
    segmentsByPitcher.set(key, group);
  }

  return [...segmentsByPitcher.entries()].map(
    ([pitcherKey, pitcherSegments]) => {
      const segmentIds = new Set(pitcherSegments.map((segment) => segment.id));
      const outingPas = plateAppearances
        .filter((plateAppearance) => segmentIds.has(plateAppearance.segmentId))
        .sort((left, right) => left.paOrder - right.paOrder);
      const outingPitches = orderedPitchesForPlateAppearances(
        outingPas,
        pitchesByPaId,
      );
      const stats = computeSegmentStats_pure(outingPitches, outingPas);
      const leadSegment = pitcherSegments[0];

      return {
        pitcherKey,
        pitcherId: leadSegment?.playerId?.trim() || null,
        teamSide: leadSegment?.teamSide ?? "our",
        displayName: leadSegment?.displayName ?? "Unknown Pitcher",
        segments: pitcherSegments,
        pitches: outingPitches,
        plateAppearances: outingPas,
        stats,
        pitchMixEntries: buildPitchMixEntries(stats),
        zoneFrequency: buildZoneFrequency(outingPitches),
        outcomes: summarizeOutcomes(outingPas),
      };
    },
  );
}

export function buildHitterOverviewModels(
  plateAppearances: ChartingPlateAppearance[],
  pitches: ChartingPitch[],
  lineupEntries?: {
    hitterName: string;
    lineupSlot: number;
    teamSide?: ChartingMatchupSide;
  }[],
): HitterOverviewModel[] {
  const firstSeenOrder = new Map<string, number>();
  const plateAppearancesByHitter = new Map<string, ChartingPlateAppearance[]>();
  const lineupSlots = new Map<string, number>();
  const hitterMeta = new Map<
    string,
    { hitterName: string; teamSide: ChartingMatchupSide }
  >();

  const hitterKeyFor = (hitterName: string, teamSide: ChartingMatchupSide) =>
    `${teamSide}:${hitterName.trim().toLowerCase()}`;

  if (lineupEntries) {
    for (const entry of lineupEntries) {
      const hitterName = entry.hitterName.trim();
      const teamSide = entry.teamSide ?? "opponent";
      if (hitterName) {
        const hitterKey = hitterKeyFor(hitterName, teamSide);
        lineupSlots.set(hitterKey, entry.lineupSlot);
        firstSeenOrder.set(hitterKey, entry.lineupSlot);
        plateAppearancesByHitter.set(hitterKey, []);
        hitterMeta.set(hitterKey, { hitterName, teamSide });
      }
    }
  }

  for (const plateAppearance of [...plateAppearances].sort(
    (left, right) => left.paOrder - right.paOrder,
  )) {
    const hitterKey = hitterKeyFor(
      plateAppearance.hitterName,
      plateAppearance.teamSide,
    );
    if (!firstSeenOrder.has(hitterKey)) {
      firstSeenOrder.set(
        hitterKey,
        100 + plateAppearance.paOrder,
      );
    }
    hitterMeta.set(hitterKey, {
      hitterName: plateAppearance.hitterName,
      teamSide: plateAppearance.teamSide,
    });

    const group = plateAppearancesByHitter.get(hitterKey) ?? [];
    group.push(plateAppearance);
    plateAppearancesByHitter.set(hitterKey, group);
  }

  const pitchesByPaId = buildPitchesByPaId(pitches);

  return [...plateAppearancesByHitter.entries()]
    .sort(
      ([leftKey], [rightKey]) =>
        (firstSeenOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER) -
        (firstSeenOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER),
    )
    .map(([hitterKey, hitterPas]) => {
      const orderedPas = [...hitterPas].sort(
        (left, right) => left.paOrder - right.paOrder,
      );
      const hitterPitches = orderedPitchesForPlateAppearances(
        orderedPas,
        pitchesByPaId,
      );
      const stats = computeHitterStats_pure(hitterPitches, orderedPas);
      const meta = hitterMeta.get(hitterKey) ?? {
        hitterName: orderedPas[0]?.hitterName ?? "Unknown Hitter",
        teamSide: orderedPas[0]?.teamSide ?? "opponent",
      };

      return {
        hitterKey,
        hitterName: meta.hitterName,
        teamSide: meta.teamSide,
        lineupSlot:
          orderedPas[0]?.lineupSlot ?? lineupSlots.get(hitterKey) ?? 0,
        plateAppearances: orderedPas,
        pitches: hitterPitches,
        stats,
        zoneFrequency: buildZoneFrequency(hitterPitches),
        outcomes: summarizeOutcomes(orderedPas),
      };
    });
}
