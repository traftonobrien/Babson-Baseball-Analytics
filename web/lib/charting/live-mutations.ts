import { nextSegmentOrder } from "./domain";
import type {
  ChartingGameSnapshot,
  ChartingInitialCount,
  ChartingLineupEntry,
  ChartingMatchupSide,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  PitchResult,
} from "./types";
import type { PAResultType } from "./live-constants";
import {
  type GameStateOverride,
  type LiveStateOptions,
  type PAPitchProgress,
  type RecordPitchInput,
  type UpdatePlateAppearanceContextInput,
  type UpdatePlateAppearanceDetailsInput,
  availablePAResultsForClosure,
  battingSideForMatchup,
  clamp,
  deriveChartingLiveState,
  initialCountFromSeed,
  isPAResultType,
  nextPASeedFromInitialCount,
  normalizeBaserunnerState,
  pitchingSideForMatchup,
  resolvePlateAppearanceInitialCount,
  sortByPitchOrder,
} from "./live-domain";

// ---------------------------------------------------------------------------
// Snapshot mutation functions
// ---------------------------------------------------------------------------

export function recordPitchInSnapshot(
  snapshot: ChartingGameSnapshot,
  input: RecordPitchInput,
  gameStateOverride?: GameStateOverride | null,
  options?: LiveStateOptions,
): ChartingGameSnapshot {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
    options,
  );

  if (liveState.closureState !== "none") {
    return snapshot;
  }

  if (!input.pitcher.playerId.trim() || !input.hitterName.trim()) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const battingSide = battingSideForMatchup(
    nextSnapshot.game,
    liveState.isTopInning,
  );
  const pitchingSide = pitchingSideForMatchup(
    nextSnapshot.game,
    liveState.isTopInning,
  );
  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    battingSide,
    clamp(input.lineupSlot, 1, 9),
    input.hitterName.trim(),
  );

  let activeSegment = nextSnapshot.segments.at(-1) ?? null;
  const activeSegmentMatches =
    activeSegment !== null &&
    pitcherSegmentMatches(
      activeSegment,
      input.pitcher.playerId,
      input.pitcher.name,
      pitchingSide,
    );
  if (activeSegmentMatches && activeSegment) {
    syncSegmentPitcherIdentity(
      activeSegment,
      input.pitcher.playerId,
      input.pitcher.name,
    );
  }
  if (
    !activeSegment ||
    !activeSegmentMatches ||
    activeSegment.teamSide !== pitchingSide
  ) {
    if (liveState.openPAId) {
      return snapshot;
    }

    activeSegment = {
      id: crypto.randomUUID(),
      gameId: nextSnapshot.game.id,
      playerId: input.pitcher.playerId,
      displayName: input.pitcher.name,
      teamSide: pitchingSide,
      segmentOrder: nextSegmentOrder(nextSnapshot.segments),
      enteredInning: liveState.inning,
      exitedInning: null,
      pitcherHand: input.pitcher.pitcherHand ?? null,
      runsOverride: null,
      earnedRunsOverride: null,
    };
    nextSnapshot.segments.push(activeSegment);
  }

  let openPA =
    nextSnapshot.plateAppearances.find((pa) => pa.id === liveState.openPAId) ??
    null;
  const shouldSeedBuntMode = !openPA && Boolean(options?.nextPASeed?.buntMode);
  const normalizedPitchResult = normalizePitchResultForBunt(
    input.pitchResult,
    shouldSeedBuntMode || openPA?.buntContext === true,
  );

  if (!openPA) {
    openPA = {
      id: crypto.randomUUID(),
      gameId: nextSnapshot.game.id,
      segmentId: activeSegment.id,
      paOrder: nextPAOrder(nextSnapshot.plateAppearances),
      inning: liveState.inning,
      isTopInning: liveState.isTopInning,
      hitterName: input.hitterName.trim(),
      hitterHand: input.hitterHand ?? null,
      lineupSlot: clamp(input.lineupSlot, 1, 9),
      teamSide: battingSide,
      resultCode: null,
      initialCount: initialCountFromSeed(options?.nextPASeed),
      buntContext: shouldSeedBuntMode || normalizedPitchResult === "bunt_foul",
      ...normalizeBaserunnerState(options?.nextPASeed?.baserunners),
    };
    nextSnapshot.plateAppearances.push(openPA);
  } else {
    const existingPitches = nextSnapshot.pitches.filter(
      (pitch) => pitch.paId === openPA?.id,
    );
    openPA.hitterName = input.hitterName.trim();
    openPA.lineupSlot = clamp(input.lineupSlot, 1, 9);
    openPA.isTopInning = liveState.isTopInning;
    openPA.teamSide = battingSide;
    openPA.initialCount = resolvePlateAppearanceInitialCount(
      openPA,
      existingPitches,
    );
    openPA.buntContext =
      openPA.buntContext || normalizedPitchResult === "bunt_foul";
  }

  nextSnapshot.pitches.push({
    id: crypto.randomUUID(),
    gameId: nextSnapshot.game.id,
    paId: openPA.id,
    pitchOrder: nextPitchOrder(nextSnapshot.pitches),
    pitchType: input.pitchType,
    locationCell:
      normalizedPitchResult === "hit_by_pitch" ? null : input.locationCell,
    pitchResult: normalizedPitchResult,
    ballsBefore: liveState.balls,
    strikesBefore: liveState.strikes,
    velocity: input.velocity ?? null,
  });

  return nextSnapshot;
}

