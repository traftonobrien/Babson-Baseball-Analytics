"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";

interface IndexEntry {
  playerName: string;
  playerSlug: string;
  date: string;
  sessionType?: string;
  pitchCount: number;
  pitchTypes?: string[];
  veloRange?: [number, number] | null;
  pitchesPath?: string;
  summaryPath?: string;
  handedness?: string;
  team?: string;
}

interface Summary {
  pitch_count: number;
  pitch_types: string[];
  velo?: { avg: number; min: number; max: number } | null;
  spin?: { avg: number; min: number; max: number } | null;
  movement?: {
    ivb?: { avg: number; min: number; max: number } | null;
    hb?: { avg: number; min: number; max: number } | null;
  };
}

const TREND_W = 600;
const TREND_H = 120;
const TPAD = { top: 15, right: 10, bottom: 25, left: 45 };
const TPW = TREND_W - TPAD.left - TPAD.right;
const TPH = TREND_H - TPAD.top - TPAD.bottom;

function TrendLine({
  points,
  label,
  unit,
}: {
  points: { date: string; value: number }[];
  label: string;
  unit: string;
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
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth={1.5} />

        {/* Dots */}
        {sorted.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r={3} fill="#10b981" />
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

export default function TrackmanPlayerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const [slug, setSlug] = useState("");
  const [entries, setEntries] = useState<IndexEntry[]>([]);
  const [summaries, setSummaries] = useState<Map<string, Summary>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;

    fetch("/trackman/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((all: IndexEntry[]) => {
        const mine = (Array.isArray(all) ? all : []).filter(
          (e) => e.playerSlug === slug,
        );
        mine.sort((a, b) => a.date.localeCompare(b.date));
        setEntries(mine);

        // Fetch summaries
        const summaryPromises = mine
          .filter((e) => e.summaryPath)
          .map((e) =>
            fetch(e.summaryPath!)
              .then((r) => (r.ok ? r.json() : null))
              .then((s) => [e.date, s] as [string, Summary | null])
              .catch(() => [e.date, null] as [string, Summary | null]),
          );

        Promise.all(summaryPromises).then((results) => {
          const map = new Map<string, Summary>();
          for (const [date, s] of results) {
            if (s) map.set(date, s);
          }
          setSummaries(map);
          setLoading(false);
        });
      });
  }, [slug]);

  const playerName = entries[0]?.playerName ?? slug;
  const team = entries[0]?.team;
  const hand = entries[0]?.handedness;

  // Trend data
  const veloTrend = useMemo(() => {
    const points: { date: string; value: number }[] = [];
    for (const e of entries) {
      const s = summaries.get(e.date);
      if (s?.velo?.avg) points.push({ date: e.date, value: s.velo.avg });
    }
    return points;
  }, [entries, summaries]);

  const spinTrend = useMemo(() => {
    const points: { date: string; value: number }[] = [];
    for (const e of entries) {
      const s = summaries.get(e.date);
      if (s?.spin?.avg) points.push({ date: e.date, value: s.spin.avg });
    }
    return points;
  }, [entries, summaries]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/trackman" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold">{playerName}</h1>
            {hand && <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded">{hand}</span>}
          </div>
          {team && <p className="text-xs text-zinc-500">{team}</p>}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading player data...</p>
        ) : entries.length === 0 ? (
          <p className="text-zinc-400 text-sm">No sessions found for this player.</p>
        ) : (
          <>
            {/* Trends */}
            {(veloTrend.length > 1 || spinTrend.length > 1) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {veloTrend.length > 1 && (
                  <TrendLine points={veloTrend} label="Avg Velocity Over Time" unit="mph" />
                )}
                {spinTrend.length > 1 && (
                  <TrendLine points={spinTrend} label="Avg Spin Over Time" unit="rpm" />
                )}
              </div>
            )}

            {/* Sessions list */}
            <div>
              <h3 className="text-xs uppercase tracking-wider text-zinc-500 mb-3">
                {entries.length} Session{entries.length !== 1 ? "s" : ""}
              </h3>
              <div className="space-y-2">
                {entries.map((e, i) => {
                  const dateSlug = e.date.replace(/-/g, "_");
                  return (
                    <Link
                      key={`${e.date}-${i}`}
                      href={`/trackman/session/${slug}/${dateSlug}`}
                      className="block bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-mono text-zinc-300">
                          {e.date.replace(/-/g, "/").replace(/_/g, "/")}
                        </span>
                        <span className="text-xs text-zinc-500 font-mono">
                          {e.pitchCount} pitches
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {e.sessionType && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                            {e.sessionType}
                          </span>
                        )}
                        {e.pitchTypes && (
                          <span className="text-[10px] text-zinc-600">
                            {e.pitchTypes.join(", ")}
                          </span>
                        )}
                        {e.veloRange && (
                          <span className="text-[10px] text-zinc-600 font-mono">
                            {e.veloRange[0].toFixed(0)}&ndash;{e.veloRange[1].toFixed(0)} mph
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
