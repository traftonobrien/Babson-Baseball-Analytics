"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Target, Navigation } from "lucide-react";

export default function LeaderboardsFaqView() {
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
                        <div className="p-2 bg-orange-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-orange-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                            Data Dictionary
                        </p>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 mb-4">
                        Command Leaderboards FAQ
                    </h1>
                    <p className="text-base text-zinc-400 leading-relaxed max-w-3xl">
                        This guide defines the accuracy and consistency metrics used in our charting system. It explains how we measure 'command' rather than just strictly throwing strikes.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">

                {/* Core Command Metrics */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Target className="w-6 h-6 text-orange-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Core Command Metrics
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        Unlike traditional strike percentage, which credits pitchers for throwing 'fat' pitches over the heart of the plate, our system measures the precise Euclidean distance between the catcher's intended target and the actual pitch location.
                    </p>

                    <div className="space-y-8">
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:px-8">
                            <h3 className="text-lg font-bold text-zinc-200 mb-2">On-Target %</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                The percentage of pitches thrown that landed within an <strong className="text-zinc-200">8-inch radius</strong> of the catcher's requested target.
                            </p>
                            <div className="bg-zinc-900/80 rounded-lg p-4 border border-zinc-800/80 text-sm text-zinc-500">
                                <strong className="text-zinc-400 block mb-1">Why 8 inches?</strong>
                                A standard baseball is roughly 3 inches wide. An 8-inch halo allows for margin of error while still ensuring the pitch was highly competitive near the requested zone.
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">Average Miss (Total)</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Measured in inches. The average absolute distance from the intended target to the pitch's actual location across the entire sample. Lower is better. 10.0&quot; is roughly elite D3 average.
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">Consistency (Std Dev)</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Measured in inches. Tracks the <strong className="text-zinc-300">standard deviation</strong> of the pitcher's total miss. A lower number means the pitcher's misses are tightly clustered (better "grouping"). A higher number means their misses are wildly scattered.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Navigation className="w-4 h-4 text-zinc-400" />
                                    <h3 className="text-lg font-bold text-zinc-200">Horizontal Miss (Avg H)</h3>
                                </div>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    The average absolute distance missed strictly on the horizontal (left-to-right) plane. Useful for identifying early release or "missing arm side."
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Navigation className="w-4 h-4 text-zinc-400 rotate-90" />
                                    <h3 className="text-lg font-bold text-zinc-200">Vertical Miss (Avg V)</h3>
                                </div>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    The average absolute distance missed strictly on the vertical (up-down) plane.
                                </p>
                            </div>
                        </div>

                        <div className="bg-rose-950/20 border border-rose-900/30 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-rose-200 mb-2">Outlier %</h3>
                            <p className="text-sm text-rose-200/70 leading-relaxed">
                                The percentage of pitches that missed the intended target by more than <strong className="text-rose-100">20 inches</strong>. These are strictly non-competitive pitches (dirtballs, pitches to the backstop, etc). Lower is better.
                            </p>
                        </div>

                        <div className="bg-orange-950/20 border border-orange-500/20 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-orange-400 mb-2">Command+</h3>
                            <div className="space-y-4">
                                <p className="text-sm text-orange-200/70 leading-relaxed">
                                    Command+ is a pitch-weighted metric that compares a pitcher's command relative to the team's average for that specific season. An overall Command+ score of 100 means the pitcher has exactly average command across their arsenal. Higher is better.
                                </p>
                                <div className="bg-orange-950/40 border border-orange-900/50 rounded-lg p-4 mt-4">
                                    <h4 className="text-sm font-semibold text-orange-300 mb-2">The Math Behind the Metric</h4>
                                    <ul className="list-disc list-inside text-sm text-orange-200/60 space-y-2">
                                        <li><strong>Pitch-Specific Baseline:</strong> First, we calculate the team's average absolute miss distance for every pitch type (e.g., the team averages 12&quot; of miss on Fastballs and 18&quot; on Curveballs).</li>
                                        <li><strong>Relative Ratio:</strong> We divide the Team Baseline by the Pitcher's Average Miss for that specific pitch type, then multiply by 100. If the team averages 15&quot; on Sliders and the pitcher averages 10&quot;, their Slider Command+ is <code className="bg-orange-950 px-1 py-0.5 rounded text-orange-300">15 / 10 * 100 = 150</code>.</li>
                                        <li><strong>Usage Weighting:</strong> Finally, to get their global Command+ score, we weight each pitch's individual score by how often the pitcher throws it. A pitcher receives far more credit for having elite command of their primary 60%-usage fastball than they do on a 5%-usage curveball.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

            </div>
        </div>
    );
}
