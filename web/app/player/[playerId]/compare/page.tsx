"use client";

import Link from "next/link";
import { Target } from "lucide-react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useMemo, useEffect, useState, useCallback } from "react";
import { getPlayer } from "@/lib/dataIndex";
import { getSlugForPlayerId } from "@/lib/canonicalPlayers";
import { buildReport } from "@/lib/reportModel";
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

  // Push URL (always include all pitches; no outlier toggle on this page)
  const pushUrl = useCallback(
    (a: PitchSelection, b: PitchSelection) => {
      const params = serializeComparisonQueryParams(a, b, false);
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
      pushUrl(sel, selectionB);
    },
    [selectionB, pushUrl],
  );

  const handleSelectionB = useCallback(
    (sel: PitchSelection) => {
      setSelectionB(sel);
      pushUrl(selectionA, sel);
    },
    [selectionA, pushUrl],
  );

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
      { excludeOutliers: false },
    );
  }, [pitchesA, player, outingA, pitcherHand]);

  const reportB = useMemo(() => {
    if (pitchesB.length === 0) return null;
    return buildReport(
      pitchesB,
      player?.name ?? "",
      outingB?.label ?? "",
      pitcherHand,
      "outing",
      { excludeOutliers: false },
    );
  }, [pitchesB, player, outingB, pitcherHand]);

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
      <div className="flex h-screen items-center justify-center bg-background text-red-600">
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
    <LeaderboardPageFrame maxWidth="max-w-6xl" variant="light">
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 -top-4 h-56 sm:-top-6"
          style={{
            background:
              "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.08), transparent 58%)",
          }}
        />
        <div className="relative">
          <Breadcrumbs
            variant="light"
            items={[
              { label: "Home", href: "/" },
              { label: "Players", href: "/players" },
              { label: player.name, href: backHref },
              { label: "Compare" },
            ]}
          />

          <LeaderboardHero
            tone="emerald"
            variant="light"
            icon={Target}
            eyebrow="Command Compare"
            title={<>{player.name}</>}
            description="Set two outings side by side to compare miss shape, pitch-level execution, and lane breakdowns."
            meta={
              <>
                <LeaderboardPill tone="brand" variant="light">
                  Outing to outing
                </LeaderboardPill>
                <LeaderboardPill tone="neutral" variant="light">
                  Same pitcher only
                </LeaderboardPill>
              </>
            }
            side={
              <Link
                href={backHref}
                className="inline-flex w-full min-w-0 items-center justify-center rounded-2xl border border-[#E2E8F0] bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400 shadow-sm transition-smooth hover:border-[#CBD5E1] hover:text-slate-900 dark:hover:text-zinc-50 xl:w-fit xl:shrink-0"
              >
                {backLabel}
              </Link>
            }
          />

          <LeaderboardToolbar variant="light" className="mt-6">
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
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
          </LeaderboardToolbar>

      {(loadingA || loadingB) && (
        <div className="mt-6 rounded-[28px] border border-border bg-surface p-8 text-center text-slate-500 dark:text-zinc-400 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          Loading pitch data...
        </div>
      )}
      {errorA && (
        <div className="mt-6 rounded-[28px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Side A error: {errorA}
        </div>
      )}
      {errorB && (
        <div className="mt-4 rounded-[28px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Side B error: {errorB}
        </div>
      )}

      {!loadingA && !loadingB && !errorA && !errorB && (
        <div className="mt-6 space-y-5">
          {!selectionA.outingId && (
            <LeaderboardPanel variant="light" className="p-5 text-sm text-slate-500 dark:text-zinc-400">
              Select an outing for Side A to begin the comparison.
            </LeaderboardPanel>
          )}
          {!selectionB.outingId && (
            <LeaderboardPanel variant="light" className="p-5 text-sm text-slate-500 dark:text-zinc-400">
              Select an outing for Side B to begin the comparison.
            </LeaderboardPanel>
          )}

          {isComparisonError && (
            <div className="rounded-[28px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-400">
                      Side A: {outingA?.label ?? ""}
                    </div>
                    <StrikeZoneScatter
                      pitches={pitchesA}
                      selected={null}
                      onSelect={() => {}}
                      throwsHand={pitcherHand}
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-zinc-400">
                      Side B: {outingB?.label ?? ""}
                    </div>
                    <StrikeZoneScatter
                      pitches={pitchesB}
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
            <LeaderboardPanel variant="light" className="p-5 text-sm text-slate-500 dark:text-zinc-400">
              No pitches were found for Side B.
            </LeaderboardPanel>
          )}
          {!comparison && !reportA && reportB && selectionA.outingId && !loadingA && (
            <LeaderboardPanel variant="light" className="p-5 text-sm text-slate-500 dark:text-zinc-400">
              No pitches were found for Side A.
            </LeaderboardPanel>
          )}
        </div>
      )}
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <LeaderboardPanel variant="light" className="p-5 sm:p-6">
      <h2 className="border-b border-border pb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#94A3B8]">
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
        <LeaderboardPageFrame maxWidth="max-w-6xl" variant="light">
          <div className="flex min-h-[60vh] items-center justify-center text-slate-500 dark:text-zinc-400">
            Loading comparison...
          </div>
        </LeaderboardPageFrame>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
