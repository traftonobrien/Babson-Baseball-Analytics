"use client";

import Image from "next/image";
import { metricLabel, scoreColor, confidenceLabel, FOOT_STRIKE_METRIC_AFFINITY, RELEASE_METRIC_AFFINITY } from "@/lib/mechanics/labels";
import type { MetricResult, NotesJson } from "@/lib/mechanics/types";

interface MiniMetricRowProps {
  metricKey: string;
  metric: MetricResult;
  onClick: () => void;
}

function MiniMetricRow({ metricKey, metric, onClick }: MiniMetricRowProps) {
  const eff = metric.score_eff ?? metric.score;
  const color = scoreColor(eff);
  const isInsufficient = metric.status !== "ok";

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">
          {metricLabel(metricKey)}
        </span>
        <span className="font-mono font-bold text-sm" style={{ color: isInsufficient ? "#71717a" : color }}>
          {isInsufficient ? "—" : (eff != null ? eff.toFixed(1) : "—")}
        </span>
      </div>

      {metric.callout && (
        <p className="text-[11px] text-zinc-300 leading-relaxed mt-1 line-clamp-2">
          {metric.callout}
        </p>
      )}

      {!metric.callout && metric.coaching_cues[0] && (
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-1 line-clamp-1">
          {metric.coaching_cues[0]}
        </p>
      )}

      {(metric.low_confidence || isInsufficient) && (
        <div className="flex items-center gap-1 mt-1.5">
          <span className="w-1 h-1 rounded-full bg-amber-500" />
          <span className="text-[9px] text-amber-500">
            {isInsufficient ? "Insufficient data" : `Low conf · ${confidenceLabel(metric.confidence)}`}
          </span>
        </div>
      )}
    </button>
  );
}

interface InsightPanelProps {
  title: string;
  phase: string;
  imageSrc: string;
  metricKeys: string[];
  notes: NotesJson;
  onMetricClick: (key: string) => void;
}

function InsightPanel({ title, phase: _phase, imageSrc, metricKeys, notes, onMetricClick }: InsightPanelProps) {
  const available = metricKeys.filter((k) => notes.metrics[k]);
  if (available.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">{title}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-0">
        {/* Frame image */}
        <div className="relative bg-zinc-950 min-h-[140px] md:min-h-0">
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-cover"
            sizes="200px"
          />
        </div>
        {/* Metrics */}
        <div className="p-4 space-y-2">
          {available.map((key) => (
            <MiniMetricRow
              key={key}
              metricKey={key}
              metric={notes.metrics[key]}
              onClick={() => onMetricClick(key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PhaseInsightPanelsProps {
  notes: NotesJson;
  basePath: string;
  onMetricClick: (key: string) => void;
}

export function PhaseInsightPanels({ notes, basePath, onMetricClick }: PhaseInsightPanelsProps) {
  const official = new Set(notes.official_metrics);

  const footStrikeMetrics = notes.official_metrics.filter(
    (k) => official.has(k) && FOOT_STRIKE_METRIC_AFFINITY.has(k)
  );
  const releaseMetrics = notes.official_metrics.filter(
    (k) => official.has(k) && RELEASE_METRIC_AFFINITY.has(k)
  );

  if (footStrikeMetrics.length === 0 && releaseMetrics.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Phase Insights</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {footStrikeMetrics.length > 0 && (
          <InsightPanel
            title="Foot Strike"
            phase="foot_strike"
            imageSrc={`${basePath}/foot_strike.png`}
            metricKeys={footStrikeMetrics}
            notes={notes}
            onMetricClick={onMetricClick}
          />
        )}
        {releaseMetrics.length > 0 && (
          <InsightPanel
            title="Release"
            phase="ball_release"
            imageSrc={`${basePath}/release.png`}
            metricKeys={releaseMetrics}
            notes={notes}
            onMetricClick={onMetricClick}
          />
        )}
      </div>
    </div>
  );
}
