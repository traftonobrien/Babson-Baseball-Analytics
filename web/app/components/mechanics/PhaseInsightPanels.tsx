"use client";

import Image from "next/image";
import {
  metricLabel,
  scoreColor,
  confidenceLabel,
  FOOT_STRIKE_METRIC_AFFINITY,
  RELEASE_METRIC_AFFINITY,
} from "@/lib/mechanics/labels";
import type { MetricResult, NotesJson } from "@/lib/mechanics/types";

interface MetricRowProps {
  metricKey: string;
  metric: MetricResult;
  onClick: () => void;
}

function MetricRow({ metricKey, metric, onClick }: MetricRowProps) {
  const eff = metric.score_eff ?? metric.score;
  const color = scoreColor(eff);
  const isInsufficient = metric.status !== "ok";
  const confPct = metric.confidence != null ? `${(metric.confidence * 100).toFixed(0)}%` : "—";

  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2.5 rounded-lg bg-zinc-800/40 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all"
    >
      <div className="flex items-center gap-3">
        {/* Pass/Fail dot */}
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: isInsufficient
              ? "#52525b"
              : metric.pass_fail
                ? "#22c55e"
                : "#ef4444",
          }}
        />
        {/* Metric name */}
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 flex-1">
          {metricLabel(metricKey)}
        </span>
        {/* Score */}
        <span
          className="font-mono font-bold text-sm tabular-nums"
          style={{ color: isInsufficient ? "#52525b" : color }}
        >
          {isInsufficient ? "—" : (eff != null ? eff.toFixed(1) : "—")}
        </span>
        {/* Confidence % */}
        <span
          className={`text-[9px] font-mono w-8 text-right shrink-0 ${metric.low_confidence ? "text-amber-500" : "text-zinc-600"}`}
        >
          {confPct}
        </span>
      </div>

      {/* Reason flags */}
      {metric.reasons && metric.reasons.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5 pl-5">
          {metric.reasons.map((r) => (
            <span
              key={r}
              className="text-[8px] uppercase tracking-wider bg-zinc-900 text-amber-500/70 border border-zinc-700 rounded px-1 py-0.5"
            >
              {r.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}

interface PhaseBlockProps {
  title: string;
  imageSrc: string;
  metricKeys: string[];
  notes: NotesJson;
  onMetricClick: (key: string) => void;
}

function PhaseBlock({ title, imageSrc, metricKeys, notes, onMetricClick }: PhaseBlockProps) {
  const available = metricKeys.filter((k) => notes.metrics[k]);
  if (available.length === 0) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">{title}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-[180px]">
        {/* Frame image */}
        <div className="relative bg-zinc-950 min-h-[160px] md:min-h-0">
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-cover"
            sizes="240px"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-zinc-900/20" />
        </div>

        {/* Metric rows */}
        <div className="p-4 space-y-2">
          {/* Column headers */}
          <div className="flex items-center gap-3 px-3 mb-1">
            <span className="w-2 shrink-0" />
            <span className="text-[8px] uppercase tracking-wider text-zinc-700 flex-1">
              Metric
            </span>
            <span className="text-[8px] uppercase tracking-wider text-zinc-700 text-right w-8">
              Score
            </span>
            <span className="text-[8px] uppercase tracking-wider text-zinc-700 text-right w-8">
              Conf
            </span>
          </div>
          {available.map((key) => (
            <MetricRow
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
    (k) => official.has(k) && FOOT_STRIKE_METRIC_AFFINITY.has(k),
  );
  const releaseMetrics = notes.official_metrics.filter(
    (k) => official.has(k) && RELEASE_METRIC_AFFINITY.has(k),
  );

  if (footStrikeMetrics.length === 0 && releaseMetrics.length === 0) return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">
        Phase Breakdown
      </h2>
      <div className="space-y-4">
        {footStrikeMetrics.length > 0 && (
          <PhaseBlock
            title="Foot Strike"
            imageSrc={`${basePath}/foot_strike.png`}
            metricKeys={footStrikeMetrics}
            notes={notes}
            onMetricClick={onMetricClick}
          />
        )}
        {releaseMetrics.length > 0 && (
          <PhaseBlock
            title="Release"
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