/**
 * Immediately creates a new pitcher segment for `newPitcher` and closes the
 * current active segment for the same pitching side.  Unlike
 * `recordPitchInSnapshot`, this does NOT require a pitch to be recorded first,
 * so the segment is persisted as soon as the caller queues a save.
 *
 * Returns the same snapshot (reference-equal) if:
 *   - There is an open plate appearance (must be closed first).
 *   - `newPitcher.name` is empty.
 *   - The active segment already belongs to `newPitcher`.
 */
export function switchPitcherInSnapshot(
  snapshot: ChartingGameSnapshot,
  newPitcher: { playerId: string; name: string; pitcherHand?: string | null },
  gameStateOverride?: GameStateOverride | null,
): ChartingGameSnapshot {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );

  if (liveState.openPAId) return snapshot;

  const pitchingSide = pitchingSideForMatchup(snapshot.game, liveState.isTopInning);
  const trimmedId = newPitcher.playerId.trim();
  const trimmedName = newPitcher.name.trim();

  if (!trimmedName) return snapshot;

  const lastSegment =
    [...snapshot.segments].reverse().find((s) => s.teamSide === pitchingSide) ?? null;

  if (lastSegment && pitcherSegmentMatches(lastSegment, trimmedId, trimmedName, pitchingSide)) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);

  // Close the current active segment at the current inning.
  const currentSeg = lastSegment
    ? nextSnapshot.segments.find((s) => s.id === lastSegment.id) ?? null
    : null;
  if (currentSeg && currentSeg.exitedInning === null) {
    currentSeg.exitedInning = liveState.inning;
  }

  nextSnapshot.segments.push({
    id: crypto.randomUUID(),
    gameId: nextSnapshot.game.id,
    playerId: trimmedId,
    displayName: trimmedName,
    teamSide: pitchingSide,
    segmentOrder: nextSegmentOrder(nextSnapshot.segments),
    enteredInning: liveState.inning,
    exitedInning: null,
    pitcherHand: newPitcher.pitcherHand ?? null,
    runsOverride: null,
    earnedRunsOverride: null,
  });

  return nextSnapshot;
}

export function closeCurrentPlateAppearance(
  snapshot: ChartingGameSnapshot,
  result: PAResultType,
  gameStateOverride?: GameStateOverride | null,
): ChartingGameSnapshot {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );

  if (!availablePAResultsForClosure(liveState.closureState).includes(result)) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const openPA = nextSnapshot.plateAppearances.find(
    (pa) => pa.id === liveState.openPAId,
  );
  if (!openPA) {
    return snapshot;
  }

  openPA.resultCode = result;
  return nextSnapshot;
}

