"use client";

import { useState, useEffect, useMemo } from "react";
import { Play } from "lucide-react";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonBlueActiveClassName,
  leaderboardFilterButtonBlueInactiveClassName,
} from "@/components/ui/neon-button";
import {
  findPitchComps,
  findArsenalComps,
  type MLBCompsData,
  type MLBCompResult,
  type ArsenalCompResult,
  type CompInput,
} from "@/lib/mlbComps";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";
import VideoClipsModal from "./VideoClipsModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return "—";
  return v.toFixed(decimals);
}

function compPitchLabel(pitch: MLBCompResult["pitch"]): string {
  if (pitch.pitchTypeName && pitch.pitchTypeName !== pitch.pitchType) {
    return `${pitch.pitchTypeName} (${pitch.pitchType})`;
  }
  return pitch.pitchTypeName ?? pitch.pitchType;
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
// Comp interpretation helpers
// ---------------------------------------------------------------------------

function describePerPitchComp(
  topComp: MLBCompResult,
): string[] {
  const parts: string[] = [];

  // IVB — vertical movement
  if (topComp.deltas.ivb !== null) {
    const d = topComp.deltas.ivb;
    if (Math.abs(d) < 1.5) {
      parts.push(`Similar vertical movement to ${topComp.pitcher.name}.`);
    } else if (d > 0) {
      parts.push(`More ride than ${topComp.pitcher.name} (+${d.toFixed(1)}″).`);
    } else {
      parts.push(`Less rise than ${topComp.pitcher.name} (${d.toFixed(1)}″).`);
    }
  }

  // HB — only note if meaningfully different
  if (topComp.deltas.hb !== null && Math.abs(topComp.deltas.hb) >= 1.5) {
    const d = topComp.deltas.hb;
    parts.push(
      d > 0
        ? `More horizontal break toward first (+${d.toFixed(1)}″ HB).`
        : `More horizontal break toward third (${d.toFixed(1)}″ HB).`,
    );
  }

  return parts;
}

function describeArsenalComp(
  arsenalSize: number,
  topComp: ArsenalCompResult,
): string[] {
  const parts: string[] = [];

  const n = topComp.matchedPitches;
  const pitchWord = n === 1 ? "pitch type" : "pitch types";
  if (topComp.avgDistance < 1.5) {
    parts.push(`Very close full-arsenal match across ${n} ${pitchWord}.`);
  } else if (topComp.avgDistance < 3.0) {
    parts.push(`Reasonable arsenal shape match across ${n} ${pitchWord}.`);
  } else {
    parts.push(`Loose shape match — ${n} ${pitchWord} overlapping.`);
  }

  // Closest individual pitch type
  if (topComp.pitchBreakdown.length > 0) {
    const closest = [...topComp.pitchBreakdown].sort((a, b) => a.distance - b.distance)[0];
    if (closest.distance < 1.5) {
      parts.push(`Closest individual match on the ${closest.pitchType}.`);
    }
  }

  return parts;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function WatchClipButton({
  onClick,
  title,
}: {
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-[30px] w-[96px] shrink-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-xl border border-zinc-700/70 bg-zinc-800/90 px-2.5 text-[11px] font-medium text-zinc-300 transition-smooth hover:border-zinc-600 hover:bg-zinc-700/90 hover:text-zinc-100"
      title={title}
    >
      <Play className="w-3 h-3 fill-current shrink-0" />
      Watch clip
    </button>
  );
}

function PitchCompCard({
  result,
  rank,
  onWatch,
}: {
  result: MLBCompResult;
  rank: number;
  onWatch?: () => void;
}) {
  const rankColors = ["text-yellow-400", "text-zinc-300", "text-amber-600"];
  const rankColor = rankColors[rank] ?? "text-zinc-500";
  const pitchLabel = compPitchLabel(result.pitch);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-zinc-800/60 last:border-0">
      <span className={`text-xs font-bold w-4 shrink-0 ${rankColor}`}>
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-200 truncate">
          {result.pitcher.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-medium text-zinc-400">
            {pitchLabel}
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-500">
            IVB {fmt(result.pitch.avgIvb)}&quot;
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-500">
            HB {fmt(result.pitch.avgHb)}&quot;
          </span>
          <span className="text-zinc-700">·</span>
          <span className="text-[10px] font-mono text-zinc-400">
            {fmt(result.pitch.avgVelo)} mph
          </span>
        </div>
      </div>
      <div className="flex items-center shrink-0 flex-nowrap">
        {onWatch && (
          <WatchClipButton
            onClick={onWatch}
            title={`Watch ${result.pitcher.name}'s ${pitchLabel} strike clip`}
          />
        )}
        <div className="text-right shrink-0 ml-8">
          <div className="text-[10px] uppercase tracking-wide text-zinc-600 mb-0.5">Δ shape</div>
          <div className="flex items-center gap-1.5">
            <DeltaBadge value={result.deltas.ivb} />
            <span className="text-zinc-700 text-[10px]">/</span>
            <DeltaBadge value={result.deltas.hb} />
          </div>
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
    <div className="flex items-center gap-3 py-3 border-b border-zinc-800/60 last:border-0">
      <span className={`text-xs font-bold w-4 shrink-0 ${rankColor}`}>
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0 text-sm font-medium text-zinc-200 truncate">
        {result.pitcher.name}
      </div>
      <div className="inline-flex shrink-0 min-w-[8.5rem] items-center justify-end gap-2 rounded-xl border border-blue-500/20 bg-blue-500/[0.08] px-3 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <span className="text-sm font-mono font-semibold text-blue-200">
          {result.avgDistance.toFixed(2)}
        </span>
        <span className="whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-300/70">
          Arsenal Delta
        </span>
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
  const [activeClip, setActiveClip] = useState<{
    pitcherId: string;
    pitcherName: string;
    pitchType: string;
    pitchTypeCode?: string | null;
    pitchLabel?: string | null;
  } | null>(null);

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
    return findArsenalComps(arsenal, hand, mlbData.pitchers, 8, 2);
  }, [mlbData, arsenal, hand]);

  // Active pitch defaults to first available
  const pitchKeys = Array.from(perPitchComps.keys());
  const currentPitch = activePitch ?? pitchKeys[0] ?? null;

  if (!hand) return null;
  if (arsenal.length === 0) return null;

  return (
    <div className="rounded-[1.35rem] border border-zinc-800/90 bg-[radial-gradient(circle_at_84%_14%,rgba(59,130,246,0.08),transparent_22%),linear-gradient(180deg,rgba(24,24,27,0.78),rgba(9,9,11,0.94))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">MLB Shape Comps</h3>
          {mlbData && (
            <p className="text-[10px] text-zinc-500 mt-0.5">
              {mlbData.year} · {mlbData.pitchers.length} MLB pitchers · matched by IVB &amp; HB
            </p>
          )}
        </div>
        {/* Mode toggle */}
        <div className="flex items-center gap-1 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-1">
          {(["per-pitch", "arsenal"] as const).map((m) => (
            <Button
              key={m}
              onClick={() => setMode(m)}
              variant="default"
              tone="blue"
              className={`${leaderboardFilterButtonBaseClassName} ${
                mode === m
                  ? leaderboardFilterButtonBlueActiveClassName
                  : leaderboardFilterButtonBlueInactiveClassName
              }`}
              aria-pressed={mode === m}
            >
              {m === "per-pitch" ? "Per Pitch" : "Arsenal"}
            </Button>
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
                <div className="flex flex-wrap gap-2">
                  {pitchKeys.map((pt) => {
                    const isActive = pt === currentPitch;
                    return (
                      <button
                        key={pt}
                        onClick={() => setActivePitch(pt)}
                        className={`rounded-full transition-smooth ${
                          isActive ? "opacity-100" : "opacity-40 hover:opacity-80"
                        }`}
                        aria-pressed={isActive}
                      >
                        <PitchTypeChip pitchType={pt} label={pt} size="xs" variant="solid" />
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
                      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                          <PitchTypeChip
                            pitchType={currentPitch}
                            label={`Your ${currentPitch}`}
                            size="xs"
                            variant="solid"
                          />
                        </div>
                        <span className="text-[11px] font-mono text-zinc-400">
                          IVB {fmt(input.ivb)}&quot;
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">
                          HB {fmt(input.hb)}&quot;
                        </span>
                        <span className="text-[11px] font-mono text-zinc-600">
                          {fmt(input.velo)} mph
                        </span>
                      </div>
                    )}

                    {/* Per-pitch comp interpretation */}
                    {input && comps.length > 0 && (() => {
                      const lines = describePerPitchComp(comps[0]);
                      if (lines.length === 0) return null;
                      return (
                        <div className="mb-3 rounded-[1.1rem] border border-zinc-800/50 bg-zinc-950/40 px-4 py-3">
                          <ul className="space-y-1">
                            {lines.map((l) => (
                              <li key={l} className="text-[12px] leading-relaxed text-zinc-400">{l}</li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Legend */}
                    <div className="flex justify-end mb-1">
                      <span className="text-[9px] uppercase tracking-wider text-zinc-600">
                        Δ ivb / Δ hb
                      </span>
                    </div>

                    {comps.map((comp, i) => (
                      <PitchCompCard
                        key={comp.pitcher.id}
                        result={comp}
                        rank={i}
                        onWatch={() =>
                          setActiveClip({
                            pitcherId: comp.pitcher.id,
                            pitcherName: comp.pitcher.name,
                            pitchType: comp.pitch.pitchType,
                            pitchTypeCode: comp.pitch.pitchTypeCode ?? null,
                            pitchLabel: compPitchLabel(comp.pitch),
                          })
                        }
                      />
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
              {/* Arsenal comp interpretation */}
              {arsenalComps.length > 0 && (() => {
                const lines = describeArsenalComp(arsenal.length, arsenalComps[0]);
                if (lines.length === 0) return null;
                return (
                  <div className="mb-3 rounded-[1.1rem] border border-zinc-800/50 bg-zinc-950/40 px-4 py-3">
                    <ul className="space-y-1">
                      {lines.map((l) => (
                        <li key={l} className="text-[12px] leading-relaxed text-zinc-400">{l}</li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
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

      {/* Video clips modal */}
      {activeClip && (
        <VideoClipsModal
          pitcherId={activeClip.pitcherId}
          pitcherName={activeClip.pitcherName}
          pitchType={activeClip.pitchType}
          pitchTypeCode={activeClip.pitchTypeCode}
          pitchLabel={activeClip.pitchLabel}
          year={mlbData?.year}
          onClose={() => setActiveClip(null)}
        />
      )}
    </div>
  );
}
