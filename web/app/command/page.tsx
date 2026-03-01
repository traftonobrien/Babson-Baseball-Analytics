"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Target, ChevronRight, Users, Activity, Calendar } from "lucide-react";
import Breadcrumbs from "../components/Breadcrumbs";
import Segment from "../components/Segment";
import { players, type Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { getCanonicalPlayerId } from "@/lib/canonicalPlayers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ViewMode = "outings" | "players";

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

function outingSeason(o: Outing): number | null {
  const dateId = o.id.split("/")[1];
  return dateId ? seasonFromDateId(dateId) : null;
}

// ---------------------------------------------------------------------------
// Command Hub Page
// ---------------------------------------------------------------------------

export default function CommandPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("outings");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [seasonFilter, setSeasonFilter] = useState<string>("2026");
  const { slug: selectedSlug } = useSelectedPlayer();
  const selectedPlayerId = selectedSlug ? getCanonicalPlayerId(selectedSlug) : null;

  // All seasons present in the data
  const allSeasons = useMemo(() => {
    const s = new Set<number>();
    for (const p of players) {
      for (const o of p.outings) {
        const yr = outingSeason(o);
        if (yr) s.add(yr);
      }
    }
    return Array.from(s).sort((a, b) => b - a);
  }, []);

  // Filter outings by season
  const filterOutings = useMemo(() => {
    return (outings: Outing[]) => {
      if (seasonFilter === "all") return outings;
      const yr = Number(seasonFilter);
      return outings.filter((o) => outingSeason(o) === yr);
    };
  }, [seasonFilter]);

  // Stats summary (respects season filter)
  const stats = useMemo(() => {
    const filteredPlayers = players.filter((p) => filterOutings(p.outings).length > 0);
    const totalPlayers = filteredPlayers.length;
    const totalOutings = filteredPlayers.reduce((s, p) => s + filterOutings(p.outings).length, 0);
    const totalPitches = filteredPlayers.reduce(
      (s, p) => s + filterOutings(p.outings).reduce((a, o) => a + parsePitchCount(o.label), 0),
      0,
    );
    let mostRecentDate: Date | null = null;
    for (const p of filteredPlayers) {
      for (const o of filterOutings(p.outings)) {
        const d = parseDateFromId(o.id);
        if (d && (!mostRecentDate || d > mostRecentDate)) mostRecentDate = d;
      }
    }
    return { totalPlayers, totalOutings, totalPitches, mostRecentDate };
  }, [filterOutings]);

  // Outing view: flat list of all outings sorted by date (most recent first)
  const outingRows = useMemo(() => {
    const rows: { player: typeof players[0]; outing: Outing; date: Date | null; pitchCount: number }[] = [];
    for (const p of players) {
      for (const o of filterOutings(p.outings)) {
        rows.push({
          player: p,
          outing: o,
          date: parseDateFromId(o.id),
          pitchCount: parsePitchCount(o.label),
        });
      }
    }
    rows.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
    return rows;
  }, [filterOutings]);

  // Player view: grouped by pitcher
  const pitcherData = useMemo(() => {
    const data = players
      .map((p) => {
        const filtered = filterOutings(p.outings);
        const outings = [...filtered]
          .map((o) => ({ ...o, date: parseDateFromId(o.id) }))
          .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
        const totalPitches = filtered.reduce(
          (s, o) => s + parsePitchCount(o.label),
          0,
        );
        const latestDate = outings[0]?.date ?? null;
        return { player: p, outings, totalPitches, latestDate };
      })
      .filter((item) => item.outings.length > 0)
      .sort(
        (a, b) =>
          (b.latestDate?.getTime() ?? 0) - (a.latestDate?.getTime() ?? 0),
      );
    if (selectedPlayerId) {
      const idx = data.findIndex((d) => d.player.id === selectedPlayerId);
      if (idx > 0) {
        const [me] = data.splice(idx, 1);
        data.unshift(me);
      }
    }
    return data;
  }, [selectedPlayerId, filterOutings]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Command Hub" }]} />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
            <div>
              <h1 className="text-2xl font-semibold flex items-center gap-2">
                <Target className="w-5 h-5 text-orange-400" />
                Command Hub
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                All command tracking outings by pitcher
              </p>
            </div>

            {/* Leaderboards Link Button */}
            <Link
              href="/leaderboards"
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium text-zinc-300 hover:text-orange-400 hover:border-orange-500/30 transition-all hover:bg-orange-500/5 group"
            >
              <Target className="w-4 h-4 text-orange-500 group-hover:scale-110 transition-transform" />
              View Command Leaderboards
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-orange-400 transition-colors" />
            </Link>
          </div>
        </motion.div>

        {/* Controls: View Mode + Season */}
        <motion.div
          className="flex flex-wrap items-center gap-4 mb-6"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.03 }}
        >
          <Segment
            label="View"
            options={[
              { value: "outings", display: "Latest Outings" },
              { value: "players", display: "By Player" },
            ]}
            selected={viewMode}
            onChange={(v) => setViewMode(v as ViewMode)}
          />
          {allSeasons.length > 1 && (
            <Segment
              label="Season"
              options={[
                ...allSeasons.map((yr) => ({ value: String(yr), display: String(yr) })),
                { value: "all", display: "All" },
              ]}
              selected={seasonFilter}
              onChange={setSeasonFilter}
            />
          )}
        </motion.div>

        {/* At a Glance */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          {[
            { label: "Pitchers", value: stats.totalPlayers, Icon: Users },
            { label: "Outings", value: stats.totalOutings, Icon: Activity },
            { label: "Pitches", value: stats.totalPitches.toLocaleString(), Icon: Target },
            {
              label: "Latest",
              value: stats.mostRecentDate
                ? stats.mostRecentDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

        {/* ---- OUTING VIEW ---- */}
        {viewMode === "outings" && (
          <div className="space-y-2">
            {outingRows.length === 0 && (
              <p className="text-sm text-zinc-600 py-8 text-center">No outings for this season.</p>
            )}
            {outingRows.map((row, i) => {
              const isMe = row.player.id === selectedPlayerId;
              return (
                <motion.div
                  key={row.outing.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.4) }}
                >
                  <Link
                    href={`/player/${row.player.id}?outingId=${row.outing.id}&from=command`}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg border hover:bg-zinc-800/50 transition-smooth ${isMe ? "border-emerald-500/40 bg-zinc-900" : "border-zinc-800 bg-zinc-900"
                      }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-zinc-100 min-w-[120px]">
                        {row.date ? formatDate(row.date) : "\u2014"}
                      </span>
                      <span className="text-sm text-zinc-300">
                        {row.player.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(
                          row.player.throws === "L" ? "L" : "R"
                        )}`}
                      >
                        {row.player.throws === "L" ? "LHP" : "RHP"}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md px-1.5 py-0.5">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono text-zinc-500">
                        {row.pitchCount} pitches
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ---- PLAYER VIEW ---- */}
        {viewMode === "players" && (
          <div className="space-y-3">
            {pitcherData.length === 0 && (
              <p className="text-sm text-zinc-600 py-8 text-center">No pitchers for this season.</p>
            )}
            {pitcherData.map((item, i) => {
              const isExpanded = expanded === item.player.id;
              const isMe = item.player.id === selectedPlayerId;
              return (
                <motion.div
                  key={item.player.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.2,
                    delay: Math.min(i * 0.04, 0.4),
                  }}
                  className={`bg-zinc-900 border rounded-lg overflow-hidden ${isMe ? "border-emerald-500/40" : "border-zinc-800"}`}
                >
                  {/* Pitcher header row */}
                  <button
                    onClick={() =>
                      setExpanded(isExpanded ? null : item.player.id)
                    }
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-smooth text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm text-zinc-100">
                        {item.player.name}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(
                          item.player.throws === "L" ? "L" : "R"
                        )}`}
                      >
                        {item.player.throws === "L" ? "LHP" : "RHP"}
                      </span>
                      {isMe && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md px-1.5 py-0.5">
                          You
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-zinc-500">
                        {item.outings.length} outing
                        {item.outings.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {item.totalPitches} pitches
                      </span>
                      {item.latestDate && (
                        <span className="text-xs text-zinc-600 hidden sm:inline">
                          Latest: {formatDate(item.latestDate)}
                        </span>
                      )}
                      <ChevronRight
                        className={`w-4 h-4 text-zinc-600 transition-transform ${isExpanded ? "rotate-90" : ""
                          }`}
                      />
                    </div>
                  </button>

                  {/* Expanded outings */}
                  {isExpanded && (
                    <div className="border-t border-zinc-800 bg-zinc-900/50">
                      {item.outings.map((o) => (
                        <Link
                          key={o.id}
                          href={`/player/${item.player.id}?outingId=${o.id}&from=command`}
                          className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-smooth border-b border-zinc-800/50 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-zinc-300">
                              {o.date ? formatDate(o.date) : o.label}
                            </span>
                            <span className="text-xs font-mono text-zinc-500">
                              {parsePitchCount(o.label)} pitches
                            </span>
                          </div>
                          <ChevronRight className="w-3 h-3 text-zinc-600" />
                        </Link>
                      ))}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
