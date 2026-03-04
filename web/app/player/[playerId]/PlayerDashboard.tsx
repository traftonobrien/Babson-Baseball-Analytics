"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { usePitchData } from "../../hooks/usePitchData";
import { applyFilters } from "../../utils";
import type { Pitch, Filters } from "../../types";
import type { Lane } from "@/lib/handedness";
import type { Player, Outing } from "@/lib/dataIndex";
import { laneOf, ON_TARGET_THRESHOLD_IN } from "@/lib/reportModel";
import FilterPanel from "../../components/FilterPanel";
import PitchTable from "../../components/PitchTable";
import VideoPlayer from "../../components/VideoPlayer";
import StrikeZoneScatter from "../../components/StrikeZoneScatter";
import LaneReport from "../../components/LaneReport";
import PitchTypeSummaryCards from "../../components/PitchTypeSummaryCards";
import CommandPlusSection from "../../components/CommandPlusSection";
import MissHeatmap from "../../components/MissHeatmap";
import LogoutButton from "../../components/LogoutButton";
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
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
  leaderboardFilterButtonOrangeActiveClassName,
} from "@/components/ui/neon-button";
import {
  LeaderboardPill,
  LeaderboardStatBlock,
} from "@/app/components/leaderboards/LeaderboardChrome";

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

function formatSnapshotNumber(value: number | null, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return "--";
  return value.toFixed(decimals);
}

function laneLabel(lane: Lane | null): string {
  if (!lane) return "all lanes";
  if (lane === "Glove") return "glove-side lane";
  if (lane === "Arm") return "arm-side lane";
  return "middle lane";
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

  // Load overrides from localStorage on mount / outing change
  useEffect(() => {
    setOverrides(loadOverrides(outing.id));
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
    return Array.from(types).sort();
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
    return ["All", ...Array.from(types).sort()];
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

  const outingSnapshot = useMemo(() => {
    if (laneFiltered.length === 0) {
      return {
        avgMiss: null,
        onTargetPct: null,
        bestPitchName: "--",
        bestPitchAvgMiss: null,
        worstPitchName: "--",
        worstPitchAvgMiss: null,
      };
    }

    const avgMiss =
      laneFiltered.reduce((sum, pitch) => sum + pitch.total_miss_inches, 0) /
      laneFiltered.length;
    const onTargetPct =
      (laneFiltered.filter((pitch) => pitch.total_miss_inches <= ON_TARGET_THRESHOLD_IN).length /
        laneFiltered.length) *
      100;

    const byPitchType = new Map<
      string,
      { totalMiss: number; count: number }
    >();
    for (const pitch of laneFiltered) {
      const key = pitch.pitch_type || "UNK";
      const current = byPitchType.get(key) ?? { totalMiss: 0, count: 0 };
      current.totalMiss += pitch.total_miss_inches;
      current.count += 1;
      byPitchType.set(key, current);
    }

    const rankedPitches = Array.from(byPitchType.entries())
      .map(([pitchType, stats]) => ({
        pitchType,
        avgMiss: stats.totalMiss / stats.count,
        count: stats.count,
      }))
      .sort((a, b) => {
        if (a.avgMiss !== b.avgMiss) return a.avgMiss - b.avgMiss;
        return b.count - a.count;
      });

    const best = rankedPitches[0] ?? null;
    const worst = rankedPitches[rankedPitches.length - 1] ?? null;

    return {
      avgMiss,
      onTargetPct,
      bestPitchName: best ? pitchDisplayName(best.pitchType) : "--",
      bestPitchAvgMiss: best?.avgMiss ?? null,
      worstPitchName: worst ? pitchDisplayName(worst.pitchType) : "--",
      worstPitchAvgMiss: worst?.avgMiss ?? null,
    };
  }, [laneFiltered]);

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
                <LogoutButton className="rounded-full border border-zinc-800 bg-zinc-950/75 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 hover:border-zinc-700 hover:text-zinc-200" />
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-300">
                  {player.name}
                </div>
                <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50 sm:text-4xl">
                  {outing.label}
                </h1>
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
            detail="Filter by pitch type and miss distance."
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
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Outing Snapshot
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Fast read of the current filtered view before you drill into video and miss shape.
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <LeaderboardPill tone="orange">
                  {laneLabel(activeLane)}
                </LeaderboardPill>
                <LeaderboardPill tone="neutral">
                  {laneFiltered.length} pitch{laneFiltered.length === 1 ? "" : "es"} in view
                </LeaderboardPill>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <LeaderboardStatBlock
                label="Avg Miss"
                value={
                  outingSnapshot.avgMiss == null
                    ? "--"
                    : `${formatSnapshotNumber(outingSnapshot.avgMiss)}"`
                }
                detail="average distance from target"
              />
              <LeaderboardStatBlock
                label="On Target"
                value={
                  outingSnapshot.onTargetPct == null
                    ? "--"
                    : `${outingSnapshot.onTargetPct.toFixed(0)}%`
                }
                detail={`within ${ON_TARGET_THRESHOLD_IN}" of target`}
                emphasisClassName="text-orange-300"
              />
              <LeaderboardStatBlock
                label="Best Pitch"
                value={outingSnapshot.bestPitchName}
                detail={
                  outingSnapshot.bestPitchAvgMiss == null
                    ? "no tracked miss data"
                    : `${formatSnapshotNumber(outingSnapshot.bestPitchAvgMiss)}" avg miss`
                }
              />
              <LeaderboardStatBlock
                label="Needs Work"
                value={outingSnapshot.worstPitchName}
                detail={
                  outingSnapshot.worstPitchAvgMiss == null
                    ? "no tracked miss data"
                    : `${formatSnapshotNumber(outingSnapshot.worstPitchAvgMiss)}" avg miss`
                }
              />
            </div>
          </section>

          <section className="rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[0_20px_56px_rgba(0,0,0,0.24)]">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Video + Miss Shape
                </div>
                <div className="mt-1 text-sm text-zinc-400">
                  Review the selected pitch, then switch between scatter and heatmap without leaving the outing.
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

          {outingMeta ? (
            <GameStatsSection meta={outingMeta} statsByGame={statsByGame} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
