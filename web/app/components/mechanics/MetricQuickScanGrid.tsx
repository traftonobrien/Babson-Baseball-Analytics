"use client";

import { metricLabel, scoreColor, scoreBg, confidenceLabel } from "@/lib/mechanics/labels";
import type { MetricResult, NotesJson } from "@/lib/mechanics/types";

interface MetricTileProps {
  metricKey: string;
  metric: MetricResult;
  onClick: () => void;
}

function MetricTile({ metricKey, metric, onClick }: MetricTileProps) {
  const eff = metric.score_eff ?? metric.score;
  const color = scoreColor(eff);
  const bg = scoreBg(eff);
  const isInsufficient = metric.status !== "ok";

  return (
    <button
      onClick={onClick}
      className={`relative text-left p-4 rounded-[1.45rem] border cursor-pointer transition-smooth hover:-translate-y-0.5 hover:brightness-110 ${bg} shadow-[0_16px_40px_rgba(0,0,0,0.18)]`}
    >
      {metric.low_confidence && (
        <span className="absolute top-2.5 right-2.5 rounded-full border border-amber-800/40 bg-amber-900/60 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-amber-400">
          Low conf
        </span>
      )}
      {metric.manual_review_recommended && !metric.low_confidence && (
        <span className="absolute top-2.5 right-2.5 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Review
        </span>
      )}

      <p className="mb-2 pr-12 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        {metricLabel(metricKey)}
      </p>

      {isInsufficient ? (
        <p className="text-2xl font-black font-mono text-zinc-600">—</p>
      ) : (
        <p className="text-3xl font-black font-mono tabular-nums" style={{ color }}>
          {eff != null ? eff.toFixed(1) : "—"}
        </p>
      )}

      {/* Status or pass/fail */}
      <div className="mt-2 flex items-center gap-2">
        {isInsufficient ? (
          <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Insufficient data</span>
        ) : (
          <>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor: metric.pass_fail ? "#22c55e" : "#ef4444",
                opacity: metric.pass_fail === null ? 0 : 1,
              }}
            />
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">
              {metric.pass_fail ? "Pass" : metric.pass_fail === false ? "Fail" : ""}
            </span>
          </>
        )}
        {metric.confidence != null && (
          <span className="text-[9px] text-zinc-600 ml-auto">
            {confidenceLabel(metric.confidence)} conf
          </span>
        )}
      </div>

      {metric.reasons && metric.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {metric.reasons.map((r) => (
            <span
              key={r}
              className="rounded-full border border-zinc-700/50 bg-zinc-900/60 px-1.5 py-px text-[8px] uppercase tracking-[0.16em] text-amber-500/60"
            >
              {r.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface MetricQuickScanGridProps {
  notes: NotesJson;
  onMetricClick: (key: string) => void;
  heading?: string;
}

export function MetricQuickScanGrid({
  notes,
  onMetricClick,
  heading = "All Metrics",
}: MetricQuickScanGridProps) {
  const keys = notes.official_metrics.filter((k) => notes.metrics[k]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">{heading}</h2>
        <p className="mt-1 text-xs text-zinc-600">Click any tile for the full metric breakdown and confidence context.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {keys.map((key) => (
          <MetricTile
            key={key}
            metricKey={key}
            metric={notes.metrics[key]}
            onClick={() => onMetricClick(key)}
          />
        ))}
      </div>
      <p className="mt-3 text-[9px] text-zinc-700">
        Click any tile for full breakdown · Score = score_eff (confidence-weighted)
      </p>
    </div>
  );
}
