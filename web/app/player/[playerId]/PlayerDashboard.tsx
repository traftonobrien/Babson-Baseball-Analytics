"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
// Legacy: MLB averages bar hidden for now — re-enable by uncommenting
// import MLBAveragesBar from "../../components/MLBAveragesBar";
import MissHeatmap from "../../components/MissHeatmap";
import LogoutButton from "../../components/LogoutButton";
import OutingSelect from "./OutingSelect";
import GameStatsSection from "@/lib/stats/GameStatsSection";
import { MechanicsProfileSection } from "@/app/components/mechanics/MechanicsProfileSection";
import {
  loadOutingMeta,
  loadPlayerGameStats,
  loadPlayerSlugIndex,
  type OutingMeta,
  type PlayerGameStats,
} from "@/lib/stats";

type VizMode = "scatter" | "heatmap";

const EMPTY_FILTERS: Filters = {
  pitchTypes: new Set(),
  quadrants: new Set(),
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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PlayerDashboard({
  player,
  outing,
  backTo,
}: {
  player: Player;
  outing: Outing;
  backTo?: string;
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
      const slugIndex = await loadPlayerSlugIndex();
      const slug = slugIndex?.[outingPlayerId];
      const initialMap: Record<string, PlayerGameStats | null> = {};
      for (const game of meta.linkedGames) {
        initialMap[game.gameId] = null;
      }
      if (!slug) {
        setStatsByGame(initialMap);
        return;
      }
      const entries = await Promise.all(
        meta.linkedGames.map(async (game) => [
          game.gameId,
          await loadPlayerGameStats(slug, game.season, game.gameId),
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
  const laneFiltered = activeLane
    ? filtered.filter((p) => laneOf(p, pitcherHand) === (activeLane as string))
    : filtered;

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
        Loading pitch data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-red-400">
        Error: {error}
      </div>
    );
  }

  const hasEdits = editedPitches.size > 0;

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          {backTo ? (
            <a href={backTo} className="text-sm font-semibold tracking-wide hover:text-zinc-300">
              &larr; Profile
            </a>
          ) : (
            <a href="/" className="text-sm font-semibold tracking-wide hover:text-zinc-300">
              Pitch Tracker
            </a>
          )}
          <span className="text-xs text-zinc-400">
            {player.name} &middot; {outing.label}
          </span>
          {player.outings.length > 1 && (
            <OutingSelect
              playerId={player.id}
              outings={player.outings}
              selectedOutingId={outing.id}
            />
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/trackman/session/${player.id}/${outing.id.split("/")[1] ?? ""}`}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-smooth"
          >
            Trackman
          </a>
          <a
            href={`/player/${player.id}/report?scope=outing&outingId=${outing.id}`}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-smooth"
          >
            Outing Report
          </a>
          <a
            href={`/player/${player.id}/report?scope=overall`}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-smooth"
          >
            Overall Report
          </a>
          {player.outings.length >= 1 && (
            <a
              href={
                player.outings.length >= 2
                  ? `/player/${player.id}/compare?outingA=${outing.id}&outingB=${player.outings.find((o) => o.id !== outing.id)?.id ?? player.outings[1].id}`
                  : `/player/${player.id}/compare?outingA=${outing.id}`
              }
              className="text-xs font-medium text-orange-400 hover:text-orange-300 transition-smooth"
            >
              Compare
            </a>
          )}
          <span className="text-xs text-zinc-500">
            {laneFiltered.length} / {pitches.length} pitches
          </span>
          <LogoutButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950">
          <div className="p-3 border-b border-zinc-800">
            <FilterPanel
              pitches={pitches}
              filters={filters}
              onChange={setFilters}
            />
          </div>
          {/* Reset edits button */}
          {hasEdits && (
            <div className="px-3 py-1.5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-[10px] text-amber-400">
                {editedPitches.size} pitch type{editedPitches.size !== 1 ? "s" : ""} edited
              </span>
              <button
                type="button"
                onClick={handleResetEdits}
                className="text-[10px] text-zinc-400 hover:text-zinc-200 underline transition-smooth"
              >
                Reset edits
              </button>
            </div>
          )}
          <PitchTable
            pitches={laneFiltered}
            selected={selected}
            onSelect={setSelected}
            pitcherHand={pitcherHand}
            editedPitches={editedPitches}
            onEditPitchType={handleEditPitchType}
            pitchTypeOptions={pitchTypeOptions}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {/* Video + Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VideoPlayer
              pitch={selected}
              overlayDir={outing.overlayDir}
              clipsDir={outing.clipsDir}
              pitcherHand={pitcherHand}
            />
            <div>
              {/* Viz toggle + heatmap pitch type selector */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <div className="flex gap-1">
                  {(["scatter", "heatmap"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVizMode(mode)}
                      className={[
                        "px-3 py-1 text-xs rounded-md capitalize transition-smooth",
                        vizMode === mode
                          ? "bg-zinc-700 text-zinc-100"
                          : "bg-zinc-900 text-zinc-500 hover:text-zinc-300",
                      ].join(" ")}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                {vizMode === "heatmap" && heatmapPitchTypes.length > 2 && (
                  <div className="flex gap-1 ml-2 border-l border-zinc-800 pl-2">
                    {heatmapPitchTypes.map((pt) => (
                      <button
                        key={pt}
                        type="button"
                        onClick={() => setHeatmapPitchType(pt)}
                        className={[
                          "px-2 py-0.5 text-xs rounded transition-smooth",
                          heatmapPitchType === pt
                            ? "bg-zinc-600 text-zinc-100"
                            : "bg-zinc-900 text-zinc-500 hover:text-zinc-300",
                        ].join(" ")}
                      >
                        {pt}
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          </div>

          {/* Game stats (linked boxscore) */}
          {outingMeta && (
            <GameStatsSection meta={outingMeta} statsByGame={statsByGame} />
          )}

          {/* Legacy: MLB averages bar — uncomment to re-enable */}
          {/* <MLBAveragesBar /> */}

          {/* Command+ */}
          {laneFiltered.length > 0 && (
            <CommandPlusSection pitches={laneFiltered} outingId={outing.id} />
          )}

          {/* Per-pitch-type summary */}
          {laneFiltered.length > 0 && (
            <PitchTypeSummaryCards pitches={laneFiltered} />
          )}

          {/* Lane Report — receives un-lane-filtered list so counts don't disappear */}
          {filtered.length > 0 && (
            <LaneReport
              pitches={filtered}
              throwsHand={pitcherHand}
              activeLane={activeLane}
              onSelectLane={toggleLane}
            />
          )}

          {/* Mechanics Analysis */}
          <MechanicsProfileSection playerId={player.id} />
        </main>
      </div>
    </div>
  );
}
