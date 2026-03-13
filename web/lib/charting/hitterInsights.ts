import type { ChartingPitch, ChartingPlateAppearance, PitchResult, PitchType } from "./types";

export type BatterHand = "R" | "L" | "S" | null;
export type PitcherHand = "R" | "L" | null;
export type HitterInsightMetricId =
  | "avg"
  | "slg"
  | "woba"
  | "swingPct"
  | "whiffPct"
  | "contactPct"
  | "chasePct"
  | "xwoba"
  | "hardHitPct";
export type HitterInsightVelocityBandId =
  | "lt80"
  | "80_84"
  | "85_89"
  | "90_94"
  | "95_plus"
  | "untracked";
export type HitterInsightCountCategory =
  | "all"
  | "hitter"
  | "pitcher"
  | "twoStrike"
  | "full";
export type HitterInsightZoneScope = "all" | "inZone" | "outOfZone";

export interface HitterInsightMetricOption {
  id: HitterInsightMetricId;
  label: string;
  description: string;
  lowerBetter: boolean;
  available: boolean;
}

export interface HitterInsightGameContext {
  id: string;
  gameDate: string;
  opponent: string | null;
}

export interface HitterInsightPitchRecord {
  id: string;
  gameId: string;
  gameDate: string;
  opponent: string | null;
  pitcherHand: PitcherHand;
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
  countCategory: Exclude<HitterInsightCountCategory, "all"> | "even";
  velocity: number | null;
  velocityBand: HitterInsightVelocityBandId;
  isSwing: boolean;
  isWhiff: boolean;
  isContact: boolean;
  isTake: boolean;
  isFoul: boolean;
  isBallInPlay: boolean;
  isTerminalPitch: boolean;
  paClosed: boolean;
  paResultCode: string | null;
  outcomeLabel: string;
  outcomeCategory:
    | "take"
    | "foul"
    | "whiff"
    | "ballInPlay"
    | "strikeout"
    | "walk"
    | "hitByPitch"
    | "single"
    | "double"
    | "triple"
    | "homeRun"
    | "out"
    | "reached";
  terminalPlateAppearance: boolean;
  terminalAtBat: boolean;
  terminalHit: boolean;
  terminalExtraBaseHit: boolean;
  terminalOnBase: boolean;
  terminalBases: number;
  wobaWeight: number;
  plateX: number | null;
  plateZ: number | null;
  exitVelocity: number | null;
  launchAngle: number | null;
  xwoba: number | null;
}

export interface HitterPerformanceInsightsData {
  hitterId: string | null;
  hitterName: string;
  batterHand: BatterHand;
  matchedHitterNames: string[];
  games: HitterInsightGameContext[];
  pitches: HitterInsightPitchRecord[];
  summary: {
    totalPitchesSeen: number;
    totalPlateAppearances: number;
    avg: number | null;
    obp: number | null;
    slg: number | null;
    ops: number | null;
  };
  capabilities: {
    pitcherHand: boolean;
    qualityOfContact: boolean;
    expectedMetrics: boolean;
    exactPitchLocations: boolean;
    gameType: boolean;
    homeAway: boolean;
  };
  metricOptions: HitterInsightMetricOption[];
}

export interface HitterInsightsFilters {
  dateFrom: string | null;
  dateTo: string | null;
  pitchTypes: PitchType[];
  velocityBands: HitterInsightVelocityBandId[];
  countCategory: HitterInsightCountCategory;
  zoneScope: HitterInsightZoneScope;
}

export type HitterInsightSelection =
  | { kind: "all" }
  | { kind: "cell"; cell: number }
  | { kind: "row"; row: number }
  | { kind: "column"; column: number }
  | { kind: "inZone" }
  | { kind: "outOfZone" };

export interface HitterInsightAggregate {
  pitches: number;
  locatedPitches: number;
  swings: number;
  takes: number;
  whiffs: number;
  contacts: number;
  fouls: number;
  ballsInPlay: number;
  hits: number;
  extraBaseHits: number;
  strikeouts: number;
  walks: number;
  hitByPitch: number;
  outs: number;
  avg: number | null;
  obp: number | null;
  slg: number | null;
  ops: number | null;
  woba: number | null;
  swingPct: number | null;
  whiffPct: number | null;
  contactPct: number | null;
  chasePct: number | null;
  zoneSwingPct: number | null;
  zoneWhiffPct: number | null;
  hardHitPct: number | null;
  xwoba: number | null;
}

