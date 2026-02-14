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
import VeloByPitch from "./VeloByPitch";
import SpinByPitch from "./SpinByPitch";
import TrackmanPitchTable from "./TrackmanPitchTable";
import PitchTypeFilter from "./PitchTypeFilter";

interface RawPayload {
  meta?: Record<string, unknown>;
  pitches?: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
}

/** Try multiple paths to find the session data. */
async function fetchSessionData(playerId: string, date: string): Promise<RawPayload> {
  // Candidate paths: legacy canonical, PDF pipeline (with various session slugs)
  const candidates = [
    `/data/${playerId}/${date}/trackman/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/session/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/live_ab/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/bullpen/pitches.json`,
  ];

  // Also try looking up the index to find the exact path
  try {
    const indexRes = await fetch("/trackman/index.json");
    if (indexRes.ok) {
      const index = await indexRes.json();
      if (Array.isArray(index)) {
        const match = index.find(
          (e: Record<string, unknown>) =>
            ((e.playerSlug as string) === playerId || (e.playerId as string) === playerId) &&
            ((e.date as string) === date ||
              (e.date as string)?.replace(/-/g, "_") === date ||
              date.replace(/_/g, "-") === (e.date as string)),
        );
        if (match?.pitchesPath) {
          candidates.unshift(match.pitchesPath as string);
        }
      }
    }
  } catch {
    // Index lookup failed, continue with candidates
  }

  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      continue;
    }
  }

  throw new Error(`No session data found for ${playerId}/${date}. Tried ${candidates.length} paths.`);
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchSessionData(playerId, date)
      .then((data) => {
        if (!active) return;
        // Handle both array (PDF pipeline) and object (legacy) formats
        let rawRows: Record<string, unknown>[];
        if (Array.isArray(data)) {
          rawRows = data;
        } else {
          rawRows = data.pitches ?? data.rows ?? [];
          setMeta(data.meta ?? null);
        }
        const normalized = rawRows.map((row, i) => normalizePitch(row, i));
        setPitches(normalized);
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
  }, [playerId, date]);

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

        {/* Charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Movement profile */}
          <MovementScatter pitches={filtered} />

          {/* Velo by pitch number */}
          <VeloByPitch pitches={filtered} />
        </div>

        {/* Spin by pitch number */}
        <SpinByPitch pitches={filtered} />

        {/* Pitch table */}
        <TrackmanPitchTable pitches={filtered} />
      </div>
    </div>
  );
}
