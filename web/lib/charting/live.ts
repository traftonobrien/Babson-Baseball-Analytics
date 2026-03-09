import { nextSegmentOrder } from "./domain";
import type {
  ChartingGameSnapshot,
  ChartingLineupEntry,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  PitchResult,
  PitchType,
} from "./types";

export const GAME_PITCH_RESULTS = [
  "ball",
  "called_strike",
  "swinging_strike",
  "foul",
  "in_play",
  "hit_by_pitch",
] as const satisfies readonly PitchResult[];

export const HIT_OPTIONS = ["1B", "2B", "3B", "HR"] as const;
export const FLY_OUT_OPTIONS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9"] as const;
export const LINE_OUT_OPTIONS = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9"] as const;
export const POP_OUT_OPTIONS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9"] as const;
export const GROUND_OUT_OPTIONS = ["1-3", "2-3", "4-3", "5-3", "6-3"] as const;
export const UNASSISTED_OUT_OPTIONS = ["1U", "2U", "3U", "4U", "5U", "6U", "7U", "8U", "9U"] as const;
export const DOUBLE_PLAY_OPTIONS = [
  "DP",
  "1-6-3 DP",
  "2-4-3 DP",
  "2-6-3 DP",
  "3-6-3 DP",
  "4-6-3 DP",
  "5-4-3 DP",
  "6-4-3 DP",
] as const;
export const ERROR_OPTIONS = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"] as const;
export const FIELDERS_CHOICE_OPTIONS = [
  "FC",
  "FC 1-2",
  "FC 1-6",
  "FC 2-4",
  "FC 2-5",
  "FC 3-6",
  "FC 4-6",
  "FC 5-2",
  "FC 5-4",
  "FC 6-4",
  "FC 6-5",
] as const;

export const PA_RESULT_OPTIONS = [
  "K",
  "BB",
  "HBP",
  ...HIT_OPTIONS,
  ...FLY_OUT_OPTIONS,
  ...LINE_OUT_OPTIONS,
  ...POP_OUT_OPTIONS,
  ...GROUND_OUT_OPTIONS,
  ...UNASSISTED_OUT_OPTIONS,
  ...DOUBLE_PLAY_OPTIONS,
  ...ERROR_OPTIONS,
  ...FIELDERS_CHOICE_OPTIONS,
] as const;

export type PAResultType = (typeof PA_RESULT_OPTIONS)[number];
export type PAClosureState = "none" | "strikeout" | "walk" | "hit_by_pitch" | "in_play";
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
  anchorPAOrder: number;
}

export interface RecordPitchInput {
  pitchType: PitchType;
  pitchResult: PitchResult;
  locationCell: number | null;
  velocity: number | null;
  pitcher: {
    playerId: string;
    name: string;
  };
  hitterName: string;
  lineupSlot: number;
}

export interface PAResultGroup {
  title: string;
  results: readonly PAResultType[];
}

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

export function availablePAResultsForClosure(state: PAClosureState): readonly PAResultType[] {
  switch (state) {
    case "strikeout":
      return ["K"];
    case "walk":
      return ["BB"];
    case "hit_by_pitch":
      return ["HBP"];
    case "in_play":
      return [
        ...HIT_OPTIONS,
        ...FLY_OUT_OPTIONS,
        ...LINE_OUT_OPTIONS,
        ...POP_OUT_OPTIONS,
        ...GROUND_OUT_OPTIONS,
        ...UNASSISTED_OUT_OPTIONS,
        ...DOUBLE_PLAY_OPTIONS,
        ...ERROR_OPTIONS,
        ...FIELDERS_CHOICE_OPTIONS,
      ];
    default:
      return [];
  }
}

export function guidanceTextForClosure(state: PAClosureState, openPAId: string | null): string {
  if (!openPAId) {
    return "Ready for the next hitter.";
  }

  switch (state) {
    case "strikeout":
      return "Strike three logged. Close the PA with K.";
    case "walk":
      return "Ball four logged. Close the PA with BB.";
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
  if (result === "BB" || result === "HBP") return "freePass";
  if ((HIT_OPTIONS as readonly string[]).includes(result)) return "hit";
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
    case "1B":
      return "Single";
    case "2B":
      return "Double";
    case "3B":
      return "Triple";
    case "HR":
      return "Home run";
    case "DP":
      return "Double play";
    case "FC":
      return "Fielder's choice";
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
        return scoring === "FC" ? "Fielder's choice" : `Fielder's choice, ${scoring}`;
      }
      return result;
  }
}

