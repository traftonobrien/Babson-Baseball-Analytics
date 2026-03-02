"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";

export default function MechanicsFaqView() {
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
                        <div className="p-2 bg-violet-500/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-violet-400" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-semibold">
                            Analysis Documentation
                        </p>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-50 mb-4">
                        AWRE Pitching Metrics: Definitions & FAQ
                    </h1>
                    <p className="text-base text-zinc-400 leading-relaxed max-w-3xl">
                        Welcome to the AWRE Pitching Mechanics evaluation guide. Our computer vision pipeline tracks the pitcher&apos;s body through the entire delivery, measuring key biomechanical checkpoints to generate a <strong className="text-zinc-200">0-10 Efficiency Score</strong>.
                        <br className="hidden sm:block" />
                        <br className="hidden sm:block" />
                        This document defines every metric we evaluate: what it measures, and how our algorithm calculates the score from AWRE Camera footage.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12 space-y-20">

                {/* Core Metrics */}
                <section>
                    <h2 className="text-2xl tracking-tight font-bold text-zinc-50 mb-6 pb-4 border-b border-zinc-800">
                        Core Efficiency Metrics
                    </h2>
                    <p className="text-zinc-400 mb-10">
                        These seven primary metrics strictly drive the overall Mechanics Efficiency Score.
                    </p>

                    <div className="space-y-12">

                        {/* 1. Timing */}
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">1.</span> Timing (Pace to Plate)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> The elapsed time from the pitcher&apos;s SET phase to FOOT STRIKE (when the lead foot plants).
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> We calculate the difference in time (in seconds) between the exact video frame where the pitcher begins their motion and the frame where the lead foot plants.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">2.</span> Balance (Trunk Lean at Release)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> Measures the pitcher&apos;s lateral trunk lean (angle offset from perfectly vertical) at the exact moment of BALL RELEASE.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> The trunk is defined as the 2D vector drawn from the mid-point of the hips to the mid-point of the shoulders. We calculate the angle of this vector from a perfectly vertical line.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">3.</span> Posture (Head Drop / Bobbing)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> Measures the vertical drop or travel of the pitcher&apos;s head from SET to BALL RELEASE.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> We track the absolute pixel vertical distance of the nose between the Set phase and the Ball Release phase. To make this measurement accurate across all body types and camera distances, we divide this pixel drop by the pitcher&apos;s estimated body height to get a percentage of height traveled.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">4.</span> Lift &amp; Thrust (Glute Loading)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> Evaluates how effectively the pitcher is loading their back hip and glute before driving down the mound.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> At the PEAK LEG LIFT frame, we draw an energy vector originating at the planted drive ankle (back foot) and pointing to the elevated stride hip (front hip). We measure this angle above horizontal.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">5.</span> Swivel &amp; Stabilize (Glove Arm Discipline)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> Checks if the front glove-side arm remains inside the geometric bounds of the torso at BALL RELEASE.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> We calculate the horizontal bounding box of the torso (bounded by the shoulders and hips) at the Release frame. If the glove wrist falls within these lines, the pitcher remained stable.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
                                    </span>
                                    <ul className="list-disc list-inside space-y-1.5 ml-1">
                                        <li>Glove inside torso bounds: <span className="text-green-400 font-mono ml-1">10/10</span></li>
                                        <li>Glove outside torso bounds: <span className="text-red-400 font-mono ml-1">3/10</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 6. Trunk Stability */}
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-1 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">6.</span> Trunk Stability (Core Control)
                            </h3>
                            <p className="text-xs text-zinc-500 mb-4 italic ml-7">
                                *Note: This metric serves as our measure for body rotation ("Stack &amp; Track") for single-camera 2D video.*
                            </p>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed mt-4">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> Measures how much the pitcher&apos;s core lean changes between FOOT STRIKE and BALL RELEASE.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> We calculate the angle of the trunk vector (mid-hip to mid-shoulder) at Foot Strike, and compare it to the trunk angle at Ball Release. The difference between these two angles dictates the score.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 sm:p-8">
                            <h3 className="text-xl font-bold text-violet-400 mb-4 flex items-baseline gap-3">
                                <span className="text-sm font-mono text-violet-500/50">7.</span> Torque Retention (Shoulder Closedness)
                            </h3>
                            <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">What it is:</strong> A measure of Hip-to-Shoulder Separation. Evaluates how "closed" (pointing toward 3rd or 1st base) the shoulders remain at FOOT STRIKE relative to how completely "open" (pointing at home plate) they are at BALL RELEASE.
                                </p>
                                <p>
                                    <strong className="text-zinc-200 tracking-wide">How it&apos;s measured:</strong> Using the 2D pixel angle of the shoulder line, we compare the shoulder angle at Foot Strike to the angle at Release and express it as a simple ratio (Openness at Foot Strike / Openness at Release). A ratio near 0.0 means the shoulders barely rotated before foot strike (preserving torque). A ratio near 1.0 means the shoulders were already fully open facing the batter at foot plant.
                                </p>
                                <div className="pt-2">
                                    <span className="text-zinc-500 text-[10px] uppercase tracking-widest font-semibold mb-2 block">
                                        Scoring Criteria:
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
                    <h2 className="text-2xl tracking-tight font-bold text-zinc-50 mb-6 pb-4 border-b border-zinc-800">
                        Secondary &amp; Supporting Metrics
                    </h2>
                    <p className="text-zinc-400 mb-10">
                        These metrics provide rich, coach-level insights and data points, but typically do not heavily penalize the core Efficiency Score.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Arm Timing</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                <strong className="text-zinc-300">What it is:</strong> Ensures the throwing arm reaches its cocked (flip-up) position at roughly the exact same time the front foot takes the pitcher&apos;s full body weight.
                            </p>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                <strong className="text-zinc-300">How it&apos;s measured:</strong> We calculate the frame offset between the arm flip-up phase and the weight-bearing phase.
                            </p>
                            <ul className="list-disc list-inside space-y-1 mt-3 text-sm text-zinc-400 ml-1">
                                <li><strong className="text-green-400 font-normal">On time:</strong> 0 to 2 frames before weight bearing</li>
                                <li><strong className="text-amber-400 font-normal">Early:</strong> 3+ frames prior to weight bearing</li>
                                <li><strong className="text-red-400 font-normal">Late:</strong> After weight bearing (major flaw)</li>
                            </ul>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Arm Alignment &amp; Flexion</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                <strong className="text-zinc-300">What it is:</strong> Evaluates whether the throwing elbow is properly elevated and flexed when the arm cocks back.
                            </p>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
                                <strong className="text-zinc-300">How it&apos;s measured:</strong> A balanced composite of:
                            </p>
                            <ul className="list-decimal list-outside space-y-1.5 text-sm text-zinc-400 ml-4">
                                <li><strong>Shoulder-Elbow Line Level:</strong> The shoulder-to-elbow vector should be exactly in line with the horizontal shoulder-to-shoulder vector.</li>
                                <li><strong>Elbow Flexion:</strong> The angle of the inner elbow hinge should ideally be 90&deg; or less.</li>
                            </ul>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Front Knee Bracing</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                <strong className="text-zinc-300">What it is:</strong> Measures if the front leg blocks and acts as a firm brake to catapult the upper body forward.
                            </p>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                <strong className="text-zinc-300">How it&apos;s measured:</strong> We compare the internal angle of the lead knee at FOOT STRIKE vs BALL RELEASE. If the angle increases (extends), it braced. If it decreases (flexes further), the pitcher leaked energy by lunging.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Release Extension</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                <strong className="text-zinc-300">What it is:</strong> Evaluates how far down the mound the pitcher releases the baseball, making the pitch appear faster to the hitter.
                            </p>
                            <p className="text-sm text-zinc-400 leading-relaxed">
                                <strong className="text-zinc-300">How it&apos;s measured:</strong> This is a composite proxy metric using the normalized forward distance of the throwing wrist relative to the drive hip, the shoulder-to-wrist release angle, and forward wrist velocity before release.
                            </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-6 md:col-span-2">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Loading Profile</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                                <strong className="text-zinc-300">What it is:</strong> A snapshot evaluation of the athlete at their lowest, deepest point of the stride between Peak Leg Lift and Foot Strike.
                            </p>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
                                <strong className="text-zinc-300">How it&apos;s measured:</strong> Merges four independent measurements into one profile score:
                            </p>
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <li className="flex items-start gap-2 text-sm text-zinc-400">
                                    <span className="text-zinc-600 font-mono mt-0.5">1.</span>
                                    <span>The depth of the back hip hinge angle.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-zinc-400">
                                    <span className="text-zinc-600 font-mono mt-0.5">2.</span>
                                    <span>The angle of the torso lean.</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-zinc-400">
                                    <span className="text-zinc-600 font-mono mt-0.5">3.</span>
                                    <span>The degree of shoulder counter-rotation (hiding the ball).</span>
                                </li>
                                <li className="flex items-start gap-2 text-sm text-zinc-400">
                                    <span className="text-zinc-600 font-mono mt-0.5">4.</span>
                                    <span>The horizontal baseline drift distance (forward momentum) from Peak Leg Lift.</span>
                                </li>
                            </ul>
                        </div>

                    </div>
                </section>

                {/* Disabled Metrics */}
                <section>
                    <div className="bg-rose-950/20 border border-rose-900/30 rounded-2xl p-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                        <h2 className="text-2xl tracking-tight font-bold text-rose-100 mb-4 flex items-center gap-3">
                            Disabled Metrics
                        </h2>
                        <p className="text-rose-200/70 mb-8 max-w-2xl leading-relaxed">
                            We believe in strict data integrity. If a metric cannot be measured with robust mathematical certainty due to single-camera constraints, we disable it rather than outputting false data to the athlete.
                        </p>

                        <div className="bg-zinc-950/50 rounded-xl p-6 border border-rose-900/20">
                            <h3 className="text-lg font-bold text-zinc-200 mb-3">Stride Length</h3>
                            <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                                <strong className="text-zinc-300">What it was supposed to measure:</strong> The physical distance (in inches) from the pitching rubber to the lead foot at foot strike. Standard benchmarks require 80%-90% of body height.
                            </p>
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-rose-300 uppercase tracking-widest">Why it is disabled:</h4>
                                <ul className="space-y-4">
                                    <li className="text-sm text-zinc-400 leading-relaxed">
                                        <strong className="text-rose-200/80 block mb-1">Digital Panning:</strong>
                                        Operators naturally pan AWRE Cameras to follow the pitcher moving down the mound. Because the camera physically rotates, the background pixels shift continuously over the pitch delivery. Measuring pure pixel distance between the back ankle at Set Phase and the front ankle at Foot Strike is invalidated because the camera&apos;s origin point drags along with the pitcher.
                                    </li>
                                    <li className="text-sm text-zinc-400 leading-relaxed">
                                        <strong className="text-rose-200/80 block mb-1">Occlusion:</strong>
                                        Tracing the pitching rubber directly also fails because pitchers regularly drag their feet over the rubber, tricking computer vision algorithms into tracking the moving shoe instead of the stationary ground.
                                    </li>
                                    <li className="text-sm text-zinc-400 leading-relaxed border-t border-rose-900/20 pt-4 mt-2">
                                        <strong className="text-rose-100 block mb-1">Conclusion:</strong>
                                        Without establishing a stationary 3D origin, measuring absolute Euclidean distance from single, panning cameras is not robust enough. Stride length is currently disabled and does not penalize efficiency scores.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    );
}
