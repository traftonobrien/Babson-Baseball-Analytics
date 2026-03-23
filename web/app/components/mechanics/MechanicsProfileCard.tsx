"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";

// ---------------------------------------------------------------------------
// Types (subset we actually render — avoids deep imports in client bundle)
// ---------------------------------------------------------------------------
interface Props {
  /** null = player exists but has no mechanics data */
  entry: HubPlayerEntry | null;
  /** When set (e.g. from player profile), back button on session will return to profile */
  profileSlug?: string;
}

// ---------------------------------------------------------------------------
// MechanicsProfileCard
// ---------------------------------------------------------------------------
export default function MechanicsProfileCard({ entry, profileSlug }: Props) {
  const [thumbError, setThumbError] = useState(false);

  // No sessions or player not found
  if (!entry || !entry.sessions.length) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200/80 bg-surface px-5 py-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Mechanics
        </p>
        <p className="mb-4 text-sm text-slate-500">No mechanics sessions for this player yet.</p>
        <Link
          href="/mechanics"
          className="group/btn inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-700 transition-smooth hover:border-violet-300 hover:bg-violet-100"
        >
          Browse Mechanics Hub
          <ArrowRight className="h-4 w-4 shrink-0 text-violet-600 opacity-70 transition-opacity group-hover/btn:opacity-100" />
        </Link>
      </div>
    );
  }

  const latest = [...entry.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  const color = scoreColor(latest.efficiency_score);
  const confPct =
    latest.avg_confidence != null ? Math.round(latest.avg_confidence * 100) : null;
  const confLabel =
    latest.avg_confidence != null ? confidenceLabel(latest.avg_confidence) : null;
  const isLowConf = (latest.avg_confidence ?? 1) < 0.6;
  const thumbSrc = `/mechanics/${entry.slug}/${latest.slug}/release.png`;

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-surface shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
      {/* Section label */}
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
          Mechanics
        </p>
        {isLowConf && (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
            Low Conf
          </span>
        )}
      </div>

      <div className="p-5 flex gap-4">
        {/* Thumbnail */}
        {!thumbError && (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:block">
            <img
              src={thumbSrc}
              alt="Release frame"
              className="w-full h-full object-cover object-top"
              onError={() => setThumbError(true)}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Score + metadata */}
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <p className="text-[10px] text-slate-500">{latest.date}</p>
              <p className="mt-0.5 truncate text-sm font-semibold leading-tight text-slate-900">
                {latest.label}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(latest.hand)}`}
                >
                  {latest.hand === "R" ? "RHP" : "LHP"}
                </span>
                {" · "}
                {latest.view_mode.replace(/_/g, " ")}
              </p>
            </div>
            <div className="flex items-baseline gap-0.5 shrink-0">
              <span
                className="text-2xl font-black font-mono tabular-nums"
                style={{ color }}
              >
                {latest.efficiency_score.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-500">/10</span>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] mb-3">
            <span className="text-green-500">{latest.pass_count} PASS</span>
            <span className="text-slate-300">·</span>
            <span className="text-red-500">{latest.fail_count} FAIL</span>
            {confPct !== null && (
              <>
                <span className="text-slate-300">·</span>
                <span className={isLowConf ? "text-amber-600" : "text-slate-500"}>
                  {confPct}% conf{confLabel ? ` (${confLabel})` : ""}
                </span>
              </>
            )}
            {latest.low_confidence_count != null && latest.low_confidence_count > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-600">
                  {latest.low_confidence_count} low-conf metric
                  {latest.low_confidence_count !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          <Link
            href={`/mechanics/session/${entry.slug}/${latest.slug}${profileSlug ? `?from=profile&slug=${profileSlug}` : ""}`}
            className="group/btn flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 transition-smooth hover:border-violet-300 hover:bg-violet-100"
          >
            <span className="text-sm font-semibold text-violet-700 transition-smooth group-hover/btn:text-violet-800">
              Open Session
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-violet-600 opacity-70 transition-opacity group-hover/btn:opacity-100" />
          </Link>
        </div>
      </div>
    </div>
  );
}
