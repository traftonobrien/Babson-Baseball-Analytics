"use client";

import Link from "next/link";
import {
  startTransition,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  LoaderCircle,
  PencilLine,
  RefreshCw,
  Save,
  ShieldAlert,
  Timer,
  Undo2,
  WandSparkles,
} from "lucide-react";
import {
  availablePAResultsForClosure,
  DOUBLE_PLAY_OPTIONS,
  ERROR_OPTIONS,
  FIELDERS_CHOICE_OPTIONS,
  FLY_OUT_OPTIONS,
  GAME_PITCH_RESULTS,
  closeCurrentPlateAppearance,
  closeoutResultGroups,
  createGameStateOverride,
  deriveChartingLiveState,
  detailTextForPAResult,
  guidanceTextForClosure,
  GROUND_OUT_OPTIONS,
  HIT_OPTIONS,
  LINE_OUT_OPTIONS,
  lineupNameForSlot,
  paResultOutsRecorded,
  POP_OUT_OPTIONS,
  recordPitchInSnapshot,
  syncHitterToSnapshot,
  undoSnapshotAction,
  UNASSISTED_OUT_OPTIONS,
  updateSnapshotRevision,
  type GameStateOverride,
  type PAResultType,
} from "@/lib/charting/live";
import { PITCH_TYPES } from "@/lib/charting/domain";
import type {
  ChartingBootstrapPitcher,
  ChartingBootstrapRosterPlayer,
  ChartingGameSnapshot,
  PitchResult,
  PitchType,
} from "@/lib/charting/types";

type SaveState = "idle" | "saving" | "saved" | "error";

type RecentPitchRow = {
  id: string;
  paId: string;
  order: number;
  hitterName: string;
  inning: number;
  count: string;
  pitchType: PitchType;
  pitchResult: PitchResult;
  paResult: string | null;
};

const INNING_OPTIONS = Array.from({ length: 20 }, (_, index) => index + 1);
const OUT_OPTIONS = [0, 1, 2] as const;

const OUT_TYPE_LABELS: Record<string, string> = {
  ground: "ground out",
  line: "line out",
  fly: "fly out",
  pop: "pop out",
  unassisted: "unassisted out",
  dp: "double play",
  error: "error",
  fc: "fielder's choice",
};

const LOCATION_CELLS: LocationCellConfig[] = [
  { id: 11, label: "11", kind: "topLeftCorner", className: "col-[1_/_span_2] row-[1_/_span_2]" },
  { id: 12, label: "12", kind: "topRightCorner", className: "col-[4_/_span_2] row-[1_/_span_2]" },
  { id: 13, label: "13", kind: "bottomLeftCorner", className: "col-[1_/_span_2] row-[4_/_span_2]" },
  { id: 14, label: "14", kind: "bottomRightCorner", className: "col-[4_/_span_2] row-[4_/_span_2]" },
  { id: 1, label: "1", kind: "square", className: "col-start-2 row-start-2" },
  { id: 2, label: "2", kind: "square", className: "col-start-3 row-start-2" },
  { id: 3, label: "3", kind: "square", className: "col-start-4 row-start-2" },
  { id: 4, label: "4", kind: "square", className: "col-start-2 row-start-3" },
  { id: 5, label: "5", kind: "square", className: "col-start-3 row-start-3" },
  { id: 6, label: "6", kind: "square", className: "col-start-4 row-start-3" },
  { id: 7, label: "7", kind: "square", className: "col-start-2 row-start-4" },
  { id: 8, label: "8", kind: "square", className: "col-start-3 row-start-4" },
  { id: 9, label: "9", kind: "square", className: "col-start-4 row-start-4" },
];

