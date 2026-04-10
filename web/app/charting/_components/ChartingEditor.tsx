"use client";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  availablePAResultsForClosure,
  baserunnerStateFromPlateAppearance,
  battingSideForMatchup,
  closeCurrentPlateAppearance,
  closeoutResultGroups,
  countPitcherInningPitches,
  countPitcherPitches,
  createGameStateOverride,
  deriveChartingLiveState,
  deriveNextLineupSlot,
  detailTextForPAResult,
  guidanceTextForClosure,
  GAME_PITCH_RESULTS,
  emptyBaserunnerState,
  normalizeBaserunnerState,
  nextPASeedFromInitialCount,
  paResultOutsRecorded,
  pitchingSideForMatchup,
  recordPitchInSnapshot,
  switchPitcherInSnapshot,
  syncHitterToSnapshot,
  undoSnapshotAction,
  updatePitchVelocityInSnapshot,
  updatePlateAppearanceContextInSnapshot,
  updatePlateAppearanceDetailsInSnapshot,
  updateSnapshotRevision,
  type GameStateOverride,
  type PAResultType,
} from "@/lib/charting/live";
import { PITCH_TYPES } from "@/lib/charting/domain";
import type {
  ChartingBaserunnerState,
  ChartingBootstrapPitcher,
  ChartingBootstrapRosterPlayer,
  ChartingGameSnapshot,
  ChartingMatchupSide,
  PitchResult,
  PitchType,
} from "@/lib/charting/types";
import {
  getOpponentRoster,
  findOpponentRosterPlayer,
  resolveOpponentRosterTeamName,
  type ChartingOpponentPlayer,
} from "@/lib/charting/bootstrapOpponents";
import { findRosterPlayerByIdentity } from "@/lib/charting/rosterIdentity";
import { ChartingEditorBottomBar } from "./charting-editor/bottom-bar";
import { BUNT_MODE_PITCH_RESULTS } from "./charting-editor/constants";
import {
  buildLineupDrafts,
  buildSnapshotLineup,
  deriveBaserunnerDraft,
} from "./charting-editor/drafts";
import {
  buildHistoryPitcherOptions,
  buildRecentPAGroups,
  findHistoryPitcherOptionByName,
} from "./charting-editor/history";
import { ChartingEditorHistoryEditModal } from "./charting-editor/history-edit-modal";
import { ChartingEditorInPlayModal } from "./charting-editor/in-play-modal";
import { ChartingEditorLineupModal } from "./charting-editor/lineup-editor-modal";
import { EndInningModal } from "./charting-editor/end-inning-modal";
import { SwitchPitcherModal } from "./charting-editor/switch-pitcher-modal";
import {
  buildPitcherSuggestions,
  buildHitterSuggestions,
  buildSelectedPitcherOption,
  deriveMatchupSelection,
  derivePitcherSelection,
  manualPitcherId,
} from "./charting-editor/matchup";
import {
  countPresetFromInitialCount,
  deriveCountPresetForUndo,
  deriveEditorCountPresetFromPA,
  detailTextForClosure,
  getSaveStatusLabel,
  isUnauthorizedSaveError,
  initialCountFromPreset,
  parseVelocity,
  safeReadText,
} from "./charting-editor/pitch-utils";
import { ChartingEditorTopBar } from "./charting-editor/top-bar";
import { ChartingEditorTopHeader } from "./charting-editor/top-header";
import type {
  HistoryEditDraft,
  InPlayOutType,
  InPlayStep,
  LineupDrafts,
  LiveABCountPreset,
  RecentPAGroup,
  SaveState,
} from "./charting-editor/types";
import { ChartingEditorWorkspace } from "./charting-editor/workspace";
import { TEAM_NAME } from "@/lib/teamConfig";

// After a PA closes, auto-advance the on-base panel to reflect the result.
// For walks/singles: apply the force-chain rule. For doubles/triples: place batter.
// For HR: clear all. For errors/FC: batter to 1B. For outs: no change.
function autoAdvanceBaserunners(
  current: ChartingBaserunnerState,
  result: PAResultType,
): ChartingBaserunnerState {
  if (result === "HR") {
    return { runnerOnFirst: null, runnerOnSecond: null, runnerOnThird: null };
  }
  if (result === "BB" || result === "HBP" || result === "1B") {
    // Force-advance chain: 1B→2B, 2B→3B, 3B scores (cleared)
    const next = { ...current };
    if (next.runnerOnFirst) {
      if (next.runnerOnSecond) {
        if (next.runnerOnThird) {
          next.runnerOnThird = null; // scores
        }
        next.runnerOnThird = next.runnerOnSecond;
      }
      next.runnerOnSecond = next.runnerOnFirst;
    }
    next.runnerOnFirst = "runner";
    return next;
  }
  if (result === "2B") {
    return { ...current, runnerOnSecond: "runner" };
  }
  if (result === "3B") {
    return { ...current, runnerOnThird: "runner" };
  }
  // Errors and FC: batter reaches 1B. All other 0-out results (misc family) handled here.
  if (paResultOutsRecorded(result) === 0) {
    return { ...current, runnerOnFirst: "runner" };
  }
  // Out — no change to baserunners
  return current;
}

function normalizePitcherHand(
  hand: string | null | undefined,
): "R" | "L" | null {
  return hand === "R" || hand === "L" ? hand : null;
}

function normalizeHitterHand(
  hand: string | null | undefined,
): "R" | "L" | "S" | null {
  return hand === "R" || hand === "L" || hand === "S" ? hand : null;
}

function normalizeComparableName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function findRosterPlayerByName(
  rosterPlayers: ChartingBootstrapRosterPlayer[],
  playerName: string,
): ChartingBootstrapRosterPlayer | null {
  return findRosterPlayerByIdentity(rosterPlayers, playerName);
}

function resolveHitterHand(
  battingSide: ChartingMatchupSide,
  hitterName: string,
  rosterPlayers: ChartingBootstrapRosterPlayer[],
  opponentRoster: ChartingOpponentPlayer[],
): "R" | "L" | "S" | null {
  if (battingSide === "our") {
    return normalizeHitterHand(
      findRosterPlayerByName(rosterPlayers, hitterName)?.bats,
    );
  }

  return normalizeHitterHand(
    findOpponentRosterPlayer(opponentRoster, hitterName)?.bats,
  );
}

