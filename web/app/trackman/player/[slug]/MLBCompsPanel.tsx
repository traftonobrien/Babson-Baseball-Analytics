"use client";

import { useState, useEffect, useMemo } from "react";
import { pitchColor } from "@/lib/pitchColors";
import {
  findPitchComps,
  findArsenalComps,
  type MLBCompsData,
  type MLBCompResult,
  type ArsenalCompResult,
  type CompInput,
} from "@/lib/mlbComps";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-zinc-600 text-[10px]">—</span>;
  const isPos = value >= 0;
  const abs = Math.abs(value);
  const cls =
    abs < 1.5
      ? "text-emerald-400"
      : abs < 3
        ? "text-yellow-400"
        : "text-red-400";
  return (
    <span className={`text-[10px] font-mono ${cls}`}>
      {isPos ? `+${value.toFixed(1)}` : value.toFixed(1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PitchCompCard({
  result,
  rank,
}: {
  result: MLBCompResult;
  rank: number;
}) {
  const rankColors = ["text-yellow-400", "text-zinc-300", "text-amber-600"];
  const rankColor = rankColors[rank] ?? "text-zinc-500";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
      <span className={`text-xs font-bold w-4 shrink-0 ${rankColor}`}>
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-200 truncate">
          {result.pitcher.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-mono text-zinc-500">
            {fmt(result.pitch.avgVelo)} mph
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-500">
            IVB {fmt(result.pitch.avgIvb)}&quot;
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-500">
            HB {fmt(result.pitch.avgHb)}&quot;
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] uppercase tracking-wide text-zinc-600 mb-0.5">Δ</div>
        <div className="flex items-center gap-1.5">
          <DeltaBadge value={result.deltas.ivb} />
          <span className="text-zinc-700 text-[10px]">/</span>
          <DeltaBadge value={result.deltas.hb} />
        </div>
      </div>
    </div>
  );
}

function ArsenalCompCard({
  result,
  rank,
}: {
  result: ArsenalCompResult;
  rank: number;
}) {
  const rankColors = ["text-yellow-400", "text-zinc-300", "text-amber-600"];
  const rankColor = rankColors[rank] ?? "text-zinc-500";

  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
      <span className={`text-xs font-bold w-4 shrink-0 ${rankColor}`}>
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-200 truncate">
          {result.pitcher.name}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
          {result.pitchBreakdown.map((b) => (
            <span
              key={b.pitchType}
              className="text-[9px] font-mono text-zinc-500 bg-zinc-800/80 px-1 py-0.5 rounded"
            >
              {b.pitchType.slice(0, 3)} {b.distance.toFixed(1)}
            </span>
          ))}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] font-mono text-zinc-400">
          {result.avgDistance.toFixed(2)}
        </div>
        <div className="text-[9px] text-zinc-600">dist</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

type ViewMode = "per-pitch" | "arsenal";

export default function MLBCompsPanel({
  aggregated,
  hand,
}: {
  aggregated: TrackmanPitchTypeSummary[];
  hand: "R" | "L" | undefined;
}) {
  const [mlbData, setMlbData] = useState<MLBCompsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ViewMode>("per-pitch");
  const [activePitch, setActivePitch] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/mlb_pitch_comps.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`)))
      .then((data: MLBCompsData) => {
        setMlbData(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(String(err));
        setLoading(false);
      });
  }, []);

  // Build CompInput[] from aggregated pitch data
  const arsenal: CompInput[] = useMemo(
    () =>
      aggregated
        .filter((p) => p.pitchType !== "Other" && p.avgIvb != null && p.avgHb != null)
        .map((p) => ({
          pitchType: p.pitchType,
          ivb: p.avgIvb,
          hb: p.avgHb,
          velo: p.avgVelo,
        })),
    [aggregated],
  );

  // Per-pitch comps
  const perPitchComps: Map<string, MLBCompResult[]> = useMemo(() => {
    if (!mlbData || !hand) return new Map();
    const map = new Map<string, MLBCompResult[]>();
    for (const input of arsenal) {
      const comps = findPitchComps(input, hand, mlbData.pitchers, 5);
      if (comps.length > 0) map.set(input.pitchType, comps);
    }
    return map;
  }, [mlbData, arsenal, hand]);

  // Arsenal comps
  const arsenalComps: ArsenalCompResult[] = useMemo(() => {
    if (!mlbData || !hand || arsenal.length === 0) return [];
    return findArsenalComps(arsenal, hand, mlbData.pitchers, 8, 1);
  }, [mlbData, arsenal, hand]);

  // Active pitch defaults to first available
  const pitchKeys = Array.from(perPitchComps.keys());
  const currentPitch = activePitch ?? pitchKeys[0] ?? null;

  if (!hand) return null;
  if (arsenal.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">MLB Comps</h3>
          {mlbData && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {mlbData.year} · {mlbData.pitchers.length} MLB pitchers
            </p>
          )}
        </div>
        {/* Mode toggle */}
        <div className="flex bg-zinc-800 rounded-lg p-0.5 gap-0.5">
          {(["per-pitch", "arsenal"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                mode === m
                  ? "bg-zinc-600 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m === "per-pitch" ? "Per Pitch" : "Arsenal"}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-zinc-500 text-sm">Loading MLB data...</p>
      )}
      {error && (
        <p className="text-red-400 text-sm">Failed to load: {error}</p>
      )}

      {!loading && !error && mlbData && (
        <>
          {mode === "per-pitch" && (
            <div className="space-y-5">
              {/* Pitch type selector */}
              {pitchKeys.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {pitchKeys.map((pt) => {
                    const color = pitchColor(pt);
                    const isActive = pt === currentPitch;
                    return (
                      <button
                        key={pt}
                        onClick={() => setActivePitch(pt)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                          isActive
                            ? "border-transparent text-white"
                            : "border-zinc-700 text-zinc-400 hover:text-zinc-200 bg-transparent"
                        }`}
                        style={
                          isActive
                            ? { backgroundColor: color, borderColor: color }
                            : {}
                        }
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: isActive ? "rgba(255,255,255,0.7)" : color }}
                        />
                        {pt}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Comp list for selected pitch */}
              {currentPitch && perPitchComps.has(currentPitch) && (() => {
                const comps = perPitchComps.get(currentPitch)!;
                const input = arsenal.find((a) => a.pitchType === currentPitch);
                return (
                  <div>
                    {/* Babson pitcher's stats for context */}
                    {input && (
                      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-zinc-800">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: pitchColor(currentPitch) }}
                          />
                          <span className="text-xs font-medium text-zinc-300">
                            Your {currentPitch}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-zinc-500">
                          {fmt(input.velo)} mph
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          IVB {fmt(input.ivb)}&quot;
                        </span>
                        <span className="text-[11px] font-mono text-zinc-500">
                          HB {fmt(input.hb)}&quot;
                        </span>
                      </div>
                    )}

                    {/* Legend */}
                    <div className="flex justify-end mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                        Δ ivb / Δ hb
                      </span>
                    </div>

                    {comps.map((comp, i) => (
                      <PitchCompCard key={comp.pitcher.id} result={comp} rank={i} />
                    ))}
                  </div>
                );
              })()}

              {pitchKeys.length === 0 && (
                <p className="text-zinc-500 text-sm">
                  No {hand}HP pitchers found for this arsenal.
                </p>
              )}
            </div>
          )}

          {mode === "arsenal" && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-3">
                Closest full-arsenal matches across {arsenal.length} pitch{arsenal.length !== 1 ? "es" : ""}
              </p>
              {arsenalComps.length === 0 ? (
                <p className="text-zinc-500 text-sm">No matches found.</p>
              ) : (
                arsenalComps.map((comp, i) => (
                  <ArsenalCompCard key={comp.pitcher.id} result={comp} rank={i} />
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