export function closeoutResultGroups(availableResults: readonly PAResultType[]): PAResultGroup[] {
  const available = new Set(availableResults);
  const groups: PAResultGroup[] = [];

  addGroup(groups, "Direct Result", ["K", "BB", "HBP"], available);
  addGroup(groups, "Hits", HIT_OPTIONS, available);
  addGroup(groups, "Fly Outs", FLY_OUT_OPTIONS, available);
  addGroup(groups, "Line Outs", LINE_OUT_OPTIONS, available);
  addGroup(groups, "Pop Outs", POP_OUT_OPTIONS, available);
  addGroup(groups, "Ground Outs", GROUND_OUT_OPTIONS, available);
  addGroup(groups, "Unassisted Outs", UNASSISTED_OUT_OPTIONS, available);
  addGroup(groups, "Double Plays", DOUBLE_PLAY_OPTIONS, available);
  addGroup(groups, "Errors", ERROR_OPTIONS, available);
  addGroup(groups, "Fielder's Choice", FIELDERS_CHOICE_OPTIONS, available);

  return groups;
}

export function derivePAPitchProgress(
  pitches: ChartingPitch[],
  seedBalls?: number,
  seedStrikes?: number
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
  segments: ChartingPitcherSegment[],
  plateAppearances: ChartingPlateAppearance[],
  pitches: ChartingPitch[],
  gameStateOverride?: GameStateOverride | null
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
    batterSlot: 1,
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
    state.inning = Math.max(state.inning, pa.inning);

    const paPitches = pitchesByPA.get(pa.id) ?? [];
    if (!pa.resultCode) {
      const progress = derivePAPitchProgress(paPitches);
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
        state.inning += 1;
      }
    }

    state.balls = 0;
    state.strikes = 0;
    state.batterSlot = (pa.lineupSlot % 9) + 1;
    state.openPAId = null;
    state.closureState = "none";
    state.lastPitchResult = null;
  }

  const lastPA = relevantPAs.at(-1);
  if (lastPA?.resultCode && isPAResultType(lastPA.resultCode)) {
    state.isBetweenInnings =
      paResultOutsRecorded(lastPA.resultCode) > 0 &&
      state.outs === 0 &&
      state.inning > lastPA.inning;
  }

  return state;
}

export function createGameStateOverride(
  snapshot: ChartingGameSnapshot,
  nextState: Pick<GameStateOverride, "inning" | "isTopInning" | "outs">
): GameStateOverride {
  const anchorPAOrder = snapshot.plateAppearances.reduce(
    (max, pa) => Math.max(max, pa.paOrder),
    -1
  );

  return {
    inning: Math.max(1, nextState.inning),
    isTopInning: nextState.isTopInning,
    outs: clamp(nextState.outs, 0, 2),
    anchorPAOrder,
  };
}

