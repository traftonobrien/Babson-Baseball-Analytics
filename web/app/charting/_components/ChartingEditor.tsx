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
  detailTextForPAResult,
  guidanceTextForClosure,
  GAME_PITCH_RESULTS,
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
interface ChartingEditorProps {
  initialSnapshot: ChartingGameSnapshot;
  pitchers: ChartingBootstrapPitcher[];
  rosterPlayers: ChartingBootstrapRosterPlayer[];
}
export function ChartingEditor({
  initialSnapshot,
  pitchers,
  rosterPlayers,
}: ChartingEditorProps) {
  const initialMatchup = deriveMatchupSelection(initialSnapshot, null);
  const initialPitcherSelection = derivePitcherSelection(
    initialSnapshot,
    pitchers,
    null,
  );
  const datalistId = useId();
  const historyPitcherDatalistId = useId();
  const pitcherDatalistId = useId();
  const lineupDraftStorageKey = `charting-lineup-${initialSnapshot.game.id}`;
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
  const pitchRecordedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const overrideBase = {
    inning: gameStateOverride?.inning ?? liveState.inning,
    isTopInning: gameStateOverride?.isTopInning ?? liveState.isTopInning,
    outs: gameStateOverride?.outs ?? liveState.outs,
  };
  const activeBattingSide = battingSideForMatchup(snapshot.game, overrideBase.isTopInning);
  const activePitchingSide = pitchingSideForMatchup(snapshot.game, overrideBase.isTopInning);
  const ourTeamLabel = snapshot.game.ourTeamLabel?.trim() || TEAM_NAME;
  const opponentTeamLabel =
    snapshot.game.opponentTeamLabel?.trim() || snapshot.game.opponent;
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
      ? openPlateAppearance?.lineupSlot ?? liveState.batterSlot
      : openPlateAppearance?.lineupSlot ?? 1;
  const availablePitchResults: readonly PitchResult[] = effectiveBuntMode
    ? BUNT_MODE_PITCH_RESULTS
    : GAME_PITCH_RESULTS;
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
  const hitterSuggestions = buildHitterSuggestions(
    snapshot,
    rosterPlayers,
    activeBattingSide,
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
  const liveSummary = `${liveState.isTopInning ? "Top" : "Bot"} ${liveState.inning} • ${liveState.outs} Outs`;
  const guidanceText = guidanceTextForClosure(
    liveState.closureState,
    liveState.openPAId,
  );
  const closureTitle = detailTextForClosure(liveState.closureState);
  const inningPitches = countPitcherInningPitches(
    snapshot,
    selectedPitcher?.playerId ?? "",
    overrideBase.inning,
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
      batterSlot: liveState.batterSlot,
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
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      lineup: buildSnapshotLineup(snapshot, lineupDrafts),
    };
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Lineups updated");
    try {
      sessionStorage.removeItem(lineupDraftStorageKey);
    } catch {
      // Ignore sessionStorage failures.
    }
    setShowLineupEditor(false);
  };
  const handleHitterBlur = () => {
    if (!hitterName.trim()) {
      return;
    }
    const nextSnapshot = syncHitterToSnapshot(
      snapshot,
      hitterName.trim(),
      activeMatchupSlot,
      gameStateOverride,
    );
    if (nextSnapshot !== snapshot) {
      startTransition(() => setSnapshot(nextSnapshot));
      queueSnapshotSave(nextSnapshot, "Hitter saved");
    }
  };
  const handleSwitchPitcher = () => {
    setShowSwitchPitcherModal(true);
  };
  const handleConfirmSwitchPitcher = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const rostered =
      activePitchingSide === "our"
        ? pitchers.find((p) => p.name.toLowerCase() === trimmed.toLowerCase())
        : null;
    const newPitcher = {
      playerId: rostered?.playerId ?? manualPitcherId(trimmed, activePitchingSide),
      name: trimmed,
    };
    const nextSnapshot = switchPitcherInSnapshot(snapshot, newPitcher, gameStateOverride);
    if (nextSnapshot !== snapshot) {
      applyOptimisticSnapshot(nextSnapshot, gameStateOverride, `Switched to ${trimmed}`);
    }
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
        const message =
          error instanceof Error ? error.message : "Could not save charting changes.";
        startTransition(() => {
          setSaveState("error");
          setStatusMessage(null);
          setErrorMessage(message);
        });
      });
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
        ? pitchers.find((pitcher) => pitcher.name.toLowerCase() === nextName.toLowerCase())
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
    const nextSnapshot = updatePlateAppearanceDetailsInSnapshot(snapshot, {
      paId: historyEditDraft.paId,
      pitcher: {
        playerId: selectedHistoryPitcher.playerId,
        name: selectedHistoryPitcher.name,
      },
      hitterName: historyEditDraft.hitterName,
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
        },
        hitterName: hitterName.trim(),
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
    const nextOverride = createGameStateOverride(snapshot, {
      inning: field === "inning" ? Number(value) : overrideBase.inning,
      isTopInning:
        field === "isTopInning" ? Boolean(value) : overrideBase.isTopInning,
      outs: field === "outs" ? Number(value) : overrideBase.outs,
      batterSlot: liveState.batterSlot,
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
        onOpenLineupEditor={handleOpenLineupEditor}
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
            selectedPitcherId={selectedPitcherId}
            currentPitcherLocked={currentPitcherLocked}
            pitchers={pitchers}
            hitterName={hitterName}
            hitterSuggestions={hitterSuggestions}
            overrideInning={overrideBase.inning}
            overrideIsTopInning={overrideBase.isTopInning}
            overrideOuts={overrideBase.outs}
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
            onHitterChange={setHitterName}
            onHitterBlur={handleHitterBlur}
            onVenueSideChange={handleVenueSideChange}
            onResetOverride={handleResetOverride}
            onOverrideChange={handleOverrideChange}
            onCommitBaserunnerDraft={commitBaserunnerDraft}
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
            lineupDrafts={lineupDrafts}
            onClose={() => setShowLineupEditor(false)}
            onSave={handleSaveLineups}
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
            pitchers={pitchers}
            onConfirm={handleConfirmSwitchPitcher}
            onClose={() => setShowSwitchPitcherModal(false)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
