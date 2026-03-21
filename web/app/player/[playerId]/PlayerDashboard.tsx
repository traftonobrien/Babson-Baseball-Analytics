"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { usePitchData } from "../../hooks/usePitchData";
import { applyFilters } from "../../utils";
import type { Pitch, Filters } from "../../types";
import type { Lane } from "@/lib/handedness";
import type { Player, Outing } from "@/lib/dataIndex";
import { laneOf } from "@/lib/reportModel";
import FilterPanel from "../../components/FilterPanel";
import PitchTable from "../../components/PitchTable";
import VideoPlayer from "../../components/VideoPlayer";
import StrikeZoneScatter from "../../components/StrikeZoneScatter";
import LaneReport from "../../components/LaneReport";
import PitchTypeSummaryCards from "../../components/PitchTypeSummaryCards";
import CommandPlusSection from "../../components/CommandPlusSection";
import MissHeatmap from "../../components/MissHeatmap";
import OutingSelect from "./OutingSelect";
import GameStatsSection from "@/lib/stats/GameStatsSection";
import { seasonFromDateId } from "@/lib/season";
import { pitchDisplayName } from "@/lib/pitchNames";
import {
  loadOutingMeta,
  loadPlayerGameStats,
  type OutingMeta,
  type PlayerGameStats,
} from "@/lib/stats";
import { sortPitchTypes } from "@/lib/pitchTypeOrder";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonOrangeActiveClassName,
} from "@/components/ui/neon-button";
import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";

type VizMode = "scatter" | "heatmap";

const EMPTY_FILTERS: Filters = {
  pitchTypes: new Set(),
  maxMiss: null,
};

/* ------------------------------------------------------------------ */
/*  Pitch-type override helpers (localStorage)                         */
/* ------------------------------------------------------------------ */

type Overrides = Record<number, string>; // pitch_number → new pitch_type

function storageKey(outingId: string): string {
  return `pitchTypeOverrides:${outingId}`;
}

function loadOverrides(outingId: string): Overrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey(outingId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOverrides(outingId: string, overrides: Overrides): void {
  if (typeof window === "undefined") return;
  if (Object.keys(overrides).length === 0) {
    localStorage.removeItem(storageKey(outingId));
  } else {
    localStorage.setItem(storageKey(outingId), JSON.stringify(overrides));
  }
}

function outingLabelKey(outingId: string): string {
  return `outingLabel:${outingId}`;
}

function loadOutingLabel(outingId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(outingLabelKey(outingId));
  } catch {
    return null;
  }
}

function saveOutingLabel(outingId: string, label: string): void {
  if (typeof window === "undefined") return;
  if (label.trim() === "") {
    localStorage.removeItem(outingLabelKey(outingId));
  } else {
    localStorage.setItem(outingLabelKey(outingId), label.trim());
  }
}

function applyOverrides(pitches: Pitch[], overrides: Overrides): Pitch[] {
  if (Object.keys(overrides).length === 0) return pitches;
  return pitches.map((p) => {
    const newType = overrides[p.pitch_number];
    if (newType && newType !== p.pitch_type) {
      return { ...p, pitch_type: newType };
    }
    return p;
  });
}

