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
      eyebrow="Data Dictionary"
      title="Command Leaderboard Guide"
      description="This guide defines the accuracy and consistency metrics used in our charting system. It explains how we measure command instead of simply counting strikes."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Dictionary", href: "/dictionary" },
        { label: "Command" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="orange"
        icon={Target}
        title="Core Command Metrics"
        description="Unlike raw strike percentage, our system measures the exact Euclidean distance between the catcher’s target and the actual pitch location."
      >
        <div className="space-y-6">
          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">On-Target %</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              The percentage of pitches thrown that landed within an{" "}
              <strong className="text-zinc-200">8-inch radius</strong> of the
              catcher&apos;s requested target.
            </p>
            <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/75 p-4 text-sm text-zinc-500">
              <strong className="mb-1 block text-zinc-300">Why 8 inches?</strong>
              A standard baseball is roughly 3 inches wide. An 8-inch halo
              allows for margin of error while still ensuring the pitch stayed
              highly competitive near the requested spot.
            </div>
          </DictionaryCard>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">
                Average Miss (Total)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in inches. The average absolute distance from the
                intended target to the pitch&apos;s actual location across the
                full sample. Lower is better. 10.0&quot; is roughly elite D3
                average.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">
                Consistency (Std Dev)
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Measured in inches. Tracks the{" "}
                <strong className="text-zinc-300">standard deviation</strong> of
                the pitcher&apos;s total miss. A lower number means misses are
                tightly clustered. A higher number means they scatter.
              </p>
            </DictionaryCard>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <DictionaryCard>
              <div className="mb-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 text-zinc-400" />
                <h3 className="text-lg font-bold text-zinc-200">
                  Horizontal Miss (Avg H)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                The average absolute distance missed strictly on the horizontal
                plane. Useful for spotting early release or missing arm-side.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <div className="mb-2 flex items-center gap-2">
                <Navigation className="h-4 w-4 rotate-90 text-zinc-400" />
                <h3 className="text-lg font-bold text-zinc-200">
                  Vertical Miss (Avg V)
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">
                The average absolute distance missed strictly on the vertical
                plane.
              </p>
            </DictionaryCard>
          </div>

          <DictionaryCard className="border-rose-900/30 bg-rose-950/15">
            <h3 className="text-lg font-bold text-rose-200">Outlier %</h3>
            <p className="mt-2 text-sm leading-relaxed text-rose-200/70">
              The percentage of pitches that missed the intended target by more
              than <strong className="text-rose-100">20 inches</strong>. These
              are strictly non-competitive misses. Lower is better.
            </p>
          </DictionaryCard>

          <DictionaryCard className="border-orange-500/20 bg-orange-950/15">
            <h3 className="text-lg font-bold text-orange-300">Command+</h3>
            <div className="mt-3 space-y-4">
              <p className="text-sm leading-relaxed text-orange-200/70">
                Command+ is a live, pitch-weighted metric that compares a
                pitcher&apos;s command relative to the team&apos;s current-season
                average for that same pitch type. A score of 100 means exactly
                average command across the arsenal. Higher is better.
              </p>
              <div className="rounded-2xl border border-orange-900/50 bg-orange-950/35 p-4">
                <h4 className="mb-2 text-sm font-semibold text-orange-300">
                  The Math Behind the Metric
                </h4>
                <ul className="list-disc space-y-2 pl-5 text-sm text-orange-200/65">
                  <li>
                    <strong>Pitch-Specific Baseline:</strong> We calculate the
                    team&apos;s live season average absolute miss for every valid
                    pitch type.
                  </li>
                  <li>
                    <strong>Relative Ratio:</strong> Team Baseline divided by the
                    pitcher&apos;s average miss for that pitch, multiplied by 100.
                  </li>
                  <li>
                    <strong>Usage Weighting:</strong> Global Command+ weights each
                    pitch score by how often that pitch is thrown.
                  </li>
                  <li>
                    <strong>Eligibility:</strong> Blank, unknown, and{" "}
                    <code className="rounded bg-orange-950 px-1 py-0.5 text-orange-300">
                      OTHER
                    </code>{" "}
                    rows are excluded from the official baseline and score.
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
