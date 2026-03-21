"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { getPlayer } from "@/lib/dataIndex";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
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
import Breadcrumbs from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";

/* ------------------------------------------------------------------ */
/*  Inner component (needs Suspense boundary for useSearchParams)      */
/* ------------------------------------------------------------------ */

function CompareInner() {
  const { playerId } = useParams<{ playerId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const profileSlug = searchParams.get("slug") ?? getSlugForPlayerId(playerId);

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
      if (profileSlug) {
        params.set("from", "profile");
        params.set("slug", profileSlug);
      }
      router.push(`/player/${playerId}/compare?${params.toString()}`);
    },
    [profileSlug, router, playerId],
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
  const backHref = profileSlug
    ? `/players/${profileSlug}?tab=Command`
    : selectionA.outingId
      ? `/player/${playerId}?outingId=${encodeURIComponent(selectionA.outingId)}`
      : `/player/${playerId}`;
  const backLabel = profileSlug ? "Back to Player Profile" : "Back to Command Outing";

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Players", href: "/players" },
          { label: player.name, href: backHref },
          { label: "Compare" },
        ]}
      />

      <LeaderboardHero
        tone="orange"
        icon={Target}
        eyebrow="Command Compare"
        title={<>{player.name}</>}
        description="Set two outings side by side to compare miss shape, pitch-level execution, and lane breakdowns."
        meta={
          <>
            <LeaderboardPill tone="orange">Outing to outing</LeaderboardPill>
            <LeaderboardPill tone="neutral">Same pitcher only</LeaderboardPill>
          </>
        }
        side={
          <div className="grid gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/75 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
            >
              {backLabel}
            </Link>
          </div>
        }
      />

      <LeaderboardToolbar>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid gap-3 md:grid-cols-2">
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
          <label className="inline-flex min-h-[3.75rem] items-center gap-3 rounded-3xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 text-xs text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <input
              type="checkbox"
              checked={excludeOutliers}
              onChange={toggleExcludeOutliers}
              className="h-4 w-4 accent-orange-400"
            />
            <span className="font-semibold uppercase tracking-[0.18em] text-zinc-300">
              Exclude outliers &gt;{OUTLIER_MISS_THRESHOLD_IN}&Prime;
            </span>
          </label>
        </div>
      </LeaderboardToolbar>

      {(loadingA || loadingB) && (
        <div className="mt-6 rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-8 text-center text-zinc-400">
          Loading pitch data...
        </div>
      )}
      {errorA && (
        <div className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Side A error: {errorA}
        </div>
      )}
      {errorB && (
        <div className="mt-4 rounded-3xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          Side B error: {errorB}
        </div>
      )}

      {!loadingA && !loadingB && !errorA && !errorB && (
        <div className="mt-6 space-y-5">
          {!selectionA.outingId && (
            <LeaderboardPanel className="p-5 text-sm text-zinc-500">
              Select an outing for Side A to begin the comparison.
            </LeaderboardPanel>
          )}
          {!selectionB.outingId && (
            <LeaderboardPanel className="p-5 text-sm text-zinc-500">
              Select an outing for Side B to begin the comparison.
            </LeaderboardPanel>
          )}

          {isComparisonError && (
            <div className="rounded-3xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-300">
              Cannot compare these outings because the detected pitcher handedness does not match.
            </div>
          )}

          {comparison && !isComparisonError && (
            <div className="space-y-5">
              <Section title="Key Metrics">
                <CompareKpiRow
                  reportA={comparison.reportA}
                  reportB={comparison.reportB}
                  delta={comparison.delta}
                />
              </Section>

              <Section title="Miss Scatter">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
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
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
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

              <Section title="Pitch Type Comparison">
                <ComparePitchTypeTable comparison={comparison.pitchTypeComparison} />
              </Section>

              <Section title="Lane Breakdown">
                <CompareLaneTable
                  comparison={comparison.laneComparison}
                  pitcherHand={comparison.pitcherHand}
                />
              </Section>
            </div>
          )}

          {!comparison && reportA && !reportB && selectionB.outingId && !loadingB && (
            <LeaderboardPanel className="p-5 text-sm text-zinc-500">
              No pitches were found for Side B.
            </LeaderboardPanel>
          )}
          {!comparison && !reportA && reportB && selectionA.outingId && !loadingA && (
            <LeaderboardPanel className="p-5 text-sm text-zinc-500">
              No pitches were found for Side A.
            </LeaderboardPanel>
          )}
        </div>
      )}
    </LeaderboardPageFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <LeaderboardPanel className="p-5 sm:p-6">
      <h2 className="border-b border-zinc-800/80 pb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </LeaderboardPanel>
  );
}

/* ------------------------------------------------------------------ */
/*  Page export                                                        */
/* ------------------------------------------------------------------ */

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <LeaderboardPageFrame maxWidth="max-w-6xl">
          <div className="flex min-h-[60vh] items-center justify-center text-zinc-400">
            Loading comparison...
          </div>
        </LeaderboardPageFrame>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
