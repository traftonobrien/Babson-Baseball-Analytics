"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, Search, Download, BookOpen } from "lucide-react";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import LogoutButton from "@/app/components/LogoutButton";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

interface BabsonPitcherRow {
  playerId: string;
  playerName: string;
  slug?: string;
  ip: number;
  h: number;
  er: number;
  bb: number;
  so: number;
  bf: number;
  war: number;
  era: number;
  whip: number;
  kPct: number;
  bbPct: number;
  kMinusBbPct: number;
  fip: number;
  k9: number;
  bb9: number;
  h9: number;
  gs: number;
  app: number;
  w: number;
  l: number;
  sv: number;
  eraPlus: number;
}

type SortKey = keyof Omit<BabsonPitcherRow, "playerId" | "playerName" | "slug">;
const SORT_KEYS: { key: SortKey; label: string; lowerBetter?: boolean }[] = [
  { key: "ip", label: "IP", lowerBetter: false },
  { key: "era", label: "ERA", lowerBetter: true },
  { key: "fip", label: "FIP", lowerBetter: true },
  { key: "whip", label: "WHIP", lowerBetter: true },
  { key: "k9", label: "K/9", lowerBetter: false },
  { key: "bb9", label: "BB/9", lowerBetter: true },
  { key: "h9", label: "H/9", lowerBetter: true },
  { key: "kPct", label: "K%", lowerBetter: false },
  { key: "bbPct", label: "BB%", lowerBetter: true },
  { key: "kMinusBbPct", label: "K-BB%", lowerBetter: false },
  { key: "eraPlus", label: "ERA+", lowerBetter: false },
  { key: "gs", label: "GS", lowerBetter: false },
  { key: "w", label: "W", lowerBetter: false },
  { key: "l", label: "L", lowerBetter: true },
  { key: "sv", label: "SV", lowerBetter: false },
  { key: "war", label: "WAR", lowerBetter: false },
];

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`;
  if (i === 1) return `text-zinc-400 ${glow}`;
  if (i === 2) return `text-amber-600 ${glow}`;
  return "text-zinc-500";
}

const DEFAULT_MIN_IP = 10;

export default function TeamStatsPage() {
  const [pitchers, setPitchers] = useState<BabsonPitcherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ip");
  const [sortDesc, setSortDesc] = useState(true);
  const [year, setYear] = useState("2025");
  const [minIp, setMinIp] = useState(DEFAULT_MIN_IP);
  const { slug: selectedSlug } = useSelectedPlayer();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/team-stats?year=${year}&minIp=10`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setPitchers(data.pitchers ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [year]);

  const filtered = useMemo(() => {
    if (!search.trim()) return pitchers;
    const q = search.toLowerCase();
    return pitchers.filter((p) => p.playerName.toLowerCase().includes(q));
  }, [pitchers, search]);

  const sorted = useMemo(() => {
    const config = SORT_KEYS.find((s) => s.key === sortKey);
    const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;
    return [...filtered].sort((a, b) => {
      const aQualified = a.ip >= minIp ? 1 : 0;
      const bQualified = b.ip >= minIp ? 1 : 0;
      if (aQualified !== bQualified) return bQualified - aQualified;
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      const diff = av - bv;
      return desc ? -diff : diff;
    });
  }, [filtered, sortKey, sortDesc, minIp]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(key);
    setSortDesc((prev) => (sortKey === key ? !prev : (SORT_KEYS.find((s) => s.key === key)?.lowerBetter === false)));
  }, [sortKey]);

  const exportCsv = useCallback(() => {
    const headers = ["Rank", "Player", "IP", "ERA", "FIP", "WHIP", "K/9", "BB/9", "H/9", "K%", "BB%", "K-BB%", "ERA+", "GS", "W", "L", "SV", "WAR"];
    const rows = sorted.map((p, i) => [
      i + 1,
      p.playerName,
      p.ip.toFixed(1),
      p.era.toFixed(2),
      p.fip.toFixed(2),
      p.whip.toFixed(2),
      p.k9.toFixed(1),
      p.bb9.toFixed(1),
      p.h9.toFixed(1),
      p.kPct.toFixed(1) + "%",
      p.bbPct.toFixed(1) + "%",
      p.kMinusBbPct.toFixed(1) + "%",
      p.eraPlus.toFixed(0),
      p.gs,
      p.w,
      p.l,
      p.sv,
      p.war.toFixed(1),
    ]);
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `babson-pitching-${year}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, year]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="absolute top-4 right-4">
        <LogoutButton />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Leaderboards", href: "/leaderboards-hub" }, { label: "Team Stats" }]} />
          <div className="flex items-start justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <BarChart3 className="w-6 h-6 text-sky-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
                  Statistics Leaderboard
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Babson pitchers ranked by D3 stats ({year})
                </p>
              </div>
            </div>

            <Link
              href="/team-stats/faq"
              className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-sky-500/50 hover:bg-zinc-800 text-sm text-zinc-300 hover:text-white transition-all shadow-sm group"
            >
              <BookOpen className="w-4 h-4 text-sky-400 group-hover:text-sky-300" />
              Metrics Dictionary
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-6 p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/60">
          <div className="flex gap-2">
            {["2025"].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-smooth ${year === y
                  ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  : "bg-zinc-900/60 border border-zinc-700/80 text-zinc-400 hover:border-zinc-600"
                  }`}
              >
                {y}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Qualified min IP:</span>
            <select
              value={minIp}
              onChange={(e) => setMinIp(Number(e.target.value))}
              className="text-xs bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-100 focus:outline-none focus:border-sky-500/50"
            >
              {[5, 10, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search players..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-smooth"
            />
          </div>
          {!loading && sorted.length > 0 && (
            <button
              type="button"
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-smooth text-xs font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
          {!loading && (
            <span className="text-xs font-semibold text-sky-400/80">
              {sorted.length} pitcher{sorted.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading && (
          <div className="py-12 text-center text-zinc-500">Loading Babson pitching stats...</div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-amber-400">
            {error}
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-900/30 shadow-xl shadow-black/20 max-h-[70vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Player
                  </th>
                  {SORT_KEYS.map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-sky-400/80 transition-smooth whitespace-nowrap"
                      onClick={() => handleSort(key)}
                    >
                      {label}
                      {sortKey === key && (
                        <span className="ml-1 text-sky-400">
                          {sortDesc ? "\u25BC" : "\u25B2"}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={18} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-zinc-500">No pitchers match your search.</span>
                        {search.trim() && (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="text-sm font-medium text-sky-400 hover:text-sky-300 transition-smooth"
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
                {sorted.map((p, i) => {
                  const isQualified = p.ip >= minIp;
                  const isMe = p.slug === selectedSlug;
                  return (
                    <tr
                      key={p.playerId}
                      className={`border-b border-zinc-800/50 transition-smooth ${isMe ? "bg-emerald-500/5" : ""
                        } ${isQualified ? "hover:bg-sky-500/5" : "opacity-60 hover:opacity-75"
                        }`}
                    >
                      <td className={`px-4 py-3 font-mono text-xs font-semibold ${isQualified ? rankColor(i) : "text-zinc-500"}`}>
                        {i + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={isQualified ? "font-medium" : "font-medium text-zinc-400"}>
                            {p.slug ? (
                              <Link
                                href={`/players/${p.slug}`}
                                className={`transition-smooth underline decoration-sky-500/30 underline-offset-2 hover:decoration-sky-400 ${isQualified ? "text-sky-400 hover:text-sky-300" : "text-zinc-400 hover:text-zinc-300"
                                  }`}
                              >
                                {p.playerName}
                                {isMe && <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 no-underline">You</span>}
                              </Link>
                            ) : (
                              p.playerName
                            )}
                          </span>
                          {!isQualified && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700/80 text-zinc-400 font-medium">
                              Unqualified
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.ip.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.era.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.fip > 0 ? p.fip.toFixed(2) : "—"}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.whip.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.k9.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.bb9.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.h9.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.kPct.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.bbPct.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.kMinusBbPct.toFixed(1)}%</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.eraPlus > 0 ? p.eraPlus.toFixed(0) : "—"}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.gs}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.w}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.l}</td>
                      <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{p.sv}</td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${!isQualified ? "text-zinc-500" : ""}`}>{p.war.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
