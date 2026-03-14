"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, Search, BookOpen } from "lucide-react";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import LogoutButton from "@/app/components/LogoutButton";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

type StatMode = "pitching" | "batting";

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

interface BabsonHitterRow {
  playerId: string;
  playerName: string;
  slug?: string;
  pa: number;
  ab: number;
  h: number;
  r: number;
  hr: number;
  rbi: number;
  sb: number;
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPct: number;
  bbPct: number;
  wrcPlus: number;
  war: number;
}

type SortKey = keyof Omit<BabsonPitcherRow, "playerId" | "playerName" | "slug">;
type HitterSortKey = keyof Omit<BabsonHitterRow, "playerId" | "playerName" | "slug">;
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
const HITTER_SORT_KEYS: { key: HitterSortKey; label: string; lowerBetter?: boolean }[] = [
  { key: "pa", label: "PA", lowerBetter: false },
  { key: "avg", label: "AVG", lowerBetter: false },
  { key: "obp", label: "OBP", lowerBetter: false },
  { key: "slg", label: "SLG", lowerBetter: false },
  { key: "ops", label: "OPS", lowerBetter: false },
  { key: "hr", label: "HR", lowerBetter: false },
  { key: "rbi", label: "RBI", lowerBetter: false },
  { key: "r", label: "R", lowerBetter: false },
  { key: "h", label: "H", lowerBetter: false },
  { key: "sb", label: "SB", lowerBetter: false },
  { key: "bbPct", label: "BB%", lowerBetter: false },
  { key: "kPct", label: "K%", lowerBetter: true },
  { key: "wrcPlus", label: "wRC+", lowerBetter: false },
  { key: "war", label: "WAR", lowerBetter: false },
];

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`;
  if (i === 1) return `text-zinc-400 ${glow}`;
  if (i === 2) return `text-amber-600 ${glow}`;
  return "text-zinc-500";
}

const DEFAULT_MIN_IP = 1;
const DEFAULT_MIN_PA = 1;

export default function TeamStatsPage() {
  const [statMode, setStatMode] = useState<StatMode>("pitching");
  const [pitchers, setPitchers] = useState<BabsonPitcherRow[]>([]);
  const [hitters, setHitters] = useState<BabsonHitterRow[]>([]);
  const [seasonYear, setSeasonYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ip");
  const [hitterSortKey, setHitterSortKey] = useState<HitterSortKey>("ops");
  const [sortDesc, setSortDesc] = useState(true);
  const [hitterSortDesc, setHitterSortDesc] = useState(true);
  const [minIp, setMinIp] = useState(DEFAULT_MIN_IP);
  const [minPa, setMinPa] = useState(DEFAULT_MIN_PA);
  const { slug: selectedSlug } = useSelectedPlayer();

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/team-stats?statType=${statMode}&minIp=1`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPitchers(data.pitchers ?? []);
        setHitters(data.hitters ?? []);
        setSeasonYear(typeof data.year === "string" ? data.year : null);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [statMode]);

  const filteredPitchers = useMemo(() => {
    if (!search.trim()) return pitchers;
    const q = search.toLowerCase();
    return pitchers.filter((p) => p.playerName.toLowerCase().includes(q));
  }, [pitchers, search]);

  const filteredHitters = useMemo(() => {
    if (!search.trim()) return hitters;
    const q = search.toLowerCase();
    return hitters.filter((h) => h.playerName.toLowerCase().includes(q));
  }, [hitters, search]);

  const sortedPitchers = useMemo(() => {
    const config = SORT_KEYS.find((s) => s.key === sortKey);
    const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === sortDesc : sortDesc;
    return [...filteredPitchers].sort((a, b) => {
      const aQualified = a.ip >= minIp ? 1 : 0;
      const bQualified = b.ip >= minIp ? 1 : 0;
      if (aQualified !== bQualified) return bQualified - aQualified;
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      const diff = av - bv;
      return desc ? -diff : diff;
    });
  }, [filteredPitchers, sortKey, sortDesc, minIp]);

  const sortedHitters = useMemo(() => {
    const config = HITTER_SORT_KEYS.find((s) => s.key === hitterSortKey);
    const desc = config?.lowerBetter !== undefined ? !config.lowerBetter === hitterSortDesc : hitterSortDesc;
    return [...filteredHitters].sort((a, b) => {
      const aQualified = a.pa >= minPa ? 1 : 0;
      const bQualified = b.pa >= minPa ? 1 : 0;
      if (aQualified !== bQualified) return bQualified - aQualified;
      const av = a[hitterSortKey] as number;
      const bv = b[hitterSortKey] as number;
      const diff = av - bv;
      return desc ? -diff : diff;
    });
  }, [filteredHitters, hitterSortKey, hitterSortDesc, minPa]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(key);
    setSortDesc((prev) => (sortKey === key ? !prev : (SORT_KEYS.find((s) => s.key === key)?.lowerBetter === false)));
  }, [sortKey]);

  const handleHitterSort = useCallback((key: HitterSortKey) => {
    setHitterSortKey(key);
    setHitterSortDesc((prev) => (hitterSortKey === key ? !prev : (HITTER_SORT_KEYS.find((s) => s.key === key)?.lowerBetter === false)));
  }, [hitterSortKey]);

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <LeaderboardIntro
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Leaderboards", href: "/leaderboards-hub" },
          { label: "Statistics" },
        ]}
        actions={<LogoutButton />}
      >
        <LeaderboardHero
          tone="sky"
          icon={BarChart3}
          eyebrow="Statistics"
          title={<>Statistics Leaderboard</>}
          meta={(
            <>
              <LeaderboardPill tone="sky">
                {seasonYear ? `${seasonYear} season` : "Season stats"}
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {statMode === "pitching" ? `${minIp}+ IP qualifies` : `${minPa}+ PA qualifies`}
              </LeaderboardPill>
            </>
          )}
          side={(
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Guide</div>
              <Link
                href="/team-stats/faq"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3.5 text-sm font-semibold text-sky-300 transition-smooth hover:border-sky-400/40 hover:text-sky-200"
              >
                <BookOpen className="h-4 w-4" />
                Metrics Dictionary
              </Link>
            </div>
          )}
        />
      </LeaderboardIntro>

      <LeaderboardToolbar>
        <div className="grid gap-4 xl:grid-cols-[minmax(13rem,16rem)_minmax(12rem,14rem)_minmax(0,1fr)_auto] xl:items-end">
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              View
            </div>
            <div className="inline-flex rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
              {(["pitching", "batting"] as const).map((mode) => {
                const isActive = statMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStatMode(mode)}
                    className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-smooth ${
                      isActive
                        ? "bg-sky-500/15 text-sky-200"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {mode === "pitching" ? "Pitchers" : "Hitters"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Qualification Floor
            </div>
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
              {statMode === "pitching" ? (
                <select
                  value={minIp}
                  onChange={(e) => setMinIp(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                >
                  {[1, 5, 10, 15, 20, 25, 30].map((n) => (
                    <option key={n} value={n}>
                      {n} IP
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  value={minPa}
                  onChange={(e) => setMinPa(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                >
                  {[1, 10, 20, 30, 40, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} PA
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Search
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                type="text"
                placeholder={statMode === "pitching" ? "Search pitcher..." : "Search hitter..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {search.trim() ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </LeaderboardToolbar>

      {loading ? (
        <LeaderboardPanel className="mt-6 p-10 text-center text-zinc-500">
          Loading statistics...
        </LeaderboardPanel>
      ) : error ? (
        <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-rose-200">
          {error}
        </div>
      ) : (
        <LeaderboardPanel className="mt-6 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Player
                  </th>
                  {(statMode === "pitching" ? SORT_KEYS : HITTER_SORT_KEYS).map(({ key, label }) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-sky-300 transition-smooth whitespace-nowrap"
                      onClick={() => statMode === "pitching" ? handleSort(key as SortKey) : handleHitterSort(key as HitterSortKey)}
                    >
                      {label}
                      {(statMode === "pitching" ? sortKey === key : hitterSortKey === key) ? (
                        <span className="ml-1 text-sky-300">
                          {(statMode === "pitching" ? sortDesc : hitterSortDesc) ? "\u25BC" : "\u25B2"}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(statMode === "pitching" ? sortedPitchers.length : sortedHitters.length) === 0 ? (
                  <tr>
                    <td colSpan={18} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-zinc-500">
                          {statMode === "pitching" ? "No pitchers match your search." : "No hitters match your search."}
                        </span>
                        {search.trim() ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="text-sm font-medium text-sky-300 hover:text-sky-200 transition-smooth"
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
                {statMode === "pitching"
                  ? sortedPitchers.map((p, i) => {
                      const isQualified = p.ip >= minIp;
                      const isMe = p.slug === selectedSlug;
                      return (
                        <tr
                          key={p.playerId}
                          className={`border-b border-zinc-800/50 transition-smooth ${isMe ? "bg-emerald-500/5" : ""} ${isQualified ? "hover:bg-sky-500/5" : "opacity-60 hover:opacity-75"}`}
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
                                    className={`transition-smooth underline decoration-sky-500/30 underline-offset-2 hover:decoration-sky-400 ${isQualified ? "text-sky-300 hover:text-sky-200" : "text-zinc-400 hover:text-zinc-300"}`}
                                  >
                                    {p.playerName}
                                    {isMe ? <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 no-underline">You</span> : null}
                                  </Link>
                                ) : (
                                  p.playerName
                                )}
                              </span>
                              {!isQualified ? (
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                  Unqualified
                                </span>
                              ) : null}
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
                    })
                  : sortedHitters.map((h, i) => {
                      const isQualified = h.pa >= minPa;
                      const isMe = h.slug === selectedSlug;
                      const formatRate = (value: number) => value > 0 ? value.toFixed(3).replace(/^0/, "") : ".000";
                      return (
                        <tr
                          key={h.playerId}
                          className={`border-b border-zinc-800/50 transition-smooth ${isMe ? "bg-emerald-500/5" : ""} ${isQualified ? "hover:bg-sky-500/5" : "opacity-60 hover:opacity-75"}`}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${isQualified ? rankColor(i) : "text-zinc-500"}`}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={isQualified ? "font-medium" : "font-medium text-zinc-400"}>
                                {h.slug ? (
                                  <Link
                                    href={`/players/${h.slug}`}
                                    className={`transition-smooth underline decoration-sky-500/30 underline-offset-2 hover:decoration-sky-400 ${isQualified ? "text-sky-300 hover:text-sky-200" : "text-zinc-400 hover:text-zinc-300"}`}
                                  >
                                    {h.playerName}
                                    {isMe ? <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 no-underline">You</span> : null}
                                  </Link>
                                ) : (
                                  h.playerName
                                )}
                              </span>
                              {!isQualified ? (
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                  Unqualified
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.pa}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{formatRate(h.avg)}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{formatRate(h.obp)}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{formatRate(h.slg)}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{formatRate(h.ops)}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.hr}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.rbi}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.r}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.h}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.sb}</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.bbPct.toFixed(1)}%</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.kPct.toFixed(1)}%</td>
                          <td className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>{h.wrcPlus > 0 ? h.wrcPlus.toFixed(0) : "—"}</td>
                          <td className={`px-4 py-3 text-right font-mono font-medium ${!isQualified ? "text-zinc-500" : ""}`}>{h.war.toFixed(1)}</td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </LeaderboardPanel>
      )}
    </LeaderboardPageFrame>
  );
}
