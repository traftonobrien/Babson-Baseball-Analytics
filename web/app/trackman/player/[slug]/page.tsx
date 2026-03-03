"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Radio } from "lucide-react";
import {
  normalizePitchTypeRow,
  type TrackmanPitchTypeSummary,
} from "@/lib/trackman/metrics";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import PitchTypeTable from "../../session/[playerId]/[date]/PitchTypeTable";
import MovementScatterByType from "../../session/[playerId]/[date]/MovementScatterByType";
import PitchArsenalCards from "../../session/[playerId]/[date]/PitchArsenalCards";
import { mergeRenamedPitchTypes } from "@/lib/mergePitchTypes";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact, parseHand } from "@/lib/handBadge";
import MLBCompsPanel from "./MLBCompsPanel";
import StuffPlusSummaryCard from "./StuffPlusSummaryCard";

interface IndexEntry {
  playerName: string;
  playerSlug: string;
  date: string;
  sessionType?: string;
  pitchTypes?: string[];
  weightedAvgVelo: number | null;
  pitchTypesPath?: string;
  handedness?: string;
  team?: string;
}

function normalizeEntry(raw: Record<string, unknown>): IndexEntry {
  return {
    playerName: (raw.playerName as string) ?? "Unknown",
    playerSlug: (raw.playerSlug as string) ?? "",
    date: (raw.date as string) ?? "",
    sessionType: (raw.sessionType as string) ?? undefined,
    pitchTypes: Array.isArray(raw.pitchTypes) ? raw.pitchTypes as string[] : undefined,
    weightedAvgVelo: (raw.weightedAvgVelo as number) ?? null,
    pitchTypesPath: (raw.pitchTypesPath as string) ?? undefined,
    handedness: (raw.handedness as string) ?? undefined,
    team: (raw.team as string) ?? undefined,
  };
}

