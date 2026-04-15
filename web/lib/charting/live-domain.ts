import type {
  ChartingBaserunnerState,
  ChartingGame,
  ChartingGameSnapshot,
  ChartingInitialCount,
  ChartingMatchupSide,
  ChartingPitch,
  ChartingPlateAppearance,
  PitchResult,
} from "./types";
import {
  HIT_OPTIONS,
  HIT_ERROR_OPTIONS,
  SAC_OPTIONS,
  SPECIAL_PLAY_OPTIONS,
  FLY_OUT_OPTIONS,
  LINE_OUT_OPTIONS,
  POP_OUT_OPTIONS,
  GROUND_OUT_OPTIONS,
  UNASSISTED_OUT_OPTIONS,
  DOUBLE_PLAY_OPTIONS,
  ERROR_OPTIONS,
  FIELDERS_CHOICE_OPTIONS,
  PA_RESULT_OPTIONS,
  type PAResultType,
} from "./live-constants";

export type PAClosureState =
  | "none"
  | "strikeout"
  | "walk"
  | "hit_by_pitch"
  | "in_play";
export type PAResultFamily = "strikeout" | "freePass" | "hit" | "out" | "misc";

export interface PAPitchProgress {
  balls: number;
  strikes: number;
  closureState: PAClosureState;
  lastPitchResult: PitchResult | null;
}

export interface ChartingLiveState {
  inning: number;
  isTopInning: boolean;
  outs: number;
  balls: number;
  strikes: number;
  batterSlot: number;
  openPAId: string | null;
  activeSegmentId: string | null;
  closureState: PAClosureState;
  lastPitchResult: PitchResult | null;
  isBetweenInnings: boolean;
}

export interface GameStateOverride {
  inning: number;
  isTopInning: boolean;
  outs: number;
  batterSlot: number;
  anchorPAOrder: number;
}

export interface NextPASeed {
  balls: number;
  strikes: number;
  buntMode?: boolean;
  baserunners?: Partial<ChartingBaserunnerState> | null;
}

export interface LiveStateOptions {
  nextPASeed?: NextPASeed | null;
}

export interface RecordPitchInput {
  pitchType: import("./types").PitchType;
  pitchResult: PitchResult;
  locationCell: number | null;
  velocity: number | null;
  pitcher: {
    playerId: string;
    name: string;
    pitcherHand?: string | null;
  };
  hitterName: string;
  hitterHand?: string | null;
  lineupSlot: number;
}

export interface PAResultGroup {
  title: string;
  results: readonly PAResultType[];
}

export interface UpdatePlateAppearanceDetailsInput {
  paId: string;
  pitcher: {
    playerId: string;
    name: string;
  };
  hitterName: string;
  initialCount: ChartingInitialCount;
  resultCode: PAResultType | null;
}

export interface UpdatePlateAppearanceContextInput {
  paId: string;
  inning?: number;
  isTopInning?: boolean;
}

// ---------------------------------------------------------------------------
// Count / seed helpers
// ---------------------------------------------------------------------------

export function initialCountFromSeed(
  seed?: NextPASeed | null,
): ChartingInitialCount {
  if (seed?.buntMode) {
    return "Bunt";
  }
  if (seed?.balls === 2 && seed?.strikes === 1) {
    return "2-1";
  }
  return "0-0";
}

export function nextPASeedFromInitialCount(
  initialCount?: ChartingInitialCount | null,
): NextPASeed {
  switch (initialCount) {
    case "2-1":
      return { balls: 2, strikes: 1, buntMode: false };
    case "Bunt":
      return { balls: 0, strikes: 0, buntMode: true };
    case "0-0":
    default:
      return { balls: 0, strikes: 0, buntMode: false };
  }
}

export function inferInitialCountFromPitches(
  pitches: ChartingPitch[],
  buntContext = false,
): ChartingInitialCount {
  if (buntContext) {
    return "Bunt";
  }

  const firstPitch = sortByPitchOrder(pitches)[0];
  if (firstPitch?.ballsBefore === 2 && firstPitch.strikesBefore === 1) {
    return "2-1";
  }

  return "0-0";
}

