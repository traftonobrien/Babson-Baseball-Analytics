"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Users, LayoutDashboard, Database } from "lucide-react";

export default function PlayersFaqView() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
            {/* Header */}
            <div className="border-b border-zinc-800/50 bg-zinc-900/50 px-6 py-8">
                <div className="max-w-4xl mx-auto">
                    <Link
                        href="/players"
                        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-8 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Players Hub
                    </Link>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-indigo-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                            Platform Guide
                        </p>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 mb-4">
                        Roster &amp; Profiles FAQ
                    </h1>
                    <p className="text-base text-zinc-400 leading-relaxed max-w-3xl">
                        This guide explains how the unified Player Profiles aggregate data from across the different tracking systems to build a complete picture of an athlete's development.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">

                {/* Unified Profiles */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <LayoutDashboard className="w-6 h-6 text-indigo-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            The Unified Profile
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        Each pitcher has a single canonical profile that serves as their home base. This profile automatically pulls in their latest data whenever new sessions are uploaded to any of the subsystems.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-blue-400 mb-3 flex items-center gap-2">
                                1. Trackman Data
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Pulls the pitcher's pitch arsenal, velocity averages, Stuff+ models, and movement metrics from all radar-tracked bullpen sessions and scrimmages.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-rose-400 mb-3 flex items-center gap-2">
                                2. Mechanics AI
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Connects to the AWRE computer vision pipeline to display the pitcher's global Efficiency Score and highlight their top kinematic flaws (like early hip rotation).
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-sky-400 mb-3 flex items-center gap-2">
                                3. Game Stats
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Displays real-world outcomes against external opponents, including traditional D3 box scores and advanced Sabermetrics (FIP, WAR).
                            </p>
                        </div>
                    </div>
                </section>

                {/* Searching and Organization */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Users className="w-6 h-6 text-zinc-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Navigating the Roster
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-6">
                        The Players Hub allows you to filter the active roster.
                    </p>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:px-8 space-y-4">
                        <h3 className="text-lg font-bold text-zinc-200">Personalized Views</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            If you used the <strong className="text-zinc-300">Login</strong> feature on the home page to select your name, your player card will be automatically pinned to the exact top of the roster list, highlighted in emerald green. This gives you one-click access to your unified development dashboard.
                        </p>

                        <h3 className="text-lg font-bold text-zinc-200 mt-6">Handedness &amp; Search</h3>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Use the toggle filters to rapidly sort the roster by <strong className="text-zinc-300">LHP</strong> (Left-Handed Pitchers) or <strong className="text-zinc-300">RHP</strong> (Right-Handed Pitchers). The universal search bar supports partial name matching.
                        </p>
                    </div>
                </section>

                {/* Data Sync */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Database className="w-6 h-6 text-zinc-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Data Synchronization (Under the Hood)
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-6 text-sm leading-relaxed">
                        The platform relies on an internal system called <strong>Canonical Names</strong> to ensure data links correctly. Because a player might be logged as "Trafton O'Brien" in Trackman, "O'Brien, Trafton" in NCAA box scores, and "trafton_obrien" in the AWRE mechanics pipeline, the system uses fuzzy string matching to bind these disparate data sources into a single <code>playerSlug</code>. This means you do not have to worry about exact spelling when uploading new CSV or PDF reports.
                    </p>
                </section>

            </div>
        </div>
    );
}
