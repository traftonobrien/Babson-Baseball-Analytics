"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";

// ---------------------------------------------------------------------------
// Types (subset we actually render — avoids deep imports in client bundle)
// ---------------------------------------------------------------------------
interface Props {
  /** null = player exists but has no mechanics data */
  entry: HubPlayerEntry | null;
}

// ---------------------------------------------------------------------------
// MechanicsProfileCard
// ---------------------------------------------------------------------------
export default function MechanicsProfileCard({ entry }: Props) {
  const [thumbError, setThumbError] = useState(false);

  // No sessions or player not found
  if (!entry || !entry.sessions.length) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 px-5 py-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-600 mb-3">
          Mechanics
        </p>
        <p className="text-sm text-zinc-600 mb-4">No mechanics sessions for this player yet.</p>
        <Link
          href="/mechanics"
          className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Browse Mechanics Hub
          <ArrowRight className="w-3 h-3" />
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
      {/* Section label */}
      <div className="px-5 py-3 border-b border-zinc-800/60 flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
          Mechanics
        </p>
        {isLowConf && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-amber-400">
            Low Conf
          </span>
        )}
      </div>

      <div className="p-5 flex gap-4">
        {/* Thumbnail */}
        {!thumbError && (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-950 shrink-0 hidden sm:block">
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
              <p className="text-[10px] text-zinc-600">{latest.date}</p>
              <p className="text-sm font-semibold text-zinc-200 leading-tight mt-0.5 truncate">
                {latest.label}
              </p>
              <p className="text-[10px] text-zinc-600 mt-0.5">
                {latest.hand === "R" ? "RHP" : "LHP"}
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
              <span className="text-[10px] text-zinc-600">/10</span>
            </div>
          </div>

          {/* Stat chips */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] mb-3">
            <span className="text-green-500">{latest.pass_count} PASS</span>
            <span className="text-zinc-700">·</span>
            <span className="text-red-500">{latest.fail_count} FAIL</span>
            {confPct !== null && (
              <>
                <span className="text-zinc-700">·</span>
                <span className={isLowConf ? "text-amber-400" : "text-zinc-500"}>
                  {confPct}% conf{confLabel ? ` (${confLabel})` : ""}
                </span>
              </>
            )}
            {latest.low_confidence_count != null && latest.low_confidence_count > 0 && (
              <>
                <span className="text-zinc-700">·</span>
                <span className="text-amber-600">
                  {latest.low_confidence_count} low-conf metric
                  {latest.low_confidence_count !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            <Link
              href={`/mechanics/session/${entry.slug}/${latest.slug}`}
              className="flex-1 text-center text-[11px] font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              Open Mechanics Session
            </Link>
            <Link
              href={`/mechanics/player/${entry.slug}`}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap px-2"
            >
              All Sessions →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
