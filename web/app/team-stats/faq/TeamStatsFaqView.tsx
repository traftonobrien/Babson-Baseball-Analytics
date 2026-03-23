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
      title="Statistics Guide"
      description="This guide explains the season stats, rate stats, and value metrics used on the statistics leaderboard."
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
        description="These metrics try to isolate the pitcher&apos;s direct impact from defense, environment, and noise."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-sky-400">
              FIP (Fielding Independent Pitching)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Estimates run prevention with average defense behind the pitcher.
              It focuses on the outcomes the pitcher controls most directly:
              strikeouts, walks, hit batters, and home runs.
            </p>
          </DictionaryCard>

          <DictionaryCard className="border-emerald-200 bg-emerald-50">
            <h3 className="text-lg font-bold text-emerald-900">
              WAR (Wins Above Replacement)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              A cumulative value metric estimating how many wins a pitcher adds
              compared to a replacement-level Division III arm.
            </p>
          </DictionaryCard>

          <DictionaryCard className="md:col-span-2">
            <h3 className="text-lg font-bold text-slate-900">
              ERA+ (Adjusted ERA)
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Takes ERA and normalizes it across the division so{" "}
              <strong className="text-slate-800">100 is perfectly average</strong>.
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
        description="Rate stats usually tell the cleaner story per batter than raw counting totals."
      >
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">K% and BB%</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                The share of batters faced that ended in a strikeout or a walk.
                These are often cleaner than K/9 or BB/9 because inning length
                does not distort them.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">K-BB%</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Strikeout percentage minus walk percentage. This is one of the
                best quick indicators of underlying pitcher quality.
              </p>
            </DictionaryCard>
          </div>

          <DictionaryCard className="sm:px-8">
            <h3 className="text-lg font-bold text-slate-900">
              Per 9 Innings (K/9, BB/9, H/9)
            </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Standardizes how many strikeouts, walks, or hits a pitcher would
                allow over nine innings.
              </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="sky"
        title="Traditional Statistics"
        description="The core season stats used across the leaderboard and player stat pages."
      >
        <DictionaryTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="w-24 px-6 py-4">Stat</th>
                <th className="px-6 py-4">Definition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-600">
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">IP</td>
                <td className="px-6 py-4">
                  Innings pitched, tracked in thirds of an inning.
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">ERA</td>
                <td className="px-6 py-4">
                  Earned runs allowed per 9 innings.
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">WHIP</td>
                <td className="px-6 py-4">
                  Walks plus hits allowed per inning pitched.
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">W / L</td>
                <td className="px-6 py-4">
                  Wins and losses credited to the pitcher of record.
                </td>
              </tr>
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">SV</td>
                <td className="px-6 py-4">Saves credited in qualifying close games.</td>
              </tr>
              <tr className="hover:bg-slate-50 transition-smooth">
                <td className="px-6 py-4 font-mono font-medium text-slate-900">GS</td>
                <td className="px-6 py-4">Games started.</td>
              </tr>
            </tbody>
          </table>
        </DictionaryTableShell>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
