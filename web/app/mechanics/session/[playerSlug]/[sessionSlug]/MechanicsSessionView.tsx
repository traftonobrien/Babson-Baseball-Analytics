"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { NotesJson } from "@/lib/mechanics/types";
import { MechanicsHeader } from "@/app/components/mechanics/MechanicsHeader";
import { MetricQuickScanGrid } from "@/app/components/mechanics/MetricQuickScanGrid";
import { MechanicsFilmRoom } from "@/app/components/mechanics/MechanicsFilmRoom";
import { PhaseInsightPanels } from "@/app/components/mechanics/PhaseInsightPanels";
import { MetricDetailModal } from "@/app/components/mechanics/MetricDetailModal";
import { MechanicsLimitations } from "@/app/components/mechanics/MechanicsLimitations";

interface MechanicsSessionViewProps {
  playerSlug: string;
  sessionSlug: string;
}

function formatPlayerName(slug: string): string {
  return slug
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatSessionLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MechanicsSessionView({ playerSlug, sessionSlug }: MechanicsSessionViewProps) {
  const [notes, setNotes] = useState<NotesJson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);

  const basePath = `/mechanics/${playerSlug}/${sessionSlug}`;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${basePath}/notes.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Not found (${r.status})`);
        return r.json() as Promise<NotesJson>;
      })
      .then((data) => {
        setNotes(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? "Failed to load session");
        setLoading(false);
      });
  }, [basePath]);

  const playerName = formatPlayerName(playerSlug);
  const sessionLabel = formatSessionLabel(sessionSlug);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading mechanics data…</p>
      </div>
    );
  }

  if (error || !notes) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4">
        <p className="text-zinc-400 text-sm">{error ?? "No data found."}</p>
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">← Home</Link>
      </div>
    );
  }

  const modalMetric = selectedMetric ? notes.metrics[selectedMetric] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-16">
      {/* Back nav */}
      <div className="bg-zinc-950 border-b border-zinc-800/50 px-6 py-2.5">
        <div className="max-w-5xl mx-auto">
          <Link href="/" className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors w-fit">
            <ArrowLeft className="w-3.5 h-3.5" />
            Home
          </Link>
        </div>
      </div>

      {/* Header */}
      <MechanicsHeader
        notes={notes}
        playerName={playerName}
        sessionLabel={sessionLabel}
      />

      {/* Quick Scan */}
      <MetricQuickScanGrid notes={notes} onMetricClick={setSelectedMetric} />

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t border-zinc-800/60" />
      </div>

      {/* Film Room */}
      <MechanicsFilmRoom notes={notes} basePath={basePath} />

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t border-zinc-800/60" />
      </div>

      {/* Phase Insight Panels */}
      <PhaseInsightPanels
        notes={notes}
        basePath={basePath}
        onMetricClick={setSelectedMetric}
      />

      {/* Limitations */}
      <div className="max-w-5xl mx-auto px-6">
        <div className="border-t border-zinc-800/60" />
      </div>
      <MechanicsLimitations notes={notes} />

      {/* Metric Detail Modal */}
      {selectedMetric && modalMetric && (
        <MetricDetailModal
          metricKey={selectedMetric}
          metric={modalMetric}
          onClose={() => setSelectedMetric(null)}
        />
      )}
    </div>
  );
}
