"use client";

import { Film } from "lucide-react";
import { DictionaryPageShell } from "@/app/components/dictionary/DictionaryChrome";

export default function MechanicsFaqView() {
    return (
        <DictionaryPageShell
            tone="violet"
            icon={Film}
            eyebrow="Metrics Dictionary"
            title="Mechanics Guide"
            description={
                <>
                    This guide explains the AWRE mechanics model. The
                    computer-vision pipeline tracks the full delivery and
                    turns it into a{" "}
                    <strong className="text-slate-900">0-10 Efficiency Score</strong>.
                    {" "}Below is what each metric measures and how it is scored.
                </>
            }
            breadcrumbs={[
                { label: "Home", href: "/" },
                { label: "Metrics Dictionary", href: "/dictionary" },
                { label: "Mechanics" },
            ]}
            maxWidth="max-w-5xl"
        >

                {/* Core Metrics */}
                <section>
                    <h2 className="text-2xl tracking-tight font-bold text-slate-900 dark:text-zinc-50 mb-6 pb-4 border-b border-slate-200">
                        Core Efficiency Metrics
                    </h2>
                    <p className="text-slate-600 mb-10">
                        These seven metrics are the main drivers of the overall Mechanics Efficiency Score.
                    </p>

                    <div className="space-y-12">

                        {/* 1. Timing */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">1.</span> Timing (Pace to Plate)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> The time from the set position to foot strike.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We calculate the exact number of seconds between first movement and lead-foot plant.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>1.05 seconds or faster: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>1.05s to 1.15s: Scales from 10 down to 6</li>
                                        <li>Slower than 1.15 seconds: <span className="text-red-400 font-mono ml-1">3/10</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 2. Balance */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">2.</span> Balance (Trunk Lean at Release)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> The pitcher&apos;s side-to-side trunk lean at ball release.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We draw a trunk line from the hips to the shoulders and measure its angle away from vertical.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>Less than 6&deg; lean: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>Greater than 40&deg; lean: <span className="text-red-400 font-mono ml-1">0/10</span></li>
                                        <li>Values between 6&deg; and 40&deg; scale linearly.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 3. Posture */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">3.</span> Posture (Head Drop / Bobbing)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> The amount of head drop from set to ball release.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We track the nose vertically, then normalize that drop by estimated body height so the score scales across body types and camera distances.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>1% drop or less: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>10% drop or more: <span className="text-red-400 font-mono ml-1">0/10</span></li>
                                        <li>Values between 1% and 10% scale linearly.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 4. Lift & Thrust */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">4.</span> Lift &amp; Thrust (Glute Loading)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> How well the pitcher loads the back hip before driving down the mound.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> At peak leg lift, we measure the angle from the drive ankle to the stride hip above horizontal.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>25&deg; angle or more: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>3&deg; angle or less: <span className="text-red-400 font-mono ml-1">0/10</span></li>
                                        <li>Values in between scale linearly.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 5. Swivel & Stabilize */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">5.</span> Swivel &amp; Stabilize (Glove Arm Discipline)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> Whether the glove-side arm stays stable and inside the torso window at release.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We build a horizontal torso boundary from the shoulders and hips, then check whether the glove wrist stays inside it at release.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>Glove inside torso bounds: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>Glove outside torso bounds: <span className="text-red-400 font-mono ml-1">3/10</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 6. Trunk Stability */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-1 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">6.</span> Trunk Stability (Core Control)
                            </h3>
                            <p className="text-xs text-slate-900 dark:text-zinc-500 mb-4 italic ml-7">
                                *For single-camera 2D video, this is our best proxy for body rotation.*
                            </p>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed mt-4">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> How much trunk angle changes between foot strike and ball release.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We compare the trunk angle at foot strike to the trunk angle at release. The difference drives the score.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>5&deg; delta or less: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>25&deg; delta or more: <span className="text-red-400 font-mono ml-1">0/10</span></li>
                                        <li>Values between scale linearly.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 7. Torque Retention */}
                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">7.</span> Torque Retention (Shoulder Closedness)
                            </h3>
                            <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
                                <p>
                                    <strong className="text-slate-900 tracking-wide">What it is:</strong> A hip-to-shoulder separation check that measures how closed the shoulders stay at foot strike.
                                </p>
                                <p>
                                    <strong className="text-slate-900 tracking-wide">How it&apos;s measured:</strong> We compare the shoulder-line angle at foot strike to the angle at release and express it as an openness ratio. Lower means the shoulders stayed closed longer. Higher means they opened early.
                                </p>
                                <div className="pt-2">
                                    <span className="text-slate-900 dark:text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>Ratio of 0.10 or less: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>Ratio of 0.80 or more: <span className="text-red-400 font-mono ml-1">0/10</span></li>
                                        <li>Values between scale linearly.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Supporting Metrics */}
                <section>
                    <h2 className="text-2xl tracking-tight font-bold text-slate-900 dark:text-zinc-50 mb-6 pb-4 border-b border-slate-200">
                        Secondary &amp; Supporting Metrics
                    </h2>
                    <p className="text-slate-600 mb-10">
                        These metrics add context for coaches, but they do not usually drive the core score as heavily.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Arm Timing</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                <strong className="text-slate-800">What it is:</strong> Checks whether the throwing arm is up when the front side takes full weight.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">How it&apos;s measured:</strong> We calculate the frame offset between arm flip-up and the weight-bearing phase.
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-3 text-sm text-slate-600 ml-1">
                                <li><strong className="text-green-400 font-normal">On time:</strong> 0 to 2 frames before weight bearing</li>
                                <li><strong className="text-amber-400 font-normal">Early:</strong> 3+ frames prior to weight bearing</li>
                                <li><strong className="text-red-400 font-normal">Late:</strong> After weight bearing (major flaw)</li>
                            </ul>
                        </div>

                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Arm Alignment &amp; Flexion</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                <strong className="text-slate-800">What it is:</strong> Checks whether the throwing elbow is in a strong position when the arm cocks back.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed mb-2">
                                <strong className="text-slate-800">How it&apos;s measured:</strong> A balanced composite of:
                            </p>
                            <ul className="list-decimal list-outside space-y-1.5 text-sm text-slate-600 ml-4">
                                <li><strong>Shoulder-elbow line:</strong> The shoulder-to-elbow line should stay level with the shoulder line.</li>
                                <li><strong>Elbow flexion:</strong> The inner elbow angle should ideally stay at 90&deg; or less.</li>
                            </ul>
                        </div>

                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Front Knee Bracing</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                <strong className="text-slate-800">What it is:</strong> Checks whether the front leg firms up and creates a stable brace.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">How it&apos;s measured:</strong> We compare the lead-knee angle at foot strike to the angle at release. More extension means a brace. More bend means energy leaked forward.
                            </p>
                        </div>

                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Release Extension</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                <strong className="text-slate-800">What it is:</strong> Estimates how far out front the pitcher releases the ball.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                <strong className="text-slate-800">How it&apos;s measured:</strong> It uses a proxy blend of forward wrist distance, shoulder-to-wrist release angle, and wrist speed into release.
                            </p>
                        </div>

                        <div className="bg-surface border border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.05)] rounded-xl p-6 md:col-span-2">
                            <h3 className="text-lg font-bold text-slate-900 mb-3">Loading Profile</h3>
                            <p className="text-sm text-slate-600 leading-relaxed mb-3">
                                <strong className="text-slate-800">What it is:</strong> A snapshot of the athlete at the deepest point of the move between peak leg lift and foot strike.
                            </p>
                            <p className="text-sm text-slate-600 leading-relaxed mb-2">
                                <strong className="text-slate-800">How it&apos;s measured:</strong> It merges four checks into one profile score:
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <li className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="text-slate-600 font-mono mt-0.5">1.</span>
                                    <span>The depth of the back hip hinge angle.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="text-slate-600 font-mono mt-0.5">2.</span>
                                    <span>The angle of the torso lean.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="text-slate-600 font-mono mt-0.5">3.</span>
                                    <span>The degree of shoulder counter-rotation (hiding the ball).</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-slate-600">
                                    <span className="text-slate-600 font-mono mt-0.5">4.</span>
                                    <span>The horizontal baseline drift distance (forward momentum) from Peak Leg Lift.</span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </section>

                {/* Disabled Metrics */}
                <section>
                    <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 p-8">
                        <div className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full bg-rose-100/60 blur-3xl" />

                        <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold tracking-tight text-rose-900">
                            Disabled Metrics
                        </h2>
                        <p className="mb-8 max-w-2xl leading-relaxed text-slate-700">
                            If a metric cannot be measured reliably from a
                            single camera, we disable it instead of showing bad
                            data.
                        </p>

                        <div className="rounded-xl border border-rose-200 bg-surface p-6 shadow-sm">
                            <h3 className="mb-3 text-lg font-bold text-slate-900">Stride Length</h3>
                            <p className="mb-4 text-sm leading-relaxed text-slate-600">
                                <strong className="text-slate-800">What it was supposed to measure:</strong> The physical distance from the rubber to the lead foot at foot strike. Standard benchmarks are usually 80%-90% of body height.
                            </p>
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold uppercase tracking-widest text-rose-800">Why it is disabled:</h4>
                                <ul className="space-y-4">
                                    <li className="text-sm leading-relaxed text-slate-600">
                                        <strong className="mb-1 block text-rose-900">Digital Panning:</strong>
                                        Operators naturally pan the camera to follow the pitcher. Once the camera rotates, the background shifts and the pixel origin moves with the athlete, which breaks any true distance measurement.
                                    </li>
                                    <li className="text-sm leading-relaxed text-slate-600">
                                        <strong className="mb-1 block text-rose-900">Occlusion:</strong>
                                        Tracking the rubber directly also fails because pitchers often drag the back foot over it, which makes computer vision lock onto the moving shoe instead of the fixed ground.
                                    </li>
                                    <li className="mt-2 border-t border-rose-200 pt-4 text-sm leading-relaxed text-slate-600">
                                        <strong className="mb-1 block text-rose-900">Conclusion:</strong>
                                        Without a fixed 3D origin, absolute stride distance is not reliable enough from a single panning camera. Stride length stays disabled and does not affect the efficiency score.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

        </DictionaryPageShell>
    );
}
