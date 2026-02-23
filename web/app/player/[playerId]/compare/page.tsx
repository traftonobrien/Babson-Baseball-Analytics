"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { getPlayer } from "@/lib/dataIndex";
import {
  buildReport,
  isOutlier,
  OUTLIER_MISS_THRESHOLD_IN,
} from "@/lib/reportModel";
import {
  parseComparisonQueryParams,
  serializeComparisonQueryParams,
  buildComparisonReport,
  type PitchSelection,
  type ComparisonReport,
} from "@/lib/comparisonModel";
import { useAllPitchData } from "@/app/hooks/useAllPitchData";
import CompareControls from "@/app/components/CompareControls";
import CompareKpiRow from "@/app/components/CompareKpiRow";
import ComparePitchTypeTable from "@/app/components/ComparePitchTypeTable";
import CompareLaneTable from "@/app/components/CompareLaneTable";
import StrikeZoneScatter from "@/app/components/StrikeZoneScatter";
import LogoutButton from "@/app/components/LogoutButton";

/* ------------------------------------------------------------------ */
/*  Inner component (needs Suspense boundary for useSearchParams)      */
/* ------------------------------------------------------------------ */

function CompareInner() {
  const { playerId } = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const player = getPlayer(playerId);

  // Parse query params
  const parsed = useMemo(() => {
    if (!player) return null;
    return parseComparisonQueryParams(
      searchParams,
      playerId,
      player.outings,
    );
  }, [searchParams, playerId, player]);

  const [selectionA, setSelectionA] = useState<PitchSelection>(
    parsed?.selectionA ?? { playerId, outingId: null },
  );
  const [selectionB, setSelectionB] = useState<PitchSelection>(
    parsed?.selectionB ?? { playerId, outingId: null },
  );

  // Sync from URL on searchParams change
  useEffect(() => {
    if (!parsed) return;
    setSelectionA(parsed.selectionA);
    setSelectionB(parsed.selectionB);
  }, [parsed]);

  // Exclude outliers: URL > localStorage > false
  const lsKey = `compareExcludeOutliers:${playerId}`;
  const [excludeOutliers, setExcludeOutliers] = useState(
    parsed?.excludeOutliers ?? false,
  );

  // Load from localStorage on mount (only if URL didn't specify)
  useEffect(() => {
    if (searchParams.get("excludeOutliers") != null) return;
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored === "true") setExcludeOutliers(true);
    } catch { /* noop */ }
  }, [lsKey, searchParams]);

  // Push URL
  const pushUrl = useCallback(
    (a: PitchSelection, b: PitchSelection, eo: boolean) => {
      const params = serializeComparisonQueryParams(a, b, eo);
      router.push(`/player/${playerId}/compare?${params.toString()}`);
    },
    [router, playerId],
  );

  const handleSelectionA = useCallback(
    (sel: PitchSelection) => {
      setSelectionA(sel);
      pushUrl(sel, selectionB, excludeOutliers);
    },
    [selectionB, excludeOutliers, pushUrl],
  );

  const handleSelectionB = useCallback(
    (sel: PitchSelection) => {
      setSelectionB(sel);
      pushUrl(selectionA, sel, excludeOutliers);
    },
    [selectionA, excludeOutliers, pushUrl],
  );

  const toggleExcludeOutliers = useCallback(() => {
    setExcludeOutliers((prev) => {
      const next = !prev;
      try { localStorage.setItem(lsKey, String(next)); } catch { /* noop */ }
      pushUrl(selectionA, selectionB, next);
      return next;
    });
  }, [lsKey, selectionA, selectionB, pushUrl]);

  // Load CSV data
  const outingA = player?.outings.find((o) => o.id === selectionA.outingId);
  const outingB = player?.outings.find((o) => o.id === selectionB.outingId);

  const csvPathsA = useMemo(() => (outingA ? [outingA.csvPath] : []), [outingA]);
  const csvPathsB = useMemo(() => (outingB ? [outingB.csvPath] : []), [outingB]);

  const { pitches: pitchesA, pitcherHand, loading: loadingA, error: errorA } = useAllPitchData(csvPathsA, playerId);
  const { pitches: pitchesB, loading: loadingB, error: errorB } = useAllPitchData(csvPathsB, playerId);

  // Build reports
  const reportA = useMemo(() => {
    if (pitchesA.length === 0) return null;
    return buildReport(
      pitchesA,
      player?.name ?? "",
      outingA?.label ?? "",
      pitcherHand,
      "outing",
      { excludeOutliers },
    );
  }, [pitchesA, player, outingA, excludeOutliers, pitcherHand]);

  const reportB = useMemo(() => {
    if (pitchesB.length === 0) return null;
    return buildReport(
      pitchesB,
      player?.name ?? "",
      outingB?.label ?? "",
      pitcherHand,
      "outing",
      { excludeOutliers },
    );
  }, [pitchesB, player, outingB, excludeOutliers, pitcherHand]);

  // Filtered pitches for scatter plots (match what buildReport uses)
  const scatterPitchesA = useMemo(
    () => (excludeOutliers ? pitchesA.filter((p) => !isOutlier(p)) : pitchesA),
    [pitchesA, excludeOutliers],
  );
  const scatterPitchesB = useMemo(
    () => (excludeOutliers ? pitchesB.filter((p) => !isOutlier(p)) : pitchesB),
    [pitchesB, excludeOutliers],
  );

  // Build comparison
  const comparison = useMemo<ComparisonReport | { error: string } | null>(() => {
    if (!reportA || !reportB) return null;
    try {
      return buildComparisonReport(reportA, reportB, selectionA, selectionB);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      return { error: msg };
    }
  }, [reportA, reportB, selectionA, selectionB]);

  // ---- Render ----

  if (!player) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-red-400">
        Player not found.
      </div>
    );
  }

  const isComparisonError = comparison && "error" in comparison;

  return (
    <div className="max-w-[900px] mx-auto px-6 py-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <a
          href={`/player/${playerId}`}
          className="text-sm text-zinc-400 hover:text-zinc-200 transition-smooth"
        >
          &larr; Dashboard
        </a>
        <LogoutButton />
      </div>

      {/* Header */}
      <header className="mb-4">
        <div className="flex items-baseline justify-between border-b-2 border-zinc-600 pb-2">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-none">
              {player.name}
            </h1>
            <p className="text-[12px] text-zinc-400 mt-1 leading-none">
              Outing Comparison
            </p>
          </div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.15em]">
            Compare
          </div>
        </div>

        {/* Outlier toggle */}
        <div className="flex items-center gap-2 mt-1.5 text-[9px] text-zinc-500">
          <label className="inline-flex items-center gap-1 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeOutliers}
              onChange={toggleExcludeOutliers}
              className="accent-zinc-400 w-3 h-3"
            />
            <span className="text-[9px] font-medium text-zinc-400">Exclude outliers (&gt;{OUTLIER_MISS_THRESHOLD_IN}&Prime;)</span>
          </label>
        </div>
      </header>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <CompareControls
          side="A"
          selection={selectionA}
          onChange={handleSelectionA}
          availableOutings={player.outings}
          playerId={playerId}
        />
        <CompareControls
          side="B"
          selection={selectionB}
          onChange={handleSelectionB}
          availableOutings={player.outings}
          playerId={playerId}
        />
      </div>

      {/* Loading / Error states */}
      {(loadingA || loadingB) && (
        <div className="text-center text-zinc-400 py-8">Loading pitch data...</div>
      )}
      {errorA && (
        <div className="text-center text-red-400 py-2 text-sm">Side A error: {errorA}</div>
      )}
      {errorB && (
        <div className="text-center text-red-400 py-2 text-sm">Side B error: {errorB}</div>
      )}

      {/* Missing selections */}
      {!loadingA && !loadingB && !errorA && !errorB && (
        <>
          {!selectionA.outingId && (
            <div className="text-center text-zinc-500 py-4 text-sm">Select outing for Side A</div>
          )}
          {!selectionB.outingId && (
            <div className="text-center text-zinc-500 py-4 text-sm">Select outing for Side B</div>
          )}

          {/* Pitcher hand mismatch */}
          {isComparisonError && (
            <div className="text-center text-amber-400 py-4 text-sm border border-amber-500/30 rounded bg-amber-950/20 mb-4">
              Cannot compare: Different pitcher handedness detected
            </div>
          )}

          {/* Comparison results */}
          {comparison && !isComparisonError && (
            <div className="space-y-4">
              {/* KPI Row */}
              <Section title="Key Metrics">
                <CompareKpiRow
                  reportA={comparison.reportA}
                  reportB={comparison.reportB}
                  delta={comparison.delta}
                />
              </Section>

              {/* Strike Zone Scatters */}
              <Section title="Miss Scatter">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Side A: {outingA?.label ?? ""}
                    </div>
                    <StrikeZoneScatter
                      pitches={scatterPitchesA}
                      selected={null}
                      onSelect={() => {}}
                      throwsHand={pitcherHand}
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 mb-1">
                      Side B: {outingB?.label ?? ""}
                    </div>
                    <StrikeZoneScatter
                      pitches={scatterPitchesB}
                      selected={null}
                      onSelect={() => {}}
                      throwsHand={pitcherHand}
                    />
                  </div>
                </div>
              </Section>

              {/* Pitch Type Table */}
              <Section title="Pitch Type Comparison">
                <ComparePitchTypeTable comparison={comparison.pitchTypeComparison} />
              </Section>

              {/* Lane Table */}
              <Section title="Lane Breakdown">
                <CompareLaneTable
                  comparison={comparison.laneComparison}
                  pitcherHand={comparison.pitcherHand}
                />
              </Section>
            </div>
          )}

          {/* One side has data, other doesn't */}
          {!comparison && reportA && !reportB && selectionB.outingId && !loadingB && (
            <div className="text-center text-zinc-500 py-4 text-sm">No pitches found for Side B.</div>
          )}
          {!comparison && !reportA && reportB && selectionA.outingId && !loadingA && (
            <div className="text-center text-zinc-500 py-4 text-sm">No pitches found for Side A.</div>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 mb-1 border-b border-zinc-800 pb-[3px]">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen text-zinc-400">
            Loading...
          </div>
        }
      >
        <CompareInner />
      </Suspense>
    </div>
  );
}