export function undoSnapshotAction(
  snapshot: ChartingGameSnapshot,
): ChartingGameSnapshot {
  const nextSnapshot = cloneSnapshot(snapshot);
  const lastPA = [...nextSnapshot.plateAppearances]
    .sort((lhs, rhs) => {
      if (lhs.paOrder === rhs.paOrder) {
        return lhs.id.localeCompare(rhs.id);
      }
      return lhs.paOrder - rhs.paOrder;
    })
    .at(-1);

  if (!lastPA) {
    return snapshot;
  }

  if (lastPA.resultCode) {
    lastPA.resultCode = null;
    return nextSnapshot;
  }

  const pitchesForPA = sortByPitchOrder(
    nextSnapshot.pitches.filter((pitch) => pitch.paId === lastPA.id),
  );
  const lastPitch = pitchesForPA.at(-1);
  if (lastPitch) {
    nextSnapshot.pitches = nextSnapshot.pitches.filter(
      (pitch) => pitch.id !== lastPitch.id,
    );
    if (pitchesForPA.length === 1) {
      removePlateAppearanceAndOrphanSegment(nextSnapshot, lastPA.id);
    }
    return nextSnapshot;
  }

  removePlateAppearanceAndOrphanSegment(nextSnapshot, lastPA.id);
  return nextSnapshot;
}

export function syncHitterToSnapshot(
  snapshot: ChartingGameSnapshot,
  hitterName: string,
  lineupSlot: number,
  hitterHand?: string | null,
  gameStateOverride?: GameStateOverride | null,
): ChartingGameSnapshot {
  const trimmed = hitterName.trim();
  if (!trimmed) return snapshot;

  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
  );

  const nextSnapshot = cloneSnapshot(snapshot);
  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    battingSideForMatchup(snapshot.game, liveState.isTopInning),
    clamp(lineupSlot, 1, 9),
    trimmed,
  );

  const openPA = nextSnapshot.plateAppearances.find(
    (pa) => pa.id === liveState.openPAId,
  );
  if (openPA) {
    openPA.hitterName = trimmed;
    if (hitterHand !== undefined) openPA.hitterHand = hitterHand;
    openPA.lineupSlot = clamp(lineupSlot, 1, 9);
  }

  return nextSnapshot;
}

export function updatePitchVelocityInSnapshot(
  snapshot: ChartingGameSnapshot,
  pitchId: string,
  velocity: number | null,
): ChartingGameSnapshot {
  const existingPitch = snapshot.pitches.find((pitch) => pitch.id === pitchId);
  if (!existingPitch) {
    return snapshot;
  }

  const normalizedVelocity = velocity ?? null;
  if ((existingPitch.velocity ?? null) === normalizedVelocity) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const targetPitch = nextSnapshot.pitches.find(
    (pitch) => pitch.id === pitchId,
  );
  if (!targetPitch) {
    return snapshot;
  }

  targetPitch.velocity = normalizedVelocity;
  return nextSnapshot;
}

export function updatePAHitterNameInSnapshot(
  snapshot: ChartingGameSnapshot,
  paId: string,
  newHitterName: string,
): ChartingGameSnapshot {
  const trimmed = newHitterName.trim();
  if (!trimmed) return snapshot;

  const existingPA = snapshot.plateAppearances.find((pa) => pa.id === paId);
  if (!existingPA) {
    return snapshot;
  }

  if (existingPA.hitterName === trimmed) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const targetPA = nextSnapshot.plateAppearances.find((pa) => pa.id === paId);
  if (!targetPA) return snapshot;

  targetPA.hitterName = trimmed;
  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    targetPA.teamSide,
    targetPA.lineupSlot,
    trimmed,
  );

  return nextSnapshot;
}

