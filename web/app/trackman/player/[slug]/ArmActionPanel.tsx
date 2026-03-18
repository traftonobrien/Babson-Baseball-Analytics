"use client";

import { useMemo, useState } from "react";
import { Activity, CheckCircle2, Circle, HelpCircle, PlusCircle } from "lucide-react";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { classifyArmProfile, type ArmActionProfile, type PitchRecommendation } from "@/lib/trackman/armAction";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";
import ArmActionGuideModal from "./ArmActionGuideModal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(c: ArmActionProfile["confidence"]): string {
  switch (c) {
    case "High": return "text-emerald-400";
    case "Medium": return "text-yellow-400";
    case "Low": return "text-zinc-500";
  }
}

function actionAccentClasses(action: ArmActionProfile["armAction"]): {
  bg: string;
  border: string;
  text: string;
  glow: string;
} {
  switch (action) {
    case "Pronator":
      return {
        bg: "bg-blue-500/10",
        border: "border-blue-500/30",
        text: "text-blue-300",
        glow: "rgba(59,130,246,0.08)",
      };
    case "Supinator":
      return {
        bg: "bg-violet-500/10",
        border: "border-violet-500/30",
        text: "text-violet-300",
        glow: "rgba(139,92,246,0.08)",
      };
    default:
      return {
        bg: "bg-zinc-800/40",
        border: "border-zinc-700/40",
        text: "text-zinc-400",
        glow: "rgba(255,255,255,0.03)",
      };
  }
}

function RecommendationRow({ rec }: { rec: PitchRecommendation }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-zinc-800/50 last:border-0">
      <div className="mt-0.5 shrink-0">
        {rec.alreadyThrows ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : rec.priority === "Primary" ? (
          <PlusCircle className="h-4 w-4 text-blue-400" />
        ) : (
          <Circle className="h-4 w-4 text-zinc-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <PitchTypeChip pitchType={rec.pitchType} label={rec.pitchType} size="xs" />
          {rec.alreadyThrows && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-500/80">
              Current Arsenal
            </span>
          )}
          {!rec.alreadyThrows && rec.priority === "Primary" && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-400/80">
              Primary Add
            </span>
          )}
          {!rec.alreadyThrows && rec.priority === "Secondary" && (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Secondary Option
            </span>
          )}
        </div>
        <p className="text-[11px] text-zinc-400 leading-relaxed">{rec.rationale}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function ArmActionPanel({
  aggregated,
  hand,
}: {
  aggregated: TrackmanPitchTypeSummary[];
  hand: "R" | "L";
}) {
  const [guideOpen, setGuideOpen] = useState(false);

  const profile = useMemo(
    () => classifyArmProfile(aggregated, hand),
    [aggregated, hand],
  );

  const accent = actionAccentClasses(profile.armAction);

  if (aggregated.length === 0) return null;

  const primaryRecs = profile.recommendations.filter((r) => !r.alreadyThrows && r.priority === "Primary");
  const currentFit = profile.recommendations.filter((r) => r.alreadyThrows);
  const secondaryRecs = profile.recommendations.filter((r) => !r.alreadyThrows && r.priority === "Secondary");

  return (
    <div
      className="rounded-[1.35rem] border border-zinc-800/90 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.20)]"
      style={{
        background: `radial-gradient(circle at 84% 14%, ${accent.glow}, transparent 22%), linear-gradient(180deg, rgba(24,24,27,0.78), rgba(9,9,11,0.94))`,
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-zinc-100">Arm Action Profile</h3>
          </div>
          <p className="text-[10px] text-zinc-500">
            Classified from TrackMan movement data · {hand}HP
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${confidenceColor(profile.confidence)}`}
          >
            {profile.confidence} confidence
          </span>
          <button
            onClick={() => setGuideOpen(true)}
            title="How is this calculated?"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700/60 bg-zinc-800/60 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {guideOpen && <ArmActionGuideModal onClose={() => setGuideOpen(false)} />}

      {/* Classification badge */}
      <div
        className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 mb-5 ${accent.bg} ${accent.border}`}
      >
        <span className={`text-lg font-bold tracking-tight ${accent.text}`}>
          {profile.label}
        </span>
      </div>

      {/* Signals */}
      {profile.signals.length > 0 && (
        <div className="mb-5">
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-2">
            Classification Signals
          </div>
          <ul className="space-y-1">
            {profile.signals.map((sig, i) => (
              <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-400">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                {sig}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pitch fit + recommendations */}
      {profile.recommendations.length > 0 && (
        <div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-3">
            Arsenal Fit &amp; Development Cues
          </div>

          <div className="space-y-0">
            {currentFit.map((r) => (
              <RecommendationRow key={r.pitchType} rec={r} />
            ))}
            {primaryRecs.map((r) => (
              <RecommendationRow key={r.pitchType} rec={r} />
            ))}
            {secondaryRecs.map((r) => (
              <RecommendationRow key={r.pitchType} rec={r} />
            ))}
          </div>
        </div>
      )}

      {profile.armAction == null && (
        <p className="text-zinc-500 text-sm mt-2">
          Import at least one TrackMan session with fastball data to classify arm action.
        </p>
      )}
    </div>
  );
}
