import type { ChartingPitch, ChartingPlateAppearance, PitchResult, PitchType } from "./types";
import type { BatterHand } from "./hitterInsights";

export type { BatterHand };

export type PitcherInsightMetricId =
  | "strikePct"
  | "whiffPct"
  | "chasePct"
  | "baa"
  | "kPct"
  | "bbPct"
  | "fpsPct";

export type PitcherInsightVelocityBandId =
  | "lt80"
  | "80_84"
  | "85_89"
  | "90_94"
  | "95_plus"
  | "untracked";

export type PitcherInsightCountCategory =
  | "all"
  | "hitter"
  | "pitcher"
  | "twoStrike"
  | "full";

export type PitcherInsightZoneScope = "all" | "inZone" | "outOfZone";

export interface PitcherInsightMetricOption {
  id: PitcherInsightMetricId;
  label: string;
  description: string;
  /** Lower value is better for the pitcher (baa, bbPct) */
  lowerBetter: boolean;
  available: boolean;
}

export interface PitcherInsightGameContext {
  id: string;
  gameDate: string;
  opponent: string | null;
}

export interface PitcherInsightPitchRecord {
  id: string;
  gameId: string;
  gameDate: string;
  opponent: string | null;
  /** Batter hand — null, not tracked in current charting data */
  batterHand: BatterHand;
  inning: number;
  lineupSlot: number;
  paId: string;
  pitchOrder: number;
  pitchType: PitchType;
  pitchResult: PitchResult;
  locationCell: number | null;
  zoneRow: number | null;
  zoneColumn: number | null;
  isInZone: boolean | null;
  ballsBefore: number;
  strikesBefore: number;
  countLabel: string;
  countCategory: Exclude<PitcherInsightCountCategory, "all"> | "even";
  velocity: number | null;
  velocityBand: PitcherInsightVelocityBandId;
  isStrike: boolean;
  isCalledStrike: boolean;
  isSwing: boolean;
  isWhiff: boolean;
  isContact: boolean;
  isBall: boolean;
  isBallInPlay: boolean;
  isTerminalPitch: boolean;
  terminalAtBat: boolean;
  terminalStrikeout: boolean;
  terminalWalk: boolean;
  terminalHit: boolean;
  terminalHitByPitch: boolean;
  terminalPAs: number;
}

export interface PitcherInsightAggregate {
  pitches: number;
  locatedPitches: number;
  strikes: number;
  swings: number;
  whiffs: number;
  contacts: number;
  fouls: number;
  ballsInPlay: number;
  calledStrikes: number;
  balls: number;
  hits: number;
  strikeouts: number;
  walks: number;
  hitByPitch: number;
  outs: number;
  atBats: number;
  plateAppearances: number;
  strikePct: number | null;
  whiffPct: number | null;
  chasePct: number | null;
  baa: number | null;
  kPct: number | null;
  bbPct: number | null;
  fpsPct: number | null;
}

export interface PitcherPerformanceInsightsData {
  pitcherId: string | null;
  pitcherName: string;
  games: PitcherInsightGameContext[];
  pitches: PitcherInsightPitchRecord[];
  summary: {
    totalPitches: number;
    totalPlateAppearances: number;
    strikePct: number | null;
    whiffPct: number | null;
    kPct: number | null;
    bbPct: number | null;
    baa: number | null;
  };
  capabilities: {
    batterHand: boolean;
    velocity: boolean;
  };
  metricOptions: PitcherInsightMetricOption[];
}

export interface PitcherInsightsFilters {
  dateFrom: string | null;
  dateTo: string | null;
  pitchTypes: PitchType[];
  velocityBands: PitcherInsightVelocityBandId[];
  countCategory: PitcherInsightCountCategory;
  zoneScope: PitcherInsightZoneScope;
  batterHand: BatterHand | "all";
}

export type PitcherInsightSelection =
  | { kind: "all" }
  | { kind: "cell"; cell: number }
  | { kind: "row"; row: number }
  | { kind: "column"; column: number }
  | { kind: "inZone" }
  | { kind: "outOfZone" };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const IN_ZONE_CELL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const OUT_OF_ZONE_CELL_IDS = [11, 12, 13, 14, 15, 16, 17] as const;

export const DEFAULT_PITCHER_INSIGHT_FILTERS: PitcherInsightsFilters = {
  dateFrom: null,
  dateTo: null,
  pitchTypes: [],
  velocityBands: [],
  countCategory: "all",
  zoneScope: "all",
  batterHand: "all",
};

