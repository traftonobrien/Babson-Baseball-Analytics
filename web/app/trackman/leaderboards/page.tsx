"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Trophy, Search, Download } from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import { pitchColor } from "@/lib/pitchColors";
import { getStuffPlusDisplayPitchType } from "@/lib/stuffPlusPitchOverrides";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { computeTotalStuffPlus, stuffPlusBadgeClass } from "@/lib/stuffPlusUtils";

interface LeaderboardEntry {
  rank: number;
  playerName: string;
  playerSlug: string;
  team?: string;
  sessionCount?: number;
  value: number;
  pitch_type?: string;
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

const CATEGORY_TOOLTIPS: Record<string, string> = {
  stuff_plus: "Pitch quality metric (100 = league average). Higher = better movement/velo/spin.",
  max_fb_velo: "Maximum fastball velocity from session. Primary fastball type used.",
  avg_fb_velo: "Average fastball velocity across sessions.",
  avg_fb_spin: "Average spin rate for fastballs (4-seam, sinker).",
  avg_bb_spin: "Average spin rate for breaking balls (slider, curve, sweeper).",
  avg_extension: "Average release extension (feet from rubber).",
};

const STUFF_PLUS_PITCH_ORDER = [
  "Fastball", "Sinker",
  "Slider", "Curveball", "Sweeper",
  "Changeup", "Splitter",
];

function fmt(v: number, cat: string): string {
  if (cat.includes("spin")) return v.toFixed(0);
  return v.toFixed(1);
}


function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`; // gold
  if (i === 1) return `text-zinc-400 ${glow}`; // silver
  if (i === 2) return `text-amber-600 ${glow}`; // bronze
  return "text-zinc-500";
}

export default function TrackmanLeaderboardsPage() {
  const [data, setData] = useState<Leaderboards | null>(null);
  const [stuffPlusRows, setStuffPlusRows] = useState<StuffPlusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("");
  const [stuffPlusPitchFilter, setStuffPlusPitchFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [categoryPitchFilter, setCategoryPitchFilter] = useState<string>("all");
  const { slug: selectedSlug } = useSelectedPlayer();

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

  const BASE_CATEGORIES = ["stuff_plus", "max_fb_velo", "avg_fb_velo", "avg_fb_spin", "avg_bb_spin", "avg_extension"];

  const categories = useMemo(() => {
    const cats: string[] = [];
    if (stuffPlusRows.length > 0) cats.push("stuff_plus");
    if (data?.leaderboards) {
      for (const k of BASE_CATEGORIES) {
        if (k !== "stuff_plus" && data.leaderboards[k]?.length > 0) cats.push(k);
      }
    }
    return cats.sort((a, b) => {
      const ia = BASE_CATEGORIES.indexOf(a);
      const ib = BASE_CATEGORIES.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [data, stuffPlusRows]);

  // Default to first category when loaded
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(activeCategory)) {
      setActiveCategory(categories[0]);
      setCategoryPitchFilter("all");
    }
  }, [categories]);

  // Reset pitch filter when switching categories
  useEffect(() => {
    setCategoryPitchFilter("all");
  }, [activeCategory]);

  const categoryPitchOptions = useMemo(() => {
    if (activeCategory === "stuff_plus") return [];
    const fastballCats = ["max_fb_velo", "avg_fb_velo", "avg_fb_spin", "avg_extension"];
    const breakingCats = ["avg_bb_spin"];
    if (fastballCats.includes(activeCategory)) {
      return [
        { value: "all", label: "All Fastballs" },
        { value: "Fastball", label: "Fastball" },
        { value: "Sinker", label: "Sinker" },
      ];
    }
    if (breakingCats.includes(activeCategory)) {
      return [
        { value: "all", label: "All Breaking" },
        { value: "Slider", label: "Slider" },
        { value: "Curveball", label: "Curveball" },
        { value: "Sweeper", label: "Sweeper" },
      ];
    }
    return [];
  }, [activeCategory]);

  const entries = useMemo(() => {
    if (activeCategory === "stuff_plus") return [];
    // max_fb_velo: values from CSV, filter by pitch_type when not "all"
    const isMaxFbVelo = activeCategory === "max_fb_velo";
    let list: LeaderboardEntry[];
    if (isMaxFbVelo && categoryPitchFilter !== "all") {
      const base = data?.leaderboards?.[activeCategory] ?? [];
      list = base.filter((e: LeaderboardEntry) => e.pitch_type === categoryPitchFilter);
      // Re-rank after filter
      list = [...list].sort((a, b) => b.value - a.value).map((e, i) => ({ ...e, rank: i + 1 }));
    } else if (categoryPitchFilter === "all") {
      list = data?.leaderboards?.[activeCategory] ?? [];
    } else {
      const key = `${activeCategory}_${categoryPitchFilter.toLowerCase().replace(/\s+/g, "_")}`;
      list = data?.leaderboards?.[key] ?? data?.leaderboards?.[activeCategory] ?? [];
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e: LeaderboardEntry) =>
          getCanonicalName(e.playerName).toLowerCase().includes(q) ||
          e.playerSlug.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, activeCategory, categoryPitchFilter, search]);

  const stuffPlusPitchTypes = useMemo(() => {
    const set = new Set(
      stuffPlusRows.map((r) => getStuffPlusDisplayPitchType(r.playerId, r.pitchType))
    );
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
    if (stuffPlusPitchFilter === "total") {
      // Group by player and average all pitch type scores
      const byPlayer = new Map<string, StuffPlusRow[]>();
      for (const r of d) {
        if (!byPlayer.has(r.playerId)) byPlayer.set(r.playerId, []);
        byPlayer.get(r.playerId)!.push(r);
      }
      d = Array.from(byPlayer.entries()).map(([, rows]) => {
        const avg = computeTotalStuffPlus(rows)!;
        return { ...rows[0], pitchType: "Total", meanStuffPlus: avg, avgVeloMph: null };
      });
    } else if (stuffPlusPitchFilter !== "all") {
      d = d.filter(
        (r) => getStuffPlusDisplayPitchType(r.playerId, r.pitchType) === stuffPlusPitchFilter
      );
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
    if (search.trim()) {
      const q = search.toLowerCase();
      d = d.filter(
        (r) =>
          getCanonicalName(r.playerName ?? r.playerId ?? "").toLowerCase().includes(q) ||
          r.playerId.toLowerCase().includes(q)
      );
    }
    return [...d].sort((a, b) => b.meanStuffPlus - a.meanStuffPlus);
  }, [stuffPlusRows, stuffPlusPitchFilter, search]);

  const exportCsv = useCallback(() => {
    if (activeCategory === "stuff_plus" || activeCategory === "") {
      const includeVelo = stuffPlusPitchFilter !== "total";
      const headers = includeVelo
        ? ["Rank", "Player", "Pitch", "Stuff+", "Velo (mph)", "Sessions"]
        : ["Rank", "Player", "Stuff+", "Sessions"];
      const rows = rankedStuffPlus.map((r, i) =>
        includeVelo
          ? [
              i + 1,
              getCanonicalName(r.playerName ?? r.playerId ?? ""),
              getStuffPlusDisplayPitchType(r.playerId, r.pitchType),
              r.meanStuffPlus.toFixed(1),
              r.avgVeloMph != null ? r.avgVeloMph.toFixed(1) : "",
              r.nSessions ?? "",
            ]
          : [
              i + 1,
              getCanonicalName(r.playerName ?? r.playerId ?? ""),
              r.meanStuffPlus.toFixed(1),
              r.nSessions ?? "",
            ]
      );
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trackman-stuff-plus-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers =
        activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0
          ? ["Rank", "Player", "Pitch", CATEGORY_LABELS[activeCategory] ?? activeCategory, "Unit"]
          : ["Rank", "Player", "Sessions", CATEGORY_LABELS[activeCategory] ?? activeCategory, "Unit"];
      const rows = entries.map((e, i) => {
        const pitchLabel = (e as LeaderboardEntry & { pitch_type?: string }).pitch_type ?? (categoryPitchFilter !== "all" ? categoryPitchFilter : "");
        if (activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0) {
          return [e.rank, getCanonicalName(e.playerName), pitchLabel, fmt(e.value, activeCategory), CATEGORY_UNITS[activeCategory] ?? ""];
        }
        return [e.rank, getCanonicalName(e.playerName), e.sessionCount ?? "", fmt(e.value, activeCategory), CATEGORY_UNITS[activeCategory] ?? ""];
      });
      const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trackman-${activeCategory}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [activeCategory, rankedStuffPlus, entries, categoryPitchFilter, categoryPitchOptions.length, stuffPlusPitchFilter]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Leaderboards", href: "/leaderboards-hub" }, { label: "Trackman" }]} />
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <Trophy className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                Trackman Leaderboards
              </h1>
              <p className="text-sm text-zinc-500 mt-0.5">
                Stuff+, velo, spin, and extension by session
              </p>
            </div>
          </div>
        </div>
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading leaderboards...</p>
        ) : categories.length === 0 ? (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-8 text-center">
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
            {/* Stats + Category tabs + Search */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
              {data && data.session_count > 0 && (
                <span className="text-xs font-medium text-zinc-500">
                  {data.session_count} session{data.session_count !== 1 ? "s" : ""}
                  {data.generated_at && (
                    <span className="ml-2">
                      · Updated {new Date(data.generated_at).toLocaleDateString()}
                    </span>
                  )}
                </span>
              )}
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    title={CATEGORY_TOOLTIPS[cat]}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth flex items-center gap-1.5 ${
                      activeCategory === cat
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm"
                        : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60"
                    }`}
                  >
                    {CATEGORY_LABELS[cat] ?? cat}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-smooth"
                />
              </div>
              {((activeCategory === "" && rankedStuffPlus.length > 0) || (activeCategory && entries.length > 0)) && (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-smooth text-xs font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
              )}
            </div>

            {/* Category pitch type filter (for non-Stuff+ categories) */}
            {categoryPitchOptions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {categoryPitchOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCategoryPitchFilter(opt.value)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth flex items-center gap-1.5 ${
                      categoryPitchFilter === opt.value
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    {opt.value !== "all" && (
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: pitchColor(opt.label) }}
                      />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Stuff+ section */}
            {activeCategory && activeCategory === "stuff_plus" ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setStuffPlusPitchFilter("total")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth ${
                      stuffPlusPitchFilter === "total"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    Total Stuff+
                  </button>
                  <button
                    onClick={() => setStuffPlusPitchFilter("all")}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth ${
                      stuffPlusPitchFilter === "all"
                        ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:border-zinc-600"
                    }`}
                  >
                    Best Pitch
                  </button>
                  {stuffPlusPitchTypes.map((pt) => (
                    <button
                      key={pt}
                      onClick={() => setStuffPlusPitchFilter(pt)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth flex items-center gap-1.5 ${
                        stuffPlusPitchFilter === pt
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:border-zinc-600"
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
                <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/30 shadow-xl shadow-black/20 overflow-hidden max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Player</th>
                        {stuffPlusPitchFilter === "all" && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Pitch</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider" title={CATEGORY_TOOLTIPS.stuff_plus}>Stuff+</th>
                        {stuffPlusPitchFilter !== "total" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Velo</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedStuffPlus.map((r, i) => {
                        const isMe = r.playerId === selectedSlug;
                        return (
                        <tr
                          key={`${r.playerId}-${r.pitchType}-${i}`}
                          className={`border-b border-zinc-800/50 hover:bg-blue-500/5 transition-smooth ${isMe ? "bg-emerald-500/5" : ""}`}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{i + 1}</td>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/trackman/player/${r.playerId}`}
                              className="text-blue-400 hover:text-blue-300 transition-smooth"
                            >
                              {getCanonicalName(r.playerName ?? r.playerId ?? "")}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">You</span>}
                            </Link>
                          </td>
                          {stuffPlusPitchFilter === "all" && (
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: pitchColor(
                                      getStuffPlusDisplayPitchType(r.playerId, r.pitchType)
                                    ),
                                  }}
                                />
                                {getStuffPlusDisplayPitchType(r.playerId, r.pitchType)}
                              </span>
                            </td>
                          )}
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold ${stuffPlusBadgeClass(r.meanStuffPlus)}`}
                            >
                              {r.meanStuffPlus.toFixed(1)}
                            </span>
                          </td>
                          {stuffPlusPitchFilter !== "total" && (
                            <td className="px-4 py-3 text-right font-mono text-zinc-400">
                              {r.avgVeloMph != null ? `${r.avgVeloMph.toFixed(1)} mph` : "—"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono text-zinc-500">
                            {r.nSessions ?? "—"}
                          </td>
                        </tr>
                      );
                      })}
                    </tbody>
                  </table>
                </div>
                {rankedStuffPlus.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <p className="text-zinc-500 text-sm">No players match your search.</p>
                    {search.trim() && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-smooth"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : activeCategory ? (
              <>
                {/* Trackman leaderboard table */}
                <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/30 shadow-xl shadow-black/20 overflow-hidden max-h-[70vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                      <tr>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
                        <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Player</th>
                        {activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0 && (
                          <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Pitch</th>
                        )}
                        {activeCategory !== "max_fb_velo" && (
                          <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Sessions</th>
                        )}
                        <th className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                          {CATEGORY_LABELS[activeCategory] ?? activeCategory}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-zinc-500">No players match your search.</span>
                              {search.trim() && (
                                <button
                                  type="button"
                                  onClick={() => setSearch("")}
                                  className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-smooth"
                                >
                                  Clear filters
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      {entries.map((e, i) => {
                        const pitchLabel = (e as LeaderboardEntry & { pitch_type?: string }).pitch_type ?? (categoryPitchFilter !== "all" ? categoryPitchFilter : null);
                        const isMe = e.playerSlug === selectedSlug;
                        return (
                        <tr
                          key={`${e.playerSlug}-${i}`}
                          className={`border-b border-zinc-800/50 hover:bg-blue-500/5 transition-smooth ${isMe ? "bg-emerald-500/5" : ""}`}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${rankColor(i)}`}>{e.rank}</td>
                          <td className="px-4 py-3 font-medium">
                            <Link
                              href={`/trackman/player/${e.playerSlug}`}
                              className="text-blue-400 hover:text-blue-300 transition-smooth"
                            >
                              {getCanonicalName(e.playerName)}
                              {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">You</span>}
                            </Link>
                          </td>
                          {activeCategory === "max_fb_velo" && categoryPitchOptions.length > 0 && (
                            <td className="px-4 py-3">
                              {pitchLabel ? (
                                <span className="inline-flex items-center gap-1">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: pitchColor(pitchLabel) }}
                                  />
                                  {pitchLabel}
                                </span>
                              ) : (
                                <span className="text-zinc-500">—</span>
                              )}
                            </td>
                          )}
                          {activeCategory !== "max_fb_velo" && (
                            <td className="px-4 py-3 text-right text-zinc-500 font-mono">
                              {e.sessionCount ?? "\u2014"}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-mono font-medium">
                            {fmt(e.value, activeCategory)}{" "}
                            <span className="text-zinc-500">
                              {CATEGORY_UNITS[activeCategory] ?? ""}
                            </span>
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {/* Pitch mix */}
            {data?.pitch_mix && data.pitch_mix.length > 0 && (
              <div className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-5">
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
