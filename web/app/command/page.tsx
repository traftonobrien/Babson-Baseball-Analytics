"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Target, ChevronRight, Users, Activity, Calendar } from "lucide-react";
import { players, type Player, type Outing } from "@/lib/dataIndex";
import { handBadgeClassesCompact } from "@/lib/handBadge";

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

// ---------------------------------------------------------------------------
// Command Hub Page
// ---------------------------------------------------------------------------

export default function CommandPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPlayers = players.length;
    const totalOutings = players.reduce((s, p) => s + p.outings.length, 0);
    const totalPitches = players.reduce(
      (s, p) => s + p.outings.reduce((a, o) => a + parsePitchCount(o.label), 0),
      0,
    );
    let mostRecentDate: Date | null = null;
    for (const p of players) {
      for (const o of p.outings) {
        const d = parseDateFromId(o.id);
        if (d && (!mostRecentDate || d > mostRecentDate)) mostRecentDate = d;
      }
    }
    return { totalPlayers, totalOutings, totalPitches, mostRecentDate };
  }, []);

  const pitcherData = useMemo(() => {
    return players
      .map((p) => {
        const outings = [...p.outings]
          .map((o) => ({ ...o, date: parseDateFromId(o.id) }))
          .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
        const totalPitches = p.outings.reduce(
          (s, o) => s + parsePitchCount(o.label),
          0,
        );
        const latestDate = outings[0]?.date ?? null;
        return { player: p, outings, totalPitches, latestDate };
      })
      .sort(
        (a, b) =>
          (b.latestDate?.getTime() ?? 0) - (a.latestDate?.getTime() ?? 0),
      );
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-3 mb-6"
        >
          <Link
            href="/"
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-orange-400" />
              Command Hub
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              All command tracking outings by pitcher
            </p>
          </div>
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

        {/* Pitcher grid */}
        <div className="space-y-3">
          {pitcherData.map((item, i) => {
            const isExpanded = expanded === item.player.id;
            return (
              <motion.div
                key={item.player.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(i * 0.04, 0.4),
                }}
                className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden"
              >
                {/* Pitcher header row */}
                <button
                  onClick={() =>
                    setExpanded(isExpanded ? null : item.player.id)
                  }
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
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
                      className={`w-4 h-4 text-zinc-600 transition-transform ${
                        isExpanded ? "rotate-90" : ""
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
                        className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/50 transition-colors border-b border-zinc-800/50 last:border-b-0"
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
      </div>
    </div>
  );
}