export function recordPitchInSnapshot(
  snapshot: ChartingGameSnapshot,
  input: RecordPitchInput,
  gameStateOverride?: GameStateOverride | null
): ChartingGameSnapshot {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride
  );

  if (liveState.closureState !== "none") {
    return snapshot;
  }

  if (!input.pitcher.playerId.trim() || !input.hitterName.trim()) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    clamp(input.lineupSlot, 1, 9),
    input.hitterName.trim()
  );

  let activeSegment = nextSnapshot.segments.at(-1) ?? null;
  if (!activeSegment || activeSegment.playerId !== input.pitcher.playerId) {
    if (liveState.openPAId) {
      return snapshot;
    }

    activeSegment = {
      id: crypto.randomUUID(),
      gameId: nextSnapshot.game.id,
      playerId: input.pitcher.playerId,
      displayName: input.pitcher.name,
      segmentOrder: nextSegmentOrder(nextSnapshot.segments),
      enteredInning: liveState.inning,
      exitedInning: null,
      runsOverride: null,
      earnedRunsOverride: null,
    };
    nextSnapshot.segments.push(activeSegment);
  }

  let openPA = nextSnapshot.plateAppearances.find((pa) => pa.id === liveState.openPAId) ?? null;
  if (!openPA) {
    openPA = {
      id: crypto.randomUUID(),
      gameId: nextSnapshot.game.id,
      segmentId: activeSegment.id,
      paOrder: nextPAOrder(nextSnapshot.plateAppearances),
      inning: liveState.inning,
      hitterName: input.hitterName.trim(),
      lineupSlot: clamp(input.lineupSlot, 1, 9),
      resultCode: null,
      buntContext: false,
    };
    nextSnapshot.plateAppearances.push(openPA);
  } else {
    openPA.hitterName = input.hitterName.trim();
    openPA.lineupSlot = clamp(input.lineupSlot, 1, 9);
    openPA.buntContext = openPA.buntContext || false;
  }

  nextSnapshot.pitches.push({
    id: crypto.randomUUID(),
    gameId: nextSnapshot.game.id,
    paId: openPA.id,
    pitchOrder: nextPitchOrder(nextSnapshot.pitches),
    pitchType: input.pitchType,
    locationCell: input.pitchResult === "hit_by_pitch" ? null : input.locationCell,
    pitchResult: input.pitchResult,
    ballsBefore: liveState.balls,
    strikesBefore: liveState.strikes,
    velocity: input.velocity ?? null,
  });

  return nextSnapshot;
}

export function closeCurrentPlateAppearance(
  snapshot: ChartingGameSnapshot,
  result: PAResultType,
  gameStateOverride?: GameStateOverride | null
): ChartingGameSnapshot {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride
  );

  if (!availablePAResultsForClosure(liveState.closureState).includes(result)) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const openPA = nextSnapshot.plateAppearances.find((pa) => pa.id === liveState.openPAId);
  if (!openPA) {
    return snapshot;
  }

  openPA.resultCode = result;
  return nextSnapshot;
}

export function undoSnapshotAction(snapshot: ChartingGameSnapshot): ChartingGameSnapshot {
  const nextSnapshot = cloneSnapshot(snapshot);
  const lastPA = [...nextSnapshot.plateAppearances].sort((lhs, rhs) => {
    if (lhs.paOrder === rhs.paOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.paOrder - rhs.paOrder;
  }).at(-1);

  if (!lastPA) {
    return snapshot;
  }

  if (lastPA.resultCode) {
    lastPA.resultCode = null;
    return nextSnapshot;
  }

  const pitchesForPA = sortByPitchOrder(
    nextSnapshot.pitches.filter((pitch) => pitch.paId === lastPA.id)
  );
  const lastPitch = pitchesForPA.at(-1);
  if (lastPitch) {
    nextSnapshot.pitches = nextSnapshot.pitches.filter((pitch) => pitch.id !== lastPitch.id);
    if (pitchesForPA.length === 1) {
      removePlateAppearanceAndOrphanSegment(nextSnapshot, lastPA.id);
    }
    return nextSnapshot;
  }

  removePlateAppearanceAndOrphanSegment(nextSnapshot, lastPA.id);
  return nextSnapshot;
}

export function updateSnapshotRevision(
  snapshot: ChartingGameSnapshot,
  revision: number,
  updatedAt?: string
): ChartingGameSnapshot {
  return {
    ...snapshot,
    game: {
      ...snapshot.game,
      revision,
      updatedAt: updatedAt ?? snapshot.game.updatedAt,
    },
  };
}

export function lineupNameForSlot(
  lineup: ChartingLineupEntry[],
  slot: number
): string | null {
  const entry = lineup.find((item) => item.lineupSlot === slot);
  return entry?.hitterName ?? null;
}

export function isPAResultType(value: string): value is PAResultType {
  return (PA_RESULT_OPTIONS as readonly string[]).includes(value);
}

function addGroup(
  groups: PAResultGroup[],
  title: string,
  results: readonly PAResultType[],
  available: Set<PAResultType>
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
    case "in_play":
      progress.closureState = "in_play";
      break;
    case "hit_by_pitch":
      progress.closureState = "hit_by_pitch";
      break;
  }
}

