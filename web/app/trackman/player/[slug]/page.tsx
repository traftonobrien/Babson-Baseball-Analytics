"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import {
  normalizePitchTypeRow,
  type TrackmanPitchTypeSummary,
} from "@/lib/trackman/metrics";
import PitchTypeFilter from "../../session/[playerId]/[date]/PitchTypeFilter";
import PitchTypeTable from "../../session/[playerId]/[date]/PitchTypeTable";
import MovementScatterByType from "../../session/[playerId]/[date]/MovementScatterByType";
import PitchArsenalCards from "../../session/[playerId]/[date]/PitchArsenalCards";
import TopPitchCard from "./TopPitchCard";
import { mergeRenamedPitchTypes } from "@/lib/mergePitchTypes";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact, parseHand } from "@/lib/handBadge";

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
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
      <h4 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{label}</h4>
      <svg viewBox={`0 0 ${TREND_W} ${TREND_H}`} className="w-full">
        <rect x={TPAD.left} y={TPAD.top} width={TPW} height={TPH} fill="#18181b" rx={3} />

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
  const [activePitchTypes, setActivePitchTypes] = useState<Set<string>>(new Set());

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

  const allTypes = useMemo(
    () => Array.from(new Set(aggregated.map((p) => p.pitchType))).sort(),
    [aggregated],
  );

  const filtered = useMemo(() => {
    if (activePitchTypes.size === 0) return aggregated;
    return aggregated.filter((p) => activePitchTypes.has(p.pitchType));
  }, [aggregated, activePitchTypes]);

  // Trends
  const fbVeloTrend = useMemo(() => computeFbVeloTrend(sessionData), [sessionData]);
  const bbSpinTrend = useMemo(() => computeBbSpinTrend(sessionData), [sessionData]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <Link
              href={fromProfile ? `/players/${slug}` : "/trackman"}
              className="text-zinc-500 hover:text-zinc-300 transition-smooth"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="text-xs text-zinc-600 uppercase tracking-wider">
              {fromProfile ? "Player Profile" : "Trackman"}
            </span>
          </div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <h1 className="text-xl font-bold tracking-tight text-zinc-50">{playerName}</h1>
            {hand && parseHand(hand) && (
              <>
                <span className="w-px h-5 bg-zinc-700 self-center hidden sm:block" />
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${handBadgeClassesCompact(parseHand(hand)!)}`}
                >
                  {hand}
                </span>
              </>
            )}
            {team && (
              <>
                <span className="w-px h-5 bg-zinc-700 self-center hidden sm:block" />
                <span className="text-sm text-zinc-400">{team}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading player data...</p>
        ) : entries.length === 0 ? (
          <p className="text-zinc-400 text-sm">No sessions found for this player.</p>
        ) : (
          <>
            {/* Top Pitch */}
            {stuffPlusArsenal.length > 0 && (
              <TopPitchCard arsenal={stuffPlusArsenal} playerId={slug} />
            )}

            {/* Session selector */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
                Sessions ({entries.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {entries.map((e, i) => {
                  const dateSlug =
                    extractDateSlug(e.pitchTypesPath) ??
                    e.date.replace(/-/g, "_");
                  return (
                    <Link
                      key={`${e.date}-${i}`}
                      href={`/trackman/session/${slug}/${dateSlug}?from=player&slug=${slug}`}
                      className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 hover:border-zinc-600 transition-smooth text-sm"
                    >
                      <span className="font-mono text-zinc-300">
                        {formatDate(e.date)}
                      </span>
                      {e.sessionType && (
                        <span className="ml-2 text-[10px] text-zinc-500">
                          {e.sessionType}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Trend lines */}
            {(fbVeloTrend.length > 1 || bbSpinTrend.length > 1) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {fbVeloTrend.length > 1 && (
                  <TrendLine
                    points={fbVeloTrend}
                    label="Avg Fastball Velocity Over Time"
                    unit="mph"
                    color="#3b82f6"
                  />
                )}
                {bbSpinTrend.length > 1 && (
                  <TrendLine
                    points={bbSpinTrend}
                    label="Avg Breaking Ball Spin Over Time"
                    unit="rpm"
                    color="#60a5fa"
                  />
                )}
              </div>
            )}

            {/* Aggregate view */}
            {aggregated.length > 0 && (
              <>
                <div className="border-t border-zinc-800 pt-6">
                  <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-4">
                    Averages Across All Sessions
                  </h3>

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
                  />
                </div>

                <PitchTypeTable pitchTypes={filtered} summary={null} />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 items-stretch">
                  <MovementScatterByType
                    pitchTypes={filtered}
                    hand={normalizedHand}
                  />
                  <div className="flex flex-col gap-4">
                    <PitchArsenalCards pitchTypes={filtered} />
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
