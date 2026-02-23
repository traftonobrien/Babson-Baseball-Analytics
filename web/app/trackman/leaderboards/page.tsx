"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy, Search } from "lucide-react";
import { pitchColor } from "@/lib/pitchColors";

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerSlug: string;
  team?: string;
  sessionCount?: number;
  value: number;
}

interface PitchMix {
  pitch_type: string;
  count: number;
  pct: number;
}

interface Leaderboards {
  generated_at?: string;
  session_count: number;
  leaderboards: Record<string, LeaderboardEntry[]>;
  pitch_mix?: PitchMix[];
}

interface StuffPlusRow {
  playerId: string;
  playerName: string | null;
  pitchType: string;
  meanStuffPlus: number;
  avgVeloMph: number | null;
  nSessions: number | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  stuff_plus: "Stuff+",
  max_fb_velo: "Max FB Velo",
  avg_fb_velo: "Avg Fastball Velo",
  avg_fb_spin: "Avg Spin Rate (Fastballs)",
  avg_bb_spin: "Avg Spin Rate (Breaking Balls)",
  avg_extension: "Avg Extension",
};

const CATEGORY_UNITS: Record<string, string> = {
  max_fb_velo: "mph",
  avg_fb_velo: "mph",
  avg_fb_spin: "rpm",
  avg_bb_spin: "rpm",
  avg_extension: "ft",
};

const STUFF_PLUS_PITCH_ORDER = [
  "Fastball", "Sinker", "Cutter",
  "Slider", "Curveball", "Sweeper", "Knuckle Curve",
  "Changeup", "Splitter",
];

function fmt(v: number, cat: string): string {
  if (cat.includes("spin")) return v.toFixed(0);
  return v.toFixed(1);
}

function firstLast(name: string): string {
  const parts = name.split(", ");
  if (parts.length === 2) return `${parts[1]} ${parts[0]}`;
  return name;
}

function stuffPlusBadgeClass(v: number): string {
  if (v >= 110) return "bg-rose-600 text-white";
  if (v >= 100) return "bg-orange-500/80 text-white";
  if (v >= 90) return "bg-zinc-400 text-zinc-900";
  return "bg-sky-500/80 text-white";
}