function extractDateSlug(path?: string): string | null {
  if (!path) return null;
  const match = path.match(/\/trackman\/sessions\/[^/]+\/([^/]+)\//);
  return match?.[1] ?? null;
}

function getSessionHref(playerSlug: string, entry: IndexEntry): string {
  const dateSlug = extractDateSlug(entry.pitchTypesPath) ?? entry.date.replace(/-/g, "_");
  return `/trackman/session/${playerSlug}/${dateSlug}?from=player&slug=${playerSlug}`;
}

/** "2026-02-13" → "2/13/26" */
function formatDate(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}


/** Average pitch type data across multiple sessions. */
function aggregatePitchTypes(
  allSessionPitchTypes: TrackmanPitchTypeSummary[][],
): TrackmanPitchTypeSummary[] {
  // Group by pitch type
  const grouped = new Map<string, TrackmanPitchTypeSummary[]>();
  for (const session of allSessionPitchTypes) {
    for (const pt of session) {
      if (pt.pitchType === "Other") continue;
      if (!grouped.has(pt.pitchType)) grouped.set(pt.pitchType, []);
      grouped.get(pt.pitchType)!.push(pt);
    }
  }

  const avgNum = (
    items: TrackmanPitchTypeSummary[],
    key: keyof TrackmanPitchTypeSummary,
  ): number | null => {
    // If we have counts for all items, use weighted average
    const hasCounts = items.every(i => i.count !== null);
    
    if (hasCounts) {
      let totalW = 0;
      let totalV = 0;
      for (const i of items) {
        const val = i[key] as number | null;
        if (val !== null && i.count !== null) {
          totalW += i.count;
          totalV += val * i.count;
        }
      }
      if (totalW === 0) return null;
      return Math.round((totalV / totalW) * 100) / 100;
    }

    // Fallback to simple average of averages
    const vals = items
      .map((i) => i[key] as number | null)
      .filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  };

  const result: TrackmanPitchTypeSummary[] = [];
  for (const [pitchType, items] of grouped) {
    // Sum counts if available
    const totalCount = items.reduce((acc, curr) => {
      if (acc === null && curr.count === null) return null;
      return (acc || 0) + (curr.count || 0);
    }, null as number | null);

    result.push({
      pitchType,
      count: totalCount,
      avgVelo: avgNum(items, "avgVelo"),
      maxVelo: null,
      avgSpin: avgNum(items, "avgSpin"),
      maxSpin: null,
      avgIvb: avgNum(items, "avgIvb"),
      avgHb: avgNum(items, "avgHb"),
      avgExtension: avgNum(items, "avgExtension"),
      avgRelHeight: avgNum(items, "avgRelHeight"),
      avgRelSide: avgNum(items, "avgRelSide"),
      avgSpinAxis2d: avgNum(items, "avgSpinAxis2d"),
      avgSpinAxis3d: avgNum(items, "avgSpinAxis3d"),
      avgGyro: avgNum(items, "avgGyro"),
    });
  }

  // Sort by avg velo descending
  result.sort((a, b) => (b.avgVelo ?? 0) - (a.avgVelo ?? 0));
  return result;
}

interface SessionPitchTypes {
  date: string;
  pitchTypes: TrackmanPitchTypeSummary[];
}

const FASTBALL_TYPES = new Set(["Fastball", "Sinker"]);
const BREAKING_TYPES = new Set(["Slider", "Curveball", "Sweeper"]);

/** Compute avg fastball velo per session for trend line. */
function computeFbVeloTrend(sessions: SessionPitchTypes[]): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (const s of sessions) {
    const fbs = s.pitchTypes.filter((p) => FASTBALL_TYPES.has(p.pitchType));
    const velos = fbs.map((p) => p.avgVelo).filter((v): v is number => v != null);
    if (velos.length === 0) continue;
    const avg = velos.reduce((a, b) => a + b, 0) / velos.length;
    points.push({ date: s.date, value: Math.round(avg * 100) / 100 });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

/** Compute avg breaking ball spin per session for trend line. */
function computeBbSpinTrend(sessions: SessionPitchTypes[]): { date: string; value: number }[] {
  const points: { date: string; value: number }[] = [];
  for (const s of sessions) {
    const bbs = s.pitchTypes.filter((p) => BREAKING_TYPES.has(p.pitchType));
    const spins = bbs.map((p) => p.avgSpin).filter((v): v is number => v != null);
    if (spins.length === 0) continue;
    const avg = spins.reduce((a, b) => a + b, 0) / spins.length;
    points.push({ date: s.date, value: Math.round(avg * 100) / 100 });
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

// -- Trend line SVG component --
const TREND_W = 600;
const TREND_H = 120;
const TPAD = { top: 15, right: 10, bottom: 25, left: 45 };
const TPW = TREND_W - TPAD.left - TPAD.right;
const TPH = TREND_H - TPAD.top - TPAD.bottom;

function TrendLine({
  points,
  label,
  unit,
  color = "#3b82f6",
}: {
  points: { date: string; value: number }[];
  label: string;
  unit: string;
  color?: string;
}) {
  if (points.length === 0) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.value);
  const latest = sorted[sorted.length - 1];
  const yMin = Math.floor(Math.min(...values) - 1);
  const yMax = Math.ceil(Math.max(...values) + 1);

  function toX(i: number): number {
    const range = sorted.length - 1 || 1;
    return TPAD.left + (i / range) * TPW;
  }
  function toY(v: number): number {
    const range = yMax - yMin || 1;
    return TPAD.top + TPH - ((v - yMin) / range) * TPH;
  }

  const pathD = sorted
    .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.value)}`)
    .join(" ");

  return (
    <div className="relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-zinc-800/85 bg-[radial-gradient(circle_at_82%_14%,rgba(59,130,246,0.05),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.84),rgba(9,9,11,0.96))] p-3.5 shadow-[0_14px_28px_rgba(0,0,0,0.14)]">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4 className="max-w-[62%] text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          {label}
        </h4>
        <div className="shrink-0 text-right">
          <div className="text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Latest Session
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300">
            {latest.value.toFixed(1)} {unit}
          </div>
        </div>
      </div>

      <div className="h-[84px]">
        <svg
          viewBox={`0 0 ${TREND_W} ${TREND_H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          {/* Y axis labels */}
          <text x={TPAD.left - 5} y={TPAD.top + 4} textAnchor="end" className="fill-zinc-600 text-[8px] font-mono">
            {yMax}
          </text>
          <text x={TPAD.left - 5} y={TPAD.top + TPH + 3} textAnchor="end" className="fill-zinc-600 text-[8px] font-mono">
            {yMin}
          </text>

          {/* Line */}
          <path d={pathD} fill="none" stroke={color} strokeWidth={1.5} />

          {/* Dots */}
          {sorted.map((p, i) => (
            <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3} fill={color} />
          ))}

          {/* Date labels */}
          {sorted.length <= 10 &&
            sorted.map((p, i) => (
              <text
                key={`d${i}`}
                x={toX(i)}
                y={TREND_H - 4}
                textAnchor="middle"
                className="fill-zinc-600 text-[7px] font-mono"
              >
                {p.date.slice(5).replace(/-/g, "/")}
              </text>
            ))}

          {/* Unit label */}
          <text
            x={8}
            y={TPAD.top + TPH / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, 8, ${TPAD.top + TPH / 2})`}
            className="fill-zinc-600 text-[8px]"
          >
            {unit}
          </text>
        </svg>
      </div>
    </div>
  );
}

async function fetchPitchTypes(path: string): Promise<TrackmanPitchTypeSummary[]> {
  try {
    const res = await fetch(path);
    if (!res.ok) return [];
    const raw = await res.json();
    const rows = Array.isArray(raw) ? raw : raw?.pitch_types ?? raw?.rows ?? [];
    if (!Array.isArray(rows)) return [];
    return rows
      .filter((r: Record<string, unknown>) => r?.is_valid !== false)
      .map((r: Record<string, unknown>) => normalizePitchTypeRow(r))
      .filter((r: TrackmanPitchTypeSummary) => r.pitchType !== "Other");
  } catch {
    return [];
  }
}

export default function TrackmanPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [slug, setSlug] = useState("");
  const [fromProfile, setFromProfile] = useState(false);
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [sessionData, setSessionData] = useState<SessionPitchTypes[]>([]);
  const [stuffPlusArsenal, setStuffPlusArsenal] = useState<{ pitchType: string; meanStuffPlus: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
    searchParams.then((sp) => {
      setFromProfile(sp.from === "profile");
    });
  }, [params, searchParams]);

  useEffect(() => {
    if (!slug) return;

    fetch("/trackman/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then(async (all: unknown) => {
        const mine = (Array.isArray(all) ? all : [])
          .map((e) => normalizeEntry(e as Record<string, unknown>))
          .filter((e) => e.playerSlug === slug);
        // Sort by date descending (most recent first)
        mine.sort((a, b) => b.date.localeCompare(a.date));
        setEntries(mine);

        // Fetch all pitch type data for aggregation + trends
        const withPaths = mine.filter((e) => e.pitchTypesPath);
        const fetched = await Promise.all(
          withPaths.map(async (e) => ({
            date: e.date,
            pitchTypes: await fetchPitchTypes(e.pitchTypesPath!),
          })),
        );
        setSessionData(fetched.filter((d) => d.pitchTypes.length > 0));
        setLoading(false);
      });

    // Fetch Stuff+ arsenal data
    fetch(`/api/stuff-plus/arsenal?playerId=${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.pitches) setStuffPlusArsenal(res.pitches);
      });
  }, [slug]);

  const playerName = getCanonicalName(entries[0]?.playerName ?? slug);
  const team = entries[0]?.team;
  const rawHand = entries.find((e) => e.handedness)?.handedness ?? null;
  const hand = rawHand;
  const normalizedHand: "R" | "L" | undefined =
    rawHand?.toUpperCase().startsWith("R") ? "R" :
    rawHand?.toUpperCase().startsWith("L") ? "L" :
    undefined;

  // Aggregate pitch types across all sessions, then merge by movement
  const aggregated = useMemo(() => {
    const raw = aggregatePitchTypes(sessionData.map((s) => s.pitchTypes));
    const merged = normalizedHand ? mergeRenamedPitchTypes(raw, normalizedHand) : raw;
    // Merge Stuff+ data by pitch type (with display-name overrides)
    const stuffMap = new Map<string, number>();
    for (const p of stuffPlusArsenal) {
      const displayType = getStuffPlusDisplayPitchType(slug, p.pitchType);
      stuffMap.set(displayType, p.meanStuffPlus);
      stuffMap.set(p.pitchType, p.meanStuffPlus);
    }
    return merged.map((p) => ({
      ...p,
      meanStuffPlus: stuffMap.get(p.pitchType) ?? p.meanStuffPlus,
    }));
  }, [sessionData, normalizedHand, stuffPlusArsenal]);

  // Trends
  const fbVeloTrend = useMemo(() => computeFbVeloTrend(sessionData), [sessionData]);
  const bbSpinTrend = useMemo(() => computeBbSpinTrend(sessionData), [sessionData]);
  const latestEntry = entries[0] ?? null;
  const hasOverview =
    stuffPlusArsenal.length > 0 || fbVeloTrend.length > 1 || bbSpinTrend.length > 1;
  const backHref = fromProfile ? `/players/${slug}` : "/trackman";
  const backLabel = fromProfile ? "Back to Player Profile" : "Back to Trackman Hub";
  const latestSessionHref = latestEntry ? getSessionHref(slug, latestEntry) : null;
  const latestSessionLabel = latestEntry ? formatDate(latestEntry.date) : null;
  const latestSessionType = latestEntry?.sessionType;
  const overviewCardCount =
    (stuffPlusArsenal.length > 0 ? 1 : 0) +
    (fbVeloTrend.length > 1 ? 1 : 0) +
    (bbSpinTrend.length > 1 ? 1 : 0);
  const overviewGridClassName =
    overviewCardCount <= 1
      ? "lg:grid-cols-1"
      : overviewCardCount === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-3";

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <div className="flex flex-col gap-6">
        <header className="space-y-3">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Trackman", href: "/trackman" },
              { label: playerName },
            ]}
          />

          <LeaderboardHero
            tone="blue"
            icon={Radio}
            eyebrow="Trackman Profile"
            title={playerName}
            description="Movement shape, velocity trends, and arsenal snapshots across every imported Trackman session."
            meta={
              <>
                {normalizedHand ? (
                  <span
                    className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-[0.18em] ${handBadgeClassesCompact(normalizedHand)}`}
                  >
                    {normalizedHand === "R" ? "RHP" : "LHP"}
                  </span>
                ) : null}
                {team ? <LeaderboardPill tone="neutral">{team}</LeaderboardPill> : null}
                <LeaderboardPill tone="blue">
                  {entries.length} Session{entries.length !== 1 ? "s" : ""}
                </LeaderboardPill>
                {latestSessionLabel ? (
                  <LeaderboardPill tone="sky">Latest {latestSessionLabel}</LeaderboardPill>
                ) : null}
              </>
            }
            side={
              <>
                <Link href={backHref} className="block">
                  <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-blue-500/25">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                        <ArrowLeft className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                          Navigate
                        </div>
                        <div className="mt-1 text-sm font-semibold text-zinc-100">
                          {backLabel}
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
                {latestSessionHref ? (
                  <Link href={latestSessionHref} className="block">
                    <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-blue-500/25">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                          <CalendarDays className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                            Latest Session
                          </div>
                          <div className="mt-1 text-sm font-semibold text-zinc-100">
                            {latestSessionLabel}
                          </div>
                          {latestSessionType ? (
                            <div className="mt-1 text-xs text-zinc-500">{latestSessionType}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : null}
              </>
            }
          />
        </header>

        {loading ? (
          <LeaderboardPanel className="p-6">
            <p className="text-zinc-500 text-sm">Loading player data...</p>
          </LeaderboardPanel>
        ) : entries.length === 0 ? (
          <LeaderboardPanel className="p-6">
            <p className="text-zinc-400 text-sm">No sessions found for this player.</p>
          </LeaderboardPanel>
        ) : (
          <>
            <section className="space-y-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                  Session History
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  Jump into any imported day without leaving the player page.
                </div>
              </div>

              <LeaderboardPanel className="p-4 sm:p-5">
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2.5 pr-1">
                    {entries.map((e, i) => {
                      const isLatest = i === 0;
                      const sessionHref = getSessionHref(slug, e);
                      return (
                        <Link
                          key={`${e.date}-${i}`}
                          href={sessionHref}
                          className="group shrink-0 min-w-[12.25rem] rounded-2xl border border-zinc-800 bg-zinc-950/80 px-4 py-2.5 text-zinc-300 transition-smooth hover:border-zinc-600"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-mono text-sm text-zinc-100">
                                {formatDate(e.date)}
                              </div>
                            </div>

                            <div className="flex min-w-0 items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                              {e.sessionType ? (
                                <span className="truncate text-right">
                                  {e.sessionType}
                                </span>
                              ) : null}

                              {isLatest ? (
                                <span className="rounded-full border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[9px] tracking-[0.18em] text-blue-300">
                                  Latest
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </LeaderboardPanel>
            </section>

            {hasOverview && (
              <section className="space-y-2.5">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Overview
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    The fastest read on the profile before you drill into pitch details.
                  </div>
                </div>

                <div className={`grid grid-cols-1 items-stretch gap-3 ${overviewGridClassName}`}>
                  {stuffPlusArsenal.length > 0 ? (
                    <div className="h-full">
                      <StuffPlusSummaryCard arsenal={stuffPlusArsenal} playerId={slug} />
                    </div>
                  ) : null}
                  {fbVeloTrend.length > 1 ? (
                    <div className="h-full">
                      <TrendLine
                        points={fbVeloTrend}
                        label="Fastball Velo Trend"
                        unit="mph"
                        color="#3b82f6"
                      />
                    </div>
                  ) : null}
                  {bbSpinTrend.length > 1 ? (
                    <div className="h-full">
                      <TrendLine
                        points={bbSpinTrend}
                        label="Breaking-Ball Spin Trend"
                        unit="rpm"
                        color="#60a5fa"
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {aggregated.length > 0 && (
              <section className="space-y-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                    Arsenal Averages
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">
                    Every pitch type, blended across the full Trackman sample.
                  </div>
                </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.9fr)]">
                    <div className="min-w-0 space-y-6">
                      <LeaderboardPanel className="p-5">
                        <PitchTypeTable pitchTypes={aggregated} summary={null} />
                      </LeaderboardPanel>

                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                          Movement Shape
                        </div>
                        <div className="mt-1 text-sm text-zinc-500">
                          See how each pitch clusters by horizontal and induced vertical break.
                        </div>
                      </div>

                      <MovementScatterByType
                        pitchTypes={aggregated}
                        hand={normalizedHand}
                      />
                    </div>
                  </div>

                  <aside className="space-y-4 xl:sticky xl:top-8 self-start">
                    <LeaderboardPanel className="p-5">
                      <PitchArsenalCards pitchTypes={aggregated} />
                    </LeaderboardPanel>

                    {normalizedHand && (
                      <MLBCompsPanel
                        aggregated={aggregated}
                        hand={normalizedHand}
                      />
                    )}
                  </aside>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </LeaderboardPageFrame>
  );
}
