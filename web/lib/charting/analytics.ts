import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  chartingGames,
  chartingPitcherSegments,
  chartingPitches,
} from "@/db/schema";
import { countPitcherInnings } from "./innings";
import {
  legacyChartingPlateAppearances,
  mapLegacyPlateAppearanceRow,
} from "./plateAppearanceStorage";
import type {
  ChartingPitch,
  ChartingPlateAppearance,
  PitchResult,
  PitchType,
} from "./types";

const STRIKE_RESULTS: PitchResult[] = [
  "called_strike",
  "swinging_strike",
  "foul",
  "in_play",
  "bunt_foul",
];
const SWING_RESULTS: PitchResult[] = [
  "swinging_strike",
  "in_play",
  "foul",
  "bunt_foul",
];
const CONTACT_RESULTS: PitchResult[] = ["in_play", "foul", "bunt_foul"];
const PITCH_TYPES: PitchType[] = [
  "Fastball",
  "Curveball",
  "Slider",
  "Changeup",
  "Split/Cut",
  "Other",
];
const FASTBALL_TYPES: PitchType[] = ["Fastball"];
const BREAKING_TYPES: PitchType[] = ["Curveball", "Slider"];
const OFFSPEED_TYPES: PitchType[] = ["Changeup", "Split/Cut", "Other"];

export interface SegmentStats {
  totalPitches: number;
  strikePct: number | null;
  zonePct: number | null;
  baa: number | null;
  babip: number | null;
  whip: number | null;
  whiffPct: number | null;
  chasePct: number | null;
  fpsPct: number | null;
  kPct: number | null;
  bbPct: number | null;
  pitchMix: Record<PitchType, number>;
  pitchMixPct: Record<PitchType, number>;
}

export interface AggregateOptions {
  from?: Date;
  to?: Date;
  gameIds?: string[];
}

export interface AggregatedPitcherStats extends SegmentStats {
  sessions: number;
  innings: number;
  totalPAs: number;
}

export interface PitchGroupStats {
  pitches: number;
  swings: number;
  whiffs: number;
  whiffPct: number | null;
}

export interface HitterStats {
  totalPitches: number;
  totalPAs: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  chasePct: number | null;
  contactPct: number | null;
  whiffPct: number | null;
  kPct: number | null;
  bbPct: number | null;
  zoneWfPct: number | null;
  zoneSwingPct: number | null;
  babip: number | null;
  iso: number | null;
  zoneFrequency: Partial<Record<number, number>>;
  vsFastball: PitchGroupStats;
  vsBreaking: PitchGroupStats;
  vsOffspeed: PitchGroupStats;
}

export interface AggregatedHitterStats extends HitterStats {
  sessions: number;
}

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function emptyPitchMix(): Record<PitchType, number> {
  return {
    Fastball: 0,
    Curveball: 0,
    Slider: 0,
    Changeup: 0,
    "Split/Cut": 0,
    Other: 0,
  };
}

function isLocatedPitch(
  pitch: ChartingPitch
): pitch is ChartingPitch & { locationCell: number } {
  return pitch.locationCell !== null;
}

function isClosedPa(
  pa: ChartingPlateAppearance
): pa is ChartingPlateAppearance & { resultCode: string } {
  return pa.resultCode !== null;
}