export const PITCHER_INSIGHT_METRICS: PitcherInsightMetricOption[] = [
  {
    id: "strikePct",
    label: "Strike%",
    description: "Strikes thrown (called, swinging, foul, in-play) as a percentage of pitches.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "whiffPct",
    label: "Whiff%",
    description: "Swing-and-miss rate on swings in the selected zone.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "chasePct",
    label: "Chase%",
    description: "Rate at which batters swing at out-of-zone pitches.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "baa",
    label: "BAA",
    description: "Batting average against — hits allowed per at-bat with terminal pitch in this zone.",
    lowerBetter: true,
    available: true,
  },
  {
    id: "kPct",
    label: "K%",
    description: "Strikeout rate per plate appearance that includes a pitch from this zone.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "bbPct",
    label: "BB%",
    description: "Walk rate per plate appearance that includes a pitch from this zone.",
    lowerBetter: true,
    available: true,
  },
  {
    id: "fpsPct",
    label: "FPS%",
    description: "First-pitch strike rate.",
    lowerBetter: false,
    available: true,
  },
];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const STRIKE_RESULTS = new Set<PitchResult>([
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);
const SWING_RESULTS = new Set<PitchResult>(["swinging_strike", "foul", "bunt_foul", "in_play"]);
const CONTACT_RESULTS = new Set<PitchResult>(["foul", "bunt_foul", "in_play"]);
const HIT_RESULT_CODES = new Set(["1B", "2B", "3B", "HR"]);

function pct(numerator: number, denominator: number): number | null {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function zoneRowForCell(cell: number | null): number | null {
  if (cell === null || !IN_ZONE_CELL_IDS.includes(cell as (typeof IN_ZONE_CELL_IDS)[number])) {
    return null;
  }
  return Math.floor((cell - 1) / 3);
}

function zoneColumnForCell(cell: number | null): number | null {
  if (cell === null || !IN_ZONE_CELL_IDS.includes(cell as (typeof IN_ZONE_CELL_IDS)[number])) {
    return null;
  }
  return (cell - 1) % 3;
}

function velocityBandForPitch(velocity: number | null): PitcherInsightVelocityBandId {
  if (velocity === null) return "untracked";
  if (velocity < 80) return "lt80";
  if (velocity <= 84) return "80_84";
  if (velocity <= 89) return "85_89";
  if (velocity <= 94) return "90_94";
  return "95_plus";
}

function countCategoryForPitch(
  ballsBefore: number,
  strikesBefore: number
): PitcherInsightPitchRecord["countCategory"] {
  if (ballsBefore === 3 && strikesBefore === 2) return "full";
  if (strikesBefore === 2) return "twoStrike";
  if (ballsBefore > strikesBefore) return "hitter";
  if (strikesBefore > ballsBefore) return "pitcher";
  return "even";
}

function mapPitchesByPaId(pitches: ChartingPitch[]): Map<string, ChartingPitch[]> {
  const map = new Map<string, ChartingPitch[]>();
  for (const pitch of pitches) {
    const group = map.get(pitch.paId) ?? [];
    group.push(pitch);
    map.set(pitch.paId, group);
  }
  for (const [paId, group] of map.entries()) {
    map.set(paId, [...group].sort((a, b) => a.pitchOrder - b.pitchOrder));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildPitcherPerformanceInsightsData({
  pitcherId,
  pitcherName,
  games,
  plateAppearances,
  pitches,
}: {
  pitcherId: string | null;
  pitcherName: string;
  games: PitcherInsightGameContext[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
}): PitcherPerformanceInsightsData | null {
  if (plateAppearances.length === 0 || pitches.length === 0) return null;

  const gameById = new Map(games.map((game) => [game.id, game]));
  const pitchesByPaId = mapPitchesByPaId(pitches);
  const derivedPitches: PitcherInsightPitchRecord[] = [];

  for (const pa of [...plateAppearances].sort((a, b) => a.paOrder - b.paOrder)) {
    const paPitches = pitchesByPaId.get(pa.id) ?? [];
    const lastPitch = paPitches[paPitches.length - 1] ?? null;

    const isAtBat = pa.resultCode !== null && pa.resultCode !== "BB" && pa.resultCode !== "HBP";
    const isStrikeout = pa.resultCode === "K" || pa.resultCode === "KL";
    const isWalk = pa.resultCode === "BB";
    const isHit = HIT_RESULT_CODES.has(pa.resultCode ?? "");
    const isHbp = pa.resultCode === "HBP";
    const terminalPAs = pa.resultCode !== null ? 1 : 0;

    for (const pitch of paPitches) {
      const game = gameById.get(pitch.gameId);
      const isTerminalPitch = lastPitch?.id === pitch.id;
      const locationCell = pitch.locationCell;
      const isInZone = locationCell === null ? null : locationCell >= 1 && locationCell <= 9;
      const row = zoneRowForCell(locationCell);
      const column = zoneColumnForCell(locationCell);

      derivedPitches.push({
        id: pitch.id,
        gameId: pitch.gameId,
        gameDate: game?.gameDate ?? "",
        opponent: game?.opponent ?? null,
        batterHand: null,
        inning: pa.inning,
        lineupSlot: pa.lineupSlot,
        paId: pitch.paId,
        pitchOrder: pitch.pitchOrder,
        pitchType: pitch.pitchType,
        pitchResult: pitch.pitchResult,
        locationCell,
        zoneRow: row,
        zoneColumn: column,
        isInZone,
        ballsBefore: pitch.ballsBefore,
        strikesBefore: pitch.strikesBefore,
        countLabel: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
        countCategory: countCategoryForPitch(pitch.ballsBefore, pitch.strikesBefore),
        velocity: pitch.velocity,
        velocityBand: velocityBandForPitch(pitch.velocity),
        isStrike: STRIKE_RESULTS.has(pitch.pitchResult),
        isCalledStrike: pitch.pitchResult === "called_strike",
        isSwing: SWING_RESULTS.has(pitch.pitchResult),
        isWhiff: pitch.pitchResult === "swinging_strike",
        isContact: CONTACT_RESULTS.has(pitch.pitchResult),
        isBall: pitch.pitchResult === "ball",
        isBallInPlay: pitch.pitchResult === "in_play",
        isTerminalPitch,
        terminalAtBat: isTerminalPitch && isAtBat,
        terminalStrikeout: isTerminalPitch && isStrikeout,
        terminalWalk: isTerminalPitch && isWalk,
        terminalHit: isTerminalPitch && isHit,
        terminalHitByPitch: isTerminalPitch && isHbp,
        terminalPAs: isTerminalPitch ? terminalPAs : 0,
      });
    }
  }

  if (derivedPitches.length === 0) return null;

  const summary = summarizePitcherInsightPitches(derivedPitches);

  return {
    pitcherId,
    pitcherName,
    games: [...games].sort((a, b) => b.gameDate.localeCompare(a.gameDate)),
    pitches: derivedPitches,
    summary: {
      totalPitches: summary.pitches,
      totalPlateAppearances: plateAppearances.filter((pa) => pa.resultCode !== null).length,
      strikePct: summary.strikePct,
      whiffPct: summary.whiffPct,
      kPct: summary.kPct,
      bbPct: summary.bbPct,
      baa: summary.baa,
    },
    capabilities: {
      batterHand: false,
      velocity: derivedPitches.some((p) => p.velocity !== null),
    },
    metricOptions: PITCHER_INSIGHT_METRICS,
  };
}

// ---------------------------------------------------------------------------
// Filter / select / summarize
// ---------------------------------------------------------------------------

export function filterPitcherInsightPitches(
  pitches: PitcherInsightPitchRecord[],
  filters: PitcherInsightsFilters
): PitcherInsightPitchRecord[] {
  return pitches.filter((pitch) => {
    if (filters.dateFrom && pitch.gameDate < filters.dateFrom) return false;
    if (filters.dateTo && pitch.gameDate > filters.dateTo) return false;
    if (filters.pitchTypes.length > 0 && !filters.pitchTypes.includes(pitch.pitchType)) return false;
    if (filters.velocityBands.length > 0 && !filters.velocityBands.includes(pitch.velocityBand)) return false;
    if (filters.countCategory !== "all") {
      if (
        filters.countCategory === "twoStrike" &&
        pitch.countCategory !== "twoStrike" &&
        pitch.countCategory !== "full"
      ) {
        return false;
      }
      if (filters.countCategory !== "twoStrike" && pitch.countCategory !== filters.countCategory) {
        return false;
      }
    }
    if (filters.zoneScope === "inZone" && pitch.isInZone !== true) return false;
    if (filters.zoneScope === "outOfZone" && pitch.isInZone !== false) return false;
    return true;
  });
}

export function selectPitcherInsightPitches(
  pitches: PitcherInsightPitchRecord[],
  selection: PitcherInsightSelection
): PitcherInsightPitchRecord[] {
  switch (selection.kind) {
    case "all":
      return pitches;
    case "cell":
      return pitches.filter((p) => p.locationCell === selection.cell);
    case "row":
      return pitches.filter((p) => p.zoneRow === selection.row);
    case "column":
      return pitches.filter((p) => p.zoneColumn === selection.column);
    case "inZone":
      return pitches.filter((p) => p.isInZone === true);
    case "outOfZone":
      return pitches.filter((p) => p.isInZone === false);
  }
}

export function summarizePitcherInsightPitches(
  pitches: PitcherInsightPitchRecord[]
): PitcherInsightAggregate {
  const locatedPitches = pitches.filter((p) => p.locationCell !== null);
  const outOfZonePitches = pitches.filter((p) => p.isInZone === false);
  const outOfZoneSwings = outOfZonePitches.filter((p) => p.isSwing).length;

  const strikes = pitches.filter((p) => p.isStrike).length;
  const swings = pitches.filter((p) => p.isSwing).length;
  const whiffs = pitches.filter((p) => p.isWhiff).length;
  const contacts = pitches.filter((p) => p.isContact).length;
  const fouls = pitches.filter(
    (p) => p.pitchResult === "foul" || p.pitchResult === "bunt_foul"
  ).length;
  const ballsInPlay = pitches.filter((p) => p.isBallInPlay).length;
  const calledStrikes = pitches.filter((p) => p.isCalledStrike).length;
  const balls = pitches.filter((p) => p.isBall).length;

  const terminalPitches = pitches.filter((p) => p.isTerminalPitch && p.terminalPAs > 0);
  const hits = terminalPitches.filter((p) => p.terminalHit).length;
  const strikeouts = terminalPitches.filter((p) => p.terminalStrikeout).length;
  const walks = terminalPitches.filter((p) => p.terminalWalk).length;
  const hitByPitch = terminalPitches.filter((p) => p.terminalHitByPitch).length;
  const atBats = terminalPitches.filter((p) => p.terminalAtBat).length;
  const totalPAs = terminalPitches.length;
  const outs = atBats - hits;

  // First-pitch stats from all pitches in the set
  const firstPitchPitches = pitches.filter(
    (p) => p.ballsBefore === 0 && p.strikesBefore === 0
  );
  const firstPitchStrikes = firstPitchPitches.filter((p) => p.isStrike).length;

  return {
    pitches: pitches.length,
    locatedPitches: locatedPitches.length,
    strikes,
    swings,
    whiffs,
    contacts,
    fouls,
    ballsInPlay,
    calledStrikes,
    balls,
    hits,
    strikeouts,
    walks,
    hitByPitch,
    outs: Math.max(0, outs),
    atBats,
    plateAppearances: totalPAs,
    strikePct: pct(strikes, pitches.length),
    whiffPct: pct(whiffs, swings),
    chasePct: pct(outOfZoneSwings, outOfZonePitches.length),
    baa: atBats > 0 ? hits / atBats : null,
    kPct: pct(strikeouts, totalPAs),
    bbPct: pct(walks, totalPAs),
    fpsPct: pct(firstPitchStrikes, firstPitchPitches.length),
  };
}

export function metricValueForAggregate(
  aggregate: PitcherInsightAggregate,
  metricId: PitcherInsightMetricId
): number | null {
  switch (metricId) {
    case "strikePct":
      return aggregate.strikePct;
    case "whiffPct":
      return aggregate.whiffPct;
    case "chasePct":
      return aggregate.chasePct;
    case "baa":
      return aggregate.baa;
    case "kPct":
      return aggregate.kPct;
    case "bbPct":
      return aggregate.bbPct;
    case "fpsPct":
      return aggregate.fpsPct;
  }
}

// ---------------------------------------------------------------------------
// Label helpers
// ---------------------------------------------------------------------------

export function velocityBandLabel(band: PitcherInsightVelocityBandId): string {
  switch (band) {
    case "lt80": return "< 80";
    case "80_84": return "80-84";
    case "85_89": return "85-89";
    case "90_94": return "90-94";
    case "95_plus": return "95+";
    case "untracked": return "Velo N/A";
  }
}

export function zoneColumnLabel(column: number): string {
  if (column === 1) return "Heart";
  return column === 0 ? "Glove" : "Arm";
}

export function zoneRowLabel(row: number): string {
  switch (row) {
    case 0: return "High";
    case 1: return "Middle";
    case 2: return "Low";
    default: return "Zone";
  }
}

export function zoneCellLabel(cell: number): string {
  const row = zoneRowForCell(cell);
  const column = zoneColumnForCell(cell);
  if (row === null || column === null) return "Zone";
  const rowText = zoneRowLabel(row);
  const columnText = zoneColumnLabel(column);
  if (rowText === "Middle" && columnText === "Heart") return "Heart";
  return `${rowText} ${columnText}`;
}

export function selectionLabel(selection: PitcherInsightSelection): string {
  switch (selection.kind) {
    case "all": return "All filtered pitches";
    case "cell": return zoneCellLabel(selection.cell);
    case "row": return `${zoneRowLabel(selection.row)} row`;
    case "column": return `${zoneColumnLabel(selection.column)} lane`;
    case "inZone": return "Entire in-zone";
    case "outOfZone": return "Entire out-of-zone";
  }
}