export function resolvePlateAppearanceInitialCount(
  plateAppearance: Pick<
    ChartingPlateAppearance,
    "initialCount" | "buntContext"
  >,
  pitches: ChartingPitch[],
): ChartingInitialCount {
  return (
    plateAppearance.initialCount ??
    inferInitialCountFromPitches(pitches, plateAppearance.buntContext)
  );
}

// ---------------------------------------------------------------------------
// Baserunner / matchup helpers
// ---------------------------------------------------------------------------

export function emptyBaserunnerState(): ChartingBaserunnerState {
  return {
    runnerOnFirst: null,
    runnerOnSecond: null,
    runnerOnThird: null,
  };
}

export function normalizeBaserunnerState(
  state?: Partial<ChartingBaserunnerState> | null,
): ChartingBaserunnerState {
  return {
    runnerOnFirst: state?.runnerOnFirst?.trim() || null,
    runnerOnSecond: state?.runnerOnSecond?.trim() || null,
    runnerOnThird: state?.runnerOnThird?.trim() || null,
  };
}

export function baserunnerStateFromPlateAppearance(
  plateAppearance?: Pick<
    ChartingPlateAppearance,
    "runnerOnFirst" | "runnerOnSecond" | "runnerOnThird"
  > | null,
): ChartingBaserunnerState {
  return normalizeBaserunnerState(plateAppearance ?? undefined);
}

export function battingSideForMatchup(
  game: Pick<ChartingGame, "babsonVenueSide">,
  isTopInning: boolean,
): ChartingMatchupSide {
  const babsonBatting =
    (game.babsonVenueSide === "away" && isTopInning) ||
    (game.babsonVenueSide === "home" && !isTopInning);
  return babsonBatting ? "our" : "opponent";
}

export function pitchingSideForMatchup(
  game: Pick<ChartingGame, "babsonVenueSide">,
  isTopInning: boolean,
): ChartingMatchupSide {
  return battingSideForMatchup(game, isTopInning) === "our"
    ? "opponent"
    : "our";
}

export function deriveNextLineupSlot(
  snapshot: Pick<ChartingGameSnapshot, "game" | "plateAppearances">,
  battingSide: ChartingMatchupSide,
  gameStateOverride?: GameStateOverride | null,
): number {
  const orderedPlateAppearances = [...snapshot.plateAppearances].sort((left, right) => {
    if (left.paOrder === right.paOrder) {
      return left.id.localeCompare(right.id);
    }
    return left.paOrder - right.paOrder;
  });
  const lastSidePlateAppearanceAfterAnchor = gameStateOverride
    ? findLastPlateAppearance(
        orderedPlateAppearances,
        (plateAppearance) =>
          plateAppearance.paOrder > gameStateOverride.anchorPAOrder &&
          plateAppearance.teamSide === battingSide,
      )
    : null;
  if (lastSidePlateAppearanceAfterAnchor) {
    return nextLineupSlot(lastSidePlateAppearanceAfterAnchor.lineupSlot);
  }

  if (
    gameStateOverride &&
    battingSideForMatchup(snapshot.game, gameStateOverride.isTopInning) === battingSide
  ) {
    return gameStateOverride.batterSlot;
  }

  const lastSidePlateAppearance = findLastPlateAppearance(
    orderedPlateAppearances,
    (plateAppearance) => plateAppearance.teamSide === battingSide,
  );
  return lastSidePlateAppearance ? nextLineupSlot(lastSidePlateAppearance.lineupSlot) : 1;
}

// ---------------------------------------------------------------------------
// PA result helpers
// ---------------------------------------------------------------------------