function cloneSnapshot(snapshot: ChartingGameSnapshot): ChartingGameSnapshot {
  return {
    game: { ...snapshot.game },
    segments: snapshot.segments.map((segment) => ({ ...segment })),
    lineup: snapshot.lineup.map((entry) => ({ ...entry })),
    plateAppearances: snapshot.plateAppearances.map((pa) => ({ ...pa })),
    pitches: snapshot.pitches.map((pitch) => ({ ...pitch })),
  };
}

function sortByPitchOrder(pitches: ChartingPitch[]): ChartingPitch[] {
  return [...pitches].sort((lhs, rhs) => {
    if (lhs.pitchOrder === rhs.pitchOrder) {
      return lhs.id.localeCompare(rhs.id);
    }
    return lhs.pitchOrder - rhs.pitchOrder;
  });
}

function nextPitchOrder(pitches: ChartingPitch[]): number {
  return pitches.reduce((max, pitch) => Math.max(max, pitch.pitchOrder), -1) + 1;
}

function nextPAOrder(plateAppearances: ChartingPlateAppearance[]): number {
  return plateAppearances.reduce((max, pa) => Math.max(max, pa.paOrder), -1) + 1;
}

function upsertLineupEntry(
  lineup: ChartingLineupEntry[],
  gameId: string,
  lineupSlot: number,
  hitterName: string
) {
  const existing = lineup.find((entry) => entry.lineupSlot === lineupSlot);
  if (existing) {
    existing.hitterName = hitterName;
    return;
  }

  lineup.push({
    id: crypto.randomUUID(),
    gameId,
    lineupSlot,
    hitterName,
  });
}

function removePlateAppearanceAndOrphanSegment(
  snapshot: ChartingGameSnapshot,
  plateAppearanceId: string
) {
  const plateAppearance = snapshot.plateAppearances.find((pa) => pa.id === plateAppearanceId);
  if (!plateAppearance) {
    return;
  }

  snapshot.plateAppearances = snapshot.plateAppearances.filter(
    (pa) => pa.id !== plateAppearanceId
  );

  const hasRemainingSegmentUsage = snapshot.plateAppearances.some(
    (pa) => pa.segmentId === plateAppearance.segmentId
  );
  if (!hasRemainingSegmentUsage) {
    snapshot.segments = snapshot.segments.filter(
      (segment) => segment.id !== plateAppearance.segmentId
    );
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isFlyOut(result: PAResultType): result is (typeof FLY_OUT_OPTIONS)[number] {
  return (FLY_OUT_OPTIONS as readonly string[]).includes(result);
}

function isLineOut(result: PAResultType): result is (typeof LINE_OUT_OPTIONS)[number] {
  return (LINE_OUT_OPTIONS as readonly string[]).includes(result);
}

function isPopOut(result: PAResultType): result is (typeof POP_OUT_OPTIONS)[number] {
  return (POP_OUT_OPTIONS as readonly string[]).includes(result);
}

function isGroundOut(result: PAResultType): result is (typeof GROUND_OUT_OPTIONS)[number] {
  return result.includes("-") && !result.startsWith("FC ") && !result.endsWith(" DP");
}

function isUnassistedOut(result: PAResultType): result is (typeof UNASSISTED_OUT_OPTIONS)[number] {
  return result.length === 2 && result.endsWith("U");
}

function isDoublePlay(result: PAResultType): result is (typeof DOUBLE_PLAY_OPTIONS)[number] {
  return result === "DP" || result.endsWith(" DP");
}

function isError(result: PAResultType): result is (typeof ERROR_OPTIONS)[number] {
  return result.length === 2 && result.startsWith("E");
}

function isFieldersChoice(result: PAResultType): result is (typeof FIELDERS_CHOICE_OPTIONS)[number] {
  return result === "FC" || result.startsWith("FC ");
}

function positionLabelFromTrailingDigit(result: string): string | null {
  const value = Number(result.at(-1));
  return Number.isInteger(value) ? POSITION_LABELS[value] ?? null : null;
}

function positionLabelFromLeadingDigit(result: string): string | null {
  const value = Number(result[0]);
  return Number.isInteger(value) ? POSITION_LABELS[value] ?? null : null;
}
