"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import type { NotesJson } from "@/lib/mechanics/types";
import { MechanicsHero } from "@/app/components/mechanics/MechanicsHero";
import { MechanicsTopInsights } from "@/app/components/mechanics/MechanicsTopInsights";
import { MechanicsFilmRoom } from "@/app/components/mechanics/MechanicsFilmRoom";
import { PhaseInsightPanels } from "@/app/components/mechanics/PhaseInsightPanels";
import { MetricQuickScanGrid } from "@/app/components/mechanics/MetricQuickScanGrid";
import { MetricDetailModal } from "@/app/components/mechanics/MetricDetailModal";
import { MechanicsConfidencePanel } from "@/app/components/mechanics/MechanicsConfidencePanel";
import { getCanonicalName } from "@/lib/canonicalPlayers";

interface MechanicsSessionViewProps {
  playerSlug: string;
  sessionSlug: string;
}

function formatSessionLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Divider() {
  return (
    <div className="max-w-5xl mx-auto px-6">
      <div className="border-t border-zinc-800/50" />
    </div>
  );
}

export default function MechanicsSessionView({
  playerSlug,
  sessionSlug,
}: MechanicsSessionViewProps) {
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const profileSlug = searchParams.get("slug");
  const backHref = fromProfile && profileSlug ? `/players/${profileSlug}?tab=mechanics` : "/mechanics";

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
        if (!r.ok) throw new Error(`Session not found (${r.status})`);
        return r.json() as Promise<NotesJson>;
      })
      .then((data) => {
        setNotes(data);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message ?? "Failed to load session");
        setLoading(false);
      });
  }, [basePath]);

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
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    );
  }

  const playerName = getCanonicalName(playerSlug);
  const sessionLabel = formatSessionLabel(sessionSlug);
  const modalMetric = selectedMetric ? notes.metrics[selectedMetric] : null;

  const sectionLinks = [
    { id: "top-issues", label: "Top Issues" },
    { id: "film-room", label: "Film Room" },
    { id: "phase-breakdown", label: "Phase Breakdown" },
    { id: "all-metrics", label: "All Metrics" },
    { id: "context", label: "Context" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Sticky hero + breadcrumb */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/40">
        {/* Breadcrumb */}
        <div className="px-6 py-2.5">
          <div className="max-w-5xl mx-auto flex items-center gap-2 text-xs">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 transition-colors w-fit"
              aria-label={fromProfile ? "Back to profile" : "Back to Mechanics Hub"}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {fromProfile ? "Profile" : "Mechanics Hub"}
            </Link>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 truncate">{playerName}</span>
          </div>
        </div>
        {/* Hero */}
        <MechanicsHero notes={notes} playerName={playerName} sessionLabel={sessionLabel} />
        {/* Section anchors */}
        <div className="px-6 py-2 border-t border-zinc-800/40 overflow-x-auto">
          <div className="max-w-5xl mx-auto flex flex-wrap gap-2">
            {sectionLinks.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="text-[10px] text-zinc-500 hover:text-violet-400 transition-colors whitespace-nowrap px-2 py-1 rounded hover:bg-zinc-800/50"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Top Issues */}
      <section id="top-issues" className="scroll-mt-4">
        <MechanicsTopInsights notes={notes} onMetricClick={setSelectedMetric} />
      </section>

      <Divider />

      {/* Film Room */}
      <section id="film-room" className="scroll-mt-4">
        <MechanicsFilmRoom notes={notes} basePath={basePath} />
      </section>

      <Divider />

      {/* Phase Breakdown */}
      <section id="phase-breakdown" className="scroll-mt-4">
        <PhaseInsightPanels notes={notes} basePath={basePath} onMetricClick={setSelectedMetric} />
      </section>

      <Divider />

      {/* All Metrics deep dive */}
      <section id="all-metrics" className="scroll-mt-4">
        <MetricQuickScanGrid
          notes={notes}
          onMetricClick={setSelectedMetric}
          heading="All Metrics"
        />
      </section>

      <Divider />

      {/* Mechanics Context (confidence) */}
      <section id="context" className="scroll-mt-4">
        <MechanicsConfidencePanel notes={notes} />
      </section>

      {/* Metric Detail Modal */}
      <AnimatePresence>
        {selectedMetric && modalMetric && (
          <MetricDetailModal
            key={selectedMetric}
            metricKey={selectedMetric}
            metric={modalMetric}
            onClose={() => setSelectedMetric(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