export function availablePAResultsForClosure(
  state: PAClosureState,
): readonly PAResultType[] {
  switch (state) {
    case "strikeout":
      return ["K"];
    case "walk":
      return ["BB", "IBB"];
    case "hit_by_pitch":
      return ["HBP"];
    case "in_play":
      return [
        ...HIT_OPTIONS,
        ...HIT_ERROR_OPTIONS,
        ...SAC_OPTIONS,
        ...FLY_OUT_OPTIONS,
        ...LINE_OUT_OPTIONS,
        ...POP_OUT_OPTIONS,
        ...GROUND_OUT_OPTIONS,
        ...UNASSISTED_OUT_OPTIONS,
        ...DOUBLE_PLAY_OPTIONS,
        ...ERROR_OPTIONS,
        ...FIELDERS_CHOICE_OPTIONS,
        ...SPECIAL_PLAY_OPTIONS,
      ];
    default:
      return [];
  }
}

/** Whether {@link closeCurrentPlateAppearance} may apply `result` for the current live state. */
export function canClosePlateAppearanceWithResult(
  liveState: ChartingLiveState,
  result: PAResultType,
): boolean {
  if (availablePAResultsForClosure(liveState.closureState).includes(result)) {
    return true;
  }
  // Intentional walk: coach can signal anytime the count is still "live" (no terminal pitch
  // closure pending). Does not require four balls to be charted first.
  return (
    result === "IBB" &&
    liveState.openPAId !== null &&
    liveState.closureState === "none"
  );
}

export function guidanceTextForClosure(
  state: PAClosureState,
  openPAId: string | null,
): string {
  if (!openPAId) {
    return "Ready for the next hitter.";
  }

  switch (state) {
    case "strikeout":
      return "Strike three logged. Close the PA with K.";
    case "walk":
      return "Ball four logged. Close the PA with BB or IBB.";
    case "hit_by_pitch":
      return "Hit by pitch logged. Close the PA with HBP.";
    case "in_play":
      return "Ball in play logged. Choose the plate appearance result.";
    default:
      return "Record the next pitch.";
  }
}

export function paResultFamily(result: PAResultType): PAResultFamily {
  if (result === "K") return "strikeout";
  if (result === "BB" || result === "HBP" || result === "IBB") return "freePass";
  if (
    (HIT_OPTIONS as readonly string[]).includes(result) ||
    (HIT_ERROR_OPTIONS as readonly string[]).includes(result)
  ) {
    return "hit";
  }
  if ((SAC_OPTIONS as readonly string[]).includes(result)) return "out";
  if (
    (ERROR_OPTIONS as readonly string[]).includes(result) ||
    (FIELDERS_CHOICE_OPTIONS as readonly string[]).includes(result)
  ) {
    return "misc";
  }
  return "out";
}

export function paResultOutsRecorded(result: PAResultType): number {
  if (result === "K") return 1;
  if (isDoublePlay(result)) return 2;
  return paResultFamily(result) === "out" ? 1 : 0;
}

export function detailTextForPAResult(result: PAResultType): string {
  switch (result) {
    case "K":
      return "Strikeout";
    case "BB":
      return "Walk";
    case "HBP":
      return "Hit by pitch";
    case "IBB":
      return "Intentional walk";
    case "ITD":
      return "Interference (throwdown)";
    case "1B":
      return "Single";
    case "2B":
      return "Double";
    case "3B":
      return "Triple";
    case "HR":
      return "Home run";
    case "1B+E":
      return "Single + error";
    case "SAC":
      return "Sacrifice bunt";
    case "SF":
      return "Sacrifice fly";
    case "DP":
      return "Double play";
    case "FC":
      return "Fielder's choice";
    case "CS":
      return "Caught stealing";
    case "PO":
      return "Pickoff";
    case "3-1":
      return "Ground out, 3-1 (1B to pitcher)";
    default:
      if (isFlyOut(result)) {
        return `Fly out to ${positionLabelFromTrailingDigit(result) ?? result}`;
      }
      if (isLineOut(result)) {
        return `Line out to ${positionLabelFromTrailingDigit(result) ?? result}`;
      }
      if (isPopOut(result)) {
        return `Pop out to ${positionLabelFromTrailingDigit(result) ?? result}`;
      }
      if (isGroundOut(result)) {
        return `Ground out, ${result}`;
      }
      if (isUnassistedOut(result)) {
        return `Unassisted out by ${positionLabelFromLeadingDigit(result) ?? result}`;
      }
      if (isDoublePlay(result)) {
        return `Double play, ${result.replace(" DP", "")}`;
      }
      if (isError(result)) {
        return `Reached on error by ${positionLabelFromTrailingDigit(result) ?? result}`;
      }
      if (isFieldersChoice(result)) {
        const scoring = result.replace("FC ", "");
        return scoring === "FC"
          ? "Fielder's choice"
          : `Fielder's choice, ${scoring}`;
      }
      return result;
  }
}