function HeaderActionLink({
  href,
  label,
  emphasis = false,
}: {
  href: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
        emphasis
          ? "border-orange-400/35 bg-orange-500/10 text-orange-200 hover:border-orange-300/45 hover:bg-orange-500/14"
          : "border-zinc-800 bg-zinc-950/80 text-zinc-300 hover:border-orange-400/20 hover:text-zinc-100"
      }`}
    >
      {label}
    </Link>
  );
}

function SidebarPanel({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-zinc-950/75 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
      <div className="border-b border-zinc-800/70 px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
          {title}
        </div>
        {detail ? <div className="mt-1 text-xs text-zinc-500">{detail}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlayerDashboard({
  player,
  outing,
  backTo,
  backLabel,
  profileSlug,
}: {
  player: Player;
  outing: Outing;
  backTo?: string;
  backLabel?: string;
  profileSlug?: string;
}) {
  const { pitches: rawPitches, pitcherHand, loading, error } = usePitchData(outing.csvPath, player.id);
  const [overrides, setOverrides] = useState<Overrides>({});
  const [selected, setSelected] = useState<Pitch | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [activeLane, setActiveLane] = useState<Lane | null>(null);
  const [vizMode, setVizMode] = useState<VizMode>("scatter");
  const [heatmapPitchType, setHeatmapPitchType] = useState("All");
  const [outingMeta, setOutingMeta] = useState<OutingMeta | null>(null);
  const [statsByGame, setStatsByGame] = useState<Record<string, PlayerGameStats | null>>({});
  const [outingLabelOverride, setOutingLabelOverride] = useState<string | null>(null);
  const [isEditingOutingLabel, setIsEditingOutingLabel] = useState(false);
  const [outingLabelInput, setOutingLabelInput] = useState("");

  const displayOutingLabel = outingLabelOverride ?? outing.label;

  // Build label overrides map for OutingSelect (all player outings)
  const labelOverridesMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const o of player.outings) {
      const override = o.id === outing.id ? outingLabelOverride : loadOutingLabel(o.id);
      if (override) map[o.id] = override;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [player.outings, outing.id, outingLabelOverride]);

  // Load overrides and label from localStorage on mount / outing change
  useEffect(() => {
    setOverrides(loadOverrides(outing.id));
    setOutingLabelOverride(loadOutingLabel(outing.id));
    setIsEditingOutingLabel(false);
  }, [outing.id]);

  useEffect(() => {
    let active = true;
    setOutingMeta(null);
    setStatsByGame({});
    const [outingPlayerId, dateId] = outing.id.split("/");
    if (!outingPlayerId || !dateId) {
      return () => {
        active = false;
      };
    }
    const loadStats = async () => {
      const meta = await loadOutingMeta(outingPlayerId, dateId);
      if (!active || !meta) {
        if (active) setOutingMeta(null);
        return;
      }
      setOutingMeta(meta);
      const initialMap: Record<string, PlayerGameStats | null> = {};
      for (const game of meta.linkedGames) {
        initialMap[game.gameId] = null;
      }
      const entries = await Promise.all(
        meta.linkedGames.map(async (game) => [
          game.gameId,
          await loadPlayerGameStats(outingPlayerId, game.season, game.gameId),
        ] as const),
      );
      if (!active) return;
      const map: Record<string, PlayerGameStats | null> = { ...initialMap };
      for (const [gameId, stats] of entries) {
        map[gameId] = stats;
      }
      setStatsByGame(map);
    };
    void loadStats();
    return () => {
      active = false;
    };
  }, [outing.id]);

  // Pitches with overrides applied — used everywhere downstream
  const pitches = useMemo(
    () => applyOverrides(rawPitches, overrides),
    [rawPitches, overrides],
  );

  // Set of edited pitch numbers (for UI badge)
  const editedPitches = useMemo(
    () => new Set(Object.keys(overrides).map(Number)),
    [overrides],
  );

  // Available pitch type options: union of original types + any override values
  const pitchTypeOptions = useMemo(() => {
    const types = new Set<string>();
    for (const p of rawPitches) {
      if (p.pitch_type) types.add(p.pitch_type);
    }
    for (const v of Object.values(overrides)) {
      if (v) types.add(v);
    }
    return sortPitchTypes(Array.from(types), (type) => type);
  }, [rawPitches, overrides]);

  const handleEditPitchType = useCallback(
    (pitchNumber: number, newType: string) => {
      setOverrides((prev) => {
        // Find original type — if the edit returns it to original, remove the override
        const original = rawPitches.find((p) => p.pitch_number === pitchNumber);
        const next = { ...prev };
        if (original && original.pitch_type === newType) {
          delete next[pitchNumber];
        } else {
          next[pitchNumber] = newType;
        }
        saveOverrides(outing.id, next);
        return next;
      });
    },
    [outing, rawPitches],
  );

  const handleResetEdits = useCallback(() => {
    setOverrides({});
    saveOverrides(outing.id, {});
  }, [outing]);

  const filtered = applyFilters(pitches, filters);
  // Exclude no-read pitches (NaN measurements) from visualizations and calculations
  const measurable = filtered.filter((p) => Number.isFinite(p.total_miss_inches));
  const laneFiltered = activeLane
    ? measurable.filter((p) => laneOf(p, pitcherHand) === (activeLane as string))
    : measurable;

  // Unique pitch types present in the filtered data (for heatmap selector)
  const heatmapPitchTypes = useMemo(() => {
    const types = new Set(laneFiltered.map((p) => p.pitch_type).filter(Boolean));
    return ["All", ...sortPitchTypes(Array.from(types), (type) => type)];
  }, [laneFiltered]);

  // Heatmap data filtered by local pitch type selector
  const heatmapData = useMemo(() => {
    if (heatmapPitchType === "All") return laneFiltered;
    return laneFiltered.filter((p) => p.pitch_type === heatmapPitchType);
  }, [laneFiltered, heatmapPitchType]);

  // Reset heatmap pitch type when it's no longer available
  useEffect(() => {
    if (!heatmapPitchTypes.includes(heatmapPitchType)) {
      setHeatmapPitchType("All");
    }
  }, [heatmapPitchTypes, heatmapPitchType]);

  // Keep selected pitch valid when the visible list changes
  useEffect(() => {
    if (selected && !laneFiltered.some((p) => p.pitch_number === selected.pitch_number)) {
      setSelected(laneFiltered.length > 0 ? laneFiltered[0] : null);
    }
  }, [laneFiltered, selected]);

  const toggleLane = (lane: Lane) => {
    setActiveLane((prev) => (prev === lane ? null : lane));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_22%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)] text-zinc-400">
        Loading command report...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_22%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)] text-red-400">
        Error: {error}
      </div>
    );
  }

  const hasEdits = editedPitches.size > 0;
  const outingDateId = outing.id.split("/")[1] ?? "";
  const currentSeason = seasonFromDateId(outingDateId);
  const profileHref = profileSlug ? `/players/${profileSlug}?tab=Command` : null;
  const profileContextQuery = profileSlug
    ? `&from=profile&slug=${encodeURIComponent(profileSlug)}`
    : "";
  const trackmanHref = profileSlug
    ? `/trackman/session/${player.id}/${outingDateId}?from=profile&slug=${profileSlug}`
    : `/trackman/session/${player.id}/${outingDateId}`;
  const compareHref =
    player.outings.length >= 2
      ? `/player/${player.id}/compare?outingA=${outing.id}&outingB=${
          player.outings.find((o) => o.id !== outing.id)?.id ?? player.outings[1].id
        }${profileContextQuery}`
      : `/player/${player.id}/compare?outingA=${outing.id}${profileContextQuery}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_22%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_22%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)] text-zinc-100">
      <header className="border-b border-zinc-800/70 bg-[linear-gradient(135deg,rgba(24,24,27,0.95),rgba(9,9,11,0.96))]">
        <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={backTo ?? "/"}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition-all duration-300 hover:border-orange-400/20 hover:text-zinc-100"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  {backLabel ?? "Home"}
                </Link>
                <span className="hidden text-zinc-700 sm:inline">/</span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Command Outing
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <LeaderboardPill tone="orange">
                  {laneFiltered.length} / {pitches.length} pitches
                </LeaderboardPill>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300">
                  {player.name}
                </div>
                {isEditingOutingLabel ? (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="text"
                      value={outingLabelInput}
                      onChange={(e) => setOutingLabelInput(e.target.value)}
                      onBlur={() => {
                        const trimmed = outingLabelInput.trim();
                        if (trimmed) {
                          saveOutingLabel(outing.id, trimmed);
                          setOutingLabelOverride(trimmed);
                        } else {
                          saveOutingLabel(outing.id, "");
                          setOutingLabelOverride(null);
                        }
                        setIsEditingOutingLabel(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        }
                        if (e.key === "Escape") {
                          setOutingLabelInput(displayOutingLabel);
                          setIsEditingOutingLabel(false);
                          e.currentTarget.blur();
                        }
                      }}
                      autoFocus
                      className="min-w-[12rem] flex-1 rounded-lg border border-zinc-600 bg-zinc-900/80 px-3 py-2 text-xl font-black tracking-tight text-zinc-50 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 sm:text-3xl"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOutingLabelInput(displayOutingLabel);
                      setIsEditingOutingLabel(true);
                    }}
                    className="mt-2 flex cursor-pointer items-center gap-2 text-left transition-opacity hover:opacity-90 group rounded-lg -ml-1 pl-1 pr-2 -mr-2 py-1 hover:bg-zinc-800/40"
                    aria-label="Edit outing name"
                  >
                    <h1 className="text-2xl font-black tracking-tight text-zinc-50 sm:text-4xl">
                      {displayOutingLabel}
                    </h1>
                    <Pencil className="h-4 w-4 shrink-0 text-zinc-500 opacity-60 group-hover:opacity-100 sm:h-5 sm:w-5" aria-hidden />
                  </button>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {currentSeason ? (
                    <LeaderboardPill tone="orange">{currentSeason} season</LeaderboardPill>
                  ) : null}
                  <LeaderboardPill>{pitches.length} tracked pitches</LeaderboardPill>
                  {selected ? (
                    <LeaderboardPill tone="neutral">
                      Pitch #{selected.pitch_number} • {pitchDisplayName(selected.pitch_type)}
                    </LeaderboardPill>
                  ) : null}
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[34rem]">
                {player.outings.length > 1 ? (
                  <OutingSelect
                    playerId={player.id}
                    outings={player.outings}
                    selectedOutingId={outing.id}
                    labelOverrides={labelOverridesMap}
                  />
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {profileHref ? (
                    <HeaderActionLink href={profileHref} label="Player Profile" />
                  ) : null}
                  <HeaderActionLink href={trackmanHref} label="Trackman Session" />
                  <HeaderActionLink
                    href={`/player/${player.id}/report?scope=outing&outingId=${outing.id}${profileContextQuery}`}
                    label="Print Outing"
                  />
                  <HeaderActionLink
                    href={`/player/${player.id}/report?scope=overall${profileContextQuery}`}
                    label="Season Report"
                  />
                  {player.outings.length >= 1 ? (
                    <HeaderActionLink href={compareHref} label="Compare Outings" emphasis />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-4 px-4 py-4 sm:px-6 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-4 xl:sticky xl:top-4">
          <SidebarPanel
            title="Filters"
            detail="Choose pitch types and a max miss."
          >
            <FilterPanel
              pitches={pitches}
              filters={filters}
              onChange={setFilters}
            />
          </SidebarPanel>

          {hasEdits ? (
            <div className="rounded-[1.5rem] border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  {editedPitches.size} edited
                </span>
                <button
                  type="button"
                  onClick={handleResetEdits}
                  className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400 transition-all duration-300 hover:text-zinc-200"
                >
                  Reset
                </button>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-zinc-950/75 shadow-[0_18px_48px_rgba(0,0,0,0.24)]">
            <div className="border-b border-zinc-800/70 px-4 py-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Pitch Log
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Pick any pitch to update the video and miss shape.
              </div>
            </div>
            <PitchTable
              pitches={activeLane ? laneFiltered : filtered}
              selected={selected}
              onSelect={setSelected}
              pitcherHand={pitcherHand}
              editedPitches={editedPitches}
              onEditPitchType={handleEditPitchType}
              pitchTypeOptions={pitchTypeOptions}
            />
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[0_20px_56px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Video + Miss Shape
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Review the selected pitch, then switch between scatter and heatmap in the same outing.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {(["scatter", "heatmap"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant="ghost"
                    neon
                    tone="orange"
                    onClick={() => setVizMode(mode)}
                    className={`${leaderboardFilterButtonBaseClassName} min-w-[5rem] ${
                      vizMode === mode
                        ? leaderboardFilterButtonOrangeActiveClassName
                        : leaderboardFilterButtonGhostInactiveClassName
                    }`}
                  >
                    {mode === "scatter" ? "Scatter" : "Heatmap"}
                  </Button>
                ))}

                {vizMode === "heatmap" && heatmapPitchTypes.length > 2 ? (
                  <div className="ml-1 flex flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                    {heatmapPitchTypes.map((pitchType) => (
                      <Button
                        key={pitchType}
                        type="button"
                        size="sm"
                        variant="ghost"
                        neon
                        tone="orange"
                        onClick={() => setHeatmapPitchType(pitchType)}
                        className={`${leaderboardFilterButtonBaseClassName} min-w-[4.75rem] ${
                          heatmapPitchType === pitchType
                            ? leaderboardFilterButtonOrangeActiveClassName
                            : leaderboardFilterButtonGhostInactiveClassName
                        }`}
                      >
                        {pitchType}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
              <VideoPlayer
                pitch={selected}
                overlayDir={outing.overlayDir}
                clipsDir={outing.clipsDir}
                pitcherHand={pitcherHand}
              />
              {vizMode === "scatter" ? (
                <StrikeZoneScatter
                  pitches={laneFiltered}
                  selected={selected}
                  onSelect={setSelected}
                  throwsHand={pitcherHand}
                />
              ) : (
                <MissHeatmap pitches={heatmapData} throwsHand={pitcherHand} />
              )}
            </div>
          </section>

          {outingMeta ? (
            <GameStatsSection meta={outingMeta} statsByGame={statsByGame} />
          ) : null}

          {laneFiltered.length > 0 ? (
            <CommandPlusSection pitches={laneFiltered} outingId={outing.id} />
          ) : null}

          {laneFiltered.length > 0 ? (
            <PitchTypeSummaryCards pitches={laneFiltered} />
          ) : null}

          {measurable.length > 0 ? (
            <LaneReport
              pitches={measurable}
              throwsHand={pitcherHand}
              activeLane={activeLane}
              onSelectLane={toggleLane}
            />
          ) : null}

        </main>
      </div>
    </div>
  );
}
