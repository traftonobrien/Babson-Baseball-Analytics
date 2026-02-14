"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  normalizePitch,
  normalizePitchTypeRow,
  normalizeSessionSummary,
  uniquePitchTypes,
  type TrackmanPitch,
  type TrackmanPitchTypeSummary,
  type TrackmanSessionSummary,
} from "@/lib/trackman/metrics";
import KpiCards from "./KpiCards";
import MovementScatter from "./MovementScatter";
import VeloByPitch from "./VeloByPitch";
import SpinByPitch from "./SpinByPitch";
import TrackmanPitchTable from "./TrackmanPitchTable";
import PitchTypeFilter from "./PitchTypeFilter";
import PitchTypeTable from "./PitchTypeTable";
import MovementScatterByType from "./MovementScatterByType";
import VeloByTypeBar from "./VeloByTypeBar";
import SpinByTypeBar from "./SpinByTypeBar";

interface PitchPayload {
  format: "pitch";
  meta?: Record<string, unknown> | null;
  rows: Record<string, unknown>[];
}

interface AggregatePayload {
  format: "aggregate";
  meta?: Record<string, unknown> | null;
  pitchTypes: Record<string, unknown>[];
  summary?: Record<string, unknown> | null;
}

type SessionPayload = PitchPayload | AggregatePayload;

async function fetchJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function formatDateLabel(raw: string): string {
  if (raw.includes("__")) {
    const [start, end] = raw.split("__");
    const startLabel = start.replace(/_/g, "/").replace(/-/g, "/");
    const endLabel = end.replace(/_/g, "/").replace(/-/g, "/");
    return `${startLabel} \u2014 ${endLabel}`;
  }
  return raw.replace(/_/g, "/").replace(/-/g, "/");
}

/** Try multiple paths to find the session data. */
async function fetchSessionData(playerId: string, date: string): Promise<SessionPayload> {
  // Candidate paths: legacy canonical, PDF pipeline (with various session slugs)
  const pitchCandidates = [
    `/data/${playerId}/${date}/trackman/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/session/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/live_ab/pitches.json`,
    `/trackman/sessions/${playerId}/${date}/bullpen/pitches.json`,
  ];
  const aggregateCandidates = [
    `/trackman/sessions/${playerId}/${date}/session/pitch_types.json`,
    `/trackman/sessions/${playerId}/${date}/live_ab/pitch_types.json`,
    `/trackman/sessions/${playerId}/${date}/bullpen/pitch_types.json`,
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
          const raw = await fetchJson(match.pitchesPath as string);
          if (raw) {
            if (Array.isArray(raw)) {
              return { format: "pitch", rows: raw, meta: null };
            }
            const rows = (raw as Record<string, unknown>).pitches ?? (raw as Record<string, unknown>).rows ?? [];
            if (Array.isArray(rows)) {
              return { format: "pitch", rows, meta: asRecord((raw as Record<string, unknown>).meta) };
            }
          }
        }
        if (match?.pitchTypesPath) {
          const raw = await fetchJson(match.pitchTypesPath as string);
          if (raw) {
            const rows = Array.isArray(raw)
              ? raw
              : (raw as Record<string, unknown>).pitch_types ?? (raw as Record<string, unknown>).rows ?? [];
            if (Array.isArray(rows)) {
              const summary = match.summaryPath ? await fetchJson(match.summaryPath as string) : null;
              const meta = match.metaPath ? await fetchJson(match.metaPath as string) : null;
              return {
                format: "aggregate",
                pitchTypes: rows,
                summary: asRecord(summary),
                meta: asRecord(meta),
              };
            }
          }
        }
      }
    }
  } catch {
    // Index lookup failed, continue with candidates
  }

  for (const path of pitchCandidates) {
    const raw = await fetchJson(path);
    if (!raw) continue;
    if (Array.isArray(raw)) {
      return { format: "pitch", rows: raw, meta: null };
    }
    const rows = (raw as Record<string, unknown>).pitches ?? (raw as Record<string, unknown>).rows ?? [];
    if (Array.isArray(rows)) {
      return { format: "pitch", rows, meta: asRecord((raw as Record<string, unknown>).meta) };
    }
  }

  for (const path of aggregateCandidates) {
    const raw = await fetchJson(path);
    if (!raw) continue;
    const rows = Array.isArray(raw)
      ? raw
      : (raw as Record<string, unknown>).pitch_types ?? (raw as Record<string, unknown>).rows ?? [];
    if (Array.isArray(rows)) {
      const base = path.replace(/pitch_types\.json$/, "");
      const summary = await fetchJson(`${base}session_summary.json`);
      const meta = await fetchJson(`${base}meta.json`);
      return {
        format: "aggregate",
        pitchTypes: rows,
        summary: asRecord(summary),
        meta: asRecord(meta),
      };
    }
  }

  throw new Error(`No session data found for ${playerId}/${date}. Tried ${pitchCandidates.length + aggregateCandidates.length} paths.`);
}