interface LocationCellConfig {
  id: number;
  label: string;
  kind: "square" | "topLeftCorner" | "topRightCorner" | "bottomLeftCorner" | "bottomRightCorner";
  className: string;
}

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
  const datalistId = useId();

  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [selectedPitcherId, setSelectedPitcherId] = useState(
    findDefaultPitcherId(initialSnapshot, pitchers)
  );
  const [pitcherNameInput, setPitcherNameInput] = useState(() => {
    const defaultId = findDefaultPitcherId(initialSnapshot, pitchers);
    return pitchers.find((p) => p.playerId === defaultId)?.name ?? "";
  });
  const pitcherDatalistId = useId();
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);

  const [selectedPitchType, setSelectedPitchType] = useState<PitchType | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedPitchResult, setSelectedPitchResult] = useState<PitchResult | null>(null);
  const [pendingVelocity, setPendingVelocity] = useState("");
  const [hitterName, setHitterName] = useState(initialMatchup.hitterName);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPAs, setExpandedPAs] = useState<Set<string>>(() => new Set());
  const [gameStateOverride, setGameStateOverride] = useState<GameStateOverride | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  type InPlayStep = "hit_or_out" | "hit_type" | "out_type" | "out_scoring";
  type InPlayOutType = "ground" | "line" | "fly" | "pop" | "unassisted" | "dp" | "error" | "fc";
  const [inPlayStep, setInPlayStep] = useState<InPlayStep>("hit_or_out");
  const [inPlayOutType, setInPlayOutType] = useState<InPlayOutType | null>(null);
  const [showPitchRecordedFlash, setShowPitchRecordedFlash] = useState(false);
  const pitchRecordedFlashRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revisionRef = useRef(initialSnapshot.game.revision);
  const saveEpochRef = useRef(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride
  );
  const openPlateAppearance =
    snapshot.plateAppearances.find((pa) => pa.id === liveState.openPAId) ?? null;
  const needsPAClosure =
    liveState.openPAId !== null && liveState.closureState !== "none";
  const closeoutGroups = closeoutResultGroups(
    needsPAClosure
      ? availablePAResultsForClosure(liveState.closureState)
      : []
  );

  useEffect(() => {
    if (needsPAClosure && liveState.closureState === "in_play") {
      setInPlayStep("hit_or_out");
      setInPlayOutType(null);
    }
  }, [needsPAClosure, liveState.closureState]);

  useEffect(() => () => {
    if (pitchRecordedFlashRef.current) clearTimeout(pitchRecordedFlashRef.current);
  }, []);

  const selectedPitcher =
    pitchers.find((pitcher) => pitcher.playerId === selectedPitcherId) ??
    (snapshot.segments.length > 0
      ? {
        playerId: snapshot.segments[snapshot.segments.length - 1].playerId,
        name: snapshot.segments[snapshot.segments.length - 1].displayName,
        throws: "R" as const,
        arsenalPitchTypes: [...PITCH_TYPES],
      }
      : null);
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
  const hitterSuggestions = buildHitterSuggestions(snapshot, rosterPlayers);
  const recentPAGroups = buildRecentPAGroups(snapshot).slice(-12).reverse();
  const lastPaId = recentPAGroups[recentPAGroups.length - 1]?.paId ?? null;
  const expandedPAsInit = useRef(false);
  useEffect(() => {
    if (showHistory && lastPaId && !expandedPAsInit.current) {
      expandedPAsInit.current = true;
      setExpandedPAs((prev) => new Set([...prev, lastPaId]));
    }
  }, [showHistory, lastPaId]);
  const activePitcherPitchCount = countPitcherPitches(
    snapshot,
    selectedPitcher?.playerId ?? ""
  );
  const currentPitcherLocked = liveState.openPAId !== null;
  const saveStatusLabel = getSaveStatusLabel(saveState, statusMessage, errorMessage);
  const guidanceText = guidanceTextForClosure(
    liveState.closureState,
    liveState.openPAId
  );

  // Calculate total pitches for the current pitcher segment
  const activeSegmentId = liveState.activeSegmentId;
  const totalPitches = activeSegmentId
    ? snapshot.plateAppearances
      .filter(pa => pa.segmentId === activeSegmentId)
      .reduce((sum, pa) => {
        return sum + snapshot.pitches.filter(p => p.paId === pa.id).length;
      }, 0)
    : 0;

  const inningPitches = activeSegmentId
    ? snapshot.plateAppearances
      .filter(pa => pa.segmentId === activeSegmentId && pa.inning === liveState.inning)
      .reduce((sum, pa) => {
        return sum + snapshot.pitches.filter(p => p.paId === pa.id).length;
      }, 0)
    : 0;

  const overrideBase = {
    inning: gameStateOverride?.inning ?? liveState.inning,
    isTopInning: gameStateOverride?.isTopInning ?? liveState.isTopInning,
    outs: gameStateOverride?.outs ?? liveState.outs,
  };

  const clearPitchDraft = () => {
    setSelectedPitchType(null);
    setSelectedLocation(null);
    setSelectedPitchResult(null);
    setPendingVelocity("");
  };

  const syncMatchupInputs = (
    nextSnapshot: ChartingGameSnapshot,
    nextOverride: GameStateOverride | null
  ) => {
    const nextMatchup = deriveMatchupSelection(nextSnapshot, nextOverride);
    setHitterName(nextMatchup.hitterName);
    const nextPitcherId = findDefaultPitcherId(nextSnapshot, pitchers);
    setSelectedPitcherId(nextPitcherId);
    setPitcherNameInput(pitchers.find((p) => p.playerId === nextPitcherId)?.name ?? "");
  };

  const reloadLatestSnapshot = async () => {
    const response = await fetch(`/api/charting/games/${snapshot.game.id}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error("Could not reload the latest charting snapshot.");
    }

    const latest = (await response.json()) as ChartingGameSnapshot;
    revisionRef.current = latest.game.revision;
    startTransition(() => {
      setSnapshot(latest);
      setGameStateOverride(null);
      syncMatchupInputs(latest, null);
      clearPitchDraft();
      setSaveState("error");
      setStatusMessage(null);
      setErrorMessage(
        "This game changed elsewhere. I reloaded the latest snapshot so you can continue from the current version."
      );
    });
  };

  const queueSnapshotSave = (
    nextSnapshot: ChartingGameSnapshot,
    successNote: string
  ) => {
    setSaveState("saving");
    setErrorMessage(null);
    setStatusMessage(null);
    const queuedEpoch = saveEpochRef.current;

    saveQueueRef.current = saveQueueRef.current.then(async () => {
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
        headers: {
          "Content-Type": "application/json",
        },
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
            data.game.updatedAt ?? current.game.updatedAt
          )
        );
        setSaveState("saved");
        setStatusMessage(successNote);
        setErrorMessage(null);
      });
    }).catch((error: unknown) => {
      if (queuedEpoch !== saveEpochRef.current) {
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Could not save charting changes.";
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
    successNote: string
  ) => {
    startTransition(() => {
      setSnapshot(nextSnapshot);
      setGameStateOverride(nextOverride);
      syncMatchupInputs(nextSnapshot, nextOverride);
      setErrorMessage(null);
    });
    queueSnapshotSave(nextSnapshot, successNote);
  };

  const handlePitcherInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextName = e.target.value;
    setPitcherNameInput(nextName);
    const matched = pitchers.find((p) => p.name.toLowerCase() === nextName.toLowerCase());
    if (matched && matched.playerId !== selectedPitcherId) {
      setSelectedPitcherId(matched.playerId);
    }
  };

  const handlePitcherChange = (nextPitcherId: string) => {
    setSelectedPitcherId(nextPitcherId);
    setPitcherNameInput(pitchers.find((p) => p.playerId === nextPitcherId)?.name ?? "");
  };

  const handlePitchResultChange = (nextResult: PitchResult) => {
    setSelectedPitchResult(nextResult);
    if (nextResult === "hit_by_pitch") {
      setSelectedLocation(null);
    }
  };

  const handleRecordPitch = () => {
    if (!selectedPitcher || !activePitchType || !selectedPitchResult) {
      return;
    }

    const nextSnapshot = recordPitchInSnapshot(
      snapshot,
      {
        pitchType: activePitchType,
        pitchResult: selectedPitchResult,
        locationCell: selectedPitchResult === "hit_by_pitch" ? null : selectedLocation,
        velocity: parseVelocity(pendingVelocity),
        pitcher: {
          playerId: selectedPitcher.playerId,
          name: selectedPitcher.name,
        },
        hitterName: hitterName.trim(),
        lineupSlot: 1, // Defaulting to 1 for Live ABs where lineup order doesn't matter
      },
      gameStateOverride
    );

    if (nextSnapshot === snapshot) {
      setErrorMessage(
        currentPitcherLocked && selectedPitcher.playerId !== snapshot.segments.at(-1)?.playerId
          ? "Finish the current plate appearance before switching pitchers."
          : "Charting context is incomplete. Set a pitcher and hitter before recording the pitch."
      );
      return;
    }

    clearPitchDraft();
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Pitch saved");

    if (pitchRecordedFlashRef.current) clearTimeout(pitchRecordedFlashRef.current);
    setShowPitchRecordedFlash(true);
    pitchRecordedFlashRef.current = setTimeout(() => {
      setShowPitchRecordedFlash(false);
      pitchRecordedFlashRef.current = null;
    }, 1500);
  };

  const handleClosePlateAppearance = (result: PAResultType) => {
    const nextSnapshot = closeCurrentPlateAppearance(
      snapshot,
      result,
      gameStateOverride
    );

    if (nextSnapshot === snapshot) {
      setErrorMessage("That result is not available for the current plate appearance.");
      return;
    }

    clearPitchDraft();
    applyOptimisticSnapshot(
      nextSnapshot,
      gameStateOverride,
      `Plate appearance closed as ${detailTextForPAResult(result)}`
    );
  };

  const handleUndo = () => {
    const nextSnapshot = undoSnapshotAction(snapshot);
    if (nextSnapshot === snapshot) {
      return;
    }

    clearPitchDraft();
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
    value: number | boolean
  ) => {
    const nextOverride = createGameStateOverride(snapshot, {
      inning:
        field === "inning" ? Number(value) : overrideBase.inning,
      isTopInning:
        field === "isTopInning" ? Boolean(value) : overrideBase.isTopInning,
      outs:
        field === "outs" ? Number(value) : overrideBase.outs,
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

  const handlePAInningChange = (paId: string, inning: number) => {
    const pa = snapshot.plateAppearances.find((p) => p.id === paId);
    if (!pa || pa.inning === inning) return;
    const nextSnapshot: ChartingGameSnapshot = {
      ...snapshot,
      plateAppearances: snapshot.plateAppearances.map((p) =>
        p.id === paId ? { ...p, inning } : p
      ),
    };
    applyOptimisticSnapshot(nextSnapshot, gameStateOverride, "Inning updated");
  };

  const togglePAExpanded = (paId: string) => {
    setExpandedPAs((prev) => {
      const next = new Set(prev);
      if (next.has(paId)) next.delete(paId);
      else next.add(paId);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 flex flex-col text-zinc-100 overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(circle at top left, rgba(var(--babson-green-rgb), 0.18), transparent 24%), radial-gradient(circle at top right, rgba(var(--babson-grey-rgb), 0.14), transparent 26%), linear-gradient(180deg, #09090b 0%, #111827 56%, #09090b 100%)",
      }}
    >
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/90 px-6 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/charting/games/${snapshot.game.id}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.32)] hover:text-zinc-100"
            aria-label="Back to game view"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight text-white">
                {snapshot.game.opponent}
              </h1>
              <StatusBadge status={snapshot.game.status} />
              {gameStateOverride && (
                <span className="inline-flex items-center gap-1.5 flex-none rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                  <WandSparkles className="h-3 w-3" />
                  Override
                </span>
              )}
            </div>
            <div className="mt-0.5 text-xs text-zinc-500">
              {liveState.isTopInning ? "Top" : "Bot"} {liveState.inning} • {liveState.outs} Outs
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsTopBarOpen(!isTopBarOpen)}
            className="flex items-center gap-2 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 text-xs font-bold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] hover:border-[rgba(var(--babson-grey-rgb),0.32)] transition-colors"
          >
            <span>{isTopBarOpen ? "Hide Bar" : "Show Bar"}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${isTopBarOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className="hidden items-center gap-1.5 text-xs text-zinc-500 sm:flex">
            {saveState === "saving" ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            ) : saveState === "error" ? (
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>{saveStatusLabel}</span>
          </div>

          <select
            value={snapshot.game.status}
            onChange={(event) => handleStatusChange(event.target.value as ChartingGameSnapshot["game"]["status"])}
            className="h-9 cursor-pointer rounded-lg border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-medium text-zinc-300 outline-none hover:border-[rgba(var(--babson-grey-rgb),0.32)] focus:border-[rgba(var(--babson-green-rgb),0.45)]"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="final">Final</option>
          </select>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 flex-col relative min-h-0 overflow-hidden">

        {/* Top Bar: Distinct sections for At-Bat, Game State, Pitch Count */}
        {isTopBarOpen && (
          <section className="border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-3 py-1.5 lg:px-4" style={{ backgroundImage: "linear-gradient(to bottom, rgba(var(--babson-grey-rgb), 0.04), transparent)" }}>
            <div className="mx-auto flex max-w-7xl flex-nowrap items-stretch gap-3 overflow-x-auto">

              {/* Section 1: Current At-Bat */}
              <div className="flex flex-[1.5] min-w-0 flex-col rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-2 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1">Current At-Bat</div>
                <div className="flex items-center gap-1.5">
                  <input
                    list={pitcherDatalistId}
                    value={pitcherNameInput}
                    onChange={handlePitcherInputChange}
                    disabled={currentPitcherLocked}
                    placeholder="Pitcher Name (e.g. Wilson)"
                    className="h-7 flex-1 min-w-0 rounded-lg border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600 disabled:opacity-50"
                  />
                  <datalist id={pitcherDatalistId}>
                    {pitchers.map((pitcher) => (
                      <option key={pitcher.playerId} value={pitcher.name} />
                    ))}
                  </datalist>
                  <span className="text-zinc-600 text-[10px] font-semibold italic shrink-0">vs</span>
                  <input
                    list={datalistId}
                    value={hitterName}
                    onChange={(event) => setHitterName(event.target.value)}
                    onBlur={() => {
                      if (!hitterName.trim()) return;
                      const nextSnapshot = syncHitterToSnapshot(
                        snapshot,
                        hitterName.trim(),
                        1,
                        gameStateOverride
                      );
                      if (nextSnapshot !== snapshot) {
                        startTransition(() => setSnapshot(nextSnapshot));
                        queueSnapshotSave(nextSnapshot, "Hitter saved");
                      }
                    }}
                    placeholder="Hitter Name (e.g. Smith)"
                    className="h-7 flex-1 min-w-0 rounded-lg border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-xs font-bold text-zinc-100 outline-none transition-colors focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] placeholder:font-normal placeholder:text-zinc-600"
                  />
                  <datalist id={datalistId}>
                    {rosterPlayers
                      .filter((player) => player.isHitter)
                      .map((player) => (
                        <option key={player.playerId ?? player.slug} value={player.name} />
                      ))}
                  </datalist>
                </div>
              </div>

              {/* Section 2: Game State - two pills with dropdowns */}
              <div className="flex w-fit shrink-0 flex-col justify-center rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-2 px-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
                <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-1">Game State</div>
                <div className="flex flex-nowrap items-center gap-2">
                  <select value={overrideBase.inning} onChange={(e) => handleOverrideChange("inning", Number(e.target.value))} className="h-7 min-w-[7.5rem] shrink-0 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] pl-3 pr-8 py-0 text-xs font-semibold text-[rgb(212,220,218)] outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                    {INNING_OPTIONS.map((i) => <option key={i} value={i}>Inning {i}</option>)}
                  </select>
                  <select value={overrideBase.outs} onChange={(e) => handleOverrideChange("outs", Number(e.target.value))} className="h-7 min-w-[6rem] shrink-0 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] pl-3 pr-8 py-0 text-xs font-semibold text-[rgb(212,220,218)] outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                    {OUT_OPTIONS.map((o) => <option key={o} value={o}>{o} Outs</option>)}
                  </select>
                  {gameStateOverride && (
                    <button onClick={handleResetOverride} className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 shrink-0 whitespace-nowrap">Reset</button>
                  )}
                </div>
              </div>

              {/* Section 3: Pitch Count & Live Count - single row */}
              <div className="flex flex-[2] min-w-0 flex-col justify-center rounded-xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-2 px-3 shadow-[0_12px_32px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
                <div className="flex items-center gap-2">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500 shrink-0">Pitch Count</div>
                  {needsPAClosure && (
                    <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 font-bold tracking-widest text-amber-500 text-[10px] shrink-0">CLOSE PA</span>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex items-center gap-1.5 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)]">Total</span>
                      <span className="text-sm font-black text-white">{totalPitches}</span>
                    </span>
                    <span className="flex items-center gap-1.5 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-2 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)]">Inning</span>
                      <span className="text-sm font-black text-white">{inningPitches}</span>
                    </span>
                  </div>
                  <div className="flex flex-1 min-w-0 items-center justify-between gap-2 rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-[rgb(212,220,218)] shrink-0">Live Count</span>
                    <span className="text-2xl font-black tracking-[0.35em] text-[var(--babson-green)] leading-none tabular-nums shrink-0">
                      {liveState.balls}-{liveState.strikes}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Middle Content: Zone (Left) & Actions (Right) */}
        <section className="mx-auto flex w-full max-w-7xl flex-1 gap-6 p-4 min-h-0 overflow-hidden">

          {/* Left: Zone */}
          <div className="flex flex-col items-center rounded-[2rem] border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-4 min-h-0 w-fit shrink-0 shadow-[0_24px_64px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
            <div className="mb-3 flex w-full items-center justify-between gap-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 whitespace-nowrap">Zone Workspace</div>
              <div className="inline-flex rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                Selected: <span className="ml-1 font-bold text-white">{selectedPitchResult === "hit_by_pitch" ? "HBP" : selectedLocation ? `Cell ${selectedLocation}` : "None"}</span>
              </div>
            </div>

            <div className="flex-1 w-[24rem] flex items-center justify-center min-h-0">
              <PitchLocationGrid
                selectedLocation={selectedLocation}
                disabled={selectedPitchResult === "hit_by_pitch"}
                onSelect={(cellId) => setSelectedLocation(cellId)}
              />
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-1 flex-col gap-4 min-w-0 min-h-0 overflow-hidden">
            {/* View Toggle */}
            <div className="flex items-center rounded-xl border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.06),rgba(var(--babson-grey-rgb),0.04)_58%,rgba(9,9,11,0.92)_100%)] p-1 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
              <button
                onClick={() => setShowHistory(false)}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${!showHistory ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"}`}
              >
                Arsenal & Action
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition-all ${showHistory ? "bg-zinc-800 text-white shadow-sm ring-1 ring-white/10" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"}`}
              >
                Pitch History
              </button>
            </div>

            {!showHistory ? (
              <div className="flex flex-1 flex-col gap-4 min-h-0">
                {/* Column 1: Pitch Family */}
                <SurfacePanel className="p-3 flex flex-col flex-1 h-0 min-h-0">
                  <SectionHeading eyebrow="Arsenal" title="Pitch Family" body="" />
                  <div className="mt-2 flex-1 min-h-0 grid auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {availablePitchTypes.map((type) => (
                      <SelectionButton
                        key={type}
                        title={type}
                        subtitle=""
                        active={activePitchType === type}
                        tone={pitchTypeTone(type)}
                        onClick={() => setSelectedPitchType(type)}
                      />
                    ))}
                  </div>
                </SurfacePanel>

                {/* Column 2: Pitch Result */}
                <SurfacePanel className="p-3 flex flex-col flex-1 h-0 min-h-0">
                  <SectionHeading eyebrow="Action" title="Pitch Result" body="" />
                  <div className="mt-2 flex-1 min-h-0 grid auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-1">
                    {GAME_PITCH_RESULTS.map((result) => (
                      <SelectionButton
                        key={result}
                        title={pitchResultLabel(result)}
                        subtitle=""
                        active={selectedPitchResult === result}
                        tone={pitchResultTone(result)}
                        onClick={() => handlePitchResultChange(result)}
                      />
                    ))}
                  </div>
                </SurfacePanel>
              </div>
            ) : (
              /* Column 3: Pitch Log History — grouped by at-bat, expandable */
              <SurfacePanel className="p-5 flex-1 min-h-0 flex flex-col overflow-hidden">
                <SectionHeading eyebrow="History" title="Recent Pitches" body="" />
                <div className="mt-4 min-h-0 flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden pr-2 overscroll-contain max-h-[60vh]">
                  {recentPAGroups.length === 0 ? (
                    <div className="py-4 text-center text-sm text-zinc-500">No pitches charted yet.</div>
                  ) : (
                    recentPAGroups.map((group) => {
                      const isExpanded = expandedPAs.has(group.paId);
                      return (
                        <div key={group.paId} className="rounded-xl bg-zinc-900/60 overflow-hidden">
                          <button
                            type="button"
                            onClick={() => togglePAExpanded(group.paId)}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
                            )}
                            <select
                              value={group.inning}
                              onChange={(e) => {
                                e.stopPropagation();
                                handlePAInningChange(group.paId, Number(e.target.value));
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="h-7 min-w-[3rem] rounded-md border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-200 outline-none focus:border-emerald-500/50"
                            >
                              {INNING_OPTIONS.map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                            <span className="text-zinc-500 text-xs font-medium">inning</span>
                            <span className="truncate flex-1 font-medium text-zinc-300">{group.hitterName}</span>
                            {group.paResult && (
                              <span className="text-emerald-400 font-bold text-sm shrink-0">{group.paResult}</span>
                            )}
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 shrink-0">
                              {group.pitches.length} pitch{group.pitches.length !== 1 ? "es" : ""}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="border-t border-zinc-800/60 bg-zinc-950/40 rounded-b-xl overflow-hidden">
                              <div className="max-h-[200px] min-h-0 overflow-y-auto overscroll-contain">
                                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-0 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/60 sticky top-0 bg-zinc-950/95 z-10">
                                  <span>#</span>
                                  <span>Pitch</span>
                                  <span>Count</span>
                                  <span>Result</span>
                                </div>
                                {group.pitches.map((pitch, idx) => (
                                  <div
                                    key={pitch.id}
                                    className="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-0 items-center px-4 py-2.5 pl-10 text-sm border-b border-zinc-800/40 last:border-b-0"
                                  >
                                    <span className="text-zinc-500 font-mono text-xs">{idx + 1}</span>
                                    <span className="truncate font-medium text-zinc-300">{pitch.pitchType}</span>
                                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-400 shrink-0">{pitch.count}</span>
                                    <span className={pitch.paResult ? "text-emerald-400 font-bold shrink-0" : "font-medium text-zinc-400 shrink-0"}>
                                      {pitch.paResult ?? pitchResultLabel(pitch.pitchResult)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </SurfacePanel>
            )}
          </div>
        </section>

        {/* Bottom Static Bar: PA Closeout or Record Pitch */}
        <section className="relative flex-shrink-0 border-t border-[rgba(var(--babson-grey-rgb),0.18)] bg-zinc-950/95 p-4 backdrop-blur-xl lg:px-8 lg:py-4 shadow-[0_-20px_40px_rgba(0,0,0,0.5)]">
          {/* Pitch recorded flash overlay — does not affect layout */}
          <AnimatePresence>
            {showPitchRecordedFlash && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
              >
                <span className="rounded-xl bg-[var(--babson-green)]/90 px-6 py-2.5 text-sm font-bold text-white shadow-lg">
                  Pitch recorded
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mx-auto max-w-7xl">
            {needsPAClosure && liveState.closureState === "in_play" ? (
              <div className="flex items-center justify-center py-4">
                <p className="text-sm font-medium text-amber-200/80">
                  Ball in play — select the result in the popup above
                </p>
              </div>
            ) : needsPAClosure ? (
              <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                <div>
                  <h3 className="text-xl font-bold text-amber-500">{detailTextForClosure(liveState.closureState)}</h3>
                  <p className="mt-1 text-sm font-medium text-amber-200/60">{guidanceText}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {closeoutGroups.map((group) =>
                    group.results.map((result) => (
                      <button
                        key={result}
                        type="button"
                        onClick={() => handleClosePlateAppearance(result)}
                        className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-6 py-3.5 text-left transition-colors hover:bg-amber-500/20"
                      >
                        <span className="text-sm font-bold text-amber-100">{result}</span>
                        {paResultOutsRecorded(result) > 0 && (
                          <span className="rounded bg-amber-500/20 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-amber-400">{paResultOutsRecorded(result)} out</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 items-center rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.12)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-5 text-sm font-medium text-zinc-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]">
                    <span className="uppercase tracking-widest text-zinc-500 mr-3 text-[10px] font-bold">Pending</span>
                    <span className="text-white">{buildPendingPitchSummary({ selectedPitchType: activePitchType, selectedLocation, selectedPitchResult, pendingVelocity })}</span>
                  </div>
                  <input
                    value={pendingVelocity}
                    onChange={(e) => setPendingVelocity(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                    placeholder="Velo (mph)"
                    className="h-12 w-32 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-3 text-center text-sm font-bold text-white outline-none focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)] transition-colors"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={clearPitchDraft} className="h-12 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-6 text-sm font-semibold text-[rgb(212,220,218)] hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-200 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">Clear</button>
                  <button
                    onClick={handleUndo}
                    disabled={snapshot.pitches.length === 0}
                    className="h-12 rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] px-6 text-sm font-semibold text-[rgb(212,220,218)] hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-200 disabled:opacity-50 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]"
                  >Undo</button>
                  <button
                    onClick={handleRecordPitch}
                    disabled={!canConfirmPitch}
                    className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-transparent bg-[var(--babson-green)] px-10 font-bold text-white shadow-[0_12px_26px_rgba(var(--babson-green-rgb),0.22)] transition-colors hover:bg-[#00573a] disabled:border-[rgba(var(--babson-grey-rgb),0.22)] disabled:bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.08),rgba(var(--babson-grey-rgb),0.06)_58%,rgba(9,9,11,0.92)_100%)] disabled:text-zinc-500 disabled:shadow-none"
                  >
                    <ArrowRight className="h-5 w-5" /> Record Pitch
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* In-Play Result Modal */}
      <AnimatePresence>
        {needsPAClosure && liveState.closureState === "in_play" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="in-play-modal-title"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.92),rgba(9,9,11,0.96))] shadow-[0_24px_64px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)]"
            >
              <div className="flex items-center justify-between border-b border-[rgba(var(--babson-grey-rgb),0.18)] px-5 py-4 shrink-0">
                <div className="flex items-center gap-3">
                  {(inPlayStep === "hit_type" || inPlayStep === "out_type" || inPlayStep === "out_scoring") && (
                    <button
                      type="button"
                      onClick={() => {
                        if (inPlayStep === "out_scoring") {
                          setInPlayStep("out_type");
                          setInPlayOutType(null);
                        } else {
                          setInPlayStep("hit_or_out");
                          if (inPlayStep === "out_type") setInPlayOutType(null);
                        }
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[rgba(var(--babson-grey-rgb),0.08)] text-zinc-400 transition-colors hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:text-zinc-100"
                      aria-label="Back"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  <div>
                    <h2 id="in-play-modal-title" className="text-lg font-bold text-zinc-100">Ball in Play</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {inPlayStep === "hit_or_out" && "Hit or out?"}
                      {inPlayStep === "hit_type" && "Single, double, triple, or home run?"}
                      {inPlayStep === "out_type" && "What kind of out?"}
                      {inPlayStep === "out_scoring" && inPlayOutType && `Select ${OUT_TYPE_LABELS[inPlayOutType]}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <InPlayWizardContent
                  step={inPlayStep}
                  outType={inPlayOutType}
                  onSelect={handleClosePlateAppearance}
                  onStepChange={setInPlayStep}
                  onOutTypeChange={setInPlayOutType}
                  paResultOutsRecorded={paResultOutsRecorded}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const WIZARD_BTN =
  "flex items-center gap-2 rounded-xl border border-[rgba(var(--babson-grey-rgb),0.22)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.1),rgba(var(--babson-grey-rgb),0.08)_58%,rgba(9,9,11,0.92)_100%)] px-4 py-2.5 text-sm font-bold text-[rgb(212,220,218)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)] transition-colors hover:border-[rgba(var(--babson-green-rgb),0.35)] hover:bg-[rgba(var(--babson-green-rgb),0.12)]";

type InPlayStep = "hit_or_out" | "hit_type" | "out_type" | "out_scoring";
type InPlayOutType = "ground" | "line" | "fly" | "pop" | "unassisted" | "dp" | "error" | "fc";

const OUT_TYPE_TO_OPTIONS: Record<InPlayOutType, readonly PAResultType[]> = {
  ground: GROUND_OUT_OPTIONS,
  line: LINE_OUT_OPTIONS,
  fly: FLY_OUT_OPTIONS,
  pop: POP_OUT_OPTIONS,
  unassisted: UNASSISTED_OUT_OPTIONS,
  dp: DOUBLE_PLAY_OPTIONS,
  error: ERROR_OPTIONS,
  fc: FIELDERS_CHOICE_OPTIONS,
};

const OUT_TYPE_CHOICES: { type: InPlayOutType; label: string }[] = [
  { type: "ground", label: "Ground Out" },
  { type: "line", label: "Line Out" },
  { type: "fly", label: "Fly Out" },
  { type: "pop", label: "Pop Out" },
  { type: "unassisted", label: "Unassisted Out" },
  { type: "dp", label: "Double Play" },
  { type: "error", label: "Error" },
  { type: "fc", label: "Fielder's Choice" },
];

function InPlayWizardContent({
  step,
  outType,
  onSelect,
  onStepChange,
  onOutTypeChange,
  paResultOutsRecorded,
}: {
  step: InPlayStep;
  outType: InPlayOutType | null;
  onSelect: (result: PAResultType) => void;
  onStepChange: (s: InPlayStep) => void;
  onOutTypeChange: (t: InPlayOutType | null) => void;
  paResultOutsRecorded: (r: PAResultType) => number;
}) {
  if (step === "hit_or_out") {
    return (
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onStepChange("hit_type")}
          className={WIZARD_BTN}
        >
          Hit
        </button>
        <button
          type="button"
          onClick={() => onStepChange("out_type")}
          className={WIZARD_BTN}
        >
          Out
        </button>
      </div>
    );
  }

  if (step === "hit_type") {
    return (
      <div className="flex flex-wrap gap-2">
        {HIT_OPTIONS.map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onSelect(result)}
            className={WIZARD_BTN}
          >
            {result === "1B" ? "Single" : result === "2B" ? "Double" : result === "3B" ? "Triple" : "Home Run"}
          </button>
        ))}
      </div>
    );
  }

  if (step === "out_type") {
    return (
      <div className="flex flex-wrap gap-2">
        {OUT_TYPE_CHOICES.map(({ type, label }) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              onOutTypeChange(type);
              onStepChange("out_scoring");
            }}
            className={WIZARD_BTN}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  if (step === "out_scoring" && outType) {
    const options = OUT_TYPE_TO_OPTIONS[outType];
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((result) => (
          <button
            key={result}
            type="button"
            onClick={() => onSelect(result)}
            className={WIZARD_BTN}
          >
            <span>{result}</span>
            {paResultOutsRecorded(result) > 0 && (
              <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-400">
                {paResultOutsRecorded(result)} out
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  return null;
}

function ControlField({
  label,
  helper,
  children,
}: {
  label: string;
  helper: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      {children}
      <span className="block text-xs text-zinc-500">{helper}</span>
    </label>
  );
}

function SurfacePanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(12,18,17,0.82),rgba(9,9,11,0.92))] p-4 shadow-[0_24px_64px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)] ${className}`}
    >
      {children}
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <header className="flex flex-col gap-0.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {eyebrow}
      </div>
      <h2 className="text-lg font-bold tracking-tight text-zinc-50 leading-none">
        {title}
      </h2>
      {body && <p className="mt-1 text-xs text-zinc-400">{body}</p>}
    </header>
  );
}

function MetricPill({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "emerald" | "amber" | "sky" | "slate";
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${metricToneClass(tone)}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
        </div>
        <div className="text-zinc-300">{icon}</div>
      </div>
    </div>
  );
}

function StatTag({
  label,
  value,
  action,
}: {
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
      <span>{label}</span>
      {action ?? <span className="text-zinc-100">{value}</span>}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ChartingGameSnapshot["game"]["status"];
}) {
  if (status === "final") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Final
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200">
        <Timer className="h-3.5 w-3.5" />
        Active
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
      <PencilLine className="h-3.5 w-3.5" />
      Draft
    </span>
  );
}

function SelectionButton({
  title,
  subtitle,
  active,
  tone,
  onClick,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  tone: SelectionTone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-4 text-left transition-all ${selectionToneClass(
        tone,
        active
      )}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold">{title}</div>
          {subtitle && <div className="mt-1 text-xs leading-6 opacity-80">{subtitle}</div>}
        </div>
        {active ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      </div>
    </button>
  );
}

function PitchLocationGrid({
  selectedLocation,
  disabled,
  onSelect,
}: {
  selectedLocation: number | null;
  disabled: boolean;
  onSelect: (cellId: number) => void;
}) {
  return (
    <div className="relative aspect-square w-full max-w-[26rem] rounded-[2.75rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_48%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid h-full grid-cols-5 grid-rows-5 gap-2">
        {LOCATION_CELLS.map((cell) => {
          const active = selectedLocation === cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => onSelect(cell.id)}
              disabled={disabled}
              className={`${cell.className} relative overflow-hidden border transition-all ${active
                ? "border-sky-300/50 bg-sky-400/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.28)]"
                : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
                } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              style={{
                clipPath: clipPathForCell(cell.kind),
                borderRadius: cell.kind === "square" ? "1.1rem" : "1.5rem",
              }}
            >
              <span
                className={`absolute text-lg font-black ${cell.kind === "square"
                  ? "inset-0 flex items-center justify-center"
                  : cornerLabelClass(cell.kind)
                  }`}
              >
                {cell.label}
              </span>
            </button>
          );
        })}
      </div>
      <div className="pointer-events-none absolute inset-4 rounded-[2.3rem] border border-white/5" />
    </div>
  );
}

function deriveMatchupSelection(
  snapshot: ChartingGameSnapshot,
  gameStateOverride: GameStateOverride | null
) {
  const liveState = deriveChartingLiveState(
    snapshot.segments,
    snapshot.plateAppearances,
    snapshot.pitches,
    gameStateOverride
  );
  const openPlateAppearance =
    snapshot.plateAppearances.find((pa) => pa.id === liveState.openPAId) ?? null;
  const slot = openPlateAppearance?.lineupSlot ?? liveState.batterSlot;
  const hitterName =
    openPlateAppearance?.hitterName ?? lineupNameForSlot(snapshot.lineup, slot) ?? "";

  return { slot, hitterName };
}

function buildHitterSuggestions(
  snapshot: ChartingGameSnapshot,
  rosterPlayers: ChartingBootstrapRosterPlayer[]
) {
  return Array.from(
    new Set([
      ...snapshot.lineup.map((entry) => entry.hitterName),
      ...rosterPlayers
        .filter((player) => player.isHitter)
        .map((player) => player.name),
    ])
  ).sort((left, right) => left.localeCompare(right));
}

type RecentPAGroup = {
  paId: string;
  inning: number;
  hitterName: string;
  paResult: string | null;
  pitches: RecentPitchRow[];
};

function buildRecentPitchRows(snapshot: ChartingGameSnapshot): RecentPitchRow[] {
  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));

  return [...snapshot.pitches]
    .sort((left, right) => left.pitchOrder - right.pitchOrder)
    .map((pitch) => {
      const pa = paById.get(pitch.paId);
      return {
        id: pitch.id,
        paId: pitch.paId,
        order: pitch.pitchOrder + 1,
        hitterName: pa?.hitterName ?? "Unknown Hitter",
        inning: pa?.inning ?? 1,
        count: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
        pitchType: pitch.pitchType,
        pitchResult: pitch.pitchResult,
        paResult: pa?.resultCode ?? null,
      };
    });
}

function buildRecentPAGroups(snapshot: ChartingGameSnapshot): RecentPAGroup[] {
  const rows = buildRecentPitchRows(snapshot);
  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));
  const groupsByPa = new Map<string, RecentPitchRow[]>();

  for (const row of rows) {
    const paId = row.paId;
    if (!groupsByPa.has(paId)) groupsByPa.set(paId, []);
    groupsByPa.get(paId)!.push(row);
  }

  return [...snapshot.plateAppearances]
    .sort((a, b) => a.paOrder - b.paOrder)
    .filter((pa) => groupsByPa.has(pa.id))
    .map((pa) => {
      const pitches = groupsByPa.get(pa.id)!;
      return {
        paId: pa.id,
        inning: pa.inning,
        hitterName: pa.hitterName,
        paResult: pa.resultCode,
        pitches,
      };
    });
}

function countPitcherPitches(
  snapshot: ChartingGameSnapshot,
  pitcherId: string
) {
  if (!pitcherId) {
    return 0;
  }

  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));
  const segmentIds = new Set(
    snapshot.segments
      .filter((segment) => segment.playerId === pitcherId)
      .map((segment) => segment.id)
  );

  return snapshot.pitches.filter((pitch) => {
    const pa = paById.get(pitch.paId);
    return pa ? segmentIds.has(pa.segmentId) : false;
  }).length;
}

function findDefaultPitcherId(
  snapshot: ChartingGameSnapshot,
  pitchers: ChartingBootstrapPitcher[]
) {
  return (
    snapshot.segments[snapshot.segments.length - 1]?.playerId ??
    pitchers[0]?.playerId ??
    ""
  );
}

function buildPendingPitchSummary({
  selectedPitchType,
  selectedLocation,
  selectedPitchResult,
  pendingVelocity,
}: {
  selectedPitchType: PitchType | null;
  selectedLocation: number | null;
  selectedPitchResult: PitchResult | null;
  pendingVelocity: string;
}) {
  const pieces = [
    selectedPitchType ?? "Pitch type",
    selectedPitchResult === "hit_by_pitch"
      ? "No zone"
      : selectedLocation
        ? `Cell ${selectedLocation}`
        : "Zone",
    selectedPitchResult ? pitchResultLabel(selectedPitchResult) : "Action",
  ];

  if (pendingVelocity) {
    pieces.push(`${pendingVelocity} mph`);
  }

  return pieces.join(" • ");
}

function detailTextForClosure(closureState: string) {
  switch (closureState) {
    case "strikeout":
      return "Strike Three Logged";
    case "walk":
      return "Ball Four Logged";
    case "hit_by_pitch":
      return "Hit By Pitch Logged";
    case "in_play":
      return "Ball In Play";
    default:
      return "Close Plate Appearance";
  }
}

function parseVelocity(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function safeReadText(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? null;
  } catch {
    return null;
  }
}

function getSaveStatusLabel(
  saveState: SaveState,
  statusMessage: string | null,
  errorMessage: string | null
) {
  if (saveState === "saving") {
    return "Saving live snapshot";
  }
  if (saveState === "saved") {
    return statusMessage ?? "All changes synced";
  }
  if (saveState === "error") {
    return errorMessage ?? "Save failed";
  }
  return "Ready";
}

function pitchTypeDescription(type: PitchType) {
  switch (type) {
    case "Fastball":
      return "Primary heater, sinker, or ride profile.";
    case "Slider":
      return "Sweeper or lateral breaker.";
    case "Curveball":
      return "Vertical breaking ball.";
    case "Changeup":
      return "Offspeed separation pitch.";
    case "Split/Cut":
      return "Splitter, cutter, or hybrid offshoot.";
    case "Other":
      return "Unclassified or custom pitch type.";
  }
}

function pitchResultLabel(result: PitchResult) {
  switch (result) {
    case "ball":
      return "Ball";
    case "called_strike":
      return "Called Strike";
    case "swinging_strike":
      return "Swinging Strike";
    case "foul":
      return "Foul";
    case "bunt_foul":
      return "Bunt Foul";
    case "in_play":
      return "In Play";
    case "hit_by_pitch":
      return "HBP";
  }
}

function pitchResultDescription(result: PitchResult) {
  switch (result) {
    case "ball":
      return "Advances the count toward a walk.";
    case "called_strike":
      return "Taken strike without a swing.";
    case "swinging_strike":
      return "Swing and miss.";
    case "foul":
      return "Foul ball, capped at two strikes.";
    case "bunt_foul":
      return "Bunt attempt foul, capped at two strikes.";
    case "in_play":
      return "Triggers PA closeout selection.";
    case "hit_by_pitch":
      return "No zone required for commit.";
  }
}

type SelectionTone = "emerald" | "rose" | "amber" | "sky" | "violet" | "slate";

function pitchTypeTone(type: PitchType): SelectionTone {
  switch (type) {
    case "Fastball":
      return "rose";
    case "Slider":
      return "amber";
    case "Curveball":
      return "sky";
    case "Changeup":
      return "emerald";
    case "Split/Cut":
      return "violet";
    case "Other":
      return "slate";
  }
}

function pitchResultTone(result: PitchResult): SelectionTone {
  switch (result) {
    case "ball":
      return "emerald";
    case "called_strike":
      return "rose";
    case "swinging_strike":
      return "amber";
    case "foul":
    case "bunt_foul":
      return "slate";
    case "in_play":
      return "sky";
    case "hit_by_pitch":
      return "violet";
  }
}

function selectionToneClass(tone: SelectionTone, active: boolean) {
  const palette = {
    emerald: active
      ? "border-emerald-300/40 bg-emerald-500/16 text-emerald-100 shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-emerald-400/25 hover:text-zinc-100",
    rose: active
      ? "border-rose-300/40 bg-rose-500/16 text-rose-100 shadow-[0_18px_40px_rgba(244,63,94,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-rose-400/25 hover:text-zinc-100",
    amber: active
      ? "border-amber-300/40 bg-amber-500/16 text-amber-100 shadow-[0_18px_40px_rgba(245,158,11,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-amber-400/25 hover:text-zinc-100",
    sky: active
      ? "border-sky-300/40 bg-sky-500/16 text-sky-100 shadow-[0_18px_40px_rgba(59,130,246,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-sky-400/25 hover:text-zinc-100",
    violet: active
      ? "border-violet-300/40 bg-violet-500/16 text-violet-100 shadow-[0_18px_40px_rgba(139,92,246,0.16)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-violet-400/25 hover:text-zinc-100",
    slate: active
      ? "border-zinc-500/40 bg-zinc-700/40 text-zinc-100 shadow-[0_18px_40px_rgba(63,63,70,0.18)]"
      : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100",
  };

  return palette[tone];
}

function metricToneClass(tone: "emerald" | "amber" | "sky" | "slate") {
  switch (tone) {
    case "emerald":
      return "border-emerald-500/20 bg-emerald-500/10";
    case "amber":
      return "border-amber-400/20 bg-amber-400/10";
    case "sky":
      return "border-sky-500/20 bg-sky-500/10";
    case "slate":
      return "border-zinc-800 bg-zinc-950/80";
  }
}

function clipPathForCell(kind: LocationCellConfig["kind"]) {
  switch (kind) {
    case "topLeftCorner":
      return "polygon(0% 0%, 100% 0%, 100% 30%, 32% 30%, 32% 100%, 0% 100%)";
    case "topRightCorner":
      return "polygon(0% 0%, 100% 0%, 100% 100%, 68% 100%, 68% 30%, 0% 30%)";
    case "bottomLeftCorner":
      return "polygon(0% 0%, 32% 0%, 32% 68%, 100% 68%, 100% 100%, 0% 100%)";
    case "bottomRightCorner":
      return "polygon(68% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 68%, 68% 68%)";
    case "square":
      return "none";
  }
}

function cornerLabelClass(kind: LocationCellConfig["kind"]) {
  switch (kind) {
    case "topLeftCorner":
      return "left-5 top-4";
    case "topRightCorner":
      return "right-5 top-4";
    case "bottomLeftCorner":
      return "bottom-4 left-5";
    case "bottomRightCorner":
      return "bottom-4 right-5";
    case "square":
      return "";
  }
}