function isStrikeout(resultCode: string | null): boolean {
  return resultCode === "K" || resultCode === "KL";
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getDb() {
  const { db } = await import("@/db");
  return db;
}

function intersectGameIds(
  baseIds: string[] | null,
  incomingIds: string[]
): string[] {
  const uniqueIncomingIds = [...new Set(incomingIds)];
  if (baseIds === null) {
    return uniqueIncomingIds;
  }

  const incomingSet = new Set(uniqueIncomingIds);
  return baseIds.filter((id) => incomingSet.has(id));
}

async function resolveFilteredGameIds(
  options?: AggregateOptions
): Promise<string[] | null> {
  if (!options?.from && !options?.to && !options?.gameIds) {
    return null;
  }

  let filteredGameIds = options?.gameIds
    ? [...new Set(options.gameIds)]
    : null;

  if (filteredGameIds && filteredGameIds.length === 0) {
    return [];
  }

  if (options?.from || options?.to) {
    const db = await getDb();
    const fromDate = options.from ? toDateKey(options.from) : null;
    const toDate = options.to ? toDateKey(options.to) : null;
    const dateFilter =
      fromDate && toDate
        ? and(
          gte(chartingGames.gameDate, fromDate),
          lte(chartingGames.gameDate, toDate)
        )
        : fromDate
          ? gte(chartingGames.gameDate, fromDate)
          : lte(chartingGames.gameDate, toDate!);
    const games = await db
      .select({ id: chartingGames.id })
      .from(chartingGames)
      .where(dateFilter)
      .orderBy(asc(chartingGames.gameDate));

    filteredGameIds = intersectGameIds(
      filteredGameIds,
      games.map((game) => game.id)
    );
  }

  return filteredGameIds;
}

function mapPitchRows(rows: typeof chartingPitches.$inferSelect[]): ChartingPitch[] {
  return rows.map(
    (pitch) =>
      ({
        ...pitch,
        pitchType: pitch.pitchType as ChartingPitch["pitchType"],
        pitchResult: pitch.pitchResult as ChartingPitch["pitchResult"],
      }) satisfies ChartingPitch
  );
}

function mapPlateAppearanceRows(
  rows: typeof legacyChartingPlateAppearances.$inferSelect[]
): ChartingPlateAppearance[] {
  return rows.map(mapLegacyPlateAppearanceRow);
}

function computePitchGroup(
  pitches: ChartingPitch[],
  types: PitchType[]
): PitchGroupStats {
  const group = pitches.filter((pitch) => types.includes(pitch.pitchType));
  const swings = group.filter((pitch) =>
    SWING_RESULTS.includes(pitch.pitchResult)
  ).length;
  const whiffs = group.filter(
    (pitch) => pitch.pitchResult === "swinging_strike"
  ).length;

  return {
    pitches: group.length,
    swings,
    whiffs,
    whiffPct: pct(whiffs, swings),
  };
}

export function computeSegmentStats_pure(
  pitches: ChartingPitch[],
  pas: ChartingPlateAppearance[]
): SegmentStats | null {
  if (pitches.length === 0 || pas.length === 0) {
    return null;
  }

  const locatedPitches = pitches.filter(isLocatedPitch);
  const outOfZoneLocatedPitches = locatedPitches.filter(
    (pitch) => pitch.locationCell > 9
  );
  const swings = pitches.filter((pitch) =>
    SWING_RESULTS.includes(pitch.pitchResult)
  ).length;
  const whiffs = pitches.filter(
    (pitch) => pitch.pitchResult === "swinging_strike"
  ).length;
  const strikeCount = pitches.filter((pitch) =>
    STRIKE_RESULTS.includes(pitch.pitchResult)
  ).length;
  const inZoneCount = locatedPitches.filter(
    (pitch) => pitch.locationCell >= 1 && pitch.locationCell <= 9
  ).length;
  const chaseSwings = outOfZoneLocatedPitches.filter((pitch) =>
    SWING_RESULTS.includes(pitch.pitchResult)
  ).length;
  const firstPitches = pitches.filter(
    (pitch) => pitch.ballsBefore === 0 && pitch.strikesBefore === 0
  );
  const firstPitchStrikes = firstPitches.filter((pitch) =>
    STRIKE_RESULTS.includes(pitch.pitchResult)
  ).length;
  const closedPas = pas.filter(isClosedPa);
  const strikeoutCount = closedPas.filter((pa) =>
    isStrikeout(pa.resultCode)
  ).length;
  const walkCount = closedPas.filter((pa) => pa.resultCode === "BB").length;
  const hbpCount = closedPas.filter((pa) => pa.resultCode === "HBP").length;

  const singles = closedPas.filter((pa) => pa.resultCode === "1B").length;
  const doubles = closedPas.filter((pa) => pa.resultCode === "2B").length;
  const triples = closedPas.filter((pa) => pa.resultCode === "3B").length;
  const homeRuns = closedPas.filter((pa) => pa.resultCode === "HR").length;

  const hits = singles + doubles + triples + homeRuns;
  const atBats = closedPas.length - walkCount - hbpCount;
  const baa = atBats > 0 ? hits / atBats : null;

  // WHIP Calculation: (Walks + Hits) / Innings Pitched
  // Preserve the raw numerator here and defer inning scaling to aggregation,
  // which has access to the full inning span for the outing.
  const whip = (walkCount + hits);

  // BABIP Calculation: (H - HR) / (AB - K - HR + SF)
  // Re-deriving in-play at bats. We don't currently track SF distinctively in charting, 
  // so (AB - K - HR) is the closest approximation with current data structure.
  const babipDenominator = atBats - strikeoutCount - homeRuns;
  const babip = babipDenominator > 0 ? (hits - homeRuns) / babipDenominator : null;

  const pitchMix = emptyPitchMix();

  for (const pitch of pitches) {
    pitchMix[pitch.pitchType] += 1;
  }

  const pitchMixPct = PITCH_TYPES.reduce<Record<PitchType, number>>(
    (mix, pitchType) => {
      mix[pitchType] = pct(pitchMix[pitchType], pitches.length) ?? 0;
      return mix;
    },
    emptyPitchMix()
  );

  return {
    totalPitches: pitches.length,
    strikePct: pct(strikeCount, pitches.length),
    zonePct: pct(inZoneCount, locatedPitches.length),
    baa,
    babip,
    whip,
    whiffPct: pct(whiffs, swings),
    chasePct: pct(chaseSwings, outOfZoneLocatedPitches.length),
    fpsPct: pct(firstPitchStrikes, firstPitches.length),
    kPct: pct(strikeoutCount, closedPas.length),
    bbPct: pct(walkCount, closedPas.length),
    pitchMix,
    pitchMixPct,
  };
}

export async function computeSegmentStats(
  segmentId: string
): Promise<SegmentStats | null> {
  const db = await getDb();
  const pas = mapPlateAppearanceRows(
    await db
      .select()
      .from(legacyChartingPlateAppearances)
      .where(eq(legacyChartingPlateAppearances.segmentId, segmentId))
      .orderBy(asc(legacyChartingPlateAppearances.paOrder))
  );

  if (pas.length === 0) {
    return null;
  }

  const paIds = pas.map((pa) => pa.id);
  if (paIds.length === 0) {
    return null;
  }

  const pitches = mapPitchRows(
    await db
      .select()
      .from(chartingPitches)
      .where(inArray(chartingPitches.paId, paIds))
      .orderBy(asc(chartingPitches.pitchOrder))
  );

  return computeSegmentStats_pure(pitches, pas);
}

export function computePitcherAggregation(
  allPitches: ChartingPitch[],
  allPas: ChartingPlateAppearance[],
  sessions: number,
  innings: number
): AggregatedPitcherStats | null {
  const base = computeSegmentStats_pure(allPitches, allPas);
  if (!base) {
    return null;
  }

  // Re-scale WHIP using the caller-supplied inning count.
  let trueWhip: number | null = null;
  if (base.whip !== null && innings > 0) {
    trueWhip = base.whip / innings;
  }

  return {
    ...base,
    whip: trueWhip,
    sessions,
    innings,
    totalPAs: allPas.length,
  };
}

export async function aggregatePitcherStats(
  playerId: string,
  options?: AggregateOptions
): Promise<AggregatedPitcherStats | null> {
  const db = await getDb();
  const filteredGameIds = await resolveFilteredGameIds(options);
  if (filteredGameIds !== null && filteredGameIds.length === 0) {
    return null;
  }

  const segmentFilter =
    filteredGameIds === null
      ? eq(chartingPitcherSegments.playerId, playerId)
      : and(
        eq(chartingPitcherSegments.playerId, playerId),
        inArray(chartingPitcherSegments.gameId, filteredGameIds)
      );
  const segments = await db
    .select()
    .from(chartingPitcherSegments)
    .where(segmentFilter)
    .orderBy(asc(chartingPitcherSegments.segmentOrder));

  if (segments.length === 0) {
    return null;
  }

  const segmentIds = segments.map((segment) => segment.id);
  if (segmentIds.length === 0) {
    return null;
  }

  const pas = mapPlateAppearanceRows(
    await db
      .select()
      .from(legacyChartingPlateAppearances)
      .where(inArray(legacyChartingPlateAppearances.segmentId, segmentIds))
      .orderBy(asc(legacyChartingPlateAppearances.paOrder))
  );

  if (pas.length === 0) {
    return null;
  }

  const paIds = pas.map((pa) => pa.id);
  if (paIds.length === 0) {
    return null;
  }

  const pitches = mapPitchRows(
    await db
      .select()
      .from(chartingPitches)
      .where(inArray(chartingPitches.paId, paIds))
      .orderBy(asc(chartingPitches.pitchOrder))
  );

  const sessions = new Set(segments.map((s) => s.gameId)).size;
  const innings = countPitcherInnings(segments, pas);

  return computePitcherAggregation(pitches, pas, sessions, innings);
}

export function computeHitterStats_pure(
  pitches: ChartingPitch[],
  pas: ChartingPlateAppearance[]
): HitterStats | null {
  if (pitches.length === 0 || pas.length === 0) {
    return null;
  }

  const locatedPitches = pitches.filter(isLocatedPitch);
  const outOfZoneLocatedPitches = locatedPitches.filter(
    (pitch) => pitch.locationCell > 9
  );
  const outOfZoneSwings = outOfZoneLocatedPitches.filter((pitch) =>
    SWING_RESULTS.includes(pitch.pitchResult)
  ).length;

  const inZoneLocatedPitches = locatedPitches.filter(
    (pitch) => pitch.locationCell >= 1 && pitch.locationCell <= 9
  );
  const inZoneSwings = inZoneLocatedPitches.filter((pitch) =>
    SWING_RESULTS.includes(pitch.pitchResult)
  ).length;
  const inZoneWhiffs = inZoneLocatedPitches.filter(
    (pitch) => pitch.pitchResult === "swinging_strike"
  ).length;

  const whiffs = pitches.filter(
    (pitch) => pitch.pitchResult === "swinging_strike"
  ).length;
  const contacts = pitches.filter((pitch) =>
    CONTACT_RESULTS.includes(pitch.pitchResult)
  ).length;
  const swings = contacts + whiffs;
  const closedPas = pas.filter(isClosedPa);
  const strikeoutCount = closedPas.filter((pa) =>
    isStrikeout(pa.resultCode)
  ).length;
  const walkCount = closedPas.filter((pa) => pa.resultCode === "BB").length;
  const hbpCount = closedPas.filter((pa) => pa.resultCode === "HBP").length;

  const singles = closedPas.filter((pa) => pa.resultCode === "1B").length;
  const doubles = closedPas.filter((pa) => pa.resultCode === "2B").length;
  const triples = closedPas.filter((pa) => pa.resultCode === "3B").length;
  const homeRuns = closedPas.filter((pa) => pa.resultCode === "HR").length;

  const hits = singles + doubles + triples + homeRuns;
  const totalBases = singles + 2 * doubles + 3 * triples + 4 * homeRuns;
  const atBats = closedPas.length - walkCount - hbpCount;

  const avg = atBats > 0 ? hits / atBats : null;
  const obp =
    closedPas.length > 0
      ? (hits + walkCount + hbpCount) / closedPas.length
      : null;
  const slg = atBats > 0 ? totalBases / atBats : null;
  const ops = obp !== null ? obp + (slg ?? 0) : null;
  const iso = slg !== null && avg !== null ? slg - avg : null;

  // BABIP Calculation: (H - HR) / (AB - K - HR + SF)
  // Re-deriving in-play at bats. We don't currently track SF distinctively in charting, 
  // so (AB - K - HR) is the closest approximation with current data structure.
  const babipDenominator = atBats - strikeoutCount - homeRuns;
  const babip = babipDenominator > 0 ? (hits - homeRuns) / babipDenominator : null;

  const zoneFrequency = locatedPitches.reduce<Partial<Record<number, number>>>(
    (frequency, pitch) => {
      frequency[pitch.locationCell] = (frequency[pitch.locationCell] ?? 0) + 1;
      return frequency;
    },
    {}
  );

  return {
    totalPitches: pitches.length,
    totalPAs: pas.length,
    avg,
    obp,
    slg,
    ops,
    chasePct: pct(outOfZoneSwings, outOfZoneLocatedPitches.length),
    contactPct: pct(contacts, contacts + whiffs),
    whiffPct: pct(whiffs, swings),
    zoneWfPct: pct(inZoneWhiffs, inZoneSwings),
    zoneSwingPct: pct(inZoneSwings, inZoneLocatedPitches.length),
    kPct: pct(strikeoutCount, closedPas.length),
    bbPct: pct(walkCount, closedPas.length),
    babip,
    iso,
    zoneFrequency,
    vsFastball: computePitchGroup(pitches, FASTBALL_TYPES),
    vsBreaking: computePitchGroup(pitches, BREAKING_TYPES),
    vsOffspeed: computePitchGroup(pitches, OFFSPEED_TYPES),
  };
}

export async function computeHitterStats(
  hitterName: string,
  gameId: string
): Promise<HitterStats | null> {
  const db = await getDb();
  const pas = mapPlateAppearanceRows(
    (
      await db
        .select()
        .from(legacyChartingPlateAppearances)
        .where(eq(legacyChartingPlateAppearances.gameId, gameId))
        .orderBy(asc(legacyChartingPlateAppearances.paOrder))
    ).filter((pa) => pa.hitterName === hitterName)
  );

  if (pas.length === 0) {
    return null;
  }

  const paIds = pas.map((pa) => pa.id);
  if (paIds.length === 0) {
    return null;
  }

  const pitches = mapPitchRows(
    await db
      .select()
      .from(chartingPitches)
      .where(inArray(chartingPitches.paId, paIds))
      .orderBy(asc(chartingPitches.pitchOrder))
  );

  return computeHitterStats_pure(pitches, pas);
}

export function computeHitterAggregation(
  allPitches: ChartingPitch[],
  allPas: ChartingPlateAppearance[],
  sessions: number
): AggregatedHitterStats | null {
  const base = computeHitterStats_pure(allPitches, allPas);
  if (!base) {
    return null;
  }

  return {
    ...base,
    sessions,
  };
}

export async function aggregateHitterStats(
  hitterName: string,
  options?: AggregateOptions
): Promise<AggregatedHitterStats | null> {
  const db = await getDb();
  const filteredGameIds = await resolveFilteredGameIds(options);
  if (filteredGameIds !== null && filteredGameIds.length === 0) {
    return null;
  }

  // Fetch-all is acceptable for this internal dataset size; revisit if volume grows materially.
  const pas = mapPlateAppearanceRows(
    filteredGameIds === null
      ? await db
        .select()
        .from(legacyChartingPlateAppearances)
        .orderBy(
          asc(legacyChartingPlateAppearances.gameId),
          asc(legacyChartingPlateAppearances.paOrder)
        )
      : await db
        .select()
        .from(legacyChartingPlateAppearances)
        .where(inArray(legacyChartingPlateAppearances.gameId, filteredGameIds))
        .orderBy(
          asc(legacyChartingPlateAppearances.gameId),
          asc(legacyChartingPlateAppearances.paOrder)
        )
  ).filter((pa) => pa.hitterName === hitterName);

  if (pas.length === 0) {
    return null;
  }

  const paIds = pas.map((pa) => pa.id);
  if (paIds.length === 0) {
    return null;
  }

  const pitches = mapPitchRows(
    await db
      .select()
      .from(chartingPitches)
      .where(inArray(chartingPitches.paId, paIds))
      .orderBy(asc(chartingPitches.pitchOrder))
  );
  const sessions = new Set(pas.map((pa) => pa.gameId)).size;

  return computeHitterAggregation(pitches, pas, sessions);
}
