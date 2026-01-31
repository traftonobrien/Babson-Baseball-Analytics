"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { getPlayer } from "@/lib/dataIndex";
import { usePitchData } from "../../hooks/usePitchData";
import { applyFilters } from "../../utils";
import type { Pitch, Filters } from "../../types";
import FilterPanel from "../../components/FilterPanel";
import PitchTable from "../../components/PitchTable";
import VideoPlayer from "../../components/VideoPlayer";
import StrikeZoneScatter from "../../components/StrikeZoneScatter";
import LaneReport from "../../components/LaneReport";
import PitchTypeSummaryCards from "../../components/PitchTypeSummaryCards";
import MLBAveragesBar from "../../components/MLBAveragesBar";

const EMPTY_FILTERS: Filters = {
  pitchTypes: new Set(),
  quadrants: new Set(),
  maxMiss: null,
};

export default function PlayerDashboard() {
  const { playerId } = useParams<{ playerId: string }>();
  const player = getPlayer(playerId);
  const outing = player?.outings[0];

  const { pitches, loading, error } = usePitchData(outing?.csvPath ?? "");
  const [selected, setSelected] = useState<Pitch | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  if (!player || !outing) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-red-400">
        Player not found
      </div>
    );
  }

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

  const filtered = applyFilters(pitches, filters);

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <a href="/" className="text-sm font-semibold tracking-wide hover:text-zinc-300">
            Pitch Tracker
          </a>
          <span className="text-xs text-zinc-400">
            {player.name} &middot; {outing.label}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {filtered.length} / {pitches.length} pitches
        </span>
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
          <PitchTable
            pitches={filtered}
            selected={selected}
            onSelect={setSelected}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
          {/* Video + Scatter */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <VideoPlayer
              pitch={selected}
              overlayDir={outing.overlayDir}
              clipsDir={outing.clipsDir}
            />
            <StrikeZoneScatter
              pitches={filtered}
              selected={selected}
              onSelect={setSelected}
            />
          </div>

          {/* MLB averages bar */}
          <MLBAveragesBar />

          {/* Per-pitch-type summary */}
          {filtered.length > 0 && (
            <PitchTypeSummaryCards pitches={filtered} />
          )}

          {/* Lane Report */}
          {filtered.length > 0 && <LaneReport pitches={filtered} />}
        </main>
      </div>
    </div>
  );
}
