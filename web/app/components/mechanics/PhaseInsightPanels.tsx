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
      className="w-full text-left px-3 py-3 rounded-lg bg-zinc-800/30 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-800/50 transition-smooth"
    >
      {/* Top row: dot + name + score */}
      <div className="flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: isInsufficient ? "#52525b" : metric.pass_fail ? "#22c55e" : "#ef4444",
          }}
        />
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 flex-1 leading-tight">
          {metricLabel(metricKey)}
        </span>
        <span
          className="text-base font-black font-mono tabular-nums leading-none shrink-0"
          style={{ color: isInsufficient ? "#52525b" : color }}
        >
          {isInsufficient ? "—" : (eff != null ? eff.toFixed(1) : "—")}
        </span>
      </div>

      {/* Bottom row: confidence + reason tags */}
      <div className="flex items-center gap-1.5 mt-1.5 pl-[18px] flex-wrap">
        <span
          className={`text-[9px] font-mono ${metric.low_confidence ? "text-amber-500" : "text-zinc-600"}`}
        >
          {confPct} {confidenceLabel(metric.confidence) !== "—" ? `· ${confidenceLabel(metric.confidence)}` : ""}
        </span>
        {metric.reasons?.map((r) => (
          <span
            key={r}
            className="text-[8px] uppercase tracking-wider bg-zinc-900 text-amber-500/60 border border-zinc-700/60 rounded px-1 py-px"
          >
            {r.replace(/_/g, " ")}
          </span>
        ))}
      </div>
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
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">{title}</p>
      </div>

      {/* Image + rail */}
      <div className="flex flex-col lg:flex-row">
        {/* Image — dominant column */}
        <div className="relative flex-1 min-w-0 bg-zinc-950 min-h-[240px] lg:min-h-[380px]">
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 600px"
          />
        </div>

        {/* Metric rail — fixed narrow width */}
        <div className="w-full lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 p-3 space-y-1.5 flex flex-col justify-center">
          {/* Column header */}
          <div className="flex items-center gap-2.5 px-3 pb-1 mb-0.5">
            <span className="w-2 shrink-0" />
            <span className="text-[8px] uppercase tracking-wider text-zinc-700 flex-1">Metric</span>
            <span className="text-[8px] uppercase tracking-wider text-zinc-700">Score</span>
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
      <h2 className="text-[10px] uppercase tracking-wider text-zinc-500 mb-4">Phase Breakdown</h2>
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