export const IN_ZONE_CELL_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const OUT_OF_ZONE_CELL_IDS = [11, 12, 13, 14, 15, 16, 17] as const;
export const DEFAULT_HITTER_INSIGHT_FILTERS: HitterInsightsFilters = {
  dateFrom: null,
  dateTo: null,
  pitchTypes: [],
  velocityBands: [],
  countCategory: "all",
  zoneScope: "all",
};
export const HITTER_INSIGHT_METRICS: HitterInsightMetricOption[] = [
  {
    id: "avg",
    label: "AVG",
    description: "Batting average on plate appearances ending in the selected zone.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "slg",
    label: "SLG",
    description: "Slugging based on terminal pitch outcomes in the selected sample.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "woba",
    label: "wOBA",
    description: "Weighted on-base value using available charted outcomes.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "swingPct",
    label: "Swing%",
    description: "Swings divided by pitches seen in the zone bucket.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "whiffPct",
    label: "Whiff%",
    description: "Swing-and-miss rate on swings in the zone bucket.",
    lowerBetter: true,
    available: true,
  },
  {
    id: "contactPct",
    label: "Contact%",
    description: "Any contact per swing in the zone bucket.",
    lowerBetter: false,
    available: true,
  },
  {
    id: "chasePct",
    label: "Chase%",
    description: "Available in supporting chase selections; not plotted on the in-zone grid.",
    lowerBetter: true,
    available: false,
  },
  {
    id: "xwoba",
    label: "xwOBA",
    description: "Requires expected outcome data from EV/LA capture.",
    lowerBetter: false,
    available: false,
  },
  {
    id: "hardHitPct",
    label: "Hard-Hit%",
    description: "Requires quality-of-contact capture.",
    lowerBetter: false,
    available: false,
  },
];

