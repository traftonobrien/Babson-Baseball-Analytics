"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Target, Activity } from "lucide-react";

export default function TrackmanFaqView() {
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
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-blue-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                            Data Dictionary
                        </p>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 mb-4">
                        Trackman FAQ &amp; Metrics Guide
                    </h1>
                    <p className="text-base text-zinc-400 leading-relaxed max-w-3xl">
                        This guide defines the core metrics provided by our portable Trackman B1 unit, as well as the proprietary Stuff+ models used to evaluate pitch quality and command.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">

                {/* PitchingBot Models */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Activity className="w-6 h-6 text-emerald-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Pitch Modeling (Stuff+)
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        We use advanced machine learning models (powered by PitchingBot) to evaluate every pitch based on its physical flight characteristics. These metrics are scaled so that <strong className="text-zinc-200">100 is NCAA Average</strong>. A score of 110 means the pitch is 10% better than average.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2">
                                Stuff+
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Evaluates the <strong className="text-zinc-300">physical properties</strong> of the pitch—velocity, movement (IVB/HB), spin rate, release point, and extension. It ignores where the pitch actually crossed the plate. It simply answers: "How nasty is this pitch in a vacuum?"
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-sky-400 mb-3 flex items-center gap-2">
                                Location+
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                Evaluates the <strong className="text-zinc-300">command</strong> of the pitch. It ignores the physical stuff and looks only at the (x, z) coordinate of where the pitch crossed the plate (relative to the batter's handedness and the pitch type).
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                                Pitching+
                            </h3>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                The <strong className="text-zinc-300">overall grade</strong> combining both Stuff and Location. It predicts the expected run value of throwing that specific pitch in that specific location.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Core Savant Metrics */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <Target className="w-6 h-6 text-blue-400" />
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Core Flight Metrics
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-10">
                        The raw data captured directly by the Trackman radar array.
                    </p>

                    <div className="space-y-6">

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:px-8">
                            <h3 className="text-lg font-bold text-zinc-200 mb-2">IVB (Induced Vertical Break)</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                Measured in inches. Represents the distance a pitch deviates vertically from its expected gravity-only trajectory due to Magnus force (spin).
                            </p>
                            <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-400 ml-1">
                                <li><strong className="text-zinc-300">Fastballs:</strong> Positive IVB (e.g., +18&quot;) creates a "rising" effect, staying above the hitter's barrel.</li>
                                <li><strong className="text-zinc-300">Breaking Balls:</strong> Negative IVB (e.g., -10&quot;) indicates downward depth or sink.</li>
                            </ul>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:px-8">
                            <h3 className="text-lg font-bold text-zinc-200 mb-2">HB (Horizontal Break)</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                Measured in inches. Represents how far a pitch deviates horizontally.
                            </p>
                            <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-400 ml-1">
                                <li><strong className="text-zinc-300">Positive HB:</strong> The pitch tails to the right from the pitcher&apos;s perspective (arm-side run for a RHP).</li>
                                <li><strong className="text-zinc-300">Negative HB:</strong> The pitch sweeps to the left from the pitcher&apos;s perspective (glove-side sweep for a RHP).</li>
                            </ul>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">Extension</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Measured in feet. How far down the mound the pitcher releases the ball relative to the pitching rubber. A higher extension makes the ball appear faster to the hitter (Perceived Velocity). Standard average is ~6.0 feet.
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">Release Height &amp; Side</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    The exact 3D coordinate (x, z) where the ball leaves the pitcher&apos;s hand, measured in feet from the center of the rubber. Consistency here is key to tunneling pitches.
                                </p>
                            </div>

                            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:col-span-2">
                                <h3 className="text-lg font-bold text-zinc-200 mb-2">Spin Rate</h3>
                                <p className="text-sm text-zinc-400 leading-relaxed">
                                    Measured in Revolutions Per Minute (RPM). While total spin correlates with breaking ball sharpness, it is the <strong className="text-zinc-300">active spin</strong> (the direction of the spin axis) that actually generates movement. High spin fastballs paired with high active spin efficiency create massive IVB.
                                </p>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Pitch Classifications */}
                <section>
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                        <h2 className="text-2xl tracking-tight font-bold text-zinc-50">
                            Pitch Classifications
                        </h2>
                    </div>
                    <p className="text-zinc-400 mb-6">
                        How we map Trackman's default auto-tags to internal classifications:
                    </p>

                    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-zinc-900/80 border-b border-zinc-800/60 text-zinc-400 uppercase tracking-wider text-xs">
                                <tr>
                                    <th className="px-6 py-4 font-semibold">Tag</th>
                                    <th className="px-6 py-4 font-semibold">Pitch Type</th>
                                    <th className="px-6 py-4 font-semibold hidden sm:table-cell">Movement Profile</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/40">
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-blue-400">FB</td>
                                    <td className="px-6 py-4 text-zinc-200">Four-Seam Fastball</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">High IVB, moderate arm-side run, highest spin axis.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-teal-400">SI</td>
                                    <td className="px-6 py-4 text-zinc-200">Sinker / Two-Seam</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">Lower IVB, massive arm-side run, heavy late sink.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-orange-400">SL</td>
                                    <td className="px-6 py-4 text-zinc-200">Slider</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">High velocity break, low IVB, heavy glove-side sweep.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-yellow-400">CB</td>
                                    <td className="px-6 py-4 text-zinc-200">Curveball</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">Massive negative IVB (depth), slower velocity, glove-side break.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-rose-400">CH</td>
                                    <td className="px-6 py-4 text-zinc-200">Changeup</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">Kills velocity relative to FB, relies on heavy arm-side fade and depth.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-indigo-400">CU</td>
                                    <td className="px-6 py-4 text-zinc-200">Cutter</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">Fastball velocity with slight glove-side cut and positive IVB.</td>
                                </tr>
                                <tr className="hover:bg-zinc-800/20 transition-colors">
                                    <td className="px-6 py-4 font-mono font-medium text-violet-400">SP</td>
                                    <td className="px-6 py-4 text-zinc-200">Splitter</td>
                                    <td className="px-6 py-4 text-zinc-500 hidden sm:table-cell">Kills massive spin, forcing the ball to tumble rapidly.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

            </div>
        </div>
    );
}
