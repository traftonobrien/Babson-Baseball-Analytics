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
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

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
  if (value == null) return <span className="text-[10px] text-slate-400 dark:text-zinc-500">—</span>;
  const isPos = value >= 0;
  const abs = Math.abs(value);
  const cls =
    abs < 1.5
      ? "text-emerald-700"
      : abs < 3
        ? "text-amber-700"
        : "text-red-600";
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
  const isDark = useSiteAppearance() === "dark";
  return (
    <button
      onClick={onClick}
      className={
        isDark
          ? "flex h-[30px] w-[96px] shrink-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-xl border border-zinc-600 bg-zinc-900 px-2.5 text-[11px] font-medium text-zinc-300 transition-smooth hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100"
          : "flex h-[30px] w-[96px] shrink-0 items-center justify-start gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 dark:border-zinc-700 bg-surface px-2.5 text-[11px] font-medium text-slate-500 dark:text-zinc-400 transition-smooth hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-background hover:text-slate-900 dark:hover:text-zinc-50"
      }
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
  const isDark = useSiteAppearance() === "dark";
  const rankColors = ["text-amber-700", "text-slate-600", "text-amber-800"];
  const rankColor = rankColors[rank] ?? (isDark ? "text-zinc-500" : "text-slate-500 dark:text-zinc-400");
  const pitchLabel = compPitchLabel(result.pitch);

  return (
    <div
      className={
        isDark
          ? "flex items-center gap-3 border-b border-zinc-700/80 py-2.5 last:border-0"
          : "flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0"
      }
    >
      <span className={`text-xs font-bold w-4 shrink-0 ${rankColor}`}>
        {rank + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className={isDark ? "truncate text-sm font-medium text-zinc-100" : "truncate text-sm font-medium text-slate-900 dark:text-zinc-50"}>
          {result.pitcher.name}
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className={isDark ? "text-[10px] font-medium text-zinc-400" : "text-[10px] font-medium text-slate-500 dark:text-zinc-400"}>
            {pitchLabel}
          </span>
          <span className={isDark ? "text-zinc-600" : "text-slate-400 dark:text-zinc-500"}>·</span>
          <span className={isDark ? "text-[10px] font-mono text-zinc-400" : "text-[10px] font-mono text-slate-500 dark:text-zinc-400"}>
            IVB {fmt(result.pitch.avgIvb)}&quot;
          </span>
          <span className={isDark ? "text-zinc-600" : "text-slate-400 dark:text-zinc-500"}>·</span>
          <span className={isDark ? "text-[10px] font-mono text-zinc-400" : "text-[10px] font-mono text-slate-500 dark:text-zinc-400"}>
            HB {fmt(result.pitch.avgHb)}&quot;
          </span>
          <span className={isDark ? "text-zinc-600" : "text-slate-400 dark:text-zinc-500"}>·</span>
          <span className={isDark ? "text-[10px] font-mono text-zinc-400" : "text-[10px] font-mono text-slate-500 dark:text-zinc-400"}>
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
        <div className="ml-8 shrink-0 text-right">
          <div className={isDark ? "mb-0.5 text-[10px] uppercase tracking-wide text-zinc-500" : "mb-0.5 text-[10px] uppercase tracking-wide text-slate-400 dark:text-zinc-500"}>
            Δ shape
          </div>
          <div className="flex items-center gap-1.5">
            <DeltaBadge value={result.deltas.ivb} />
            <span className={isDark ? "text-[10px] text-zinc-600" : "text-[10px] text-slate-400 dark:text-zinc-500"}>/</span>
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
  const isDark = useSiteAppearance() === "dark";
  const rankColors = ["text-amber-700", "text-slate-600", "text-amber-800"];
  const rankColor = rankColors[rank] ?? (isDark ? "text-zinc-500" : "text-slate-500 dark:text-zinc-400");

  return (
    <div
      className={
        isDark
          ? "flex items-center gap-3 border-b border-zinc-700 py-3 last:border-0"
          : "flex items-center gap-3 border-b border-border py-3 last:border-0"
      }
    >
      <span className={`w-4 shrink-0 text-xs font-bold ${rankColor}`}>
        {rank + 1}
      </span>
      <div className={isDark ? "min-w-0 flex-1 truncate text-sm font-medium text-zinc-100" : "min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-zinc-50"}>
        {result.pitcher.name}
      </div>
      <div
        className={
          isDark
            ? "inline-flex min-w-[8.5rem] shrink-0 items-center justify-end gap-2 rounded-xl border border-blue-900/60 bg-blue-950/50 px-3 py-1.5"
            : "inline-flex min-w-[8.5rem] shrink-0 items-center justify-end gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5"
        }
      >
        <span className={isDark ? "font-mono text-sm font-semibold text-blue-200" : "font-mono text-sm font-semibold text-blue-900"}>
          {result.avgDistance.toFixed(2)}
        </span>
        <span
          className={
            isDark
              ? "whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-300"
              : "whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.14em] text-blue-700"
          }
        >
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
  const isDark = useSiteAppearance() === "dark";
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
    <div
      className={
        isDark
          ? "rounded-[1.35rem] border border-zinc-700 bg-zinc-900/50 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          : "rounded-[1.35rem] border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
      }
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className={isDark ? "text-sm font-semibold text-zinc-100" : "text-sm font-semibold text-slate-900 dark:text-zinc-50"}>
            MLB Shape Comps
          </h3>
          {mlbData && (
            <p className={isDark ? "mt-0.5 text-[10px] text-zinc-400" : "mt-0.5 text-[10px] text-slate-500 dark:text-zinc-400"}>
              {mlbData.year} · {mlbData.pitchers.length} MLB pitchers · matched by IVB &amp; HB
            </p>
          )}
        </div>
        {/* Mode toggle */}
        <div
          className={
            isDark
              ? "flex items-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-950/80 p-1"
              : "flex items-center gap-1 rounded-2xl border border-border bg-background p-1"
          }
        >
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
        <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500 dark:text-zinc-400"}>Loading MLB data...</p>
      )}
      {error && (
        <p className={isDark ? "text-sm text-red-400" : "text-sm text-red-700"}>Failed to load: {error}</p>
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
                        <PitchTypeChip pitchType={pt} label={pt} size="xs" variant="soft" />
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
                      <div
                        className={
                          isDark
                            ? "mb-3 flex items-center gap-3 border-b border-zinc-700 pb-3"
                            : "mb-3 flex items-center gap-3 border-b border-border pb-3"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <PitchTypeChip
                            pitchType={currentPitch}
                            label={`Your ${currentPitch}`}
                            size="xs"
                            variant="soft"
                          />
                        </div>
                        <span className={isDark ? "text-[11px] font-mono text-zinc-400" : "text-[11px] font-mono text-slate-500 dark:text-zinc-400"}>
                          IVB {fmt(input.ivb)}&quot;
                        </span>
                        <span className={isDark ? "text-[11px] font-mono text-zinc-400" : "text-[11px] font-mono text-slate-500 dark:text-zinc-400"}>
                          HB {fmt(input.hb)}&quot;
                        </span>
                        <span className={isDark ? "text-[11px] font-mono text-zinc-500" : "text-[11px] font-mono text-slate-400 dark:text-zinc-500"}>
                          {fmt(input.velo)} mph
                        </span>
                      </div>
                    )}

                    {/* Per-pitch comp interpretation */}
                    {input && comps.length > 0 && (() => {
                      const lines = describePerPitchComp(comps[0]);
                      if (lines.length === 0) return null;
                      return (
                        <div
                          className={
                            isDark
                              ? "mb-3 rounded-[1.1rem] border border-zinc-700 bg-zinc-950/80 px-4 py-3"
                              : "mb-3 rounded-[1.1rem] border border-border bg-background px-4 py-3"
                          }
                        >
                          <ul className="space-y-1">
                            {lines.map((l) => (
                              <li
                                key={l}
                                className={isDark ? "text-[12px] leading-relaxed text-zinc-400" : "text-[12px] leading-relaxed text-slate-500 dark:text-zinc-400"}
                              >
                                {l}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Legend */}
                    <div className="mb-1 flex justify-end">
                      <span className={isDark ? "text-[9px] uppercase tracking-wider text-zinc-500" : "text-[9px] uppercase tracking-wider text-slate-400 dark:text-zinc-500"}>
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
                <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500 dark:text-zinc-400"}>
                  No {hand}HP pitchers found for this arsenal.
                </p>
              )}
            </div>
          )}

          {mode === "arsenal" && (
            <div>
              <p className={isDark ? "mb-3 text-[11px] text-zinc-400" : "mb-3 text-[11px] text-slate-500 dark:text-zinc-400"}>
                Closest full-arsenal matches across {arsenal.length} pitch{arsenal.length !== 1 ? "es" : ""}
              </p>
              {/* Arsenal comp interpretation */}
              {arsenalComps.length > 0 && (() => {
                const lines = describeArsenalComp(arsenal.length, arsenalComps[0]);
                if (lines.length === 0) return null;
                return (
                  <div
                    className={
                      isDark
                        ? "mb-3 rounded-[1.1rem] border border-zinc-700 bg-zinc-950/80 px-4 py-3"
                        : "mb-3 rounded-[1.1rem] border border-border bg-background px-4 py-3"
                    }
                  >
                    <ul className="space-y-1">
                      {lines.map((l) => (
                        <li
                          key={l}
                          className={isDark ? "text-[12px] leading-relaxed text-zinc-400" : "text-[12px] leading-relaxed text-slate-500 dark:text-zinc-400"}
                        >
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}
              {arsenalComps.length === 0 ? (
                <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500 dark:text-zinc-400"}>No matches found.</p>
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
