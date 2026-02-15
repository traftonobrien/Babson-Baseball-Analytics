"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";

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

const CATEGORY_LABELS: Record<string, string> = {
  avg_fb_velo: "Avg Fastball Velo",
  avg_fb_spin: "Avg Spin Rate (Fastballs)",
  avg_bb_spin: "Avg Spin Rate (Breaking Balls)",
  avg_extension: "Avg Extension",
};

const CATEGORY_UNITS: Record<string, string> = {
  avg_fb_velo: "mph",
  avg_fb_spin: "rpm",
  avg_bb_spin: "rpm",
  avg_extension: "ft",
};

function fmt(v: number, cat: string): string {
  if (cat.includes("spin")) return v.toFixed(0);
  return v.toFixed(1);
}

export default function TrackmanLeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("avg_fb_velo");

  useEffect(() => {
    fetch("/trackman/leaderboards.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    if (!data?.leaderboards) return [];
    return Object.keys(data.leaderboards).filter(
      (k) => data.leaderboards[k].length > 0,
    );
  }, [data]);

  const entries = useMemo(() => {
    if (!data?.leaderboards?.[activeCategory]) return [];
    return data.leaderboards[activeCategory];
  }, [data, activeCategory]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/trackman" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h1 className="text-sm font-semibold">Trackman Leaderboards</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading leaderboards...</p>
        ) : !data || data.session_count === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <Trophy className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No leaderboard data yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Import sessions with <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/import_trackman_pdf.py</code> then
              run <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/build_trackman_leaderboards.py</code>
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="text-xs text-zinc-500 mb-4">
              {data.session_count} session{data.session_count !== 1 ? "s" : ""}
              {data.generated_at && (
                <span className="ml-2">
                  Updated {new Date(data.generated_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                    activeCategory === cat
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  {CATEGORY_LABELS[cat] ?? cat}
                </button>
              ))}
            </div>

            {/* Leaderboard table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-zinc-800/50 text-zinc-400 uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left w-10">#</th>
                    <th className="px-3 py-2 text-left">Player</th>
                    <th className="px-3 py-2 text-right">Sessions</th>
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
                      <td className="px-3 py-2 font-medium">{e.playerName}</td>
                      <td className="px-3 py-2 text-right text-zinc-500 font-mono">
                        {e.sessionCount ?? "\u2014"}
                      </td>
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

            {/* Pitch mix */}
            {data.pitch_mix && data.pitch_mix.length > 0 && (
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
