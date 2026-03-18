"use client";

import { useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";

export default function ArmActionGuideModal({ onClose }: { onClose: () => void }) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [handleEscape]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">How Arm Action Profile Works</h2>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Classification methodology · TrackMan movement-based
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto px-6 py-5 space-y-7 text-[13px] text-zinc-300 leading-relaxed">

          {/* --- What is it --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              What Is Arm Action?
            </h3>
            <p>
              Every pitcher&apos;s forearm rotates at release — either <span className="text-blue-300 font-semibold">pronating</span> (palm rotates toward the ground, toward the arm side) or <span className="text-violet-300 font-semibold">supinating</span> (palm rotates skyward, toward the glove side). This rotation is the single biggest driver of where a pitch moves.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400 mb-1.5">Pronator</div>
                <ul className="space-y-1 text-[11px] text-zinc-400">
                  <li>• Palm rotates toward the ground at release</li>
                  <li>• Ball moves toward the arm side</li>
                  <li>• Natural pitches: sinker, 2-seam, changeup</li>
                  <li>• Cue: &quot;turn the doorknob&quot;</li>
                </ul>
              </div>
              <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400 mb-1.5">Supinator</div>
                <ul className="space-y-1 text-[11px] text-zinc-400">
                  <li>• Palm rotates skyward at release</li>
                  <li>• Ball moves toward the glove side</li>
                  <li>• Natural pitches: slider, sweeper, cutter</li>
                  <li>• Cue: &quot;karate chop&quot; / &quot;show the sky&quot;</li>
                </ul>
              </div>
            </div>
          </section>

          {/* --- Arm Slot --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Arm Slot
            </h3>
            <p className="mb-3">
              Arm slot is calculated from the fastball&apos;s TrackMan <span className="text-zinc-200 font-medium">release height</span> and <span className="text-zinc-200 font-medium">release side</span> using a biomechanical angle formula:
            </p>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3 font-mono text-[11px] text-zinc-400">
              angle = atan2(releaseHeight − 5.5 ft, |releaseSide|) × (180/π) + 40°
              <br />
              <span className="text-zinc-600">clamped to 0–90°</span>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              5.5 ft is the shoulder baseline. The 40° biomechanical offset aligns the shoulder-local angle with standard scouting conventions.
            </p>
            <div className="mt-3 space-y-1.5">
              {[
                { range: "75°+", label: "Over-the-top", color: "text-zinc-200" },
                { range: "60–75°", label: "High 3/4", color: "text-zinc-300" },
                { range: "45–60°", label: "3/4", color: "text-zinc-300" },
                { range: "30–45°", label: "Sidearm", color: "text-zinc-400" },
                { range: "15–30°", label: "Low Sidearm", color: "text-zinc-500" },
                { range: "0–15°", label: "Submarine", color: "text-zinc-500" },
              ].map(({ range, label, color }) => (
                <div key={label} className="flex items-center gap-3 text-[11px]">
                  <span className="w-14 shrink-0 font-mono text-zinc-600">{range}</span>
                  <span className={`font-medium ${color}`}>{label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* --- Classification Signals --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Classification Signals
            </h3>
            <p className="mb-3">
              Pronator vs. Supinator is determined by a weighted scoring system across six signals derived from the pitcher&apos;s TrackMan data. A positive score = Pronator, negative = Supinator.
            </p>
            <div className="space-y-2">
              {[
                {
                  signal: "Fastball HB direction",
                  weight: "3×",
                  detail: "The primary signal. For RHP: positive HB (toward 1B) = arm-side run = pronator. Negative HB (toward 3B) = glove-side cut = supinator. Flipped for LHP.",
                  strong: true,
                },
                {
                  signal: "Sinker in arsenal",
                  weight: "2×",
                  detail: "A sinker requires active pronation to produce arm-side sink. Strong pronator confirmation.",
                  strong: true,
                },
                {
                  signal: "Slider or Sweeper",
                  weight: "1.5×",
                  detail: "Both require forearm supination. Presence in arsenal is a reliable supinator signal.",
                  strong: false,
                },
                {
                  signal: "Changeup / Splitter",
                  weight: "1×",
                  detail: "A standard changeup grip relies on pronation at release — consistent with pronator arm action.",
                  strong: false,
                },
                {
                  signal: "Cutter HB direction",
                  weight: "1×",
                  detail: "A cutter that breaks glove-side confirms some supination component in the arm action.",
                  strong: false,
                },
                {
                  signal: "Fastball spin axis (2D)",
                  weight: "1×",
                  detail: "For RHP: axis 185–250° = arm-side tilt (pronator). Axis 110–175° = glove-side tilt (supinator). Flipped for LHP.",
                  strong: false,
                },
              ].map(({ signal, weight, detail }) => (
                <div key={signal} className="flex gap-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3.5 py-2.5">
                  <div className="shrink-0 mt-0.5">
                    <span className="inline-block rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[9px] font-semibold text-zinc-400">
                      {weight}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-zinc-200 mb-0.5">{signal}</div>
                    <div className="text-[10px] text-zinc-500">{detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-3.5 py-3 text-[11px] text-zinc-500">
              <span className="text-zinc-400 font-medium">Scoring: </span>
              The weighted average score is computed across all fired signals. Score &gt; +0.2 = Pronator, &lt; −0.2 = Supinator, in between = Neutral.
            </div>
          </section>

          {/* --- Confidence --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Confidence Levels
            </h3>
            <div className="space-y-2">
              {[
                {
                  level: "High",
                  color: "text-emerald-400",
                  desc: "Weighted score ≥ 0.6 AND 3+ signals fired. Strong multi-source agreement — classification is reliable.",
                },
                {
                  level: "Medium",
                  color: "text-yellow-400",
                  desc: "Weighted score ≥ 0.35 OR 2+ signals fired. Directionally reliable but may shift with more TrackMan data.",
                },
                {
                  level: "Low",
                  color: "text-zinc-500",
                  desc: "Weak signal or insufficient data. Import more TrackMan sessions to improve confidence.",
                },
              ].map(({ level, color, desc }) => (
                <div key={level} className="flex items-start gap-3 text-[11px]">
                  <span className={`shrink-0 mt-0.5 font-semibold ${color} w-14`}>{level}</span>
                  <span className="text-zinc-400">{desc}</span>
                </div>
              ))}
            </div>
          </section>

          {/* --- Recommendations --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Pitch Recommendations
            </h3>
            <p className="mb-3">
              Recommendations are generated from the pitcher&apos;s arm action type and their current arsenal. Three tiers:
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-[11px]">
                <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                <div>
                  <span className="font-semibold text-zinc-200">Current Arsenal — Good Fit</span>
                  <p className="text-zinc-500 mt-0.5">Pitch already in the arsenal that aligns well with the arm action. Shows coaching cues to maximize it.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-[11px]">
                <span className="mt-0.5 shrink-0 text-blue-400">+</span>
                <div>
                  <span className="font-semibold text-zinc-200">Primary Add</span>
                  <p className="text-zinc-500 mt-0.5">Highest-priority pitch to add. Naturally suited to the arm action — arm does the work with minimal adjustment.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-[11px]">
                <span className="mt-0.5 shrink-0 text-zinc-600">○</span>
                <div>
                  <span className="font-semibold text-zinc-200">Secondary Option</span>
                  <p className="text-zinc-500 mt-0.5">Viable addition but requires more deliberate technique — may work against the natural arm action and needs specific grip or wrist adjustments.</p>
                </div>
              </div>
            </div>
          </section>

          {/* --- Data requirements --- */}
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-2">
              Data Requirements
            </h3>
            <p className="text-[11px] text-zinc-400">
              Classification requires at least one fastball-family pitch (Fastball, Sinker, or Fastball/Sinker) with horizontal break (HB) data from a TrackMan import. Arm slot additionally requires release height and release side data. Confidence improves with more sessions — averages across all imported sessions are used, not just the most recent.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}
