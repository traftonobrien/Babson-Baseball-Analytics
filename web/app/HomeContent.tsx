"use client";

import { useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  Target,
  Calendar,
  ArrowUpRight,
  Clock,
  Trophy,
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

// ---------------------------------------------------------------------------
// HomeContent
// ---------------------------------------------------------------------------

export default function HomeContent() {
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

  // --- Recent outings (flattened, sorted, limited) ---
  const recentOutings = useMemo(() => {
    const all: { player: Player; outing: Outing; date: Date }[] = [];
    for (const p of players) {
      for (const o of p.outings) {
        const d = parseDateFromId(o.id);
        if (d) all.push({ player: p, outing: o, date: d });
      }
    }
    return all.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 8);
  }, []);

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
        {/* ---- Player Profiles (hero) ---- */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Link href="/players">
            <div className="group relative rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-all duration-200 hover:scale-[1.01] hover:shadow-lg group-hover:shadow-emerald-500/10">
              <div className="flex items-start justify-between">
                <Users className="w-6 h-6 text-emerald-400" />
                <ArrowUpRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-lg font-semibold mt-4">Player Profiles</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Roster, D3 stats, Savant percentiles, Trackman and command data
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ---- Trackman + Command Center ---- */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Link href="/trackman">
            <div className="group relative rounded-xl border border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group-hover:shadow-blue-500/10">
              <div className="flex items-start justify-between">
                <Activity className="w-6 h-6 text-blue-400" />
                <ArrowUpRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-lg font-semibold mt-4">Trackman</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Session data, velocity trends, movement profiles, arsenal breakdowns
              </p>
            </div>
          </Link>
          <Link href="/command">
            <div className="group relative rounded-xl border border-amber-500/30 hover:border-amber-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group-hover:shadow-amber-500/10">
              <div className="flex items-start justify-between">
                <Target className="w-6 h-6 text-amber-400" />
                <ArrowUpRight className="w-4 h-4 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-lg font-semibold mt-4">Command Center</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Miss vectors, target accuracy, command tracking outings
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ---- Leaderboards ---- */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Link href="/leaderboards">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-amber-500/40 transition-colors group">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-sm">Command Leaderboards</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-amber-400 transition-colors" />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Compare command stats across pitchers
              </p>
            </div>
          </Link>
          <Link href="/trackman/leaderboards">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-blue-500/40 transition-colors group">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-400" />
                <span className="font-medium text-sm">Trackman Leaderboards</span>
                <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-blue-400 transition-colors" />
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Compare Trackman metrics across pitchers
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ---- At a Glance ---- */}
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
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

        {/* ---- Recent Outings ---- */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs text-zinc-500 uppercase tracking-wider">
              Recent Outings
            </h3>
            <Link
              href="/command"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentOutings.map((item, i) => (
              <motion.div
                key={item.outing.id}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(0.35 + i * 0.03, 0.6),
                }}
              >
                <Link
                  href={`/player/${item.player.id}?outingId=${item.outing.id}`}
                  className="block bg-zinc-900/50 border border-zinc-800/50 rounded-lg px-3 py-2 hover:border-zinc-600 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-zinc-600" />
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
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-zinc-500">
                        {formatDateShort(item.date)}
                      </span>
                      <span className="text-xs font-mono text-zinc-500">
                        {parsePitchCount(item.outing.label)} pitches
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
