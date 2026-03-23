"use client";

import { useMemo, useState } from "react";
import { Activity, HelpCircle, PlusCircle } from "lucide-react";
import { PitchTypeChip } from "@/components/ui/pitch-type-chip";
import { classifyArmProfile, type ArmActionProfile, type PitchRecommendation } from "@/lib/trackman/armAction";
import type { TrackmanPitchTypeSummary } from "@/lib/trackman/metrics";
import ArmActionGuideModal from "./ArmActionGuideModal";
import { useSiteAppearance } from "@/app/components/SiteAppearanceContext";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function confidenceColor(c: ArmActionProfile["confidence"]): string {
  switch (c) {
    case "High": return "text-emerald-700";
    case "Medium": return "text-amber-800";
    case "Low": return "text-slate-500 dark:text-zinc-400";
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
        bg: "bg-blue-50",
        border: "border-blue-200",
        text: "text-blue-800",
        glow: "rgba(59,130,246,0.08)",
      };
    case "Supinator":
      return {
        bg: "bg-violet-50",
        border: "border-violet-200",
        text: "text-violet-800",
        glow: "rgba(139,92,246,0.08)",
      };
    default:
      return {
        bg: "bg-slate-100",
        border: "border-slate-200",
        text: "text-slate-700",
        glow: "rgba(148,163,184,0.12)",
      };
  }
}

function RecommendationRow({
  rec,
  isDark,
}: {
  rec: PitchRecommendation;
  isDark: boolean;
}) {
  const displayLabel = rec.variantLabel ?? rec.pitchType;

  return (
    <div
      className={
        isDark
          ? "flex items-start gap-3 border-b border-zinc-700 py-3 last:border-0"
          : "flex items-start gap-3 border-b border-border py-3 last:border-0"
      }
    >
      <div className="mt-0.5 shrink-0">
        {rec.priority === "Primary" ? (
          <PlusCircle className="h-4 w-4 text-blue-600" />
        ) : (
          <span className="inline-block h-4 w-4 text-center text-[10px] leading-4 text-[#94A3B8]">○</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <PitchTypeChip pitchType={rec.pitchType} label={displayLabel} size="xs" variant="solid" />
          {rec.priority === "Primary" ? (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-700">
              Primary Add
            </span>
          ) : (
            <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-zinc-400">
              Secondary Option
            </span>
          )}
        </div>
        <p className={isDark ? "text-[11px] leading-relaxed text-zinc-400" : "text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400"}>
          {rec.rationale}
        </p>
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
  const isDark = useSiteAppearance() === "dark";
  const [guideOpen, setGuideOpen] = useState(false);

  const profile = useMemo(
    () => classifyArmProfile(aggregated, hand),
    [aggregated, hand],
  );

  const accent = actionAccentClasses(profile.armAction);

  if (aggregated.length === 0) return null;

  const primaryRecs = profile.recommendations.filter((r) => r.priority === "Primary");
  const secondaryRecs = profile.recommendations.filter((r) => r.priority === "Secondary");

  return (
    <div
      className={
        isDark
          ? "rounded-[1.35rem] border border-zinc-700 bg-zinc-900/50 p-5 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
          : "rounded-[1.35rem] border border-border bg-surface p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)]"
      }
      style={{
        background: isDark
          ? `radial-gradient(circle at 84% 14%, ${accent.glow}, transparent 22%), linear-gradient(180deg, #18181b, #09090b)`
          : `radial-gradient(circle at 84% 14%, ${accent.glow}, transparent 22%), linear-gradient(180deg, #ffffff, #f8fafc)`,
      }}
    >
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Activity className={isDark ? "h-4 w-4 text-zinc-500" : "h-4 w-4 text-slate-500 dark:text-zinc-400"} />
            <h3 className={isDark ? "text-sm font-semibold text-zinc-100" : "text-sm font-semibold text-slate-900 dark:text-zinc-50"}>
              Arm Action Profile
            </h3>
          </div>
          <p className={isDark ? "text-[10px] text-zinc-400" : "text-[10px] text-slate-500 dark:text-zinc-400"}>
            Classified from TrackMan movement data · {hand}HP
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`text-[9px] font-semibold uppercase tracking-[0.18em] ${confidenceColor(profile.confidence)}`}
          >
            {profile.confidence} confidence
          </span>
          <button
            onClick={() => setGuideOpen(true)}
            title="How is this calculated?"
            className={
              isDark
                ? "flex h-6 w-6 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-100"
                : "flex h-6 w-6 items-center justify-center rounded-full border border-[#E2E8F0] bg-background text-slate-500 dark:text-zinc-400 transition-colors hover:border-[#CBD5E1] hover:text-slate-900 dark:hover:text-zinc-50"
            }
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
          <div
            className={
              isDark
                ? "mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                : "mb-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400"
            }
          >
            Classification Signals
          </div>
          <ul className="space-y-1">
            {profile.signals.map((sig, i) => (
              <li
                key={i}
                className={
                  isDark
                    ? "flex items-start gap-2 text-[11px] text-zinc-400"
                    : "flex items-start gap-2 text-[11px] text-slate-500 dark:text-zinc-400"
                }
              >
                <span
                  className={
                    isDark ? "mt-1 h-1 w-1 shrink-0 rounded-full bg-zinc-600" : "mt-1 h-1 w-1 shrink-0 rounded-full bg-[#94A3B8]"
                  }
                />
                {sig}
              </li>
            ))}
          </ul>
        </div>
      )}

      {profile.guidance && (
        <div
          className={
            isDark
              ? "mb-5 rounded-2xl border border-zinc-700 bg-zinc-950/80 px-4 py-3"
              : "mb-5 rounded-2xl border border-border bg-background px-4 py-3"
          }
        >
          <div
            className={
              isDark
                ? "mb-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                : "mb-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400"
            }
          >
            Development Note
          </div>
          <p className={isDark ? "text-[11px] leading-relaxed text-zinc-400" : "text-[11px] leading-relaxed text-slate-500 dark:text-zinc-400"}>
            {profile.guidance}
          </p>
        </div>
      )}

      {/* Pitch fit + recommendations */}
      {profile.recommendations.length > 0 && (
        <div>
          <div
            className={
              isDark
                ? "mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-500"
                : "mb-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400"
            }
          >
            Arsenal Fit &amp; Development Cues
          </div>

          <div className="space-y-0">
            {primaryRecs.map((r) => (
              <RecommendationRow
                key={`${r.variantId ?? r.pitchType}-${r.priority}`}
                rec={r}
                isDark={isDark}
              />
            ))}
            {secondaryRecs.map((r) => (
              <RecommendationRow
                key={`${r.variantId ?? r.pitchType}-${r.priority}`}
                rec={r}
                isDark={isDark}
              />
            ))}
          </div>
        </div>
      )}

      {profile.armAction == null && (
        <p className={isDark ? "mt-2 text-sm text-zinc-400" : "mt-2 text-sm text-slate-500 dark:text-zinc-400"}>
          Import at least one TrackMan session with fastball data to classify arm action.
        </p>
      )}
    </div>
  );
}
