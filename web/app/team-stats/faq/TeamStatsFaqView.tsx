"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, BarChart3, Calculator } from "lucide-react";

export default function TeamStatsFaqView() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
            {/* Header */}
            <div className="border-b border-zinc-800/50 bg-zinc-900/50 px-6 py-8">
                <div className="max-w-4xl mx-auto">
                    <Link
                        href="/dictionary"
                        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 mb-8 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Dictionary
                    </Link>

                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-sky-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-sky-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                            Data Dictionary
                        </p>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 mb-4">
                        Team Statistics FAQ
                    </h1>
                    <p className="text-base text-zinc-400 leading-relaxed max-w-3xl">
                        This guide defines the traditional box-score statistics, advanced sabermetric identifiers, and value metrics used to evaluate pitcher performance in real game action.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">

                {/* Advanced Metrics */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Calculator className="w-6 h-6 text-sky-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Advanced &amp; Value Metrics
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        These metrics attempt to isolate the pitcher's direct contribution from factors outside their control (like poor defense or lucky bounces).
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-sky-400 mb-3 flex items-center gap-2">
                                FIP (Fielding Independent Pitching)
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Estimates a pitcher's run prevention assuming they have average defense behind them. It is scaled to match the league's ERA environment. FIP only concerns itself with the "True Outcomes" over which the pitcher has total control: <strong className="text-zinc-300">Strikeouts, Walks, Hit-by-Pitches, and Home Runs.</strong> It assumes all balls in play are left to chance and defensive shifting.
                            </p>
                        </div>

                        <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                                WAR (Wins Above Replacement)
                            </h3>
                            <p className="text-sm text-emerald-100/70 leading-relaxed">
                                A cumulative value metric. It estimates how many total team Wins a pitcher provided compared to a theoretical "replacement-level" D3 pitcher (e.g., a standard multi-inning reliever called up from an intramural squad). A pitcher with 2.0 WAR has personally generated two full wins for the team strictly through their performance.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 md:col-span-2">
                            <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                                ERA+ (Adjusted ERA)
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Takes the pitcher's ERA and normalizes it across the entire division, scaled so that <strong className="text-zinc-300">100 is perfectly average</strong>.
                                <br /><br />
                                An ERA+ of <strong className="text-emerald-400">150</strong> means the pitcher is <strong className="text-zinc-300">50% better</strong> than the average D3 pitcher.
                                An ERA+ of <strong className="text-rose-400">80</strong> means the pitcher is <strong className="text-zinc-300">20% worse</strong>. This is highly useful for comparing performance across different eras and run environments.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Rate Stats */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <BarChart3 className="w-6 h-6 text-zinc-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Rate &amp; Percentage Stats
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        Percentages provide a much clearer picture of dominance per-batter than cumulative volume stats.
                    </p>

                    <div className="space-y-6">

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">K% &amp; BB%</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    The percentage of total batters faced that resulted in a Strikeout (K%) or a Walk (BB%). Unlike K/9, these percentages are not warped by how many batters safely reach base in an inning.
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">K-BB%</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Strikeout percentage minus Walk percentage. This is widely considered the single most predictive metric of future pitcher success. A K-BB% over 20% is elite.
                                </p>
                            </div>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:px-8">
                            <h3 className="text-lg font-bold text-zinc-200 mb-2">Per 9 Innings (K/9, BB/9, H/9)</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Standardizes how many Strikeouts, Walks, or Hits a pitcher allows extrapolated over a standard 9-inning complete game.
                            </p>
                        </div>

                    </div>
                </section>

                {/* Traditional Stats */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Traditional Statistics
                        </h2>
                    </div>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-900/80 border-b border-zinc-800/60 text-zinc-400 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-semibold w-24">Stat</th>
                                    <th className="px-6 py-4 font-semibold">Definition</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40 text-zinc-400">
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">IP</td>
                                    <td className="px-6 py-4">Innings pitched. Calculated in thirds (e.g., 5.1 is five innings and one out).</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">ERA</td>
                                    <td className="px-6 py-4">Earned Run Average. The average number of earned runs yielded per 9 innings.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">WHIP</td>
                                    <td className="px-6 py-4">Walks plus Hits per Inning Pitched. An average of how many baserunners the pitcher allows per inning.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">W / L</td>
                                    <td className="px-6 py-4">Wins and Losses assigned to the pitcher of record depending on the score when they exited the game.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">SV</td>
                                    <td className="px-6 py-4">Saves (awarded to closing pitchers who finish a tight game).</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-zinc-200">GS</td>
                                    <td className="px-6 py-4">Games Started.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>
        </div>
    );
}
