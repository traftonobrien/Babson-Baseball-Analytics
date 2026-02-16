"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search,
  Trophy,
  Clock,
  Users,
  Activity,
  Target,
  Calendar,
  ChevronDown,
  X,
  ArrowUpRight,
  Radio,
} from "lucide-react";
import { players, type Player, type Outing } from "@/lib/dataIndex";
import LogoutButton from "./components/LogoutButton";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePitchCount(label: string): number {
  const match = label.match(/\((\d+)\s+pitches?\)/);
  return match ? parseInt(match[1], 10) : 0;
}

function parseDateFromId(outingId: string): Date | null {
  const parts = outingId.split("/");
  if (parts.length < 2) return null;
  const segments = parts[1].split("_");
  if (segments.length < 3) return null;
  const [y, m, d] = segments.map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getYearFromId(outingId: string): number | null {
  const date = parseDateFromId(outingId);
  return date ? date.getFullYear() : null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortOption = "recent" | "pitches" | "outings" | "az";
type SeasonFilter = "all" | "2025" | "2026";
type HandFilter = "all" | "R" | "L";

// ---------------------------------------------------------------------------
// Segment control (matches leaderboards pattern)
// ---------------------------------------------------------------------------

function Segment<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; display: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex rounded-md overflow-hidden border border-zinc-700"
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 ${
            value === opt.value
              ? "bg-zinc-700 text-zinc-100"
              : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800"
          }`}
        >
          {opt.display}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HomeContent
// ---------------------------------------------------------------------------

export default function HomeContent() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("recent");
  const [season, setSeason] = useState<SeasonFilter>("all");
  const [hand, setHand] = useState<HandFilter>("all");
  const playersRef = useRef<HTMLDivElement>(null);

  // --- Aggregates ---
  const stats = useMemo(() => {
    const totalPlayers = players.length;
    const totalOutings = players.reduce(
      (sum, p) => sum + p.outings.length,
      0,
    );
    const totalPitches = players.reduce(
      (sum, p) =>
        sum + p.outings.reduce((s, o) => s + parsePitchCount(o.label), 0),
      0,
    );

    let mostRecentDate: Date | null = null;
    let mostRecentOuting: { player: Player; outing: Outing } | null = null;

    for (const p of players) {
      for (const o of p.outings) {
        const d = parseDateFromId(o.id);
        if (d && (!mostRecentDate || d > mostRecentDate)) {
          mostRecentDate = d;
          mostRecentOuting = { player: p, outing: o };
        }
      }
    }

    return {
      totalPlayers,
      totalOutings,
      totalPitches,
      mostRecentDate,
      mostRecentOuting,
    };
  }, []);

  // --- Recent outings (flattened, sorted) ---
  const recentOutings = useMemo(() => {
    const all: { player: Player; outing: Outing; date: Date }[] = [];
    for (const p of players) {
      for (const o of p.outings) {
        const d = parseDateFromId(o.id);
        if (d) all.push({ player: p, outing: o, date: d });
      }
    }
    return all.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, []);

  // --- Filtered + sorted players ---
  const filteredPlayers = useMemo(() => {
    let result = players.filter((p) => {
      if (hand === "R" && p.throws !== "R") return false;
      if (hand === "L" && p.throws !== "L") return false;

      if (season !== "all") {
        const yr = parseInt(season, 10);
        if (!p.outings.some((o) => getYearFromId(o.id) === yr)) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        const nameMatch = p.name.toLowerCase().includes(q);
        const outingMatch = p.outings.some((o) =>
          o.label.toLowerCase().includes(q),
        );
        if (!nameMatch && !outingMatch) return false;
      }

      return true;
    });

    switch (sort) {
      case "recent":
        result = [...result].sort((a, b) => {
          const ad = Math.max(
            ...a.outings.map((o) => parseDateFromId(o.id)?.getTime() ?? 0),
          );
          const bd = Math.max(
            ...b.outings.map((o) => parseDateFromId(o.id)?.getTime() ?? 0),
          );
          return bd - ad;
        });
        break;
      case "pitches":
        result = [...result].sort((a, b) => {
          const ap = a.outings.reduce(
            (s, o) => s + parsePitchCount(o.label),
            0,
          );
          const bp = b.outings.reduce(
            (s, o) => s + parsePitchCount(o.label),
            0,
          );
          return bp - ap;
        });
        break;
      case "outings":
        result = [...result].sort(
          (a, b) => b.outings.length - a.outings.length,
        );
        break;
      case "az":
        result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return result;
  }, [search, sort, season, hand]);

  // --- Filtered recent outings ---
  const filteredRecentOutings = useMemo(() => {
    return recentOutings
      .filter((item) => {
        if (season !== "all") {
          const yr = parseInt(season, 10);
          if (item.date.getFullYear() !== yr) return false;
        }
        if (hand !== "all" && item.player.throws !== hand) return false;
        return true;
      })
      .slice(0, 12);
  }, [recentOutings, season, hand]);

  const hasActiveFilters =
    search !== "" || sort !== "recent" || season !== "all" || hand !== "all";

  function resetFilters() {
    setSearch("");
    setSort("recent");
    setSeason("all");
    setHand("all");
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
      {/* Logout */}
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* ---- Header ---- */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-semibold">Pitch Tracker</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Command tracking and pitch analysis
          </p>
        </motion.div>

        {/* ---- Pitching Hub (hero card) ---- */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Link href="/players">
            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-zinc-900 to-zinc-900/80 p-6 hover:border-emerald-500/60 transition-colors group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-lg font-semibold text-zinc-100">Babson Pitching Hub</span>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      Player profiles, D3 stats, Savant percentiles, Trackman and command data
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-5 h-5 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* ---- Sessions + Leaderboards (2×2 grid) ---- */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.08 }}
        >
          {/* Left column: Command */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() =>
                playersRef.current?.scrollIntoView({ behavior: "smooth" })
              }
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group text-left"
              aria-label="Scroll to command sessions"
            >
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-sm">Command Sessions</span>
                <ChevronDown className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-zinc-300 transition-colors" />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {stats.totalPlayers} pitchers &middot; {stats.totalOutings} outings
              </p>
            </button>
            <Link href="/leaderboards">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span className="font-medium text-sm">Command Leaderboards</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-zinc-300 transition-colors" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Compare command stats across pitchers
                </p>
              </div>
            </Link>
          </div>

          {/* Right column: Trackman */}
          <div className="flex flex-col gap-3">
            <Link href="/trackman">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-emerald-400" />
                  <span className="font-medium text-sm">Trackman Sessions</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-zinc-300 transition-colors" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  View imported Trackman data
                </p>
              </div>
            </Link>
            <Link href="/trackman/leaderboards">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-sm">Trackman Leaderboards</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-zinc-300 transition-colors" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Compare Trackman metrics across pitchers
                </p>
              </div>
            </Link>
          </div>
        </motion.div>

        {/* ---- Latest Outing ---- */}
        {stats.mostRecentOuting && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
          >
            <Link
              href={`/player/${stats.mostRecentOuting.player.id}?outingId=${stats.mostRecentOuting.outing.id}`}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-zinc-600 transition-colors group">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-sm">Latest Outing</span>
                  <span className="text-xs text-zinc-500 truncate">
                    {stats.mostRecentOuting.player.name} &middot;{" "}
                    {stats.mostRecentDate
                      ? formatDate(stats.mostRecentDate)
                      : ""}
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-zinc-300 transition-colors" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ---- At a Glance ---- */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {[
            { label: "Players", value: stats.totalPlayers, Icon: Users },
            { label: "Outings", value: stats.totalOutings, Icon: Activity },
            {
              label: "Pitches",
              value: stats.totalPitches.toLocaleString(),
              Icon: Target,
            },
            {
              label: "Latest",
              value: stats.mostRecentDate
                ? formatDate(stats.mostRecentDate)
                : "\u2014",
              Icon: Calendar,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2"
            >
              <div className="text-xs text-zinc-500 flex items-center gap-1">
                <stat.Icon className="w-3 h-3" />
                {stat.label}
              </div>
              <div className="text-lg font-semibold font-mono mt-0.5">
                {stat.value}
              </div>
            </div>
          ))}
        </motion.div>

        {/* ---- Sticky Control Bar ---- */}
        <div
          ref={playersRef}
          className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/50 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mt-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-grow max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players or outings..."
                className="w-full bg-zinc-900 border border-zinc-700 rounded-md pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                aria-label="Sort order"
                className="appearance-none bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 pr-7 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 cursor-pointer"
              >
                <option value="recent">Most Recent</option>
                <option value="pitches">Most Pitches</option>
                <option value="outings">Most Outings</option>
                <option value="az">A&ndash;Z</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            </div>

            {/* Season */}
            <Segment
              label="Season filter"
              options={[
                { value: "all" as SeasonFilter, display: "All" },
                { value: "2025" as SeasonFilter, display: "2025" },
                { value: "2026" as SeasonFilter, display: "2026" },
              ]}
              value={season}
              onChange={setSeason}
            />

            {/* Hand */}
            <Segment
              label="Hand filter"
              options={[
                { value: "all" as HandFilter, display: "All" },
                { value: "R" as HandFilter, display: "RHP" },
                { value: "L" as HandFilter, display: "LHP" },
              ]}
              value={hand}
              onChange={setHand}
            />

            {/* Reset */}
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Reset
              </button>
            )}
          </div>
        </div>

        {/* ---- Main Content ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* Player List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              {filteredPlayers.length} player
              {filteredPlayers.length !== 1 ? "s" : ""}
            </div>

            {filteredPlayers.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
                <p className="text-zinc-500 text-sm">
                  No players match your filters.
                </p>
                <button
                  onClick={resetFilters}
                  className="mt-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              filteredPlayers.map((player, i) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(i * 0.03, 0.3),
                  }}
                  className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/player/${player.id}`}
                      className="flex items-center gap-2 group"
                    >
                      <span className="font-medium text-sm group-hover:text-blue-400 transition-colors">
                        {player.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                          player.throws === "L"
                            ? "bg-blue-900/40 text-blue-400"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {player.throws === "L" ? "LHP" : "RHP"}
                      </span>
                    </Link>
                    <span className="text-xs text-zinc-500">
                      {player.outings.length} outing
                      {player.outings.length !== 1 ? "s" : ""} &middot;{" "}
                      {player.outings.reduce(
                        (s, o) => s + parsePitchCount(o.label),
                        0,
                      )}{" "}
                      pitches
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {player.outings.map((o) => {
                      const d = parseDateFromId(o.id);
                      const pitches = parsePitchCount(o.label);
                      return (
                        <Link
                          key={o.id}
                          href={`/player/${player.id}?outingId=${o.id}`}
                          className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors text-zinc-400 hover:text-zinc-200"
                        >
                          {d ? formatDateShort(d) : o.label}
                          {pitches > 0 && (
                            <span className="text-zinc-500 ml-1">
                              ({pitches})
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Recent Outings Feed */}
          <div className="lg:col-span-1">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Recent Outings
            </div>
            <div className="space-y-1.5">
              {filteredRecentOutings.length === 0 ? (
                <div className="text-xs text-zinc-500 text-center py-4">
                  No outings match filters.
                </div>
              ) : (
                filteredRecentOutings.map((item, i) => (
                  <motion.div
                    key={item.outing.id}
                    initial={{ opacity: 0, x: 6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.2,
                      delay: Math.min(i * 0.03, 0.3),
                    }}
                  >
                    <Link
                      href={`/player/${item.player.id}?outingId=${item.outing.id}`}
                      className="block bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2 hover:border-zinc-600 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-300 group-hover:text-zinc-100 transition-colors">
                          {item.player.name}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${
                            item.player.throws === "L"
                              ? "bg-blue-900/40 text-blue-400"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {item.player.throws === "L" ? "LHP" : "RHP"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-zinc-500">
                          {formatDate(item.date)}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          {parsePitchCount(item.outing.label)} pitches
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
