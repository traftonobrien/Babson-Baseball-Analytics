"use client";

import { BarChart3, Calculator } from "lucide-react";
import {
  DictionaryCard,
  DictionaryPageShell,
  DictionarySection,
  DictionaryTableShell,
} from "@/app/components/dictionary/DictionaryChrome";

export default function TeamStatsFaqView() {
  return (
    <DictionaryPageShell
      tone="sky"
      icon={BarChart3}
      title="Statistics Leaderboard Guide"
      description="This guide defines the traditional box-score statistics, advanced sabermetric identifiers, and value metrics used to evaluate pitcher performance in real game action."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Statistics" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="sky"
        icon={Calculator}
        title="Advanced and Value Metrics"
        description="These metrics try to isolate the pitcher’s direct contribution from defense, environment, and pure variance."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">
              FIP (Fielding Independent Pitching)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Estimates run prevention assuming average defense. FIP focuses on
              the true outcomes the pitcher controls: strikeouts, walks,
              hit-by-pitches, and home runs.
            </p>
          </DictionaryCard>

          <DictionaryCard className="border-emerald-900/30 bg-emerald-950/15">
            <h3 className="text-lg font-bold text-emerald-400">
              WAR (Wins Above Replacement)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-emerald-100/70">
              A cumulative value metric estimating how many total wins a pitcher
              adds compared to a replacement-level D3 arm.
            </p>
          </DictionaryCard>

          <DictionaryCard className="md:col-span-2">
            <h3 className="text-lg font-bold text-amber-400">
              ERA+ (Adjusted ERA)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Takes ERA and normalizes it across the full division so{" "}
              <strong className="text-zinc-300">100 is perfectly average</strong>.
              A 150 ERA+ means the pitcher is 50% better than average. An 80
              ERA+ means the pitcher is 20% worse.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="sky"
        icon={BarChart3}
        title="Rate and Percentage Stats"
        description="Percentages usually tell the cleaner story per batter than raw counting stats."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">K% and BB%</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                The share of total batters faced that ended in a strikeout or a
                walk. These are not distorted by inning length the way K/9 can
                be.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-zinc-200">K-BB%</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Strikeout percentage minus walk percentage. This is one of the
                most predictive forward-looking indicators for pitcher success.
              </p>
            </DictionaryCard>
          </div>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-zinc-200">
              Per 9 Innings (K/9, BB/9, H/9)
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Standardizes how many strikeouts, walks, or hits a pitcher allows
              over a nine-inning game.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="sky"
        title="Traditional Statistics"
        description="The core season stats used across the team leaderboard and player stat pages."
      >
        <DictionaryTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-800/60 bg-zinc-900/85 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              <tr>
                <th className="w-24 px-6 py-4">Stat</th>
                <th className="px-6 py-4">Definition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40 text-zinc-400">
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">IP</td>
                <td className="px-6 py-4">
                  Innings pitched, tracked in thirds of an inning.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">ERA</td>
                <td className="px-6 py-4">
                  Earned Run Average, or earned runs allowed per 9 innings.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">WHIP</td>
                <td className="px-6 py-4">
                  Walks plus hits allowed per inning pitched.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">W / L</td>
                <td className="px-6 py-4">
                  Wins and losses assigned to the pitcher of record.
                </td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">SV</td>
                <td className="px-6 py-4">Saves credited in qualifying close games.</td>
              </tr>
              <tr className="hover:bg-zinc-800/20 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-zinc-200">GS</td>
                <td className="px-6 py-4">Games started.</td>
              </tr>
            </tbody>
          </table>
        </DictionaryTableShell>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
