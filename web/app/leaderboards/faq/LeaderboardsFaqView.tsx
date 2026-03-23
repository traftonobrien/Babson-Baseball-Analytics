"use client";

import { Navigation, Target } from "lucide-react";
import {
  DictionaryCard,
  DictionaryPageShell,
  DictionarySection,
} from "@/app/components/dictionary/DictionaryChrome";

export default function LeaderboardsFaqView() {
  return (
    <DictionaryPageShell
      tone="orange"
      icon={Target}
      title="Command Guide"
      description="This guide explains how the site grades command. The model measures where the pitch finished relative to the target, not just whether it was a strike."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Command" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="orange"
        icon={Target}
        title="Core Command Metrics"
        description="Command is built from the exact miss distance between the catcher’s target and the pitch location."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-slate-900">On-Target %</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  The share of pitches that finished within an{" "}
                  <strong className="text-slate-900">8-inch radius</strong> of the
                  catcher&apos;s target.
            </p>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              <strong className="mb-1 block text-slate-800">Why 8 inches?</strong>
              The 8-inch halo leaves room for normal variation while still
              keeping the pitch close enough to be genuinely competitive.
            </div>
          </DictionaryCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">
                Average Miss (Total)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Measured in inches. This is the average straight-line miss from
                the target across the full sample. Lower is better. Around
                10.0&quot; is strong Division III command.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">
                Consistency (Std Dev)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Measured in inches. This is the{" "}
                <strong className="text-slate-800">standard deviation</strong> of
                total miss. Lower means the misses cluster tightly. Higher means
                they scatter.
              </p>
            </DictionaryCard>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DictionaryCard>
              <div className="mb-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Horizontal Miss (Avg H)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                The average absolute miss on the horizontal plane. This is the
                quickest way to spot arm-side or glove-side drift.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <div className="mb-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 rotate-90 text-slate-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Vertical Miss (Avg V)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                  The average absolute miss on the vertical plane. It shows how
                  often the pitcher misses above or below the target line.
              </p>
            </DictionaryCard>
          </div>

          <DictionaryCard className="border-rose-200 bg-rose-50">
            <h3 className="text-lg font-bold text-rose-200">Outlier %</h3>
            <p className="mt-2 text-sm leading-relaxed text-rose-200/70">
              The share of pitches that missed the target by more than{" "}
              <strong className="text-rose-100">20 inches</strong>. These are
              true non-competitive misses. Lower is better.
            </p>
          </DictionaryCard>

          <DictionaryCard className="border-orange-200 bg-orange-50">
            <h3 className="text-lg font-bold text-orange-900">Command+</h3>
            <div className="mt-3 space-y-4">
              <p className="text-sm leading-relaxed text-slate-700">
                Command+ compares a pitcher&apos;s live miss distance to the
                team&apos;s current baseline for the same pitch type. A score of
                100 is team average. Higher is better.
              </p>
              <div className="rounded-2xl border border-orange-200 bg-surface/80 p-4">
                <h4 className="mb-2 text-sm font-semibold text-orange-900">
                  How Command+ Works
                </h4>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  <li>
                    <strong>Pitch baseline:</strong> Live team miss average for
                    each valid pitch type.
                  </li>
                  <li>
                    <strong>Relative score:</strong> Team baseline divided by
                    the pitcher&apos;s average miss, then multiplied by 100.
                  </li>
                  <li>
                    <strong>Usage weighting:</strong> The overall score weights
                    each pitch by how often it is thrown.
                  </li>
                  <li>
                    <strong>Eligibility:</strong> Blank, unknown, and{" "}
                    <code className="rounded bg-orange-100 px-1 py-0.5 font-mono text-orange-900">
                      OTHER
                    </code>{" "}
                    rows are excluded.
                  </li>
                </ul>
              </div>
            </div>
          </DictionaryCard>
        </div>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
