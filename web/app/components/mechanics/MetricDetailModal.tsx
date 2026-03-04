"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { metricLabel, scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import type { MetricResult } from "@/lib/mechanics/types";

interface MetricDetailModalProps {
  metricKey: string;
  metric: MetricResult;
  onClose: () => void;
}

function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800/60 py-2">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-sm font-mono font-semibold" style={{ color: color ?? "#e4e4e7" }}>
        {value}
      </span>
    </div>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.min(Math.max(confidence, 0), 1) * 100;
  const color =
    confidence >= 0.7
      ? "#22c55e"
      : confidence >= 0.5
        ? "#a3e635"
        : confidence >= 0.3
          ? "#f59e0b"
          : "#ef4444";
  return (
    <div className="w-20 h-1.5 rounded-full bg-zinc-800 overflow-hidden ml-2 shrink-0">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="metric-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full max-w-sm rounded-[1.5rem] border border-zinc-700/60 bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.98))] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-zinc-800 px-5 py-4">
          <div>
            <h3 id="metric-modal-title" className="text-sm font-semibold text-zinc-100">{metricLabel(metricKey)}</h3>
            <p className="text-[9px] text-zinc-600 mt-0.5 font-mono">{metricKey}</p>
          </div>
          <div className="flex items-center gap-3 ml-4 shrink-0">
            <span
              className="text-2xl font-black font-mono tabular-nums"
              style={{ color: effColor }}
            >
              {eff != null ? eff.toFixed(1) : "—"}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-zinc-600 transition-smooth hover:text-zinc-300"
              aria-label="Close metric details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-0 px-5 py-4">
          {metric.status !== "ok" && (
            <p className="text-xs text-amber-400 mb-3">
              Status: <span className="font-mono">{metric.status}</span>
            </p>
          )}

          <DataRow
            label="Efficiency Score"
            value={eff != null ? eff.toFixed(2) + " / 10" : "—"}
            color={effColor}
          />
          <DataRow
            label="Raw Score"
            value={raw != null ? raw.toFixed(2) + " / 10" : "—"}
          />
          {metric.raw_value != null && (
            <DataRow
              label="Measured Value"
              value={`${metric.raw_value.toFixed(3)} ${metric.unit}`}
            />
          )}

          <div className="flex items-center py-2 border-b border-zinc-800/60">
            <span className="text-xs text-zinc-500">Confidence</span>
            <div className="flex-1 flex items-center justify-end gap-1">
              <span
                className={`text-xs font-mono ${metric.low_confidence ? "text-amber-400" : "text-zinc-300"}`}
              >
                {metric.confidence != null
                  ? `${(metric.confidence * 100).toFixed(0)}%  (${confidenceLabel(metric.confidence)})`
                  : "—"}
              </span>
              {metric.confidence != null && <ConfidenceBar confidence={metric.confidence} />}
            </div>
          </div>

          <DataRow
            label="Pass / Fail"
            value={
              metric.pass_fail === null ? "—" : metric.pass_fail ? "✓  Pass" : "✗  Fail"
            }
            color={
              metric.pass_fail === null ? "#71717a" : metric.pass_fail ? "#22c55e" : "#ef4444"
            }
          />

          {metric.reasons && metric.reasons.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {metric.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-amber-900/50 bg-zinc-800 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-amber-400"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          )}

          {metric.low_confidence && (
            <div className="mt-3 rounded-2xl border border-amber-800/30 bg-amber-950/40 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-500">
                Low Confidence
              </p>
              <p className="text-xs text-amber-200/70 leading-relaxed">
                Pose estimation quality may affect this score. Cross-reference with film.
              </p>
            </div>
          )}

          <p className="text-[9px] text-zinc-600 mt-4 pt-3 border-t border-zinc-800/60">
            Click outside or press Escape to close
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
