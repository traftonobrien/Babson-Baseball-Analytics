"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  Target,
  ArrowUpRight,
  Trophy,
  Film,
  BarChart3,
} from "lucide-react";
import LogoutButton from "./components/LogoutButton";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

export default function HomeContent() {
  const { slug, name } = useSelectedPlayer();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 relative">
      {/* Logout */}
      <div className="absolute top-4 right-4 z-10">
        <LogoutButton />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <motion.div
          className="mt-2 mb-6 sm:mb-7"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(135deg,rgba(24,24,27,0.9),rgba(9,9,11,0.96))] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Babson Baseball
            </div>
            <div className="mt-3 flex items-center gap-3 sm:gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-900/80 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:h-14 sm:w-14">
                <Image
                  src="/babson-logo.svg"
                  alt="Babson Baseball"
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 sm:h-8 sm:w-8"
                  priority
                />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-zinc-50 sm:text-[2.35rem] sm:leading-tight">
                Babson Baseball Pitching Portal
              </h1>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-400">
              One home base for player reports, leaderboards, stuff, command, and mechanics.
            </p>
          </div>
        </motion.div>

        {/* ---- Personal greeting (when player selected) ---- */}
        {slug && name && (
          <motion.div
            className="mt-0 mb-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Link href={`/players/${slug}`}>
              <div className="group relative rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/10 via-zinc-900 to-zinc-900 p-5 transition-smooth duration-300 hover:border-emerald-500/70 hover:shadow-lg hover:shadow-emerald-500/10">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-zinc-50">
                      Welcome back, {name.split(" ")[0]}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">
                      Jump into your profile
                    </p>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-emerald-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ---- Player Profiles (hero) ---- */}
        <motion.div
          className="mt-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <Link href="/players">
            <div className="group relative rounded-xl border border-emerald-500/30 hover:border-emerald-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-smooth duration-300 hover:scale-[1.01] hover:shadow-lg group-hover:shadow-emerald-500/10">
              <div className="flex items-start justify-between">
                <Users className="w-6 h-6 text-emerald-400" />
                <ArrowUpRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-lg font-semibold mt-4">Player Profiles</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Full roster with D3 stats, Savant percentiles, Trackman and command
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ---- Statistics Leaderboard ---- */}
        <motion.div
          className="mt-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.07 }}
        >
          <Link href="/team-stats/leaderboard">
            <div className="group relative rounded-xl border border-sky-500/30 hover:border-sky-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-4 transition-smooth duration-300 hover:scale-[1.01] hover:shadow-lg group-hover:shadow-sky-500/10">
              <div className="flex items-start justify-between">
                <BarChart3 className="w-5 h-5 text-sky-400" />
                <ArrowUpRight className="w-3.5 h-3.5 text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-base font-semibold mt-3">Statistics Leaderboard</h2>
              <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                Season pitching stats for the roster
              </p>
            </div>
          </Link>
        </motion.div>

        {/* ---- Trackman + Command columns (cards + leaderboards) ---- */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Trackman column */}
          <div className="flex flex-col gap-3">
            <Link href="/trackman" className="flex-1">
              <div className="group relative h-full rounded-xl border border-blue-500/30 hover:border-blue-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-smooth duration-300 hover:scale-[1.02] hover:shadow-lg group-hover:shadow-blue-500/10">
                <div className="flex items-start justify-between">
                  <Activity className="w-6 h-6 text-blue-400" />
                  <ArrowUpRight className="w-4 h-4 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h2 className="text-lg font-semibold mt-4">Trackman Hub</h2>
                <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                  Velocity, movement, and arsenal data by session
                </p>
              </div>
            </Link>
            <Link href="/trackman/leaderboard">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-blue-500/40 transition-smooth group">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-blue-400" />
                  <span className="font-medium text-sm">Trackman Leaderboards</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-blue-400 transition-smooth" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Rank pitchers by velocity and movement
                </p>
              </div>
            </Link>
          </div>

          {/* Command column */}
          <div className="flex flex-col gap-3">
            <Link href="/command" className="flex-1">
              <div className="group relative h-full rounded-xl border border-orange-500/30 hover:border-orange-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-smooth duration-300 hover:scale-[1.02] hover:shadow-lg group-hover:shadow-orange-500/10">
                <div className="flex items-start justify-between">
                  <Target className="w-6 h-6 text-orange-400" />
                  <ArrowUpRight className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h2 className="text-lg font-semibold mt-4">Command Hub</h2>
                <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                  Command accuracy and miss tracking by outing
                </p>
              </div>
            </Link>
            <Link href="/command/leaderboard">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 hover:border-orange-500/40 transition-smooth group">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-orange-400" />
                  <span className="font-medium text-sm">Command Leaderboards</span>
                  <ArrowUpRight className="w-3 h-3 text-zinc-500 ml-auto group-hover:text-orange-400 transition-smooth" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">
                  Rank pitchers by command
                </p>
              </div>
            </Link>
          </div>
        </motion.div>

        {/* ---- Mechanics card ---- */}
        <motion.div
          className="mt-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
        >
          <Link href="/mechanics">
            <div className="group relative rounded-xl border border-violet-500/30 hover:border-violet-500/60 bg-gradient-to-br from-zinc-900 to-zinc-900/80 p-6 transition-smooth duration-300 hover:scale-[1.01] hover:shadow-lg">
              <span className="absolute top-3 right-3 text-xs uppercase tracking-wider font-semibold bg-violet-500/20 text-violet-400 border border-violet-500/40 rounded-md px-3 py-1">
                Beta
              </span>
              <div className="flex items-start justify-between">
                <Film className="w-6 h-6 text-violet-400" />
                <ArrowUpRight className="w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <h2 className="text-lg font-semibold mt-4">Mechanics Hub</h2>
              <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                Delivery breakdowns by phase and session
              </p>
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