export default function TrackmanSessionView({
  playerId,
  date,
}: {
  playerId: string;
  date: string;
}) {
  const [pitches, setPitches] = useState<TrackmanPitch[]>([]);
  const [pitchTypes, setPitchTypes] = useState<TrackmanPitchTypeSummary[]>([]);
  const [summary, setSummary] = useState<TrackmanSessionSummary | null>(null);
  const [meta, setMeta] = useState<Record<string, unknown> | null>(null);
  const [viewMode, setViewMode] = useState<"pitch" | "aggregate" | null>(null);
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
        if (data.format === "pitch") {
          const normalized = data.rows.map((row, i) => normalizePitch(row, i));
          setPitches(normalized);
          setPitchTypes([]);
          setSummary(null);
          setMeta(data.meta ?? null);
          setViewMode("pitch");
        } else {
          const normalized = data.pitchTypes
            .filter((row) => (row as Record<string, unknown>)?.is_valid !== false)
            .map((row) => normalizePitchTypeRow(row));
          setPitchTypes(normalized);
          setSummary(normalizeSessionSummary(data.summary ?? null));
          setPitches([]);
          setMeta(data.meta ?? null);
          setViewMode("aggregate");
        }
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
  const allTypes = useMemo(() => {
    if (viewMode === "aggregate") {
      return Array.from(new Set(pitchTypes.map((p) => p.pitchType))).sort();
    }
    return uniquePitchTypes(pitches);
  }, [pitches, pitchTypes, viewMode]);

  // Filtered pitches
  const filtered = useMemo(() => {
    if (viewMode === "aggregate") {
      let result = pitchTypes;
      if (activePitchTypes.size > 0) {
        result = result.filter((p) => activePitchTypes.has(p.pitchType));
      }
      if (veloMin !== null) {
        result = result.filter((p) => p.avgVelo !== null && p.avgVelo >= veloMin);
      }
      if (veloMax !== null) {
        result = result.filter((p) => p.avgVelo !== null && p.avgVelo <= veloMax);
      }
      return result;
    }
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
  }, [pitches, pitchTypes, activePitchTypes, veloMin, veloMax, viewMode]);

  // Header info
  const playerName =
    (meta?.player as string) ??
    (meta?.player_name as string) ??
    (meta?.playerName as string) ??
    playerId;
  const dateLabel = formatDateLabel(date);
  const filteredPitches = viewMode === "pitch" ? (filtered as TrackmanPitch[]) : [];
  const filteredPitchTypes =
    viewMode === "aggregate" ? (filtered as TrackmanPitchTypeSummary[]) : [];
  const countsMissing =
    viewMode === "aggregate" && (!summary?.totalPitches || !summary?.pitchMixPct);

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

  if (viewMode === "pitch" && pitches.length === 0) {
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

  if (viewMode === "aggregate" && pitchTypes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-zinc-400 gap-4">
        <p>No pitch type data found in session.</p>
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

        {countsMissing && (
          <div className="text-xs text-zinc-500">
            Pitch counts not provided in this PDF export.
          </div>
        )}

        {viewMode === "pitch" ? (
          <>
            {/* Per pitch type averages */}
            <KpiCards pitches={filteredPitches} />

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Movement profile */}
              <MovementScatter pitches={filteredPitches} />

              {/* Velo by pitch number */}
              <VeloByPitch pitches={filteredPitches} />
            </div>

            {/* Spin by pitch number */}
            <SpinByPitch pitches={filteredPitches} />

            {/* Pitch table */}
            <TrackmanPitchTable pitches={filteredPitches} />
          </>
        ) : (
          <>
            <PitchTypeTable pitchTypes={filteredPitchTypes} summary={summary} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MovementScatterByType pitchTypes={filteredPitchTypes} />
              <VeloByTypeBar pitchTypes={filteredPitchTypes} />
            </div>
            <SpinByTypeBar pitchTypes={filteredPitchTypes} />
          </>
        )}
      </div>
    </div>
  );
}
