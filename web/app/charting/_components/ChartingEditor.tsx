"use client";

import Link from "next/link";
import {
  startTransition,
  useId,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
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
  GAME_PITCH_RESULTS,
  closeCurrentPlateAppearance,
  closeoutResultGroups,
  createGameStateOverride,
  deriveChartingLiveState,
  detailTextForPAResult,
  guidanceTextForClosure,
  lineupNameForSlot,
  paResultOutsRecorded,
  recordPitchInSnapshot,
  undoSnapshotAction,
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
  const [selectedPitchType, setSelectedPitchType] = useState<PitchType | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);
  const [selectedPitchResult, setSelectedPitchResult] = useState<PitchResult | null>(null);
  const [pendingVelocity, setPendingVelocity] = useState("");
  const [selectedLineupSlot, setSelectedLineupSlot] = useState(initialMatchup.slot);
  const [hitterName, setHitterName] = useState(initialMatchup.hitterName);
  const [gameStateOverride, setGameStateOverride] = useState<GameStateOverride | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
  const recentPitches = buildRecentPitchRows(snapshot).slice(-12).reverse();
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
    setSelectedLineupSlot(nextMatchup.slot);
    setHitterName(nextMatchup.hitterName);
    setSelectedPitcherId(findDefaultPitcherId(nextSnapshot, pitchers));
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

  const handlePitcherChange = (nextPitcherId: string) => {
    setSelectedPitcherId(nextPitcherId);
  };

  const handleLineupSlotChange = (nextSlot: number) => {
    setSelectedLineupSlot(nextSlot);
    setHitterName(lineupNameForSlot(snapshot.lineup, nextSlot) ?? "");
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
        lineupSlot: selectedLineupSlot,
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

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.16),_transparent_34%),linear-gradient(180deg,_rgba(9,9,11,0.95),_rgba(9,9,11,0.75)_45%,_rgba(9,9,11,0.98))]" />

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-emerald-500/18 bg-zinc-950/80 shadow-[0_28px_90px_rgba(0,0,0,0.32)]">
          <div className="border-b border-zinc-800/80 px-6 py-5 lg:px-8">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-3">
                <Link
                  href={`/charting/games/${snapshot.game.id}`}
                  className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500 transition-colors hover:text-zinc-200"
                >
                  <ChevronLeft className="h-4 w-4" />
                  View Saved Game
                </Link>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight text-zinc-50 lg:text-[2.6rem]">
                      {snapshot.game.opponent}
                    </h1>
                    <StatusBadge status={snapshot.game.status} />
                    {gameStateOverride ? (
                      <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                        <WandSparkles className="h-3.5 w-3.5" />
                        Manual State Override
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
                    Desktop-first charting workspace for full game entry. Record pitches, close plate appearances, and push full snapshots back through the existing sync API.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[26rem]">
                <MetricPill
                  label="Save Status"
                  value={saveStatusLabel}
                  tone={saveState === "error" ? "amber" : saveState === "saved" ? "emerald" : "slate"}
                  icon={
                    saveState === "saving" ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : saveState === "saved" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : saveState === "error" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )
                  }
                />
                <MetricPill
                  label="Game Snapshot"
                  value={`rev ${snapshot.game.revision}`}
                  tone="sky"
                  icon={<RefreshCw className="h-4 w-4" />}
                />
                <MetricPill
                  label="Count"
                  value={`${liveState.balls}-${liveState.strikes}`}
                  tone={needsPAClosure ? "amber" : "slate"}
                  icon={<Timer className="h-4 w-4" />}
                />
                <MetricPill
                  label="Sequence"
                  value={`${snapshot.pitches.length} pitches`}
                  tone="slate"
                  icon={<PencilLine className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>

          <div className="px-6 py-5 lg:px-8">
            <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_0.9fr]">
              <ControlField
                label="Pitcher"
                helper={
                  currentPitcherLocked
                    ? "Pitcher changes are locked until the current plate appearance is closed."
                    : "Select the active pitcher and the pitch menu will filter to his arsenal."
                }
              >
                <select
                  value={selectedPitcher?.playerId ?? ""}
                  onChange={(event) => handlePitcherChange(event.target.value)}
                  disabled={currentPitcherLocked}
                  className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pitchers.map((pitcher) => (
                    <option key={pitcher.playerId} value={pitcher.playerId}>
                      {pitcher.name}
                    </option>
                  ))}
                </select>
              </ControlField>

              <ControlField
                label="Hitter"
                helper="Pick the lineup slot first, then type or choose the hitter name from the roster suggestions."
              >
                <div className="grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                  <select
                    value={selectedLineupSlot}
                    onChange={(event) => handleLineupSlotChange(Number(event.target.value))}
                    className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                  >
                    {Array.from({ length: 9 }, (_, index) => index + 1).map((slot) => (
                      <option key={slot} value={slot}>
                        Slot {slot}
                      </option>
                    ))}
                  </select>
                  <input
                    list={datalistId}
                    value={hitterName}
                    onChange={(event) => setHitterName(event.target.value)}
                    placeholder="Type hitter name"
                    className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                  />
                  <datalist id={datalistId}>
                    {hitterSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
              </ControlField>

              <ControlField
                label="Game State"
                helper="These menus let you locally correct inning, half, and outs before the next plate appearance starts."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <select
                    value={overrideBase.inning}
                    onChange={(event) =>
                      handleOverrideChange("inning", Number(event.target.value))
                    }
                    className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                  >
                    {INNING_OPTIONS.map((inning) => (
                      <option key={inning} value={inning}>
                        Inning {inning}
                      </option>
                    ))}
                  </select>
                  <select
                    value={overrideBase.isTopInning ? "top" : "bottom"}
                    onChange={(event) =>
                      handleOverrideChange(
                        "isTopInning",
                        event.target.value === "top"
                      )
                    }
                    className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                  </select>
                  <select
                    value={overrideBase.outs}
                    onChange={(event) =>
                      handleOverrideChange("outs", Number(event.target.value))
                    }
                    className="h-12 rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                  >
                    {OUT_OPTIONS.map((outs) => (
                      <option key={outs} value={outs}>
                        {outs} Outs
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    <CircleDot className="h-3.5 w-3.5" />
                    {overrideBase.isTopInning ? "Top" : "Bottom"} {overrideBase.inning} • {overrideBase.outs} Outs
                  </span>
                  {gameStateOverride ? (
                    <button
                      type="button"
                      onClick={handleResetOverride}
                      className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset Override
                    </button>
                  ) : null}
                </div>
              </ControlField>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <StatTag label="Pitcher Total" value={`${activePitcherPitchCount}`} />
              <StatTag label="Open PA" value={openPlateAppearance ? `#${openPlateAppearance.paOrder + 1}` : "Ready"} />
              <StatTag label="Batter Slot" value={`${selectedLineupSlot}`} />
              <StatTag label="Plate Appearances" value={`${snapshot.plateAppearances.length}`} />
              <StatTag
                label="Game Status"
                value={snapshot.game.status}
                action={
                  <select
                    value={snapshot.game.status}
                    onChange={(event) =>
                      handleStatusChange(
                        event.target.value as ChartingGameSnapshot["game"]["status"]
                      )
                    }
                    className="rounded-full border border-transparent bg-transparent text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300 outline-none"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="final">Final</option>
                  </select>
                }
              />
            </div>
          </div>
        </section>

        {(errorMessage || statusMessage) && (
          <section
            className={`rounded-2xl border px-5 py-4 text-sm ${
              errorMessage
                ? "border-amber-400/20 bg-amber-400/10 text-amber-100"
                : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            <div className="flex items-start gap-3">
              {errorMessage ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <p>{errorMessage ?? statusMessage}</p>
            </div>
          </section>
        )}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_24rem]">
          <SurfacePanel className="min-h-[42rem]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Zone Workspace
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-50">
                  Location First
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-7 text-zinc-400">
                  Mirror the native flow: mark the target cell, pick the pitch family, then choose the action.
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-3 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Selected Zone
                </div>
                <div className="mt-2 text-lg font-black text-zinc-100">
                  {selectedPitchResult === "hit_by_pitch"
                    ? "HBP"
                    : selectedLocation
                    ? `Cell ${selectedLocation}`
                    : "None"}
                </div>
              </div>
            </div>

            <div className="mt-8 flex min-h-[31rem] items-center justify-center">
              <PitchLocationGrid
                selectedLocation={selectedLocation}
                disabled={selectedPitchResult === "hit_by_pitch"}
                onSelect={(cellId) => setSelectedLocation(cellId)}
              />
            </div>
          </SurfacePanel>

          <div className="space-y-6">
            <SurfacePanel>
              <SectionHeading
                eyebrow="Pitch Family"
                title="Arsenal Filter"
                body={
                  selectedPitcher
                    ? `${selectedPitcher.name} • ${selectedPitcher.throws}HP`
                    : "Choose a pitcher to load the available pitch families."
                }
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {availablePitchTypes.map((pitchType) => (
                  <SelectionButton
                    key={pitchType}
                    title={pitchType}
                    subtitle={pitchTypeDescription(pitchType)}
                    active={activePitchType === pitchType}
                    tone={pitchTypeTone(pitchType)}
                    onClick={() => setSelectedPitchType(pitchType)}
                  />
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel>
              <SectionHeading
                eyebrow="Pitch Action"
                title="Pending Result"
                body="These actions set the next pitch outcome without committing it yet."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {GAME_PITCH_RESULTS.map((result) => (
                  <SelectionButton
                    key={result}
                    title={pitchResultLabel(result)}
                    subtitle={pitchResultDescription(result)}
                    active={selectedPitchResult === result}
                    tone={pitchResultTone(result)}
                    onClick={() => handlePitchResultChange(result)}
                  />
                ))}
              </div>
            </SurfacePanel>
          </div>

          <div className="space-y-6">
            <SurfacePanel>
              <SectionHeading
                eyebrow="Lineup"
                title="Quick Slot Access"
                body="Tap a slot to pull the saved lineup name into the active hitter field."
              />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {Array.from({ length: 9 }, (_, index) => index + 1).map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => handleLineupSlotChange(slot)}
                    className={`rounded-2xl border px-3 py-3 text-left transition-all ${
                      selectedLineupSlot === slot
                        ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-100 shadow-[0_18px_40px_rgba(16,185,129,0.16)]"
                        : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Slot {slot}
                    </div>
                    <div className="mt-2 line-clamp-2 text-sm font-semibold">
                      {lineupNameForSlot(snapshot.lineup, slot) ?? "Open slot"}
                    </div>
                  </button>
                ))}
              </div>
            </SurfacePanel>

            <SurfacePanel>
              <SectionHeading
                eyebrow="Recent Sequence"
                title="Pitch Log"
                body="The latest entries stay visible while you chart, so you can verify count flow at a glance."
              />
              <div className="mt-5 space-y-3">
                {recentPitches.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/75 px-4 py-5 text-sm text-zinc-500">
                    No pitches charted yet.
                  </div>
                ) : (
                  recentPitches.map((pitch) => (
                    <article
                      key={pitch.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-950/82 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                            Pitch {pitch.order}
                          </div>
                          <h3 className="mt-2 text-sm font-semibold text-zinc-100">
                            {pitch.hitterName}
                          </h3>
                        </div>
                        <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                          {pitch.count}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-400">
                        <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1">
                          {pitch.pitchType}
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1">
                          {pitchResultLabel(pitch.pitchResult)}
                        </span>
                        <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1">
                          Top {pitch.inning}
                        </span>
                        {pitch.paResult ? (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                            {pitch.paResult}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </SurfacePanel>
          </div>
        </section>

        {needsPAClosure ? (
          <SurfacePanel className="border-amber-400/20 bg-[linear-gradient(180deg,rgba(251,191,36,0.08),rgba(9,9,11,0.74))]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
                  Plate Appearance Closeout
                </div>
                <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-50">
                  {detailTextForClosure(liveState.closureState)}
                </h2>
                <p className="mt-2 text-sm leading-7 text-zinc-200/90">{guidanceText}</p>
                <p className="mt-3 text-xs uppercase tracking-[0.16em] text-amber-100/70">
                  Choose the scored result to unlock the next batter.
                </p>
              </div>
              <div className="rounded-2xl border border-amber-400/20 bg-zinc-950/80 px-4 py-3 text-sm text-amber-100/90">
                Outs on closeout will move the inning automatically. A double play adds {liveState.closureState === "in_play" ? "2 outs when selected." : "the outs attached to the selected result."}
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {closeoutGroups.map((group) => (
                <div key={group.title}>
                  <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    {group.title}
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {group.results.map((result) => (
                      <button
                        key={result}
                        type="button"
                        onClick={() => handleClosePlateAppearance(result)}
                        className="group rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-4 text-left transition-all hover:border-amber-300/35 hover:bg-amber-400/10"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-zinc-100 group-hover:text-amber-100">
                              {result}
                            </div>
                            <div className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-300">
                              {detailTextForPAResult(result)}
                            </div>
                          </div>
                          {paResultOutsRecorded(result) > 0 ? (
                            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
                              {paResultOutsRecorded(result)} out
                              {paResultOutsRecorded(result) > 1 ? "s" : ""}
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </SurfacePanel>
        ) : null}

        <section className="sticky bottom-4 z-20">
          <div className="overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-zinc-950/92 shadow-[0_28px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="flex flex-col gap-5 px-5 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
                    Pending Pitch
                  </span>
                  {selectedPitchType ? (
                    <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                      {selectedPitchType}
                    </span>
                  ) : null}
                  {selectedPitchResult ? (
                    <span className="rounded-full border border-zinc-800 bg-zinc-900/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                      {pitchResultLabel(selectedPitchResult)}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-zinc-50">
                      {buildPendingPitchSummary({
                      selectedPitchType: activePitchType,
                      selectedLocation,
                      selectedPitchResult,
                      pendingVelocity,
                    })}
                  </h2>
                  <p className="mt-2 text-sm text-zinc-400">
                    {canConfirmPitch
                      ? "Ready to commit this pitch."
                      : needsPAClosure
                      ? guidanceText
                      : "Select a pitch type, action, and zone before confirming the pitch."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 lg:min-w-[29rem]">
                <div className="grid gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    Velocity
                    <input
                      value={pendingVelocity}
                      onChange={(event) =>
                        setPendingVelocity(event.target.value.replace(/[^0-9]/g, "").slice(0, 3))
                      }
                      inputMode="numeric"
                      placeholder="mph"
                      className="mt-2 h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 text-sm font-medium text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors hover:border-zinc-700 focus:border-emerald-400/35"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={clearPitchDraft}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 text-sm font-semibold text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        snapshot.plateAppearances.length === 0 && snapshot.pitches.length === 0
                      }
                    >
                      <Undo2 className="h-4 w-4" />
                      Undo
                    </button>
                    <button
                      type="button"
                      onClick={handleRecordPitch}
                      disabled={!canConfirmPitch}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/12 px-4 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-300/30 hover:bg-emerald-500/18 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900/70 disabled:text-zinc-500"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Confirm Pitch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
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
      className={`rounded-[2rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_26px_70px_rgba(0,0,0,0.28)] ${className}`}
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
    <header>
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
        {eyebrow}
      </div>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-7 text-zinc-400">{body}</p>
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
      className={`rounded-2xl border px-4 py-4 text-left transition-all ${selectionToneClass(
        tone,
        active
      )}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-bold">{title}</div>
          <div className="mt-1 text-xs leading-6 opacity-80">{subtitle}</div>
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
    <div className="relative aspect-square w-full max-w-[38rem] rounded-[2.75rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.08),_transparent_48%),linear-gradient(180deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.95))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div className="grid h-full grid-cols-5 grid-rows-5 gap-2">
        {LOCATION_CELLS.map((cell) => {
          const active = selectedLocation === cell.id;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => onSelect(cell.id)}
              disabled={disabled}
              className={`${cell.className} relative overflow-hidden border transition-all ${
                active
                  ? "border-sky-300/50 bg-sky-400/20 text-white shadow-[0_18px_50px_rgba(59,130,246,0.28)]"
                  : "border-zinc-700 bg-zinc-900/70 text-zinc-400 hover:border-zinc-500 hover:text-zinc-100"
              } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
              style={{
                clipPath: clipPathForCell(cell.kind),
                borderRadius: cell.kind === "square" ? "1.1rem" : "1.5rem",
              }}
            >
              <span
                className={`absolute text-lg font-black ${
                  cell.kind === "square"
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

function buildRecentPitchRows(snapshot: ChartingGameSnapshot): RecentPitchRow[] {
  const paById = new Map(snapshot.plateAppearances.map((pa) => [pa.id, pa]));

  return [...snapshot.pitches]
    .sort((left, right) => left.pitchOrder - right.pitchOrder)
    .map((pitch) => {
      const pa = paById.get(pitch.paId);
      return {
        id: pitch.id,
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
      return "Track any non-standard family.";
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
      return "Bunt attempt that stays foul.";
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