export function closeoutResultGroups(
  availableResults: readonly PAResultType[],
): PAResultGroup[] {
  const available = new Set(availableResults);
  const groups: PAResultGroup[] = [];

  addGroup(groups, "Direct Result", ["K", "BB", "HBP", "IBB"], available);
  addGroup(groups, "Hits", [...HIT_OPTIONS, ...HIT_ERROR_OPTIONS], available);
  addGroup(groups, "Sacrifice", SAC_OPTIONS, available);
  addGroup(groups, "Fly Outs", FLY_OUT_OPTIONS, available);
  addGroup(groups, "Line Outs", LINE_OUT_OPTIONS, available);
  addGroup(groups, "Pop Outs", POP_OUT_OPTIONS, available);
  addGroup(groups, "Ground Outs", GROUND_OUT_OPTIONS, available);
  addGroup(groups, "Unassisted Outs", UNASSISTED_OUT_OPTIONS, available);
  addGroup(groups, "Double Plays", DOUBLE_PLAY_OPTIONS, available);
  addGroup(groups, "Errors", ERROR_OPTIONS, available);
  addGroup(groups, "Fielder's Choice", FIELDERS_CHOICE_OPTIONS, available);
  addGroup(groups, "Special", SPECIAL_PLAY_OPTIONS, available);

  return groups;
}