export default function TrackmanLeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [stuffPlusRows, setStuffPlusRows] = useState<StuffPlusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [stuffPlusPitchFilter, setStuffPlusPitchFilter] = useState<string>("all");
  const [stuffPlusSearch, setStuffPlusSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/trackman/leaderboards.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/stuff-plus/leaderboard").then((r) => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] })),
    ]).then(([lb, sp]) => {
      setData(lb);
      setStuffPlusRows(
        (sp?.rows ?? []).map((r: Record<string, unknown>) => ({
          playerId: r.playerId as string,
          playerName: r.playerName as string | null,
          pitchType: r.pitchType as string,
          meanStuffPlus: Number(r.meanStuffPlus),
          avgVeloMph: r.avgVeloMph != null ? Number(r.avgVeloMph) : null,
          nSessions: r.nSessions != null ? Number(r.nSessions) : null,
        }))
      );
      setLoading(false);
    });
  }, []);

  const categories = useMemo(() => {
    const cats: string[] = [];
    if (stuffPlusRows.length > 0) cats.push("stuff_plus");
    if (data?.leaderboards) {
      for (const k of Object.keys(data.leaderboards)) {
        if (data.leaderboards[k].length > 0) cats.push(k);
      }
    }
    return cats;
  }, [data, stuffPlusRows]);

  // Default to first category when loaded
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
    }
  }, [categories]);

  const entries = useMemo(() => {
    if (activeCategory === "stuff_plus") return [];
    if (!data?.leaderboards?.[activeCategory]) return [];
    return data.leaderboards[activeCategory];
  }, [data, activeCategory]);

  const stuffPlusPitchTypes = useMemo(() => {
    const set = new Set(stuffPlusRows.map((r) => r.pitchType));
    return Array.from(set).sort((a, b) => {
      const ia = STUFF_PLUS_PITCH_ORDER.indexOf(a);
      const ib = STUFF_PLUS_PITCH_ORDER.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [stuffPlusRows]);

  const rankedStuffPlus = useMemo(() => {
    let d = stuffPlusRows;
    if (stuffPlusPitchFilter !== "all") {
      d = d.filter((r) => r.pitchType === stuffPlusPitchFilter);
    } else {
      const byPlayer = new Map<string, StuffPlusRow>();
      for (const r of d) {
        const existing = byPlayer.get(r.playerId);
        if (!existing || r.meanStuffPlus > existing.meanStuffPlus) {
          byPlayer.set(r.playerId, r);
        }
      }
      d = Array.from(byPlayer.values());
    }
    if (stuffPlusSearch.trim()) {
      const q = stuffPlusSearch.toLowerCase();
      d = d.filter(
        (r) =>
          firstLast(r.playerName ?? "").toLowerCase().includes(q) ||
          r.playerId.toLowerCase().includes(q)
      );
    }
    return [...d].sort((a, b) => b.meanStuffPlus - a.meanStuffPlus);
  }, [stuffPlusRows, stuffPlusPitchFilter, stuffPlusSearch]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/trackman" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-blue-400" />
          <h1 className="text-sm font-semibold">Trackman Leaderboards</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading leaderboards...</p>
        ) : categories.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No leaderboard data yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Import sessions with <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/import_trackman_pdf.py</code>, run{" "}
              <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/build_trackman_leaderboards.py</code>, or load Stuff+ with{" "}
              <code className="bg-zinc-800 px-1 py-0.5 rounded">npm run load:stuff-plus</code>
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            {data && data.session_count > 0 && (
              <div className="text-xs text-zinc-500 mb-4">
                {data.session_count} session{data.session_count !== 1 ? "s" : ""}
                {data.generated_at && (
                  <span className="ml-2">
                    Updated {new Date(data.generated_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                    activeCategory === cat
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {cat === "stuff_plus" && (
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  )}
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>

            {/* Stuff+ section */}
            {activeCategory && activeCategory === "stuff_plus" ? (
              <>
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={stuffPlusSearch}
                    onChange={(e) => setStuffPlusSearch(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setStuffPlusPitchFilter("all")}
                    className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                      stuffPlusPitchFilter === "all"
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    Best Pitch
                  </button>
                  {stuffPlusPitchTypes.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setStuffPlusPitchFilter(pt)}
                      className={`text-xs px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${
                        stuffPlusPitchFilter === pt
                          ? "bg-zinc-700 text-zinc-100"
                          : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pitchColor(pt) }}
                      />
                      {pt}
                    </button>
                  ))}
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Player</th>
                        {stuffPlusPitchFilter === "all" && (
                          <th className="px-3 py-2 text-left">Pitch</th>
                        )}
                        <th className="px-3 py-2 text-right">Stuff+</th>
                        <th className="px-3 py-2 text-right">Velo</th>
                        <th className="px-3 py-2 text-right">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedStuffPlus.map((r, i) => (
                        <tr
                          key={`${r.playerId}-${r.pitchType}-${i}`}
                          className="border-t border-zinc-800/50 hover:bg-zinc-800/20"
                        >
                          <td className="px-3 py-2 text-zinc-500 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 font-medium">
                            <Link
                              href={`/trackman/player/${r.playerId}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {firstLast(r.playerName ?? "")}
                            </Link>
                          </td>
                          {stuffPlusPitchFilter === "all" && (
                            <td className="px-3 py-2">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: pitchColor(r.pitchType) }}
                                />
                                {r.pitchType}
                              </span>
                            </td>
                          )}
                          <td className="px-3 py-2 text-right">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${stuffPlusBadgeClass(r.meanStuffPlus)}`}
                            >
                              {r.meanStuffPlus.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-400">
                            {r.avgVeloMph != null ? `${r.avgVeloMph.toFixed(1)} mph` : "—"}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-zinc-500">
                            {r.nSessions ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rankedStuffPlus.length === 0 && (
                  <p className="text-zinc-500 text-sm text-center py-6">No players match your search.</p>
                )}
              </>
            ) : activeCategory ? (
              <>
                {/* Trackman leaderboard table */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left w-10">#</th>
                        <th className="px-3 py-2 text-left">Player</th>
                        {activeCategory !== "max_fb_velo" && (
                          <th className="px-3 py-2 text-right">Sessions</th>
                        )}
                        <th className="px-3 py-2 text-right">
                          {CATEGORY_LABELS[activeCategory] ?? activeCategory}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, i) => (
                        <tr
                          key={`${e.playerSlug}-${i}`}
                          className="border-t border-zinc-800/50 hover:bg-zinc-800/20"
                        >
                          <td className="px-3 py-2 text-zinc-500 font-mono">{e.rank}</td>
                          <td className="px-3 py-2 font-medium">
                            <Link
                              href={`/trackman/player/${e.playerSlug}`}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              {firstLast(e.playerName)}
                            </Link>
                          </td>
                          {activeCategory !== "max_fb_velo" && (
                            <td className="px-3 py-2 text-right text-zinc-500 font-mono">
                              {e.sessionCount ?? "\u2014"}
                            </td>
                          )}
                          <td className="px-3 py-2 text-right font-mono font-medium">
                            {fmt(e.value, activeCategory)}{" "}
                            <span className="text-zinc-500">
                              {CATEGORY_UNITS[activeCategory] ?? ""}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {/* Pitch mix */}
            {data?.pitch_mix && data.pitch_mix.length > 0 && (
              <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <h3 className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
                  Team Pitch Mix
                </h3>
                <div className="flex gap-4 flex-wrap">
                  {data.pitch_mix.map((pm) => (
                    <div key={pm.pitch_type} className="text-center">
                      <div className="text-lg font-mono font-semibold">
                        {pm.pct}%
                      </div>
                      <div className="text-[10px] text-zinc-400">{pm.pitch_type}</div>
                      <div className="text-[10px] text-zinc-600">{pm.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