export function updatePlateAppearanceDetailsInSnapshot(
  snapshot: ChartingGameSnapshot,
  input: UpdatePlateAppearanceDetailsInput,
): ChartingGameSnapshot {
  const trimmedHitter = input.hitterName.trim();
  const trimmedPitcherId = input.pitcher.playerId.trim();
  const trimmedPitcherName = input.pitcher.name.trim();
  if (!trimmedHitter || !trimmedPitcherId || !trimmedPitcherName) {
    return snapshot;
  }

  const existingPA = snapshot.plateAppearances.find(
    (pa) => pa.id === input.paId,
  );
  if (!existingPA) {
    return snapshot;
  }

  const existingSegment =
    snapshot.segments.find((segment) => segment.id === existingPA.segmentId) ??
    null;
  const currentPitches = sortByPitchOrder(
    snapshot.pitches.filter((pitch) => pitch.paId === existingPA.id),
  );
  const normalizedPitches = rebuildPitchesForInitialCount(
    currentPitches,
    input.initialCount,
  );
  const currentInitialCount = resolvePlateAppearanceInitialCount(
    existingPA,
    currentPitches,
  );
  const resultCode = input.resultCode ?? null;

  const pitchTrailChanged = normalizedPitches.some((pitch, index) => {
    const currentPitch = currentPitches[index];
    return (
      !currentPitch ||
      currentPitch.pitchResult !== pitch.pitchResult ||
      currentPitch.ballsBefore !== pitch.ballsBefore ||
      currentPitch.strikesBefore !== pitch.strikesBefore
    );
  });

  if (
    existingSegment?.playerId === trimmedPitcherId &&
    existingSegment.displayName === trimmedPitcherName &&
    existingPA.hitterName === trimmedHitter &&
    currentInitialCount === input.initialCount &&
    existingPA.resultCode === resultCode &&
    !pitchTrailChanged
  ) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const targetPA = nextSnapshot.plateAppearances.find(
    (pa) => pa.id === input.paId,
  );
  if (!targetPA) {
    return snapshot;
  }

  const targetSegment = ensureSegmentForPlateAppearance(
    nextSnapshot,
    targetPA,
    trimmedPitcherId,
    trimmedPitcherName,
  );

  targetPA.segmentId = targetSegment.id;
  targetPA.hitterName = trimmedHitter;
  targetPA.initialCount = input.initialCount;
  targetPA.buntContext = input.initialCount === "Bunt";
  targetPA.resultCode = resultCode;

  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    targetPA.teamSide,
    targetPA.lineupSlot,
    trimmedHitter,
  );

  const rebuiltPitchesById = new Map(
    normalizedPitches.map((pitch) => [pitch.id, pitch]),
  );
  nextSnapshot.pitches = nextSnapshot.pitches.map((pitch) =>
    pitch.paId === targetPA.id
      ? (rebuiltPitchesById.get(pitch.id) ?? pitch)
      : pitch,
  );

  reconcileSnapshotSegments(nextSnapshot);
  return nextSnapshot;
}

export function updatePlateAppearanceContextInSnapshot(
  snapshot: ChartingGameSnapshot,
  input: UpdatePlateAppearanceContextInput,
): ChartingGameSnapshot {
  const existingPA = snapshot.plateAppearances.find((pa) => pa.id === input.paId);
  if (!existingPA) {
    return snapshot;
  }

  const nextInning = input.inning ?? existingPA.inning;
  const nextIsTopInning = input.isTopInning ?? existingPA.isTopInning;
  if (
    existingPA.inning === nextInning &&
    existingPA.isTopInning === nextIsTopInning
  ) {
    return snapshot;
  }

  const nextSnapshot = cloneSnapshot(snapshot);
  const targetPA = nextSnapshot.plateAppearances.find((pa) => pa.id === input.paId);
  if (!targetPA) {
    return snapshot;
  }

  targetPA.inning = nextInning;
  targetPA.isTopInning = nextIsTopInning;
  targetPA.teamSide = battingSideForMatchup(
    nextSnapshot.game,
    nextIsTopInning,
  );

  const currentSegment =
    nextSnapshot.segments.find((segment) => segment.id === targetPA.segmentId) ?? null;
  if (currentSegment) {
    const targetSegment = ensureSegmentForPlateAppearance(
      nextSnapshot,
      targetPA,
      currentSegment.playerId ?? "",
      currentSegment.displayName,
    );
    targetPA.segmentId = targetSegment.id;
  }

  upsertLineupEntry(
    nextSnapshot.lineup,
    nextSnapshot.game.id,
    targetPA.teamSide,
    targetPA.lineupSlot,
    targetPA.hitterName,
  );

  reconcileSnapshotSegments(nextSnapshot);
  return nextSnapshot;
}

export function updateSnapshotRevision(
  snapshot: ChartingGameSnapshot,
  revision: number,
  updatedAt?: string,
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
  slot: number,
  teamSide: ChartingMatchupSide,
): string | null {
  const entry = lineup.find(
    (item) => item.lineupSlot === slot && item.teamSide === teamSide,
  );
  return entry?.hitterName ?? null;
}

export function countPitcherPitches(
  snapshot: Pick<
    ChartingGameSnapshot,
    "segments" | "plateAppearances" | "pitches"
  >,
  pitcherId: string,
): number {
  if (!pitcherId) {
    return 0;
  }

  const segmentIds = segmentIdsForPitcher(snapshot.segments, pitcherId);
  if (segmentIds.size === 0) {
    return 0;
  }

  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));
  return snapshot.pitches.filter((pitch) => {
    const pa = paById.get(pitch.paId);
    return pa ? segmentIds.has(pa.segmentId) : false;
  }).length;
}

