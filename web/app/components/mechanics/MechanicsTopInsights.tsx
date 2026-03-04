"use client";

import { getTopInsights } from "@/lib/mechanics/selectors";
import { metricLabel, scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import type { NotesJson } from "@/lib/mechanics/types";

interface MechanicsTopInsightsProps {
  notes: NotesJson;
  onMetricClick: (key: string) => void;
}

function insightBorder(score: number | null): string {
  if (score === null) return "border-zinc-800";
  if (score >= 7) return "border-green-800/50";
  if (score >= 5) return "border-amber-800/50";
  return "border-red-800/60";
}

function insightBg(score: number | null): string {
  if (score === null) return "bg-zinc-900";
  if (score >= 7) return "bg-green-950/40";
  if (score >= 5) return "bg-amber-950/40";
  return "bg-red-950/50";
}

function confBadge(conf: number | null): string {
  if (conf === null) return "text-zinc-600 border-zinc-700";
  if (conf >= 0.7) return "text-green-400 border-green-800/50";
  if (conf >= 0.5) return "text-zinc-400 border-zinc-700";
  return "text-amber-400 border-amber-800/50";
}

export function MechanicsTopInsights({ notes, onMetricClick }: MechanicsTopInsightsProps) {
  const top = getTopInsights(notes, 3);
  if (top.length === 0) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5 sm:px-6">
      <div className="mb-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Top Issues</h2>
        <p className="mt-1 text-xs text-zinc-600">Sorted by impact. Click any card for the full breakdown.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {top.map(({ key, metric }) => {
          const eff = metric.score_eff ?? metric.score;
          const color = scoreColor(eff);

          return (
            <button
              key={key}
              onClick={() => onMetricClick(key)}
              className={`text-left p-4 rounded-[1.5rem] border cursor-pointer transition-smooth hover:-translate-y-0.5 hover:brightness-110 ${insightBorder(eff)} ${insightBg(eff)} shadow-[0_16px_40px_rgba(0,0,0,0.18)]`}
            >
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                {metricLabel(key)}
              </p>

              <div className="flex items-end justify-between mb-3">
                <span
                  className="text-3xl font-black font-mono tabular-nums leading-none"
                  style={{ color }}
                >
                  {eff != null ? eff.toFixed(1) : "—"}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide"
                  style={{ color: metric.pass_fail ? "#22c55e" : "#ef4444" }}
                >
                  {metric.pass_fail ? "PASS" : "FAIL"}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] ${confBadge(metric.confidence)}`}
                >
                  {confidenceLabel(metric.confidence)} conf
                </span>
                {metric.reasons?.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-zinc-700/60 bg-zinc-900 px-2 py-0.5 text-[8px] uppercase tracking-[0.16em] text-amber-500/70"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
