"use client";

import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import type {
  ChartingPlayerComparisonDirectoryEntry,
  ChartingPlayerComparisonSummary,
} from "@/lib/charting/playerComparison";
import type {
  PitcherComparisonDirectoryEntry,
  PitcherComparisonSummary,
} from "@/lib/charting/pitcherComparison";

import type { ComparisonView } from "../explorerState";
import {
  formatCount,
  formatPct,
  formatRate,
  isPitcherView,
} from "../_lib/helpers";
import type {
  ExplorerEntry,
  ExplorerSummary,
} from "../_lib/types";

export function SummaryTable({
  view,
  entry,
  seasonLabel,
  summary,
}: {
  view: ComparisonView;
  entry: ExplorerEntry;
  seasonLabel: string;
  summary: ExplorerSummary;
}) {
  if (isPitcherView(view)) {
    const pitcherEntry = entry as PitcherComparisonDirectoryEntry;
    const pitcherSummary = summary as PitcherComparisonSummary;

    return (
      <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
        <div className="border-b border-slate-200 dark:border-zinc-700 px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
                Summary Table
              </div>
              <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                Filtered season-line summary for the selected pitcher.
              </div>
            </div>
            <LeaderboardPill tone="neutral" variant="light">{seasonLabel}</LeaderboardPill>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1040px] w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-700 bg-background">
                {[
                  "Player",
                  "Throw",
                  "Season",
                  "Pitches",
                  "TBF",
                  "Strike%",
                  "Zone%",
                  "Whiff%",
                  "Chase%",
                  "BAA",
                  "K%",
                  "BB%",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pitcherSummary.totalPitches === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-sm text-slate-400 dark:text-zinc-500">
                    No pitches match the current player and filter scope.
                  </td>
                </tr>
              ) : (
                <tr className="border-b border-slate-200 dark:border-zinc-700 transition-smooth hover:bg-emerald-50/60">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                        {pitcherEntry.displayName
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part.charAt(0))
                          .join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 dark:text-zinc-50">{pitcherEntry.displayName}</div>
                        <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                          {pitcherEntry.throws ? `${pitcherEntry.throws}HP` : "Hand unknown"}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">
                    {pitcherEntry.throws ? `${pitcherEntry.throws}HP` : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">{seasonLabel}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">
                    {formatCount(pitcherSummary.totalPitches)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{pitcherSummary.plateAppearances}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.strikePct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.zonePct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.whiffPct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.chasePct, 1)}</td>
                  <td className="px-4 py-4 text-sm font-semibold text-emerald-600">
                    {formatRate(pitcherSummary.baa)}
                  </td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.kPct, 1)}</td>
                  <td className="px-4 py-4 text-sm text-[#334155]">{formatPct(pitcherSummary.bbPct, 1)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  const hitterEntry = entry as ChartingPlayerComparisonDirectoryEntry;
  const hitterSummary = summary as ChartingPlayerComparisonSummary;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200 dark:border-zinc-700 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-zinc-500">
              Summary Table
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
              Filtered season-line summary for the selected hitter.
            </div>
          </div>
          <LeaderboardPill tone="neutral" variant="light">{seasonLabel}</LeaderboardPill>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1020px] w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-zinc-700 bg-background">
              {[
                "Player",
                "Season",
                "Pitches",
                "PA",
                "AB",
                "H",
                "1B",
                "2B",
                "3B",
                "HR",
                "BA",
                "SO",
                "K%",
                "wOBA",
              ].map((label) => (
                <th
                  key={label}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-zinc-500"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hitterSummary.totalPitches === 0 ? (
              <tr>
                <td colSpan={14} className="px-6 py-10 text-center text-sm text-slate-400 dark:text-zinc-500">
                  No pitches match the current player and filter scope.
                </td>
              </tr>
            ) : (
              <tr className="border-b border-slate-200 dark:border-zinc-700 transition-smooth hover:bg-emerald-50/60">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-sm font-black text-emerald-700">
                      {entry.displayName
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part.charAt(0))
                        .join("")}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-zinc-50">{hitterEntry.displayName}</div>
                      <div className="mt-1 text-[11px] text-slate-400 dark:text-zinc-500">
                        {hitterEntry.batterHand ? `${hitterEntry.batterHand}HH` : "Hand unknown"}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-slate-900 dark:text-zinc-50">{seasonLabel}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">
                  {formatCount(hitterSummary.totalPitches)}
                </td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.plateAppearances}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.atBats}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.hits}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.singles}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.doubles}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.triples}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.homeRuns}</td>
                <td className="px-4 py-4 text-sm font-semibold text-emerald-600">
                  {formatRate(hitterSummary.battingAverage)}
                </td>
                <td className="px-4 py-4 text-sm text-[#334155]">{hitterSummary.strikeouts}</td>
                <td className="px-4 py-4 text-sm text-[#334155]">
                  {formatPct(hitterSummary.strikeoutRate, 1)}
                </td>
                <td className="px-4 py-4 text-sm font-semibold text-sky-600">
                  {formatRate(hitterSummary.woba)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