export function countPitcherInningPitches(
  snapshot: Pick<
    ChartingGameSnapshot,
    "segments" | "plateAppearances" | "pitches"
  >,
  pitcherId: string,
  inning: number,
): number {
  if (!pitcherId) {
    return 0;
  }

  const segmentIds = segmentIdsForPitcher(snapshot.segments, pitcherId);
  if (segmentIds.size === 0) {
    return 0;
  }

  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));
  return snapshot.pitches.filter((pitch) => {
    const pa = paById.get(pitch.paId);
    return pa ? segmentIds.has(pa.segmentId) && pa.inning === inning : false;
  }).length;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function cloneSnapshot(snapshot: ChartingGameSnapshot): ChartingGameSnapshot {
  return {
    game: { ...snapshot.game },
    segments: snapshot.segments.map((segment) => ({ ...segment })),
    lineup: snapshot.lineup.map((entry) => ({ ...entry })),
    plateAppearances: snapshot.plateAppearances.map((pa) => ({ ...pa })),
    pitches: snapshot.pitches.map((pitch) => ({ ...pitch })),
  };
}

function nextPitchOrder(pitches: ChartingPitch[]): number {
  return (
    pitches.reduce((max, pitch) => Math.max(max, pitch.pitchOrder), -1) + 1
  );
}

function nextPAOrder(plateAppearances: ChartingPlateAppearance[]): number {
  return (
    plateAppearances.reduce((max, pa) => Math.max(max, pa.paOrder), -1) + 1
  );
}

function upsertLineupEntry(
  lineup: ChartingLineupEntry[],
  gameId: string,
  teamSide: ChartingMatchupSide,
  lineupSlot: number,
  hitterName: string,
) {
  const existing = lineup.find(
    (entry) => entry.lineupSlot === lineupSlot && entry.teamSide === teamSide,
  );
  if (existing) {
    existing.hitterName = hitterName;
    return;
  }

  lineup.push({
    id: crypto.randomUUID(),
    gameId,
    teamSide,
    lineupSlot,
    hitterName,
  });
}

function removePlateAppearanceAndOrphanSegment(
  snapshot: ChartingGameSnapshot,
  plateAppearanceId: string,
) {
  const plateAppearance = snapshot.plateAppearances.find(
    (pa) => pa.id === plateAppearanceId,
  );
  if (!plateAppearance) {
    return;
  }

  snapshot.plateAppearances = snapshot.plateAppearances.filter(
    (pa) => pa.id !== plateAppearanceId,
  );

  const hasRemainingSegmentUsage = snapshot.plateAppearances.some(
    (pa) => pa.segmentId === plateAppearance.segmentId,
  );
  if (!hasRemainingSegmentUsage) {
    snapshot.segments = snapshot.segments.filter(
      (segment) => segment.id !== plateAppearance.segmentId,
    );
  }
}

function normalizePitchResultForBunt(
  result: PitchResult,
  buntMode: boolean,
): PitchResult {
  if (buntMode && result === "foul") {
    return "bunt_foul";
  }
  if (!buntMode && result === "bunt_foul") {
    return "foul";
  }
  return result;
}