export function isPAResultType(value: string): value is PAResultType {
  return (PA_RESULT_OPTIONS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// State derivation
// ---------------------------------------------------------------------------

export function derivePAPitchProgress(
  pitches: ChartingPitch[],
  seedBalls?: number,
  seedStrikes?: number,
): PAPitchProgress {
  const orderedPitches = sortByPitchOrder(pitches);
  const initialBalls = orderedPitches[0]?.ballsBefore ?? seedBalls ?? 0;
  const initialStrikes = orderedPitches[0]?.strikesBefore ?? seedStrikes ?? 0;
  const progress: PAPitchProgress = {
    balls: clamp(initialBalls, 0, 3),
    strikes: clamp(initialStrikes, 0, 2),
    closureState: "none",
    lastPitchResult: null,
  };

  for (const pitch of orderedPitches) {
    if (progress.closureState !== "none") {
      break;
    }
    applyPitchResult(progress, pitch.pitchResult);
  }

  return progress;
}

export function deriveChartingLiveState(
  segments: import("./types").ChartingPitcherSegment[],
  plateAppearances: ChartingPlateAppearance[],
  pitches: ChartingPitch[],
  gameStateOverride?: GameStateOverride | null,
  options?: LiveStateOptions,
): ChartingLiveState {
  const orderedSegments = [...segments].sort((lhs, rhs) => {
    if (lhs.segmentOrder === rhs.segmentOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.segmentOrder - rhs.segmentOrder;
  });
  const orderedPAs = [...plateAppearances].sort((lhs, rhs) => {
    if (lhs.paOrder === rhs.paOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.paOrder - rhs.paOrder;
  });

  const pitchesByPA = new Map<string, ChartingPitch[]>();
  for (const pitch of pitches) {
    const existing = pitchesByPA.get(pitch.paId) ?? [];
    existing.push(pitch);
    pitchesByPA.set(pitch.paId, existing);
  }

  const state: ChartingLiveState = {
    inning: gameStateOverride ? Math.max(1, gameStateOverride.inning) : 1,
    isTopInning: gameStateOverride ? gameStateOverride.isTopInning : true,
    outs: gameStateOverride ? clamp(gameStateOverride.outs, 0, 2) : 0,
    balls: 0,
    strikes: 0,
    batterSlot: gameStateOverride ? clamp(gameStateOverride.batterSlot, 1, 9) : 1,
    openPAId: null,
    activeSegmentId: orderedSegments.at(-1)?.id ?? null,
    closureState: "none",
    lastPitchResult: null,
    isBetweenInnings: false,
  };

  const relevantPAs = gameStateOverride
    ? orderedPAs.filter((pa) => pa.paOrder > gameStateOverride.anchorPAOrder)
    : orderedPAs;

  for (const pa of relevantPAs) {
    state.inning = Math.max(1, pa.inning);
    state.isTopInning = pa.isTopInning;

    const paPitches = pitchesByPA.get(pa.id) ?? [];
    if (!pa.resultCode) {
      const initialSeed = nextPASeedFromInitialCount(
        resolvePlateAppearanceInitialCount(pa, paPitches),
      );
      const progress = derivePAPitchProgress(
        paPitches,
        initialSeed.balls,
        initialSeed.strikes,
      );
      state.balls = progress.balls;
      state.strikes = progress.strikes;
      state.batterSlot = pa.lineupSlot;
      state.openPAId = pa.id;
      state.activeSegmentId = pa.segmentId;
      state.closureState = progress.closureState;
      state.lastPitchResult = progress.lastPitchResult;
      state.isBetweenInnings = false;
      return state;
    }

    if (isPAResultType(pa.resultCode)) {
      state.outs += paResultOutsRecorded(pa.resultCode);
      while (state.outs >= 3) {
        state.outs -= 3;
        if (state.isTopInning) {
          state.isTopInning = false;
        } else {
          state.isTopInning = true;
          state.inning += 1;
        }
      }
    }

    state.balls = 0;
    state.strikes = 0;
    // CS/PO are baserunner outs — they don't consume a batting turn
    if (pa.resultCode !== "CS" && pa.resultCode !== "PO") {
      state.batterSlot = (pa.lineupSlot % 9) + 1;
    }
    state.openPAId = null;
    state.closureState = "none";
    state.lastPitchResult = null;
  }

  const lastPA = relevantPAs.at(-1);
  if (lastPA?.resultCode && isPAResultType(lastPA.resultCode)) {
    state.isBetweenInnings =
      paResultOutsRecorded(lastPA.resultCode) > 0 &&
      state.outs === 0 &&
      (state.inning !== lastPA.inning || state.isTopInning !== lastPA.isTopInning);
  }

  if (!state.openPAId && options?.nextPASeed) {
    state.balls = clamp(options.nextPASeed.balls, 0, 3);
    state.strikes = clamp(options.nextPASeed.strikes, 0, 2);
  }

  return state;
}

export function createGameStateOverride(
  snapshot: ChartingGameSnapshot,
  nextState: Pick<GameStateOverride, "inning" | "isTopInning" | "outs"> & {
    batterSlot?: number;
  },
): GameStateOverride {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
  );
  const anchorPAOrder = snapshot.plateAppearances.reduce(
    (max, pa) => Math.max(max, pa.paOrder),
    -1,
  );

  return {
    inning: Math.max(1, nextState.inning),
    isTopInning: nextState.isTopInning,
    outs: clamp(nextState.outs, 0, 2),
    batterSlot: clamp(nextState.batterSlot ?? liveState.batterSlot, 1, 9),
    anchorPAOrder,
  };
}

// ---------------------------------------------------------------------------
// Shared internal utilities (also used by live-mutations.ts)
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function sortByPitchOrder(pitches: ChartingPitch[]): ChartingPitch[] {
  return [...pitches].sort((lhs, rhs) => {
    if (lhs.pitchOrder === rhs.pitchOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.pitchOrder - rhs.pitchOrder;
  });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

const POSITION_LABELS: Record<number, string> = {
  1: "P",
  2: "C",
  3: "1B",
  4: "2B",
  5: "3B",
  6: "SS",
  7: "LF",
  8: "CF",
  9: "RF",
};

function addGroup(
  groups: PAResultGroup[],
  title: string,
  results: readonly PAResultType[],
  available: Set<PAResultType>,
) {
  const visible = results.filter((result) => available.has(result));
  if (visible.length > 0) {
    groups.push({ title, results: visible });
  }
}

function applyPitchResult(progress: PAPitchProgress, result: PitchResult) {
  progress.lastPitchResult = result;

  switch (result) {
    case "ball":
      if (progress.balls >= 3) {
        progress.balls = 4;
        progress.closureState = "walk";
      } else {
        progress.balls += 1;
      }
      break;
    case "called_strike":
    case "swinging_strike":
      if (progress.strikes >= 2) {
        progress.strikes = 3;
        progress.closureState = "strikeout";
      } else {
        progress.strikes += 1;
      }
      break;
    case "foul":
      if (progress.strikes < 2) {
        progress.strikes += 1;
      }
      break;
    case "bunt_foul":
      if (progress.strikes >= 2) {
        progress.strikes = 3;
        progress.closureState = "strikeout";
      } else {
        progress.strikes += 1;
      }
      break;
    case "in_play":
      progress.closureState = "in_play";
      break;
    case "hit_by_pitch":
      progress.closureState = "hit_by_pitch";
      break;
  }
}

function findLastPlateAppearance(
  plateAppearances: ChartingPlateAppearance[],
  predicate: (plateAppearance: ChartingPlateAppearance) => boolean,
) {
  for (let index = plateAppearances.length - 1; index >= 0; index -= 1) {
    const plateAppearance = plateAppearances[index];
    if (plateAppearance && predicate(plateAppearance)) {
      return plateAppearance;
    }
  }
  return null;
}

function nextLineupSlot(slot: number): number {
  return (slot % 9) + 1;
}

function isFlyOut(
  result: PAResultType,
): result is (typeof FLY_OUT_OPTIONS)[number] {
  return (FLY_OUT_OPTIONS as readonly string[]).includes(result);
}

function isLineOut(
  result: PAResultType,
): result is (typeof LINE_OUT_OPTIONS)[number] {
  return (LINE_OUT_OPTIONS as readonly string[]).includes(result);
}

function isPopOut(
  result: PAResultType,
): result is (typeof POP_OUT_OPTIONS)[number] {
  return (POP_OUT_OPTIONS as readonly string[]).includes(result);
}

function isGroundOut(
  result: PAResultType,
): result is (typeof GROUND_OUT_OPTIONS)[number] {
  return (
    result.includes("-") && !result.startsWith("FC ") && !result.endsWith(" DP")
  );
}

function isUnassistedOut(
  result: PAResultType,
): result is (typeof UNASSISTED_OUT_OPTIONS)[number] {
  return result.length === 2 && result.endsWith("U");
}

function isDoublePlay(
  result: PAResultType,
): result is (typeof DOUBLE_PLAY_OPTIONS)[number] {
  return result === "DP" || result.endsWith(" DP");
}

function isError(
  result: PAResultType,
): result is (typeof ERROR_OPTIONS)[number] {
  return result.length === 2 && result.startsWith("E");
}

function isFieldersChoice(
  result: PAResultType,
): result is (typeof FIELDERS_CHOICE_OPTIONS)[number] {
  return result === "FC" || result.startsWith("FC ");
}

function positionLabelFromTrailingDigit(result: string): string | null {
  const value = Number(result.at(-1));
  return Number.isInteger(value) ? (POSITION_LABELS[value] ?? null) : null;
}

function positionLabelFromLeadingDigit(result: string): string | null {
  const value = Number(result[0]);
  return Number.isInteger(value) ? (POSITION_LABELS[value] ?? null) : null;
}
