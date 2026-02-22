"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { metricLabel, scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import type { MetricResult } from "@/lib/mechanics/types";

interface MetricDetailModalProps {
  metricKey: string;
  metric: MetricResult;
  onClose: () => void;
}

function ScoreRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-800">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: color ?? "#e4e4e7" }}>
        {value}
      </span>
    </div>
  );
}

export function MetricDetailModal({ metricKey, metric, onClose }: MetricDetailModalProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const eff = metric.score_eff ?? metric.score;
  const raw = metric.score_raw ?? metric.score;
  const effColor = scoreColor(eff);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div>
            <h3 className="font-semibold text-zinc-100">{metricLabel(metricKey)}</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{metricKey}</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-1">
          {metric.status !== "ok" ? (
            <p className="text-sm text-zinc-500 italic">
              Status: <span className="text-amber-400">{metric.status}</span>
            </p>
          ) : null}

          <ScoreRow
            label="Efficiency Score (score_eff)"
            value={eff != null ? eff.toFixed(2) + " / 10" : "—"}
            color={effColor}
          />
          <ScoreRow
            label="Raw Score (score_raw)"
            value={raw != null ? raw.toFixed(2) + " / 10" : "—"}
          />
          {metric.raw_value != null && (
            <ScoreRow
              label={`Measured Value`}
              value={`${metric.raw_value.toFixed(3)} ${metric.unit}`}
            />
          )}
          <ScoreRow
            label="Confidence"
            value={metric.confidence != null ? `${(metric.confidence * 100).toFixed(0)}%  (${confidenceLabel(metric.confidence)})` : "—"}
            color={metric.low_confidence ? "#f59e0b" : "#e4e4e7"}
          />
          <ScoreRow
            label="Pass / Fail"
            value={metric.pass_fail === null ? "—" : metric.pass_fail ? "✓ Pass" : "✗ Fail"}
            color={metric.pass_fail === null ? "#71717a" : metric.pass_fail ? "#22c55e" : "#ef4444"}
          />

          {/* Callout */}
          {metric.callout && (
            <div className="mt-4 bg-zinc-800/60 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Callout</p>
              <p className="text-sm text-zinc-200 leading-relaxed">{metric.callout}</p>
            </div>
          )}

          {/* Coaching cues */}
          {metric.coaching_cues.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Coaching Cues</p>
              <ul className="space-y-1">
                {metric.coaching_cues.map((cue, i) => (
                  <li key={i} className="text-xs text-zinc-400 flex gap-2">
                    <span className="text-zinc-600 shrink-0">·</span>
                    {cue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Reasons / flags */}
          {metric.reasons && metric.reasons.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {metric.reasons.map((r) => (
                  <span
                    key={r}
                    className="text-[9px] uppercase tracking-wider bg-zinc-800 text-amber-400 border border-amber-900/50 rounded px-2 py-0.5"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Low confidence warning */}
          {metric.low_confidence && (
            <div className="mt-3 bg-amber-950/40 border border-amber-800/30 rounded-lg p-3">
              <p className="text-[10px] uppercase tracking-wider text-amber-500 mb-1">Low Confidence</p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                This metric may be affected by occlusion, pose estimation quality, or limited frame windows. Review the film before acting on this score.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
