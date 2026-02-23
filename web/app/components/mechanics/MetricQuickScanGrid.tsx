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
      className={`relative text-left p-4 rounded-xl border cursor-pointer transition-smooth hover:brightness-110 hover:scale-[1.01] ${bg}`}
    >
      {/* Low confidence badge */}
      {metric.low_confidence && (
        <span className="absolute top-2.5 right-2.5 text-[8px] uppercase tracking-wider bg-amber-900/60 text-amber-400 border border-amber-800/40 rounded px-1.5 py-0.5">
          Low conf
        </span>
      )}
      {/* Manual review badge */}
      {metric.manual_review_recommended && !metric.low_confidence && (
        <span className="absolute top-2.5 right-2.5 text-[8px] uppercase tracking-wider bg-zinc-800 text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
          Review
        </span>
      )}

      {/* Metric name */}
      <p className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2 pr-12">
        {metricLabel(metricKey)}
      </p>

      {/* Score */}
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

      {/* Reason tags */}
      {metric.reasons && metric.reasons.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {metric.reasons.map((r) => (
            <span
              key={r}
              className="text-[8px] uppercase tracking-wider bg-zinc-900/60 text-amber-500/60 border border-zinc-700/50 rounded px-1.5 py-px"
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
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">{heading}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {keys.map((key) => (
          <MetricTile
            key={key}
            metricKey={key}
            metric={notes.metrics[key]}
            onClick={() => onMetricClick(key)}
          />
        ))}
      </div>
      <p className="text-[9px] text-zinc-700 mt-3">
        Click any tile for full breakdown · Score = score_eff (confidence-weighted)
      </p>
    </div>
  );
}
