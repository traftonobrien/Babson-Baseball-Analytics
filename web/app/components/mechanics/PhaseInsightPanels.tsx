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
      className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/72 px-3 py-3 text-left transition-smooth hover:border-violet-500/18 hover:bg-zinc-900/65"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: isInsufficient ? "#52525b" : metric.pass_fail ? "#22c55e" : "#ef4444",
          }}
        />
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.16em] leading-tight text-zinc-400">
          {metricLabel(metricKey)}
        </span>
        <span
          className="text-base font-black font-mono tabular-nums leading-none shrink-0"
          style={{ color: isInsufficient ? "#52525b" : color }}
        >
          {isInsufficient ? "—" : (eff != null ? eff.toFixed(1) : "—")}
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-1.5 pl-[18px] flex-wrap">
        <span
          className={`text-[9px] font-mono ${metric.low_confidence ? "text-amber-500" : "text-zinc-600"}`}
        >
          {confPct} {confidenceLabel(metric.confidence) !== "—" ? `· ${confidenceLabel(metric.confidence)}` : ""}
        </span>
        {metric.reasons?.map((r) => (
          <span
            key={r}
            className="rounded-full border border-zinc-700/60 bg-zinc-900 px-1.5 py-px text-[8px] uppercase tracking-[0.16em] text-amber-500/60"
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
    <div className="overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.64),rgba(9,9,11,0.88))] shadow-[0_20px_56px_rgba(0,0,0,0.22)]">
      <div className="border-b border-zinc-800/80 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-400">{title}</p>
      </div>

      <div className="flex flex-col lg:flex-row">
        <div className="relative flex-1 min-w-0 bg-zinc-950 min-h-[240px] lg:min-h-[380px]">
          <Image
            src={imageSrc}
            alt={title}
            fill
            className="object-contain"
            sizes="(max-width: 1024px) 100vw, 600px"
          />
        </div>

        <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 p-3 space-y-1.5 flex flex-col justify-center">
          <div className="flex items-center gap-2.5 px-3 pb-1 mb-0.5">
            <span className="w-2 shrink-0" />
            <span className="flex-1 text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-700">Metric</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.18em] text-zinc-700">Score</span>
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
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Phase Breakdown</h2>
        <p className="mt-1 text-xs text-zinc-600">Tie the key metrics to the two most important frame checkpoints.</p>
      </div>
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