function resolvePitcherHand(
  pitchingSide: ChartingMatchupSide,
  selectedPitcherId: string,
  pitcherName: string,
  pitchers: ChartingBootstrapPitcher[],
  opponentRoster: ChartingOpponentPlayer[],
): "R" | "L" | null {
  if (pitchingSide === "our") {
    const rosteredPitcher =
      pitchers.find((pitcher) => pitcher.playerId === selectedPitcherId) ??
      pitchers.find(
        (pitcher) =>
          normalizeComparableName(pitcher.name) ===
          normalizeComparableName(pitcherName),
      );
    return normalizePitcherHand(rosteredPitcher?.throws);
  }

  return normalizePitcherHand(
    findOpponentRosterPlayer(opponentRoster, pitcherName)?.throws,
  );
}

interface ChartingEditorProps {
  initialSnapshot: ChartingGameSnapshot;
  pitchers: ChartingBootstrapPitcher[];
  rosterPlayers: ChartingBootstrapRosterPlayer[];
  opponentRoster?: ChartingOpponentPlayer[];
  opponentTeams?: string[];
}
export function ChartingEditor({
  initialSnapshot,
  pitchers,
  rosterPlayers,
  opponentRoster = [],
  opponentTeams = [],
}: ChartingEditorProps) {
  const initialMatchup = deriveMatchupSelection(initialSnapshot, null);
  const initialLiveState = deriveChartingLiveState(
    initialSnapshot.segments,
    initialSnapshot.plateAppearances,
    initialSnapshot.pitches,
  );
  const initialPitcherSelection = derivePitcherSelection(
    initialSnapshot,
    pitchers,
    null,
  );
  const datalistId = useId();
  const historyPitcherDatalistId = useId();
  const pitcherDatalistId = useId();
  const lineupDraftStorageKey = `charting-lineup-${initialSnapshot.game.id}`;
  const [selectedOpponentTeam, setSelectedOpponentTeam] = useState<string | null>(
    () =>
      resolveOpponentRosterTeamName(
        initialSnapshot.game.opponentTeamLabel?.trim() || initialSnapshot.game.opponent,
      ) ?? initialSnapshot.game.opponentTeamLabel?.trim() ?? null,
  );
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedPitcherId, setSelectedPitcherId] = useState(
    initialPitcherSelection.playerId,
  );
  const [pitcherNameInput, setPitcherNameInput] = useState(
    initialPitcherSelection.name,
  );
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedPitchResult, setSelectedPitchResult] = useState<PitchResult | null>(null);
  const [countPreset, setCountPreset] = useState<LiveABCountPreset>("0-0");
  const [pendingVelocity, setPendingVelocity] = useState("");
  const [hitterName, setHitterName] = useState(initialMatchup.hitterName);
  const [selectedHitterHand, setSelectedHitterHand] = useState<
    "R" | "L" | "S" | null
  >(() =>
    resolveHitterHand(
      battingSideForMatchup(initialSnapshot.game, initialLiveState.isTopInning),
      initialMatchup.hitterName,
      rosterPlayers,
      opponentRoster,
    ),
  );
  const [showHistory, setShowHistory] = useState(false);
  const [showLineupEditor, setShowLineupEditor] = useState(false);
  const [showSwitchPitcherModal, setShowSwitchPitcherModal] = useState(false);
  const [endInningDismissed, setEndInningDismissed] = useState(false);
  const [lineupDrafts, setLineupDrafts] = useState<LineupDrafts>(() => {
    try {
      const stored = sessionStorage.getItem(lineupDraftStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as LineupDrafts;
        if (parsed && typeof parsed === "object" && ("our" in parsed || "opponent" in parsed)) {
          return parsed;
        }
      }
    } catch {
      // sessionStorage unavailable or corrupt.
    }
    return buildLineupDrafts(initialSnapshot.lineup);
  });
  const [expandedPAs, setExpandedPAs] = useState<Set<string>>(() => new Set());
  const [velocityDrafts, setVelocityDrafts] = useState<Record<string, string>>({});
  const [gameStateOverride, setGameStateOverride] = useState<GameStateOverride | null>(null);
  const [baserunnerDraft, setBaserunnerDraft] = useState<ChartingBaserunnerState>(() =>
    deriveBaserunnerDraft(initialSnapshot, null),
  );
  const [historyEditDraft, setHistoryEditDraft] = useState<HistoryEditDraft | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [inPlayStep, setInPlayStep] = useState<InPlayStep>("hit_or_out");
  const [inPlayOutType, setInPlayOutType] = useState<InPlayOutType | null>(null);
  const [showPitchRecordedFlash, setShowPitchRecordedFlash] = useState(false);
  const [selectedPitcherHand, setSelectedPitcherHand] = useState<
    "R" | "L" | null
  >(() =>
    resolvePitcherHand(
      pitchingSideForMatchup(initialSnapshot.game, initialLiveState.isTopInning),
      initialPitcherSelection.playerId,
      initialPitcherSelection.name,
      pitchers,
      opponentRoster,
    ),
  );
  const pitchRecordedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hitterContextRef = useRef("");
  const pitcherContextRef = useRef("");
  const revisionRef = useRef(initialSnapshot.game.revision);
  const saveEpochRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const selectedPresetSeed = {
    ...nextPASeedFromInitialCount(countPreset === "bunt" ? "Bunt" : countPreset),
    baserunners: normalizeBaserunnerState(baserunnerDraft),
  };
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride,
    { nextPASeed: selectedPresetSeed },
  );
  const openPlateAppearance =
    snapshot.plateAppearances.find((plateAppearance) => plateAppearance.id === liveState.openPAId) ??
    null;
  const activeCountPreset = openPlateAppearance
    ? deriveEditorCountPresetFromPA(snapshot, openPlateAppearance.id)
    : countPreset;
  const activeBattingSide = battingSideForMatchup(snapshot.game, liveState.isTopInning);
  const activePitchingSide = pitchingSideForMatchup(snapshot.game, liveState.isTopInning);
  const ourTeamLabel = snapshot.game.ourTeamLabel?.trim() || TEAM_NAME;
  const opponentTeamLabel =
    snapshot.game.opponentTeamLabel?.trim() || snapshot.game.opponent;
  const activeOpponentTeam = selectedOpponentTeam?.trim() || opponentTeamLabel;
  const activeOpponentRoster =
    activeOpponentTeam ? getOpponentRoster(activeOpponentTeam) : opponentRoster;
  const topBattingTeam =
    battingSideForMatchup(snapshot.game, true) === "our"
      ? ourTeamLabel
      : (opponentTeamLabel ?? "Opp");
  const botBattingTeam =
    battingSideForMatchup(snapshot.game, false) === "our"
      ? ourTeamLabel
      : (opponentTeamLabel ?? "Opp");
  const effectiveBuntMode = openPlateAppearance
    ? activeCountPreset === "bunt"
    : Boolean(selectedPresetSeed.buntMode);
  const activeMatchupSlot =
    snapshot.game.sessionType === "game"
      ? openPlateAppearance?.lineupSlot ??
        deriveNextLineupSlot(snapshot, activeBattingSide, gameStateOverride)
      : openPlateAppearance?.lineupSlot ?? 1;
  const availablePitchResults: readonly PitchResult[] = effectiveBuntMode
    ? BUNT_MODE_PITCH_RESULTS
    : GAME_PITCH_RESULTS;
  const ourLineupSuggestions = buildHitterSuggestions(
    snapshot,
    rosterPlayers,
    "our",
    activeOpponentRoster,
  );
  const opponentLineupSuggestions = buildHitterSuggestions(
    snapshot,
    rosterPlayers,
    "opponent",
    activeOpponentRoster,
  );
  const canonicalizeHitterNameForSide = (
    side: ChartingMatchupSide,
    rawValue: string,
  ) => {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return "";
    }

    if (side === "our") {
      return findRosterPlayerByName(rosterPlayers, trimmed)?.name ?? trimmed;
    }

    return findOpponentRosterPlayer(activeOpponentRoster, trimmed)?.name ?? trimmed;
  };
  const normalizeLineupDrafts = (drafts: LineupDrafts): LineupDrafts => ({
    our: Object.fromEntries(
      Object.entries(drafts.our).map(([slot, value]) => [
        Number(slot),
        canonicalizeHitterNameForSide("our", value),
      ]),
    ),
    opponent: Object.fromEntries(
      Object.entries(drafts.opponent).map(([slot, value]) => [
        Number(slot),
        canonicalizeHitterNameForSide("opponent", value),
      ]),
    ),
  });
  const canEditCountPreset = liveState.openPAId === null;
  const needsPAClosure =
    liveState.openPAId !== null && liveState.closureState !== "none";
  const closeoutGroups = closeoutResultGroups(
    needsPAClosure
      ? availablePAResultsForClosure(liveState.closureState)
      : [],
  );
  useEffect(() => {
    if (needsPAClosure && liveState.closureState === "in_play") {
      setInPlayStep("hit_or_out");
      setInPlayOutType(null);
    }
  }, [needsPAClosure, liveState.closureState]);
  useEffect(() => {
    if (selectedPitchResult && !availablePitchResults.includes(selectedPitchResult)) {
      setSelectedPitchResult(null);
    }
  }, [availablePitchResults, selectedPitchResult]);
  useEffect(() => {
    const contextKey = `${activeBattingSide}:${normalizeComparableName(hitterName)}`;
    const resolvedHand = resolveHitterHand(
      activeBattingSide,
      hitterName,
      rosterPlayers,
      activeOpponentRoster,
    );

    if (hitterContextRef.current !== contextKey) {
      hitterContextRef.current = contextKey;
      setSelectedHitterHand(resolvedHand);
      return;
    }

    if (resolvedHand && selectedHitterHand === null) {
      setSelectedHitterHand(resolvedHand);
    }
  }, [
    activeBattingSide,
    activeOpponentRoster,
    hitterName,
    rosterPlayers,
    selectedHitterHand,
  ]);
  useEffect(() => {
    const contextKey = `${activePitchingSide}:${selectedPitcherId}:${normalizeComparableName(
      pitcherNameInput,
    )}`;
    const resolvedHand = resolvePitcherHand(
      activePitchingSide,
      selectedPitcherId,
      pitcherNameInput,
      pitchers,
      activeOpponentRoster,
    );

    if (pitcherContextRef.current !== contextKey) {
      pitcherContextRef.current = contextKey;
      setSelectedPitcherHand(resolvedHand);
      return;
    }

    if (resolvedHand && selectedPitcherHand === null) {
      setSelectedPitcherHand(resolvedHand);
    }
  }, [
    activePitchingSide,
    activeOpponentRoster,
    pitcherNameInput,
    pitchers,
    selectedPitcherHand,
    selectedPitcherId,
  ]);
  useEffect(() => {
    if (openPlateAppearance) {
      setBaserunnerDraft(baserunnerStateFromPlateAppearance(openPlateAppearance));
    }
  }, [openPlateAppearance]);
  useEffect(() => {
    return () => {
      if (pitchRecordedFlashRef.current) {
        clearTimeout(pitchRecordedFlashRef.current);
      }
    };
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(lineupDraftStorageKey, JSON.stringify(lineupDrafts));
    } catch {
      // Ignore quota or permission errors.
    }
  }, [lineupDraftStorageKey, lineupDrafts]);
  useEffect(() => {
    setSelectedOpponentTeam(
      resolveOpponentRosterTeamName(
        snapshot.game.opponentTeamLabel?.trim() || snapshot.game.opponent,
      ) ?? snapshot.game.opponentTeamLabel?.trim() ?? null,
    );
  }, [snapshot.game.opponent, snapshot.game.opponentTeamLabel]);
  // Reset the end-inning dismissal whenever we leave the between-innings state
  // (i.e., a new PA has started in the next half).
  useEffect(() => {
    if (!liveState.isBetweenInnings) {
      setEndInningDismissed(false);
    }
  }, [liveState.isBetweenInnings]);
  const selectedPitcher = buildSelectedPitcherOption(
    snapshot,
    pitchers,
    selectedPitcherId,
    pitcherNameInput,
    activePitchingSide,
    activeOpponentRoster,
  );
  const historyPitcherOptions = buildHistoryPitcherOptions(snapshot, pitchers);
  const availablePitchTypes =
    selectedPitcher?.arsenalPitchTypes.length
      ? selectedPitcher.arsenalPitchTypes
      : [...PITCH_TYPES];
  const activePitchType =
    selectedPitchType && availablePitchTypes.includes(selectedPitchType)
      ? selectedPitchType
      : null;
  const requiresLocation = selectedPitchResult !== "hit_by_pitch";
  const isPitchDraftReady =
    activePitchType !== null &&
    selectedPitchResult !== null &&
    (!requiresLocation || selectedLocation !== null);
  const canConfirmPitch =
    isPitchDraftReady &&
    !needsPAClosure &&
    Boolean(selectedPitcher) &&
    Boolean(hitterName.trim());
  const hitterSuggestions =
    activeBattingSide === "our"
      ? ourLineupSuggestions
      : opponentLineupSuggestions;
  const pitcherSuggestions = buildPitcherSuggestions(
    pitchers,
    activePitchingSide,
    activeOpponentRoster,
  );
  const recentPAGroups = buildRecentPAGroups(snapshot).reverse();
  const editingHistoryGroup = historyEditDraft
    ? recentPAGroups.find((group) => group.paId === historyEditDraft.paId) ?? null
    : null;
  const activePitcherPitchCount = countPitcherPitches(
    snapshot,
    selectedPitcher?.playerId ?? "",
  );
  const currentPitcherLocked = liveState.openPAId !== null;
  const saveStatusLabel = getSaveStatusLabel(saveState, statusMessage, errorMessage);
  const showReauthenticateAction =
    saveState === "error" && isUnauthorizedSaveError(errorMessage);
  const liveSummary = `${liveState.isTopInning ? "Top" : "Bot"} ${liveState.inning} • ${liveState.outs} Outs`;
  const guidanceText = guidanceTextForClosure(
    liveState.closureState,
    liveState.openPAId,
  );
  const closureTitle = detailTextForClosure(liveState.closureState);
  const inningPitches = countPitcherInningPitches(
    snapshot,
    selectedPitcher?.playerId ?? "",
    liveState.inning,
  );
  const canSaveHistoryEdit =
    historyEditDraft !== null &&
    Boolean(
      findHistoryPitcherOptionByName(historyPitcherOptions, historyEditDraft.pitcherName),
    ) &&
    Boolean(historyEditDraft.hitterName.trim()) &&
    (editingHistoryGroup?.paResult === null || Boolean(historyEditDraft.resultCode));
  const clearPitchDraft = () => {
    setSelectedPitchType(null);
    setSelectedLocation(null);
    setSelectedPitchResult(null);
    setPendingVelocity("");
  };
  // Derive end-of-inning display labels from liveState.
  // When isBetweenInnings is true, liveState already reflects the NEXT half,
  // so we back-compute what just ended.
  const endInningNextHalfLabel = liveState.isTopInning
    ? `Top ${liveState.inning}`
    : `Bot ${liveState.inning}`;
  const endInningCompletedLabel = liveState.isTopInning
    ? `Bot ${liveState.inning - 1}`
    : `Top ${liveState.inning}`;
  const showEndInningPrompt =
    snapshot.game.sessionType === "game" &&
    liveState.isBetweenInnings &&
    !endInningDismissed;
  const handleEndInning = () => {
    clearPitchDraft();
    // liveState.inning / isTopInning already reflect the NEXT half when
    // isBetweenInnings is true. Build an explicit override anchored at the
    // last PA so the inning selector, Top/Bot toggle, outs pips, and pitcher
    // input all snap to the new half immediately.
    const nextOverride = createGameStateOverride(snapshot, {
      inning: liveState.inning,
      isTopInning: liveState.isTopInning,
      outs: 0,
      batterSlot: deriveNextLineupSlot(
        snapshot,
        battingSideForMatchup(snapshot.game, liveState.isTopInning),
        gameStateOverride,
      ),
    });
    startTransition(() => {
      setGameStateOverride(nextOverride);
      syncMatchupInputs(snapshot, nextOverride);
    });
    setEndInningDismissed(true);
  };
  const handleOpenLineupEditor = () => {
    setLineupDrafts(buildLineupDrafts(snapshot.lineup));
    setShowLineupEditor(true);
  };
  const handleOpponentTeamChange = (value: string) => {
    const trimmed = value.trim();
    const resolvedTeam =
      resolveOpponentRosterTeamName(trimmed) ?? (trimmed || null);
    setSelectedOpponentTeam(resolvedTeam);

    if ((resolvedTeam ?? null) === (snapshot.game.opponentTeamLabel ?? null)) {
      return;
    }

    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      game: {
        ...snapshot.game,
        opponentTeamLabel: resolvedTeam,
      },
    };
    applyOptimisticSnapshot(
      nextSnapshot,
      gameStateOverride,
      resolvedTeam ? `Opponent roster set to ${resolvedTeam}` : "Opponent roster cleared",
    );
  };
  const handleLineupDraftChange = (
    side: ChartingMatchupSide,
    slot: number,
    value: string,
  ) => {
    setLineupDrafts((current) => ({
      ...current,
      [side]: {
        ...current[side],
        [slot]: value,
      },
    }));
  };
  const handleSaveLineups = () => {
    const normalizedDrafts = normalizeLineupDrafts(lineupDrafts);
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      lineup: buildSnapshotLineup(snapshot, normalizedDrafts),
    };
    setLineupDrafts(normalizedDrafts);
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Lineups updated");
    try {
      sessionStorage.removeItem(lineupDraftStorageKey);
    } catch {
      // Ignore sessionStorage failures.
    }
    setShowLineupEditor(false);
  };
  const handleHitterBlur = () => {
    const canonicalHitterName = canonicalizeHitterNameForSide(
      activeBattingSide,
      hitterName,
    );
    if (!canonicalHitterName) {
      return;
    }
    if (canonicalHitterName !== hitterName) {
      setHitterName(canonicalHitterName);
    }
    const nextSnapshot = syncHitterToSnapshot(
      snapshot,
      canonicalHitterName,
      activeMatchupSlot,
      selectedHitterHand,
      gameStateOverride,
    );
    if (nextSnapshot !== snapshot) {
      startTransition(() => setSnapshot(nextSnapshot));
      queueSnapshotSave(nextSnapshot, "Hitter saved");
    }
  };
  const handleHitterHandChange = (hand: "R" | "L" | "S") => {
    setSelectedHitterHand(hand);

    const canonicalHitterName = canonicalizeHitterNameForSide(
      activeBattingSide,
      hitterName,
    );
    if (!openPlateAppearance || !canonicalHitterName) {
      return;
    }

    const nextSnapshot = syncHitterToSnapshot(
      snapshot,
      canonicalHitterName,
      activeMatchupSlot,
      hand,
      gameStateOverride,
    );
    if (nextSnapshot !== snapshot) {
      applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Hitter hand updated");
    }
  };
  const handleSwitchPitcher = () => {
    setShowSwitchPitcherModal(true);
  };
  const handleConfirmSwitchPitcher = (selection: {
    name: string;
    pitcherHand: "R" | "L" | null;
  }) => {
    const trimmed = selection.name.trim();
    if (!trimmed) return;
    const rostered =
      activePitchingSide === "our"
        ? pitchers.find(
            (p) =>
              normalizeComparableName(p.name) ===
              normalizeComparableName(trimmed),
          )
        : null;
    const canonicalPitcherName =
      activePitchingSide === "our"
        ? rostered?.name ?? trimmed
        : (findOpponentRosterPlayer(activeOpponentRoster, trimmed)?.name ?? trimmed);

    const newPitcher = {
      playerId:
        rostered?.playerId ??
        manualPitcherId(canonicalPitcherName, activePitchingSide),
      name: canonicalPitcherName,
      pitcherHand:
        rostered?.throws ??
        resolvePitcherHand(
          activePitchingSide,
          rostered?.playerId ?? "",
          canonicalPitcherName,
          pitchers,
          activeOpponentRoster,
        ) ??
        selection.pitcherHand,
    };
    const nextSnapshot = switchPitcherInSnapshot(snapshot, newPitcher, gameStateOverride);
    if (nextSnapshot !== snapshot) {
      applyOptimisticSnapshot(
        nextSnapshot,
        gameStateOverride,
        `Switched to ${canonicalPitcherName}`,
      );
    }
    setSelectedPitcherHand(newPitcher.pitcherHand ?? null);
    setShowSwitchPitcherModal(false);
  };
  const handleBaserunnerDraftChange = (
    field: keyof ChartingBaserunnerState,
    value: string,
  ) => {
    setBaserunnerDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };
  const commitBaserunnerDraft = (
    nextDraft: Partial<ChartingBaserunnerState> | null | undefined,
    successNote: string,
  ) => {
    const normalizedBaserunners = normalizeBaserunnerState({ ...baserunnerDraft, ...nextDraft });
    if (!openPlateAppearance) {
      setBaserunnerDraft(normalizedBaserunners);
      return;
    }
    const currentBaserunners = baserunnerStateFromPlateAppearance(openPlateAppearance);
    if (JSON.stringify(normalizedBaserunners) === JSON.stringify(currentBaserunners)) {
      setBaserunnerDraft(normalizedBaserunners);
      return;
    }
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      plateAppearances: snapshot.plateAppearances.map((plateAppearance) =>
        plateAppearance.id === openPlateAppearance.id
          ? { ...plateAppearance, ...normalizedBaserunners }
          : plateAppearance,
      ),
    };
    setBaserunnerDraft(normalizedBaserunners);
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, successNote);
  };
  const syncMatchupInputs = (
    nextSnapshot: ChartingGameSnapshot,
    nextOverride: GameStateOverride | null,
  ) => {
    const nextMatchup = deriveMatchupSelection(nextSnapshot, nextOverride);
    setHitterName(nextMatchup.hitterName);
    const nextPitcherSelection = derivePitcherSelection(
      nextSnapshot,
      pitchers,
      nextOverride,
    );
    setSelectedPitcherId(nextPitcherSelection.playerId);
    setPitcherNameInput(nextPitcherSelection.name);
  };
  const reloadLatestSnapshot = async () => {
    const savedLineupDrafts = lineupDrafts;
    const savedBaserunnerDraft = baserunnerDraft;
    const response = await fetch(`/api/charting/games/${snapshot.game.id}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Could not reload the latest charting snapshot.");
    }
    const latest = (await response.json()) as ChartingGameSnapshot;
    revisionRef.current = latest.game.revision;
    const reloadedLiveState = deriveChartingLiveState(
      latest.segments,
      latest.plateAppearances,
      latest.pitches,
      null,
    );
    const hasOpenPA = Boolean(reloadedLiveState.openPAId);
    startTransition(() => {
      setSnapshot(latest);
      setGameStateOverride(null);
      syncMatchupInputs(latest, null);
      clearPitchDraft();
      setLineupDrafts(savedLineupDrafts);
      if (!hasOpenPA) {
        setBaserunnerDraft(savedBaserunnerDraft);
      }
      setSaveState("error");
      setStatusMessage(null);
      setErrorMessage(
        "Game updated from another device — reloaded latest. Lineup edits were preserved.",
      );
    });
  };
  const queueSnapshotSave = (
    nextSnapshot: ChartingGameSnapshot,
    successNote: string,
  ) => {
    setSaveState("saving");
    setErrorMessage(null);
    setStatusMessage(null);
    const queuedEpoch = saveEpochRef.current;
    saveQueueRef.current = saveQueueRef.current
      .then(async () => {
        if (queuedEpoch !== saveEpochRef.current) {
          return;
        }
        const payload: ChartingGameSnapshot = {
          ...nextSnapshot,
          game: {
            ...nextSnapshot.game,
            revision: revisionRef.current,
          },
        };
        const response = await fetch(`/api/charting/games/${payload.game.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (response.status === 409) {
          saveEpochRef.current += 1;
          saveQueueRef.current = Promise.resolve();
          await reloadLatestSnapshot();
          return;
        }
        if (!response.ok) {
          const payloadText = await safeReadText(response);
          throw new Error(payloadText || "Could not save charting changes.");
        }
        const data = (await response.json()) as {
          game: { revision: number; updatedAt?: string };
          warnings?: string[];
        };
        revisionRef.current = data.game.revision;
        if (queuedEpoch !== saveEpochRef.current) {
          return;
        }
        startTransition(() => {
          setSnapshot((current) =>
            updateSnapshotRevision(
              current,
              data.game.revision,
              data.game.updatedAt ?? current.game.updatedAt,
            ),
          );
          setSaveState("saved");
          setStatusMessage(data.warnings?.[0] ?? successNote);
          setErrorMessage(null);
        });
      })
      .catch((error: unknown) => {
        if (queuedEpoch !== saveEpochRef.current) {
          return;
        }
        const rawMessage =
          error instanceof Error ? error.message : "Could not save charting changes.";
        const message = isUnauthorizedSaveError(rawMessage)
          ? "Unauthorized issues - sign in again in another tab, then tap Save Now."
          : rawMessage;
        startTransition(() => {
          setSaveState("error");
          setStatusMessage(null);
          setErrorMessage(message);
        });
      });
  };
  const handleManualSave = () => {
    queueSnapshotSave(snapshot, "Manual save complete");
  };
  const applyOptimisticSnapshot = (
    nextSnapshot: ChartingGameSnapshot,
    nextOverride: GameStateOverride | null,
    successNote: string,
  ) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setGameStateOverride(nextOverride);
      syncMatchupInputs(nextSnapshot, nextOverride);
      setErrorMessage(null);
    });
    queueSnapshotSave(nextSnapshot, successNote);
  };
  const handlePitcherInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextName = event.target.value;
    setPitcherNameInput(nextName);
    const matched =
      activePitchingSide === "our"
        ? pitchers.find(
            (pitcher) =>
              normalizeComparableName(pitcher.name) ===
              normalizeComparableName(nextName),
          )
        : null;
    if (matched) {
      if (matched.playerId !== selectedPitcherId) {
        setSelectedPitcherId(matched.playerId);
      }
      return;
    }
    setSelectedPitcherId("");
  };
  const clearVelocityDraft = (pitchId: string) => {
    setVelocityDrafts((current) => {
      if (!(pitchId in current)) {
        return current;
      }
      const next = { ...current };
      delete next[pitchId];
      return next;
    });
  };
  const handleVelocityDraftChange = (pitchId: string, value: string) => {
    setVelocityDrafts((current) => ({
      ...current,
      [pitchId]: value.replace(/[^0-9]/g, "").slice(0, 3),
    }));
  };
  const handlePitchVelocityCommit = (pitchId: string, rawValue: string) => {
    const nextVelocity = parseVelocity(rawValue);
    const nextSnapshot = updatePitchVelocityInSnapshot(snapshot, pitchId, nextVelocity);
    clearVelocityDraft(pitchId);
    if (nextSnapshot === snapshot) {
      return;
    }
    applyOptimisticSnapshot(
      nextSnapshot,
      gameStateOverride,
      nextVelocity === null ? "Velocity cleared" : `Velocity updated to ${nextVelocity} mph`,
    );
  };
  const handlePitchResultChange = (nextResult: PitchResult) => {
    setSelectedPitchResult(nextResult);
    if (nextResult === "hit_by_pitch") {
      setSelectedLocation(null);
    }
  };
  const handlePendingVelocityChange = (value: string) => {
    setPendingVelocity(value.replace(/[^0-9]/g, "").slice(0, 3));
  };
  const handleOpenHistoryEdit = (group: RecentPAGroup) => {
    setHistoryEditDraft({
      paId: group.paId,
      pitcherId: group.pitcherId,
      pitcherName: group.pitcherName,
      hitterName: group.hitterName,
      initialCount: countPresetFromInitialCount(group.initialCount),
      resultCode: group.paResult ?? "",
    });
  };
  const handleHistoryEditPitcherNameChange = (value: string) => {
    setHistoryEditDraft((current) =>
      current
        ? {
            ...current,
            pitcherName: value,
            pitcherId:
              findHistoryPitcherOptionByName(historyPitcherOptions, value)?.playerId ?? "",
          }
        : current,
    );
  };
  const handleHistoryEditHitterNameChange = (value: string) => {
    setHistoryEditDraft((current) =>
      current ? { ...current, hitterName: value } : current,
    );
  };
  const handleHistoryEditInitialCountChange = (value: LiveABCountPreset) => {
    setHistoryEditDraft((current) =>
      current ? { ...current, initialCount: value } : current,
    );
  };
  const handleHistoryEditResultCodeChange = (value: PAResultType | "") => {
    setHistoryEditDraft((current) =>
      current ? { ...current, resultCode: value } : current,
    );
  };
  const handleHistoryEditSave = () => {
    if (!historyEditDraft) {
      return;
    }
    const selectedHistoryPitcher =
      findHistoryPitcherOptionByName(historyPitcherOptions, historyEditDraft.pitcherName) ??
      historyPitcherOptions.find((pitcher) => pitcher.playerId === historyEditDraft.pitcherId) ??
      null;
    if (!selectedHistoryPitcher) {
      setErrorMessage("Select a valid pitcher before saving the at-bat edit.");
      return;
    }
    const historyTeamSide = editingHistoryGroup?.teamSide ?? "opponent";
    const canonicalHitterName = canonicalizeHitterNameForSide(
      historyTeamSide,
      historyEditDraft.hitterName,
    );
    const nextSnapshot = updatePlateAppearanceDetailsInSnapshot(snapshot, {
      paId: historyEditDraft.paId,
      pitcher: {
        playerId: selectedHistoryPitcher.playerId,
        name: selectedHistoryPitcher.name,
      },
      hitterName: canonicalHitterName,
      initialCount: initialCountFromPreset(historyEditDraft.initialCount),
      resultCode: historyEditDraft.resultCode || null,
    });
    if (nextSnapshot === snapshot) {
      setHistoryEditDraft(null);
      return;
    }
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "At-bat history updated");
    setHistoryEditDraft(null);
  };
  const handleRecordPitch = () => {
    if (!selectedPitcher || !activePitchType || !selectedPitchResult) {
      return;
    }
    const isStartingNewPA = liveState.openPAId === null;
    const canonicalHitterName = canonicalizeHitterNameForSide(
      activeBattingSide,
      hitterName,
    );

    const nextSnapshot = recordPitchInSnapshot(
      snapshot,
      {
        pitchType: activePitchType,
        pitchResult: selectedPitchResult,
        locationCell: selectedPitchResult === "hit_by_pitch" ? null : selectedLocation,
        velocity: parseVelocity(pendingVelocity),
        pitcher: {
          playerId: selectedPitcher.playerId ?? "",
          name: selectedPitcher.name,
          pitcherHand: selectedPitcherHand,
        },
        hitterName: canonicalHitterName,
        hitterHand: selectedHitterHand,
        lineupSlot: activeMatchupSlot,
      },
      gameStateOverride,
      { nextPASeed: selectedPresetSeed },
    );
    if (nextSnapshot === snapshot) {
      setErrorMessage(
        currentPitcherLocked &&
          selectedPitcher.playerId !== snapshot.segments.at(-1)?.playerId
          ? "Finish the current plate appearance before switching pitchers."
          : "Charting context is incomplete. Set a pitcher and hitter before recording the pitch.",
      );
      return;
    }
    if (canonicalHitterName && canonicalHitterName !== hitterName) {
      setHitterName(canonicalHitterName);
    }
    clearPitchDraft();
    if (isStartingNewPA) {
      setCountPreset("0-0");
    }
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Pitch saved");
    if (pitchRecordedFlashRef.current) {
      clearTimeout(pitchRecordedFlashRef.current);
    }
    setShowPitchRecordedFlash(true);
    pitchRecordedFlashRef.current = setTimeout(() => {
      setShowPitchRecordedFlash(false);
      pitchRecordedFlashRef.current = null;
    }, 1500);
  };
  const handleClosePlateAppearance = (result: PAResultType) => {
    const nextSnapshot = closeCurrentPlateAppearance(snapshot, result, gameStateOverride);
    if (nextSnapshot === snapshot) {
      setErrorMessage("That result is not available for the current plate appearance.");
      return;
    }
    clearPitchDraft();
    applyOptimisticSnapshot(
      nextSnapshot,
      gameStateOverride,
      `Plate appearance closed as ${detailTextForPAResult(result)}`,
    );
    setBaserunnerDraft(autoAdvanceBaserunners(baserunnerDraft, result));
  };
  const handleBaserunnerOut = (
    field: keyof ChartingBaserunnerState,
    kind: "pickoff" | "cs",
  ) => {
    if (liveState.openPAId) return; // don't allow during a live PA
    const label = kind === "pickoff" ? "Pickoff out" : "Caught stealing";
    const newOuts = liveState.outs + 1;
    if (newOuts >= 3) {
      // 3rd out — flip the inning and clear all bases
      const nextIsTopInning = !liveState.isTopInning;
      const nextInning = liveState.isTopInning ? liveState.inning : liveState.inning + 1;
      const nextOverride = createGameStateOverride(snapshot, {
        inning: nextInning,
        isTopInning: nextIsTopInning,
        outs: 0,
        batterSlot: deriveNextLineupSlot(
          snapshot,
          battingSideForMatchup(snapshot.game, nextIsTopInning),
          gameStateOverride,
        ),
      });
      startTransition(() => {
        setBaserunnerDraft(emptyBaserunnerState());
        setGameStateOverride(nextOverride);
        syncMatchupInputs(snapshot, nextOverride);
        setStatusMessage(`${label} — inning over`);
        setErrorMessage(null);
      });
    } else {
      const nextOverride = createGameStateOverride(snapshot, {
        inning: liveState.inning,
        isTopInning: liveState.isTopInning,
        outs: newOuts,
        batterSlot: liveState.batterSlot,
      });
      startTransition(() => {
        setBaserunnerDraft((current) =>
          normalizeBaserunnerState({ ...current, [field]: null }),
        );
        setGameStateOverride(nextOverride);
        syncMatchupInputs(snapshot, nextOverride);
        setStatusMessage(`${label} — ${newOuts} out${newOuts !== 1 ? "s" : ""}`);
        setErrorMessage(null);
      });
    }
  };
  const handleUndo = () => {
    const nextSnapshot = undoSnapshotAction(snapshot);
    if (nextSnapshot === snapshot) {
      return;
    }
    const restoredCountPreset = deriveCountPresetForUndo(snapshot, nextSnapshot);
    clearPitchDraft();
    if (restoredCountPreset) {
      setCountPreset(restoredCountPreset);
    }
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Last action undone");
  };
  const handleStatusChange = (nextStatus: ChartingGameSnapshot["game"]["status"]) => {
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      game: {
        ...snapshot.game,
        status: nextStatus,
      },
    };
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setErrorMessage(null);
    });
    queueSnapshotSave(nextSnapshot, `Game marked ${nextStatus}`);
  };
  const handleOverrideChange = (
    field: "inning" | "isTopInning" | "outs",
    value: number | boolean,
  ) => {
    const nextIsTopInning =
      field === "isTopInning" ? Boolean(value) : liveState.isTopInning;
    const nextOverride = createGameStateOverride(snapshot, {
      inning: field === "inning" ? Number(value) : liveState.inning,
      isTopInning: nextIsTopInning,
      outs: field === "outs" ? Number(value) : liveState.outs,
      batterSlot: deriveNextLineupSlot(
        snapshot,
        battingSideForMatchup(snapshot.game, nextIsTopInning),
        gameStateOverride,
      ),
    });
    startTransition(() => {
      setGameStateOverride(nextOverride);
      syncMatchupInputs(snapshot, nextOverride);
      setErrorMessage(null);
      setStatusMessage("Manual game state override applied locally");
    });
  };
  const handleResetOverride = () => {
    startTransition(() => {
      setGameStateOverride(null);
      syncMatchupInputs(snapshot, null);
      setStatusMessage("Manual game state override cleared");
      setErrorMessage(null);
    });
  };
  const handleVenueSideChange = (newSide: "home" | "away") => {
    if (newSide === snapshot.game.babsonVenueSide) {
      return;
    }
    const updatedGame = { ...snapshot.game, babsonVenueSide: newSide };
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      game: updatedGame,
      plateAppearances: snapshot.plateAppearances.map((plateAppearance) => ({
        ...plateAppearance,
        teamSide: battingSideForMatchup(updatedGame, plateAppearance.isTopInning),
      })),
    };
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, `${TEAM_NAME} set as ${newSide}`);
  };
  const handlePAInningChange = (paId: string, inning: number) => {
    const nextSnapshot = updatePlateAppearanceContextInSnapshot(snapshot, {
      paId,
      inning,
    });
    if (nextSnapshot === snapshot) {
      return;
    }
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Inning updated");
  };
  const handlePAHalfChange = (paId: string, isTopInning: boolean) => {
    const nextSnapshot = updatePlateAppearanceContextInSnapshot(snapshot, {
      paId,
      isTopInning,
    });
    if (nextSnapshot === snapshot) {
      return;
    }
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Half inning updated");
  };
  const togglePAExpanded = (paId: string) => {
    setExpandedPAs((current) => {
      const next = new Set(current);
      if (next.has(paId)) {
        next.delete(paId);
      } else {
        next.add(paId);
      }
      return next;
    });
  };
  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden bg-background text-foreground [background-image:radial-gradient(circle_at_top_left,rgba(var(--brand-primary-rgb),0.14),transparent_24%),radial-gradient(circle_at_top_right,rgba(255,255,255,0.82),transparent_32%)] dark:text-zinc-100 dark:[background-image:radial-gradient(circle_at_top_left,rgba(var(--brand-primary-rgb),0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(63,63,70,0.26),transparent_32%)]"
    >
      <ChartingEditorTopHeader
        gameId={snapshot.game.id}
        opponent={snapshot.game.opponent}
        liveSummary={liveSummary}
        status={snapshot.game.status}
        sessionType={snapshot.game.sessionType}
        hasGameStateOverride={Boolean(gameStateOverride)}
        isTopBarOpen={isTopBarOpen}
        saveState={saveState}
        saveStatusLabel={saveStatusLabel}
        showManualSave
        showReauthenticate={showReauthenticateAction}
        onOpenLineupEditor={handleOpenLineupEditor}
        onManualSave={handleManualSave}
        onToggleTopBar={() => setIsTopBarOpen((current) => !current)}
        onStatusChange={handleStatusChange}
      />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {isTopBarOpen ? (
          <ChartingEditorTopBar
            sessionType={snapshot.game.sessionType}
            activeBattingSide={activeBattingSide}
            activePitchingSide={activePitchingSide}
            ourTeamLabel={ourTeamLabel}
            opponentTeamLabel={opponentTeamLabel}
            pitcherDatalistId={pitcherDatalistId}
            datalistId={datalistId}
            pitcherNameInput={pitcherNameInput}
            pitcherSuggestions={pitcherSuggestions}
            pitcherHand={selectedPitcherHand}
            currentPitcherLocked={currentPitcherLocked}
            hitterName={hitterName}
            hitterSuggestions={hitterSuggestions}
            hitterHand={selectedHitterHand}
            overrideInning={liveState.inning}
            overrideIsTopInning={liveState.isTopInning}
            overrideOuts={liveState.outs}
            topBattingTeam={topBattingTeam}
            botBattingTeam={botBattingTeam}
            baserunnerDraft={baserunnerDraft}
            needsPAClosure={needsPAClosure}
            activePitcherPitchCount={activePitcherPitchCount}
            inningPitches={inningPitches}
            liveCountLabel={`${liveState.balls}-${liveState.strikes}`}
            canEditCountPreset={canEditCountPreset}
            activeCountPreset={activeCountPreset}
            effectiveBuntMode={effectiveBuntMode}
            hasGameStateOverride={Boolean(gameStateOverride)}
            babsonVenueSide={snapshot.game.babsonVenueSide}
            onPitcherInputChange={handlePitcherInputChange}
            onPitcherHandChange={setSelectedPitcherHand}
            onHitterChange={setHitterName}
            onHitterBlur={handleHitterBlur}
            onHitterHandChange={handleHitterHandChange}
            onVenueSideChange={handleVenueSideChange}
            onResetOverride={handleResetOverride}
            onOverrideChange={handleOverrideChange}
            onCommitBaserunnerDraft={commitBaserunnerDraft}
            onBaserunnerOut={handleBaserunnerOut}
            onCountPresetChange={setCountPreset}
            canSwitchPitcher={!currentPitcherLocked}
            onSwitchPitcher={handleSwitchPitcher}
          />
        ) : null}
        <ChartingEditorWorkspace
          selectedPitchResult={selectedPitchResult}
          selectedLocation={selectedLocation}
          showHistory={showHistory}
          availablePitchTypes={availablePitchTypes}
          activePitchType={activePitchType}
          availablePitchResults={availablePitchResults}
          effectiveBuntMode={effectiveBuntMode}
          recentPAGroups={recentPAGroups}
          expandedPAs={expandedPAs}
          velocityDrafts={velocityDrafts}
          onLocationSelect={setSelectedLocation}
          onShowArsenal={() => setShowHistory(false)}
          onShowHistory={() => {
            setExpandedPAs(new Set());
            setShowHistory(true);
          }}
          onPitchTypeSelect={setSelectedPitchType}
          onPitchResultChange={handlePitchResultChange}
          onTogglePAExpanded={togglePAExpanded}
          onPAHalfChange={handlePAHalfChange}
          onPAInningChange={handlePAInningChange}
          onOpenHistoryEdit={handleOpenHistoryEdit}
          onVelocityDraftChange={handleVelocityDraftChange}
          onPitchVelocityCommit={handlePitchVelocityCommit}
          onClearVelocityDraft={clearVelocityDraft}
        />
        <ChartingEditorBottomBar
          showPitchRecordedFlash={showPitchRecordedFlash}
          needsPAClosure={needsPAClosure}
          closureState={liveState.closureState}
          closureTitle={closureTitle}
          guidanceText={guidanceText}
          closeoutGroups={closeoutGroups}
          activePitchType={activePitchType}
          selectedLocation={selectedLocation}
          selectedPitchResult={selectedPitchResult}
          pendingVelocity={pendingVelocity}
          effectiveBuntMode={effectiveBuntMode}
          canConfirmPitch={canConfirmPitch}
          pitchCount={snapshot.pitches.length}
          onPendingVelocityChange={handlePendingVelocityChange}
          onClearPitchDraft={clearPitchDraft}
          onUndo={handleUndo}
          onRecordPitch={handleRecordPitch}
          onClosePlateAppearance={handleClosePlateAppearance}
          paResultOutsRecorded={paResultOutsRecorded}
        />
      </div>
      <AnimatePresence>
        {showLineupEditor ? (
          <ChartingEditorLineupModal
            ourTeamLabel={ourTeamLabel}
            opponentTeamLabel={opponentTeamLabel}
            opponentTeams={opponentTeams}
            selectedOpponentTeam={selectedOpponentTeam}
            lineupDrafts={lineupDrafts}
            ourHitterSuggestions={ourLineupSuggestions}
            opponentHitterSuggestions={opponentLineupSuggestions}
            onClose={() => setShowLineupEditor(false)}
            onSave={handleSaveLineups}
            onOpponentTeamChange={handleOpponentTeamChange}
            onLineupDraftChange={handleLineupDraftChange}
          />
        ) : null}
        {historyEditDraft ? (
          <ChartingEditorHistoryEditModal
            historyEditDraft={historyEditDraft}
            historyPitcherDatalistId={historyPitcherDatalistId}
            hitterDatalistId={datalistId}
            historyPitcherOptions={historyPitcherOptions}
            editingHistoryGroup={editingHistoryGroup}
            canSave={canSaveHistoryEdit}
            onClose={() => setHistoryEditDraft(null)}
            onSave={handleHistoryEditSave}
            onPitcherNameChange={handleHistoryEditPitcherNameChange}
            onHitterNameChange={handleHistoryEditHitterNameChange}
            onInitialCountChange={handleHistoryEditInitialCountChange}
            onResultCodeChange={handleHistoryEditResultCodeChange}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {needsPAClosure && liveState.closureState === "in_play" ? (
          <ChartingEditorInPlayModal
            step={inPlayStep}
            outType={inPlayOutType}
            onClose={handleUndo}
            onSelect={handleClosePlateAppearance}
            onStepChange={setInPlayStep}
            onOutTypeChange={setInPlayOutType}
            paResultOutsRecorded={paResultOutsRecorded}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showEndInningPrompt ? (
          <EndInningModal
            completedHalfLabel={endInningCompletedLabel}
            nextHalfLabel={endInningNextHalfLabel}
            onConfirm={handleEndInning}
            onDismiss={() => setEndInningDismissed(true)}
          />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {showSwitchPitcherModal ? (
          <SwitchPitcherModal
            activePitchingSide={activePitchingSide}
            ourTeamLabel={ourTeamLabel}
            opponentTeamLabel={opponentTeamLabel}
            opponentTeams={opponentTeams}
            selectedOpponentTeam={selectedOpponentTeam}
            pitcherSuggestions={pitcherSuggestions}
            initialPitcherHand={selectedPitcherHand}
            onOpponentTeamChange={handleOpponentTeamChange}
            onConfirm={handleConfirmSwitchPitcher}
            onClose={() => setShowSwitchPitcherModal(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