const SWING_RESULTS = new Set<PitchResult>([
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);
const CONTACT_RESULTS = new Set<PitchResult>(["foul", "bunt_foul", "in_play"]);
const TAKE_RESULTS = new Set<PitchResult>(["ball", "called_strike", "hit_by_pitch"]);
const HIT_CODES = new Set(["1B", "2B", "3B", "HR"]);
const EXTRA_BASE_HIT_CODES = new Set(["2B", "3B", "HR"]);

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

function velocityBandForPitch(velocity: number | null): HitterInsightVelocityBandId {
  if (velocity === null) return "untracked";
  if (velocity < 80) return "lt80";
  if (velocity <= 84) return "80_84";
  if (velocity <= 89) return "85_89";
  if (velocity <= 94) return "90_94";
  return "95_plus";
}

function countLabel(ballsBefore: number, strikesBefore: number): string {
  return `${ballsBefore}-${strikesBefore}`;
}

function countCategoryForPitch(
  ballsBefore: number,
  strikesBefore: number
): HitterInsightPitchRecord["countCategory"] {
  if (ballsBefore === 3 && strikesBefore === 2) return "full";
  if (strikesBefore === 2) return "twoStrike";
  if (ballsBefore > strikesBefore) return "hitter";
  if (strikesBefore > ballsBefore) return "pitcher";
  return "even";
}

function outcomeFromPitchEvent(
  pitchResult: PitchResult
): Pick<HitterInsightPitchRecord, "outcomeCategory" | "outcomeLabel"> {
  switch (pitchResult) {
    case "ball":
    case "called_strike":
    case "hit_by_pitch":
      return { outcomeCategory: "take", outcomeLabel: "Take" };
    case "foul":
    case "bunt_foul":
      return { outcomeCategory: "foul", outcomeLabel: "Foul" };
    case "swinging_strike":
      return { outcomeCategory: "whiff", outcomeLabel: "Whiff" };
    case "in_play":
      return { outcomeCategory: "ballInPlay", outcomeLabel: "Ball in Play" };
  }
}

function outcomeFromPaResult(
  resultCode: string | null
): Pick<HitterInsightPitchRecord, "outcomeCategory" | "outcomeLabel"> {
  switch (resultCode) {
    case "K":
    case "KL":
      return { outcomeCategory: "strikeout", outcomeLabel: "Strikeout" };
    case "BB":
      return { outcomeCategory: "walk", outcomeLabel: "Walk" };
    case "HBP":
      return { outcomeCategory: "hitByPitch", outcomeLabel: "HBP" };
    case "1B":
      return { outcomeCategory: "single", outcomeLabel: "Single" };
    case "2B":
      return { outcomeCategory: "double", outcomeLabel: "Double" };
    case "3B":
      return { outcomeCategory: "triple", outcomeLabel: "Triple" };
    case "HR":
      return { outcomeCategory: "homeRun", outcomeLabel: "HR" };
    default:
      if (!resultCode) return { outcomeCategory: "ballInPlay", outcomeLabel: "Ball in Play" };
      if (resultCode.startsWith("E") || resultCode.startsWith("FC")) {
        return { outcomeCategory: "reached", outcomeLabel: "Reached" };
      }
      return { outcomeCategory: "out", outcomeLabel: "Out" };
  }
}

function basesForPaResult(resultCode: string | null): number {
  switch (resultCode) {
    case "1B":
      return 1;
    case "2B":
      return 2;
    case "3B":
      return 3;
    case "HR":
      return 4;
    default:
      return 0;
  }
}

function wobaWeightForResult(resultCode: string | null): number {
  switch (resultCode) {
    case "BB":
      return 0.69;
    case "HBP":
      return 0.72;
    case "1B":
      return 0.89;
    case "2B":
      return 1.27;
    case "3B":
      return 1.62;
    case "HR":
      return 2.1;
    default:
      return 0;
  }
}

function terminalAtBatForResult(resultCode: string | null): boolean {
  if (!resultCode) return false;
  return resultCode !== "BB" && resultCode !== "HBP";
}

function terminalOnBaseForResult(resultCode: string | null): boolean {
  return resultCode === "BB" || resultCode === "HBP" || HIT_CODES.has(resultCode ?? "");
}

function mapPitchesByPaId(pitches: ChartingPitch[]): Map<string, ChartingPitch[]> {
  const map = new Map<string, ChartingPitch[]>();
  for (const pitch of pitches) {
    const group = map.get(pitch.paId) ?? [];
    group.push(pitch);
    map.set(pitch.paId, group);
  }

  for (const [paId, group] of map.entries()) {
    map.set(
      paId,
      [...group].sort((left, right) => left.pitchOrder - right.pitchOrder)
    );
  }

  return map;
}

export function buildHitterPerformanceInsightsData({
  hitterId,
  hitterName,
  batterHand,
  matchedHitterNames,
  games,
  plateAppearances,
  pitches,
  pitcherHandBySegmentId = new Map<string, PitcherHand>(),
}: {
  hitterId: string | null;
  hitterName: string;
  batterHand: BatterHand;
  matchedHitterNames: string[];
  games: HitterInsightGameContext[];
  plateAppearances: ChartingPlateAppearance[];
  pitches: ChartingPitch[];
  pitcherHandBySegmentId?: Map<string, PitcherHand>;
}): HitterPerformanceInsightsData | null {
  if (plateAppearances.length === 0 || pitches.length === 0) {
    return null;
  }

  const gameById = new Map(games.map((game) => [game.id, game]));
  const pitchesByPaId = mapPitchesByPaId(pitches);
  const derivedPitches: HitterInsightPitchRecord[] = [];

  for (const plateAppearance of [...plateAppearances].sort((a, b) => a.paOrder - b.paOrder)) {
    const paPitches = pitchesByPaId.get(plateAppearance.id) ?? [];
    const lastPitch = paPitches[paPitches.length - 1] ?? null;

    for (const pitch of paPitches) {
      const game = gameById.get(pitch.gameId);
      const isTerminalPitch = lastPitch?.id === pitch.id;
      const locationCell = pitch.locationCell;
      const isInZone = locationCell === null ? null : locationCell >= 1 && locationCell <= 9;
      const row = zoneRowForCell(locationCell);
      const column = zoneColumnForCell(locationCell);
      const paClosed = plateAppearance.resultCode !== null;
      const baseOutcome = isTerminalPitch
        ? outcomeFromPaResult(plateAppearance.resultCode)
        : outcomeFromPitchEvent(pitch.pitchResult);
      const terminalAtBat = isTerminalPitch && terminalAtBatForResult(plateAppearance.resultCode);
      const terminalHit = isTerminalPitch && HIT_CODES.has(plateAppearance.resultCode ?? "");
      const terminalExtraBaseHit =
        isTerminalPitch && EXTRA_BASE_HIT_CODES.has(plateAppearance.resultCode ?? "");
      const terminalOnBase = isTerminalPitch && terminalOnBaseForResult(plateAppearance.resultCode);

      derivedPitches.push({
        id: pitch.id,
        gameId: pitch.gameId,
        gameDate: game?.gameDate ?? "",
        opponent: game?.opponent ?? null,
        pitcherHand: pitcherHandBySegmentId.get(plateAppearance.segmentId) ?? null,
        inning: plateAppearance.inning,
        lineupSlot: plateAppearance.lineupSlot,
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
        countLabel: countLabel(pitch.ballsBefore, pitch.strikesBefore),
        countCategory: countCategoryForPitch(pitch.ballsBefore, pitch.strikesBefore),
        velocity: pitch.velocity,
        velocityBand: velocityBandForPitch(pitch.velocity),
        isSwing: SWING_RESULTS.has(pitch.pitchResult),
        isWhiff: pitch.pitchResult === "swinging_strike",
        isContact: CONTACT_RESULTS.has(pitch.pitchResult),
        isTake: TAKE_RESULTS.has(pitch.pitchResult),
        isFoul: pitch.pitchResult === "foul" || pitch.pitchResult === "bunt_foul",
        isBallInPlay: pitch.pitchResult === "in_play",
        isTerminalPitch,
        paClosed,
        paResultCode: plateAppearance.resultCode,
        outcomeLabel: baseOutcome.outcomeLabel,
        outcomeCategory: baseOutcome.outcomeCategory,
        terminalPlateAppearance: isTerminalPitch && paClosed,
        terminalAtBat,
        terminalHit,
        terminalExtraBaseHit,
        terminalOnBase,
        terminalBases: isTerminalPitch ? basesForPaResult(plateAppearance.resultCode) : 0,
        wobaWeight: isTerminalPitch ? wobaWeightForResult(plateAppearance.resultCode) : 0,
        plateX: null,
        plateZ: null,
        exitVelocity: null,
        launchAngle: null,
        xwoba: null,
      });
    }
  }

  const summary = summarizeHitterInsightPitches(derivedPitches);

  return {
    hitterId,
    hitterName,
    batterHand,
    matchedHitterNames,
    games: [...games].sort((a, b) => b.gameDate.localeCompare(a.gameDate)),
    pitches: derivedPitches,
    summary: {
      totalPitchesSeen: summary.pitches,
      totalPlateAppearances: plateAppearances.length,
      avg: summary.avg,
      obp: summary.obp,
      slg: summary.slg,
      ops: summary.ops,
    },
    capabilities: {
      pitcherHand: derivedPitches.some((pitch) => pitch.pitcherHand !== null),
      qualityOfContact: false,
      expectedMetrics: false,
      exactPitchLocations: false,
      gameType: false,
      homeAway: false,
    },
    metricOptions: HITTER_INSIGHT_METRICS,
  };
}

export function filterHitterInsightPitches(
  pitches: HitterInsightPitchRecord[],
  filters: HitterInsightsFilters
): HitterInsightPitchRecord[] {
  return pitches.filter((pitch) => {
    if (filters.dateFrom && pitch.gameDate < filters.dateFrom) return false;
    if (filters.dateTo && pitch.gameDate > filters.dateTo) return false;
    if (filters.pitchTypes.length > 0 && !filters.pitchTypes.includes(pitch.pitchType)) return false;
    if (
      filters.velocityBands.length > 0 &&
      !filters.velocityBands.includes(pitch.velocityBand)
    ) {
      return false;
    }
    if (filters.countCategory !== "all") {
      if (
        filters.countCategory === "twoStrike" &&
        pitch.countCategory !== "twoStrike" &&
        pitch.countCategory !== "full"
      ) {
        return false;
      }
      if (
        filters.countCategory !== "twoStrike" &&
        pitch.countCategory !== filters.countCategory
      ) {
        return false;
      }
    }
    if (filters.zoneScope === "inZone" && pitch.isInZone !== true) return false;
    if (filters.zoneScope === "outOfZone" && pitch.isInZone !== false) return false;
    return true;
  });
}

export function selectHitterInsightPitches(
  pitches: HitterInsightPitchRecord[],
  selection: HitterInsightSelection
): HitterInsightPitchRecord[] {
  switch (selection.kind) {
    case "all":
      return pitches;
    case "cell":
      return pitches.filter((pitch) => pitch.locationCell === selection.cell);
    case "row":
      return pitches.filter((pitch) => pitch.zoneRow === selection.row);
    case "column":
      return pitches.filter((pitch) => pitch.zoneColumn === selection.column);
    case "inZone":
      return pitches.filter((pitch) => pitch.isInZone === true);
    case "outOfZone":
      return pitches.filter((pitch) => pitch.isInZone === false);
  }
}

export function summarizeHitterInsightPitches(
  pitches: HitterInsightPitchRecord[]
): HitterInsightAggregate {
  const locatedPitches = pitches.filter((pitch) => pitch.locationCell !== null);
  const outOfZonePitches = pitches.filter((pitch) => pitch.isInZone === false);
  const outOfZoneSwings = outOfZonePitches.filter((pitch) => pitch.isSwing).length;
  const inZonePitches = pitches.filter((pitch) => pitch.isInZone === true);
  const inZoneSwings = inZonePitches.filter((pitch) => pitch.isSwing).length;
  const inZoneWhiffs = inZonePitches.filter((pitch) => pitch.isWhiff).length;
  const terminalPitches = pitches.filter((pitch) => pitch.terminalPlateAppearance);
  const atBats = terminalPitches.filter((pitch) => pitch.terminalAtBat);
  const plateAppearances = terminalPitches.length;
  const hits = terminalPitches.filter((pitch) => pitch.terminalHit).length;
  const extraBaseHits = terminalPitches.filter((pitch) => pitch.terminalExtraBaseHit).length;
  const strikeouts = terminalPitches.filter(
    (pitch) => pitch.outcomeCategory === "strikeout"
  ).length;
  const walks = terminalPitches.filter((pitch) => pitch.outcomeCategory === "walk").length;
  const hitByPitch = terminalPitches.filter(
    (pitch) => pitch.outcomeCategory === "hitByPitch"
  ).length;
  const outs = terminalPitches.filter((pitch) => pitch.outcomeCategory === "out").length;
  const totalBases = terminalPitches.reduce((sum, pitch) => sum + pitch.terminalBases, 0);
  const onBase = terminalPitches.filter((pitch) => pitch.terminalOnBase).length;
  const wobaDenominator = terminalPitches.filter(
    (pitch) => pitch.terminalAtBat || pitch.outcomeCategory === "walk" || pitch.outcomeCategory === "hitByPitch"
  ).length;
  const wobaNumerator = terminalPitches.reduce((sum, pitch) => sum + pitch.wobaWeight, 0);
  const swings = pitches.filter((pitch) => pitch.isSwing).length;
  const whiffs = pitches.filter((pitch) => pitch.isWhiff).length;
  const contacts = pitches.filter((pitch) => pitch.isContact).length;

  return {
    pitches: pitches.length,
    locatedPitches: locatedPitches.length,
    swings,
    takes: pitches.filter((pitch) => pitch.isTake).length,
    whiffs,
    contacts,
    fouls: pitches.filter((pitch) => pitch.isFoul).length,
    ballsInPlay: pitches.filter((pitch) => pitch.isBallInPlay).length,
    hits,
    extraBaseHits,
    strikeouts,
    walks,
    hitByPitch,
    outs,
    avg: atBats.length > 0 ? hits / atBats.length : null,
    obp: plateAppearances > 0 ? onBase / plateAppearances : null,
    slg: atBats.length > 0 ? totalBases / atBats.length : null,
    ops:
      plateAppearances > 0 && atBats.length > 0
        ? onBase / plateAppearances + totalBases / atBats.length
        : null,
    woba: wobaDenominator > 0 ? wobaNumerator / wobaDenominator : null,
    swingPct: pct(swings, pitches.length),
    whiffPct: pct(whiffs, swings),
    contactPct: pct(contacts, swings),
    chasePct: pct(outOfZoneSwings, outOfZonePitches.length),
    zoneSwingPct: pct(inZoneSwings, inZonePitches.length),
    zoneWhiffPct: pct(inZoneWhiffs, inZoneSwings),
    hardHitPct: null,
    xwoba: null,
  };
}

export function metricValueForAggregate(
  aggregate: HitterInsightAggregate,
  metricId: HitterInsightMetricId
): number | null {
  switch (metricId) {
    case "avg":
      return aggregate.avg;
    case "slg":
      return aggregate.slg;
    case "woba":
      return aggregate.woba;
    case "swingPct":
      return aggregate.swingPct;
    case "whiffPct":
      return aggregate.whiffPct;
    case "contactPct":
      return aggregate.contactPct;
    case "chasePct":
      return aggregate.chasePct;
    case "xwoba":
      return aggregate.xwoba;
    case "hardHitPct":
      return aggregate.hardHitPct;
  }
}

export function velocityBandLabel(band: HitterInsightVelocityBandId): string {
  switch (band) {
    case "lt80":
      return "< 80";
    case "80_84":
      return "80-84";
    case "85_89":
      return "85-89";
    case "90_94":
      return "90-94";
    case "95_plus":
      return "95+";
    case "untracked":
      return "Velo N/A";
  }
}

export function zoneColumnLabel(column: number, batterHand: BatterHand): string {
  if (column === 1) return "Heart";
  if (batterHand === "R") return column === 0 ? "Inner" : "Away";
  if (batterHand === "L") return column === 0 ? "Away" : "Inner";
  return column === 0 ? "Left" : "Right";
}

export function zoneRowLabel(row: number): string {
  switch (row) {
    case 0:
      return "High";
    case 1:
      return "Middle";
    case 2:
      return "Low";
    default:
      return "Zone";
  }
}

export function zoneCellLabel(cell: number, batterHand: BatterHand): string {
  const row = zoneRowForCell(cell);
  const column = zoneColumnForCell(cell);
  if (row === null || column === null) return "Zone";
  const rowText = zoneRowLabel(row);
  const columnText = zoneColumnLabel(column, batterHand);
  if (rowText === "Middle" && columnText === "Heart") return "Heart";
  return `${rowText} ${columnText}`;
}

export function selectionLabel(
  selection: HitterInsightSelection,
  batterHand: BatterHand
): string {
  switch (selection.kind) {
    case "all":
      return "All filtered pitches";
    case "cell":
      return zoneCellLabel(selection.cell, batterHand);
    case "row":
      return `${zoneRowLabel(selection.row)} row`;
    case "column":
      return `${zoneColumnLabel(selection.column, batterHand)} lane`;
    case "inZone":
      return "Entire in-zone";
    case "outOfZone":
      return "Entire out-of-zone";
  }
}

export function createMockHitterPerformanceInsightsData(): HitterPerformanceInsightsData {
  const games: HitterInsightGameContext[] = [
    { id: "mock-game-1", gameDate: "2026-02-28", opponent: "MIT" },
    { id: "mock-game-2", gameDate: "2026-03-04", opponent: "Tufts" },
  ];
  const plateAppearances: ChartingPlateAppearance[] = [
    {
      id: "mock-pa-1",
      gameId: "mock-game-1",
      segmentId: "seg-a",
      paOrder: 0,
      inning: 1,
      teamSide: "opponent",
      hitterName: "Dylan Drazka",
      lineupSlot: 3,
      resultCode: "2B",
      buntContext: false,
    },
    {
      id: "mock-pa-2",
      gameId: "mock-game-1",
      segmentId: "seg-a",
      paOrder: 1,
      inning: 3,
      teamSide: "opponent",
      hitterName: "Dylan Drazka",
      lineupSlot: 3,
      resultCode: "K",
      buntContext: false,
    },
    {
      id: "mock-pa-3",
      gameId: "mock-game-2",
      segmentId: "seg-b",
      paOrder: 2,
      inning: 2,
      teamSide: "opponent",
      hitterName: "Dylan Drazka",
      lineupSlot: 3,
      resultCode: "BB",
      buntContext: false,
    },
    {
      id: "mock-pa-4",
      gameId: "mock-game-2",
      segmentId: "seg-b",
      paOrder: 3,
      inning: 5,
      teamSide: "opponent",
      hitterName: "Dylan Drazka",
      lineupSlot: 3,
      resultCode: "HR",
      buntContext: false,
    },
  ];
  const pitches: ChartingPitch[] = [
    {
      id: "mock-pitch-1",
      gameId: "mock-game-1",
      paId: "mock-pa-1",
      pitchOrder: 0,
      pitchType: "Fastball",
      locationCell: 2,
      pitchResult: "called_strike",
      ballsBefore: 0,
      strikesBefore: 0,
      velocity: 91,
    },
    {
      id: "mock-pitch-2",
      gameId: "mock-game-1",
      paId: "mock-pa-1",
      pitchOrder: 1,
      pitchType: "Fastball",
      locationCell: 6,
      pitchResult: "in_play",
      ballsBefore: 0,
      strikesBefore: 1,
      velocity: 92,
    },
    {
      id: "mock-pitch-3",
      gameId: "mock-game-1",
      paId: "mock-pa-2",
      pitchOrder: 0,
      pitchType: "Slider",
      locationCell: 3,
      pitchResult: "foul",
      ballsBefore: 0,
      strikesBefore: 0,
      velocity: 84,
    },
    {
      id: "mock-pitch-4",
      gameId: "mock-game-1",
      paId: "mock-pa-2",
      pitchOrder: 1,
      pitchType: "Slider",
      locationCell: 12,
      pitchResult: "swinging_strike",
      ballsBefore: 0,
      strikesBefore: 1,
      velocity: 85,
    },
    {
      id: "mock-pitch-5",
      gameId: "mock-game-2",
      paId: "mock-pa-3",
      pitchOrder: 0,
      pitchType: "Changeup",
      locationCell: 13,
      pitchResult: "ball",
      ballsBefore: 0,
      strikesBefore: 0,
      velocity: 79,
    },
    {
      id: "mock-pitch-6",
      gameId: "mock-game-2",
      paId: "mock-pa-3",
      pitchOrder: 1,
      pitchType: "Changeup",
      locationCell: 15,
      pitchResult: "ball",
      ballsBefore: 1,
      strikesBefore: 0,
      velocity: 80,
    },
    {
      id: "mock-pitch-7",
      gameId: "mock-game-2",
      paId: "mock-pa-3",
      pitchOrder: 2,
      pitchType: "Fastball",
      locationCell: 11,
      pitchResult: "ball",
      ballsBefore: 2,
      strikesBefore: 0,
      velocity: 93,
    },
    {
      id: "mock-pitch-8",
      gameId: "mock-game-2",
      paId: "mock-pa-3",
      pitchOrder: 3,
      pitchType: "Fastball",
      locationCell: 16,
      pitchResult: "ball",
      ballsBefore: 3,
      strikesBefore: 0,
      velocity: 94,
    },
    {
      id: "mock-pitch-9",
      gameId: "mock-game-2",
      paId: "mock-pa-4",
      pitchOrder: 0,
      pitchType: "Fastball",
      locationCell: 8,
      pitchResult: "foul",
      ballsBefore: 0,
      strikesBefore: 0,
      velocity: 95,
    },
    {
      id: "mock-pitch-10",
      gameId: "mock-game-2",
      paId: "mock-pa-4",
      pitchOrder: 1,
      pitchType: "Fastball",
      locationCell: 5,
      pitchResult: "in_play",
      ballsBefore: 0,
      strikesBefore: 1,
      velocity: 96,
    },
  ];

  return (
    buildHitterPerformanceInsightsData({
      hitterId: "DDrazka1",
      hitterName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      games,
      plateAppearances,
      pitches,
    }) ?? {
      hitterId: "DDrazka1",
      hitterName: "Dylan Drazka",
      batterHand: "R",
      matchedHitterNames: ["Dylan Drazka"],
      games,
      pitches: [],
      summary: {
        totalPitchesSeen: 0,
        totalPlateAppearances: 0,
        avg: null,
        obp: null,
        slg: null,
        ops: null,
      },
      capabilities: {
        pitcherHand: false,
        qualityOfContact: false,
        expectedMetrics: false,
        exactPitchLocations: false,
        gameType: false,
        homeAway: false,
      },
      metricOptions: HITTER_INSIGHT_METRICS,
    }
  );
}
