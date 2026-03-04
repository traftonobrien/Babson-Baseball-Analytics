"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, BookOpen } from "lucide-react";
import type { NotesJson } from "@/lib/mechanics/types";
import { MechanicsHero } from "@/app/components/mechanics/MechanicsHero";
import { MechanicsTopInsights } from "@/app/components/mechanics/MechanicsTopInsights";
import { MechanicsFilmRoom } from "@/app/components/mechanics/MechanicsFilmRoom";
import { PhaseInsightPanels } from "@/app/components/mechanics/PhaseInsightPanels";
import { MetricQuickScanGrid } from "@/app/components/mechanics/MetricQuickScanGrid";
import { MetricDetailModal } from "@/app/components/mechanics/MetricDetailModal";
import { MechanicsConfidencePanel } from "@/app/components/mechanics/MechanicsConfidencePanel";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import Breadcrumbs from "@/app/components/Breadcrumbs";

interface MechanicsSessionViewProps {
  playerSlug: string;
  sessionSlug: string;
}

function formatSessionLabel(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function Divider() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
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
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)]">
        <p className="text-sm text-zinc-500">Loading mechanics data…</p>
      </div>
    );
  }

  if (error || !notes) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)]">
        <p className="text-sm text-zinc-400">{error ?? "No data found."}</p>
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)] text-zinc-100 pb-20">
      <div className="sticky top-0 z-10 border-b border-zinc-800/40 bg-zinc-950/92 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 pt-3 sm:px-6">
          <div className="hidden sm:block">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Mechanics Hub", href: "/mechanics" },
                { label: playerName },
                { label: sessionLabel },
              ]}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-violet-500/25 hover:text-zinc-100"
                aria-label={fromProfile ? "Back to profile" : "Back to Mechanics Hub"}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {fromProfile ? "Profile" : "Mechanics Hub"}
              </Link>
              <span className="hidden text-zinc-700 sm:inline">/</span>
              <span className="hidden truncate text-xs text-zinc-500 sm:inline">{playerName}</span>
            </div>

            <Link
              href="/mechanics/faq"
              className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-violet-500/25 hover:text-zinc-100"
            >
              <BookOpen className="h-3.5 w-3.5 text-violet-300" />
              Metrics Dictionary
            </Link>
          </div>
        </div>

        <MechanicsHero notes={notes} playerName={playerName} sessionLabel={sessionLabel} />

        <div className="mx-auto max-w-5xl px-4 pb-3 sm:px-6">
          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
            {sectionLinks.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="whitespace-nowrap rounded-full border border-transparent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-smooth hover:border-violet-500/20 hover:bg-violet-500/10 hover:text-violet-200"
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <section id="top-issues" className="scroll-mt-40">
        <MechanicsTopInsights notes={notes} onMetricClick={setSelectedMetric} />
      </section>

      <Divider />

      <section id="film-room" className="scroll-mt-40">
        <MechanicsFilmRoom notes={notes} basePath={basePath} />
      </section>

      <Divider />

      <section id="phase-breakdown" className="scroll-mt-40">
        <PhaseInsightPanels notes={notes} basePath={basePath} onMetricClick={setSelectedMetric} />
      </section>

      <Divider />

      <section id="all-metrics" className="scroll-mt-40">
        <MetricQuickScanGrid
          notes={notes}
          onMetricClick={setSelectedMetric}
          heading="All Metrics"
        />
      </section>

      <Divider />

      <section id="context" className="scroll-mt-40">
        <MechanicsConfidencePanel notes={notes} />
      </section>

      <AnimatePresence>
        {selectedMetric && modalMetric ? (
          <MetricDetailModal
            key={selectedMetric}
            metricKey={selectedMetric}
            metric={modalMetric}
            onClose={() => setSelectedMetric(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
