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
import ArmActionPanel from "./ArmActionPanel";
import {
  useSiteAppearance,
  type SiteAppearance,
} from "@/app/components/SiteAppearanceContext";

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
  appearance = "light",
}: {
  points: { date: string; value: number }[];
  label: string;
  unit: string;
  color?: string;
  appearance?: SiteAppearance;
}) {
  if (points.length === 0) return null;
  const isDark = appearance === "dark";

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
    <div
      className={
        isDark
          ? "relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-zinc-800/85 bg-[radial-gradient(circle_at_82%_14%,rgba(59,130,246,0.05),transparent_24%),linear-gradient(180deg,rgba(24,24,27,0.84),rgba(9,9,11,0.96))] p-3.5 shadow-[0_14px_28px_rgba(0,0,0,0.14)]"
          : "relative flex h-full min-h-[156px] flex-col overflow-hidden rounded-[1.2rem] border border-border bg-surface p-3.5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
      }
    >
      <div
        className={
          isDark
            ? "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
            : "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"
        }
      />
      <div className="mb-2 flex items-center justify-between gap-3">
        <h4
          className={
            isDark
              ? "max-w-[62%] text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500"
              : "max-w-[62%] text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400"
          }
        >
          {label}
        </h4>
        <div className="shrink-0 text-right">
          <div
            className={
              isDark
                ? "text-[8px] font-semibold uppercase tracking-[0.14em] text-zinc-500"
                : "text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400"
            }
          >
            Latest Session
          </div>
          <div
            className={
              isDark
                ? "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-300"
                : "mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-900 dark:text-zinc-50"
            }
          >
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
          <text
            x={TPAD.left - 5}
            y={TPAD.top + 4}
            textAnchor="end"
            className={isDark ? "fill-zinc-600 text-[8px] font-mono" : "fill-slate-500 text-[8px] font-mono"}
          >
            {yMax}
          </text>
          <text
            x={TPAD.left - 5}
            y={TPAD.top + TPH + 3}
            textAnchor="end"
            className={isDark ? "fill-zinc-600 text-[8px] font-mono" : "fill-slate-500 text-[8px] font-mono"}
          >
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
                className={isDark ? "fill-zinc-600 text-[7px] font-mono" : "fill-slate-500 text-[7px] font-mono"}
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
            className={isDark ? "fill-zinc-600 text-[8px]" : "fill-slate-500 text-[8px]"}
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

function TrackmanPlayerPageInner({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const appearance = useSiteAppearance();
  const isDark = appearance === "dark";
  const surface: SiteAppearance = isDark ? "dark" : "light";

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
    return merged.map((p) => {
      const displayType = getStuffPlusDisplayPitchType(slug, p.pitchType);
      const renamed = displayType !== p.pitchType ? { ...p, pitchType: displayType } : p;
      return {
        ...renamed,
        meanStuffPlus: stuffMap.get(displayType) ?? stuffMap.get(p.pitchType) ?? p.meanStuffPlus,
      };
    });
  }, [sessionData, normalizedHand, stuffPlusArsenal, slug]);

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
    <LeaderboardPageFrame maxWidth="max-w-7xl" variant={surface}>
      <div className="relative">
        <div
          className="pointer-events-none absolute inset-x-0 -top-4 h-56 sm:-top-6"
          style={{
            background: isDark
              ? "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.14), transparent 58%)"
              : "radial-gradient(circle at top center, rgba(var(--brand-primary-rgb), 0.08), transparent 58%)",
          }}
        />
        <div className="relative flex flex-col gap-6">
          <header className="space-y-3">
            <Breadcrumbs
              variant={surface}
              items={[
                { label: "Home", href: "/" },
                { label: "Trackman", href: "/trackman" },
                { label: playerName },
              ]}
            />

            <LeaderboardHero
              tone="sky"
              variant={surface}
              icon={Radio}
              eyebrow="Trackman Profile"
              title={playerName}
              description="Movement shape, velocity trends, and arsenal snapshots from every Trackman session."
              meta={
                <>
                  {normalizedHand ? (
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-full font-semibold uppercase tracking-[0.18em] ${handBadgeClassesCompact(normalizedHand)}`}
                    >
                      {normalizedHand === "R" ? "RHP" : "LHP"}
                    </span>
                  ) : null}
                  {team ? (
                    <LeaderboardPill tone="neutral" variant={surface}>
                      {team}
                    </LeaderboardPill>
                  ) : null}
                  <LeaderboardPill tone="brand" variant={surface}>
                    {entries.length} Session{entries.length !== 1 ? "s" : ""}
                  </LeaderboardPill>
                  {latestSessionLabel ? (
                    <LeaderboardPill tone="sky" variant={surface}>
                      Latest {latestSessionLabel}
                    </LeaderboardPill>
                  ) : null}
                </>
              }
              side={
                <>
                  <Link href={backHref} className="block w-full xl:w-auto">
                    <div
                      className={
                        isDark
                          ? "rounded-3xl border border-zinc-700/90 bg-zinc-900/50 p-4 shadow-sm transition-smooth hover:border-zinc-600"
                          : "rounded-3xl border border-border bg-surface p-4 shadow-sm transition-smooth hover:border-[#CBD5E1]"
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={
                            isDark
                              ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-800/80 bg-sky-950/60 text-sky-300"
                              : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700"
                          }
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </div>
                        <div>
                          <div
                            className={
                              isDark
                                ? "text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                                : "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400"
                            }
                          >
                            Navigate
                          </div>
                          <div
                            className={
                              isDark
                                ? "mt-1 text-sm font-semibold text-zinc-100"
                                : "mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-50"
                            }
                          >
                            {backLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                  {latestSessionHref ? (
                    <Link href={latestSessionHref} className="block w-full xl:w-auto">
                      <div
                        className={
                          isDark
                            ? "rounded-3xl border border-zinc-700/90 bg-zinc-900/50 p-4 shadow-sm transition-smooth hover:border-zinc-600"
                            : "rounded-3xl border border-border bg-surface p-4 shadow-sm transition-smooth hover:border-[#CBD5E1]"
                        }
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={
                              isDark
                                ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-800/80 bg-sky-950/60 text-sky-300"
                                : "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-sky-200 bg-sky-50 text-sky-700"
                            }
                          >
                            <CalendarDays className="h-4 w-4" />
                          </div>
                          <div>
                            <div
                              className={
                                isDark
                                  ? "text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                                  : "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400"
                              }
                            >
                              Latest Session
                            </div>
                            <div
                              className={
                                isDark
                                  ? "mt-1 text-sm font-semibold text-zinc-100"
                                  : "mt-1 text-sm font-semibold text-slate-900 dark:text-zinc-50"
                              }
                            >
                              {latestSessionLabel}
                            </div>
                            {latestSessionType ? (
                              <div
                                className={
                                  isDark ? "mt-1 text-xs text-zinc-400" : "mt-1 text-xs text-slate-500 dark:text-zinc-400"
                                }
                              >
                                {latestSessionType}
                              </div>
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
          <LeaderboardPanel variant={surface} className="p-6">
            <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500 dark:text-zinc-400"}>
              Loading player data...
            </p>
          </LeaderboardPanel>
        ) : entries.length === 0 ? (
          <LeaderboardPanel variant={surface} className="p-6">
            <p className={isDark ? "text-sm text-zinc-400" : "text-sm text-slate-500 dark:text-zinc-400"}>
              No sessions found for this player.
            </p>
          </LeaderboardPanel>
        ) : (
          <>
            <section className="space-y-3">
              <div>
                <div
                  className={
                    isDark
                      ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                      : "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400"
                  }
                >
                  Session History
                </div>
                <div className={isDark ? "mt-1 text-sm text-zinc-400" : "mt-1 text-sm text-slate-500 dark:text-zinc-400"}>
                  Jump into any imported day without leaving the player page.
                </div>
              </div>

              <LeaderboardPanel variant={surface} className="p-4 sm:p-5">
                <div className="overflow-x-auto pb-1">
                  <div className="flex min-w-max gap-2.5 pr-1">
                    {entries.map((e, i) => {
                      const isLatest = i === 0;
                      const sessionHref = getSessionHref(slug, e);
                      return (
                        <Link
                          key={`${e.date}-${i}`}
                          href={sessionHref}
                          className={
                            isDark
                              ? "group min-w-[12.25rem] shrink-0 rounded-2xl border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-zinc-100 shadow-sm transition-smooth hover:border-zinc-600"
                              : "group min-w-[12.25rem] shrink-0 rounded-2xl border border-border bg-surface px-4 py-2.5 text-slate-900 dark:text-zinc-50 shadow-sm transition-smooth hover:border-[#CBD5E1]"
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className={
                                  isDark ? "font-mono text-sm text-zinc-100" : "font-mono text-sm text-slate-900 dark:text-zinc-50"
                                }
                              >
                                {formatDate(e.date)}
                              </div>
                            </div>

                            <div
                              className={
                                isDark
                                  ? "flex min-w-0 items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400"
                                  : "flex min-w-0 items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400"
                              }
                            >
                              {e.sessionType ? (
                                <span className="truncate text-right">
                                  {e.sessionType}
                                </span>
                              ) : null}

                              {isLatest ? (
                                <span
                                  className={
                                    isDark
                                      ? "rounded-full border border-sky-800 bg-sky-950/60 px-2 py-0.5 text-[9px] tracking-[0.18em] text-sky-200"
                                      : "rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[9px] tracking-[0.18em] text-sky-800"
                                  }
                                >
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
                  <div
                    className={
                      isDark
                        ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                        : "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400"
                    }
                  >
                    Overview
                  </div>
                  <div className={isDark ? "mt-1 text-sm text-zinc-400" : "mt-1 text-sm text-slate-500 dark:text-zinc-400"}>
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
                        appearance={appearance}
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
                        appearance={appearance}
                      />
                    </div>
                  ) : null}
                </div>
              </section>
            )}

            {aggregated.length > 0 && (
              <section className="space-y-4">
                <div>
                  <div
                    className={
                      isDark
                        ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                        : "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400"
                    }
                  >
                    Arsenal Averages
                  </div>
                  <div className={isDark ? "mt-1 text-sm text-zinc-400" : "mt-1 text-sm text-slate-500 dark:text-zinc-400"}>
                    Every pitch type, blended across the full Trackman sample.
                  </div>
                </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.9fr)]">
                    <div className="min-w-0 space-y-6">
                      <LeaderboardPanel variant={surface} className="p-5">
                        <PitchTypeTable pitchTypes={aggregated} summary={null} variant={surface} />
                      </LeaderboardPanel>

                    <div className="space-y-3">
                      <div>
                        <div
                          className={
                            isDark
                              ? "text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-500"
                              : "text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-zinc-400"
                          }
                        >
                          Movement Shape
                        </div>
                        <div className={isDark ? "mt-1 text-sm text-zinc-400" : "mt-1 text-sm text-slate-500 dark:text-zinc-400"}>
                          See how each pitch clusters by horizontal and induced vertical break.
                        </div>
                      </div>

                      <MovementScatterByType
                        pitchTypes={aggregated}
                        hand={normalizedHand}
                        surface={surface}
                      />
                    </div>
                  </div>

                  <aside className="space-y-4 self-start xl:sticky xl:top-8">
                    <LeaderboardPanel variant={surface} className="p-5">
                      <PitchArsenalCards pitchTypes={aggregated} variant={surface} />
                    </LeaderboardPanel>

                    {normalizedHand && (
                      <ArmActionPanel
                        aggregated={aggregated}
                        hand={normalizedHand}
                      />
                    )}

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
      </div>
    </LeaderboardPageFrame>
  );
}

export default TrackmanPlayerPageInner;
