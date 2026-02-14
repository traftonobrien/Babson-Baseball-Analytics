"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  normalizePitch,
  uniquePitchTypes,
  type TrackmanPitch,
} from "@/lib/trackman/metrics";
import KpiCards from "./KpiCards";
import MovementScatter from "./MovementScatter";
import TrackmanPitchTable from "./TrackmanPitchTable";
import PitchTypeFilter from "./PitchTypeFilter";

interface RawPayload {
  meta?: Record<string, unknown>;
  pitches?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
}

export default function TrackmanSessionView({
  playerId,
  date,
}: {
  playerId: string;
  date: string;
}) {
  const [pitches, setPitches] = useState<TrackmanPitch[]>([]);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activePitchTypes, setActivePitchTypes] = useState<Set<string>>(new Set());
  const [veloMin, setVeloMin] = useState<number | null>(null);
  const [veloMax, setVeloMax] = useState<number | null>(null);

  const dataPath = `/data/${playerId}/${date}/trackman/pitches.json`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch(dataPath)
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? `No data found. Expected file at ${dataPath}`
              : `Failed to load: ${res.status}`,
          );
        }
        return res.json() as Promise<RawPayload>;
      })
      .then((data) => {
        if (!active) return;
        const rawRows = data.pitches ?? data.rows ?? [];
        const normalized = rawRows.map((row, i) => normalizePitch(row, i));
        setPitches(normalized);
        setMeta(data.meta ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dataPath]);

  // All pitch types
  const allTypes = useMemo(() => uniquePitchTypes(pitches), [pitches]);

  // Filtered pitches
  const filtered = useMemo(() => {
    let result = pitches;
    if (activePitchTypes.size > 0) {
      result = result.filter((p) => activePitchTypes.has(p.pitchType));
    }
    if (veloMin !== null) {
      result = result.filter((p) => p.mph !== null && p.mph >= veloMin);
    }
    if (veloMax !== null) {
      result = result.filter((p) => p.mph !== null && p.mph <= veloMax);
    }
    return result;
  }, [pitches, activePitchTypes, veloMin, veloMax]);

  // Header info
  const playerName = (meta?.player as string) ?? playerId;
  const dateLabel = date.replace(/_/g, "/");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-400">
        Loading Trackman data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-4">
        <p className="text-red-400">{error}</p>
        <Link
          href="/trackman"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back to sessions
        </Link>
      </div>
    );
  }

  if (pitches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-4">
        <p>No pitches found in session data.</p>
        <Link
          href="/trackman"
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Back to sessions
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link
          href="/trackman"
          className="text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-sm font-semibold">{playerName}</h1>
          <p className="text-xs text-zinc-500">
            Trackman Session &middot; {dateLabel}
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <PitchTypeFilter
          allTypes={allTypes}
          activePitchTypes={activePitchTypes}
          onToggleType={(type) => {
            setActivePitchTypes((prev) => {
              const next = new Set(prev);
              if (next.has(type)) next.delete(type);
              else next.add(type);
              return next;
            });
          }}
          onClearTypes={() => setActivePitchTypes(new Set())}
          veloMin={veloMin}
          veloMax={veloMax}
          onVeloMinChange={setVeloMin}
          onVeloMaxChange={setVeloMax}
        />

        {/* Per pitch type averages */}
        <KpiCards pitches={filtered} />

        {/* Movement profile */}
        <MovementScatter pitches={filtered} />

        {/* Pitch table */}
        <TrackmanPitchTable pitches={filtered} />
      </div>
    </div>
  );
}