function rebuildPitchesForInitialCount(
  pitches: ChartingPitch[],
  initialCount: ChartingInitialCount,
): ChartingPitch[] {
  const seed = nextPASeedFromInitialCount(initialCount);
  const progress: PAPitchProgress = {
    balls: clamp(seed.balls, 0, 3),
    strikes: clamp(seed.strikes, 0, 2),
    closureState: "none",
    lastPitchResult: null,
  };

  return sortByPitchOrder(pitches).map((pitch) => {
    const normalizedResult = normalizePitchResultForBunt(
      pitch.pitchResult,
      Boolean(seed.buntMode),
    );
    const rebuiltPitch: ChartingPitch = {
      ...pitch,
      pitchResult: normalizedResult,
      ballsBefore: progress.balls,
      strikesBefore: progress.strikes,
    };
    applyPitchResult(progress, normalizedResult);
    return rebuiltPitch;
  });
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

function pitcherIdentityKey(
  playerId: string | null | undefined,
  displayName: string,
): string {
  const trimmedPlayerId = playerId?.trim() ?? "";
  const normalizedName = displayName.trim().toLowerCase();

  if (trimmedPlayerId && !trimmedPlayerId.startsWith("manual:")) {
    return `player:${trimmedPlayerId}`;
  }
  if (normalizedName) {
    return `name:${normalizedName}`;
  }
  if (trimmedPlayerId) {
    return `player:${trimmedPlayerId}`;
  }
  return "";
}

function pitcherSegmentMatches(
  segment: ChartingPitcherSegment,
  pitcherId: string,
  pitcherName: string,
  pitcherSide: ChartingMatchupSide,
): boolean {
  return (
    segment.teamSide === pitcherSide &&
    pitcherIdentityKey(segment.playerId, segment.displayName) ===
      pitcherIdentityKey(pitcherId, pitcherName)
  );
}

function syncSegmentPitcherIdentity(
  segment: ChartingPitcherSegment,
  pitcherId: string,
  pitcherName: string,
) {
  if (!segment.playerId?.trim() && pitcherId.trim()) {
    segment.playerId = pitcherId;
  }
  segment.displayName = pitcherName;
}

function ensureSegmentForPlateAppearance(
  snapshot: ChartingGameSnapshot,
  plateAppearance: ChartingPlateAppearance,
  pitcherId: string,
  pitcherName: string,
): ChartingPitcherSegment {
  const pitcherSide = pitchingSideForMatchup(
    snapshot.game,
    plateAppearance.isTopInning,
  );
  const currentSegment =
    snapshot.segments.find(
      (segment) => segment.id === plateAppearance.segmentId,
    ) ?? null;
  if (
    currentSegment &&
    pitcherSegmentMatches(currentSegment, pitcherId, pitcherName, pitcherSide)
  ) {
    syncSegmentPitcherIdentity(currentSegment, pitcherId, pitcherName);
    return currentSegment;
  }

  const existingSegment =
    snapshot.segments.find(
      (segment) => pitcherSegmentMatches(segment, pitcherId, pitcherName, pitcherSide),
    ) ?? null;
  if (existingSegment) {
    syncSegmentPitcherIdentity(existingSegment, pitcherId, pitcherName);
    return existingSegment;
  }

  const nextSegment: ChartingPitcherSegment = {
    id: crypto.randomUUID(),
    gameId: snapshot.game.id,
    playerId: pitcherId,
    displayName: pitcherName,
    teamSide: pitcherSide,
    segmentOrder: nextSegmentOrder(snapshot.segments),
    enteredInning: plateAppearance.inning,
    exitedInning: null,
    runsOverride: null,
    earnedRunsOverride: null,
  };
  snapshot.segments.push(nextSegment);
  return nextSegment;
}

function reconcileSnapshotSegments(snapshot: ChartingGameSnapshot) {
  const paGroups = new Map<string, ChartingPlateAppearance[]>();
  for (const plateAppearance of snapshot.plateAppearances) {
    const existing = paGroups.get(plateAppearance.segmentId) ?? [];
    existing.push(plateAppearance);
    paGroups.set(plateAppearance.segmentId, existing);
  }

  snapshot.segments = snapshot.segments
    .filter((segment) => paGroups.has(segment.id))
    .sort((left, right) => {
      const leftPAs = paGroups.get(left.id) ?? [];
      const rightPAs = paGroups.get(right.id) ?? [];
      const leftFirstOrder = Math.min(...leftPAs.map((pa) => pa.paOrder));
      const rightFirstOrder = Math.min(...rightPAs.map((pa) => pa.paOrder));
      if (leftFirstOrder === rightFirstOrder) {
        return left.segmentOrder - right.segmentOrder;
      }
      return leftFirstOrder - rightFirstOrder;
    })
    .map((segment, index, orderedSegments) => {
      const pas = [...(paGroups.get(segment.id) ?? [])].sort(
        (left, right) => left.paOrder - right.paOrder,
      );
      const lastInning = pas.reduce(
        (max, pa) => Math.max(max, pa.inning),
        pas[0]?.inning ?? 1,
      );
      return {
        ...segment,
        segmentOrder: index,
        enteredInning: pas[0]?.inning ?? segment.enteredInning,
        exitedInning: index === orderedSegments.length - 1 ? null : lastInning,
      };
    });
}

function segmentIdsForPitcher(
  segments: ChartingPitcherSegment[],
  pitcherId: string,
): Set<string> {
  return new Set(
    segments
      .filter((segment) => segment.playerId === pitcherId)
      .map((segment) => segment.id),
  );
}
