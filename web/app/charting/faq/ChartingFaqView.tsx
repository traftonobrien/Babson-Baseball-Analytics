"use client";

import { BarChart3, BookOpen, ClipboardList, Target } from "lucide-react";
import {
  DictionaryCard,
  DictionaryPageShell,
  DictionarySection,
  DictionaryTableShell,
} from "@/app/components/dictionary/DictionaryChrome";

const PITCHER_STATS = [
  {
    stat: "Sessions",
    definition: "Unique charted game sessions that match the selected date range or single-session filter.",
  },
  {
    stat: "Innings",
    definition: "The actual innings touched by the pitcher in the charted plate appearances, not just the number of stints logged.",
  },
  {
    stat: "Pitches",
    definition: "Total charted pitches thrown by that pitcher inside the current leaderboard scope.",
  },
  {
    stat: "TBF",
    definition: "Total batters faced. This replaces WHIP on the charting leaderboard because game innings are often non-standard.",
  },
  {
    stat: "BAA",
    definition: "Batting average against using charted outcomes only. Walks and hit-by-pitch are removed from the denominator.",
  },
  {
    stat: "BABIP",
    definition: "Batting average on balls in play. Home runs and strikeouts are removed; sacrifice flies are not tracked separately in this charting model.",
  },
  {
    stat: "Strike%",
    definition: "Share of all charted pitches that became a strike result, including called strikes, swinging strikes, fouls, bunts put in play, and balls in play.",
  },
  {
    stat: "Zone%",
    definition: "Share of charted pitches with a recorded location that finished in the 3x3 strike-zone grid.",
  },
  {
    stat: "Whiff%",
    definition: "Swinging strikes divided by all swings.",
  },
  {
    stat: "Chase%",
    definition: "Swings on pitches outside the tracked zone divided by all located pitches outside the zone.",
  },
  {
    stat: "FPS%",
    definition: "First-pitch strike rate. Only pitches thrown in a 0-0 count are included.",
  },
  {
    stat: "K% / BB%",
    definition: "Strikeouts or walks divided by completed plate appearances.",
  },
];

const HITTER_STATS = [
  {
    stat: "Sessions",
    definition: "Unique charted game sessions that include that hitter.",
  },
  {
    stat: "PAs",
    definition: "Total charted plate appearances for the hitter in the current scope.",
  },
  {
    stat: "AVG / OBP / SLG / OPS",
    definition: "Traditional slash-line stats built from charted plate-appearance outcomes.",
  },
  {
    stat: "wOBA",
    definition: "Weighted on-base average using these outcome weights: BB 0.69, HBP 0.72, 1B 0.89, 2B 1.27, 3B 1.62, HR 2.10.",
  },
  {
    stat: "Chase%",
    definition: "Swings at located pitches outside the zone divided by all located pitches outside the zone.",
  },
  {
    stat: "Contact%",
    definition: "Any foul or ball in play divided by all swings.",
  },
  {
    stat: "Whiff%",
    definition: "Swinging strikes divided by all swings.",
  },
  {
    stat: "K% / BB%",
    definition: "Strikeouts or walks divided by completed plate appearances.",
  },
  {
    stat: "FB / BRK / OFF Whiff%",
    definition: "Whiff rate against fastballs, breaking balls, or offspeed pitches using the charting pitch groups below.",
  },
  {
    stat: "Z-Swing%",
    definition: "Swings at located pitches in the tracked zone divided by all located pitches in the zone.",
  },
  {
    stat: "Z-Whiff%",
    definition: "Swinging strikes on pitches in the tracked zone divided by all swings at pitches in the zone.",
  },
  {
    stat: "BABIP",
    definition: "Balls-in-play average from charted outcomes, with the same no-sac-fly caveat as the pitcher view.",
  },
  {
    stat: "ISO",
    definition: "Isolated power, calculated as slugging minus batting average.",
  },
];

const HITTER_VISUAL_STATS = [
  {
    stat: "AVG / wOBA / Swing% / Whiff%",
    definition: "These are the four metric-toggle options on the player visuals zone view. AVG and wOBA measure production inside the selected bucket, while Swing% and Whiff% measure decision and miss behavior.",
  },
  {
    stat: "Pitcher Hand",
    definition: "Filters the selected hitter sample to pitches seen against right-handed or left-handed pitchers.",
  },
  {
    stat: "Pitches",
    definition: "Total charted pitches that remain after the current player plus any active pitcher-hand, season, pitch type, count, event/result, and pitch-speed filters.",
  },
  {
    stat: "PA / AB / H",
    definition: "Plate appearances, official at-bats, and hits inside the current filtered player sample.",
  },
  {
    stat: "1B / 2B / 3B / HR",
    definition: "Hit-type breakdown for terminal outcomes inside the current filtered player sample.",
  },
  {
    stat: "BA",
    definition: "Batting average on filtered at-bats in the player visuals summary table.",
  },
  {
    stat: "SO / K%",
    definition: "Strikeout total and strikeout rate based on terminal plate appearances in the filtered player sample.",
  },
  {
    stat: "wOBA",
    definition: "Weighted on-base average for the filtered player sample or selected zone bucket using the same charting weights as the leaderboard.",
  },
  {
    stat: "Pitch Mix Panel",
    definition: "A separate detail panel that shows pitch-type share for the active filtered sample or zone selection. It is not part of the summary table.",
  },
];

const PITCHER_VISUAL_STATS = [
  {
    stat: "Strike% / Whiff% / Chase% / BAA",
    definition: "These are the four metric-toggle options on the pitcher visuals zone view. Strike%, Whiff%, and Chase% measure command and miss behavior, while BAA tracks filtered damage on terminal at-bats.",
  },
  {
    stat: "Pitches / TBF",
    definition: "Pitches is the current filtered pitch sample. TBF is completed batters faced inside that same filtered pitcher scope.",
  },
  {
    stat: "Zone%",
    definition: "Shown in the pitcher summary table only. It measures how many located pitches landed inside the 3x3 zone grid.",
  },
  {
    stat: "K% / BB%",
    definition: "Strikeout and walk rate inside the filtered pitcher sample, using completed plate appearances only.",
  },
  {
    stat: "Called Strikes / Balls / Whiffs / Fouls / Chases / In Play / Hits / Strikeouts / Walk-HBP",
    definition: "These are the pitcher event/result filters. They swap the zone view, pitch mix panel, and one-line summary table to that exact slice of the charted pitch sample.",
  },
  {
    stat: "Pitch Mix Panel",
    definition: "A separate detail panel that shows pitch-type share for the active filtered sample or zone selection. It is not part of the summary table.",
  },
];

export default function ChartingFaqView() {
  return (
    <DictionaryPageShell
      tone="emerald"
      icon={ClipboardList}
      title="Charting Guide"
      description="This guide explains the charted pitcher and hitter metrics used across the charting leaderboard and player visuals."
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: "Metrics Dictionary", href: "/dictionary" },
        { label: "Charting" },
      ]}
      maxWidth="max-w-5xl"
    >
      <DictionarySection
        tone="emerald"
        icon={BookOpen}
        title="What This Guide Covers"
        description="The charting leaderboard and player visuals are built from manually charted game plate appearances, pitch results, and pitch locations."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-emerald-900">Scope</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Every row updates from the current session filter or date range. A
              single-session view shows only one charted outing. Wider scopes
              aggregate every matching game session.
            </p>
          </DictionaryCard>

          <DictionaryCard>
            <h3 className="text-lg font-bold text-slate-900">Location Rules</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Zone and chase metrics only use pitches with a recorded location
              cell. If a pitch was charted without location, it stays in pitch
              totals but drops out of zone-based percentages.
            </p>
          </DictionaryCard>

          <DictionaryCard className="border-emerald-200 bg-emerald-50">
            <h3 className="text-lg font-bold text-emerald-900">Why TBF, Not WHIP</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              Game innings may not always follow standard out counts due to
              pitching changes mid-inning. Total batters faced is the cleaner
              workload number for this environment, so the leaderboard uses TBF
              instead of WHIP.
            </p>
          </DictionaryCard>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="emerald"
        icon={Target}
        title="Pitcher Leaderboard Metrics"
        description="These are the columns used to rank pitchers on the charting leaderboard."
      >
        <DictionaryTableShell>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="w-32 px-6 py-4">Stat</th>
                <th className="px-6 py-4">Definition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-600">
              {PITCHER_STATS.map(({ stat, definition }) => (
                <tr key={stat} className="transition-smooth hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono font-medium text-slate-900">{stat}</td>
                  <td className="px-6 py-4">{definition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DictionaryTableShell>
      </DictionarySection>

      <DictionarySection
        tone="emerald"
        icon={BarChart3}
        title="Hitter Leaderboard Metrics"
        description="The hitter tabs blend outcome stats with swing-decision and contact indicators."
      >
        <div className="space-y-6">
          <DictionaryTableShell>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="w-36 px-6 py-4">Stat</th>
                  <th className="px-6 py-4">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                {HITTER_STATS.map(({ stat, definition }) => (
                  <tr key={stat} className="transition-smooth hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{stat}</td>
                    <td className="px-6 py-4">{definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DictionaryTableShell>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">Fastball Group</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Includes pitches charted as <strong className="text-slate-800">Fastball</strong>.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">Breaking Group</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Includes <strong className="text-slate-800">Curveball</strong> and{" "}
                <strong className="text-slate-800">Slider</strong>.
              </p>
            </DictionaryCard>

            <DictionaryCard>
              <h3 className="text-lg font-bold text-slate-900">Offspeed Group</h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                Includes <strong className="text-slate-800">Changeup</strong>,{" "}
                <strong className="text-slate-800">Split/Cut</strong>, and{" "}
                <strong className="text-slate-800">Other</strong>.
              </p>
            </DictionaryCard>
          </div>
        </div>
      </DictionarySection>

      <DictionarySection
        tone="emerald"
        icon={ClipboardList}
        title="Player Visuals Metrics"
        description="These are the filters and stat outputs used on the charting insights player visuals page, including the shared zone map, pitch mix panel, and one-line summary table."
      >
        <div className="space-y-6">
          <DictionaryCard>
            <h3 className="text-lg font-bold text-slate-900">Shared Layout Rules</h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Both views use the same 9 rough buckets on the zone board: four in-zone quadrants,
              the heart cell, and four chase corners. Pitches charted outside that visible schema
              stay in filtered totals but are called out as omitted from the grid.
            </p>
          </DictionaryCard>

          <DictionaryTableShell>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="w-40 px-6 py-4">Hitter View</th>
                  <th className="px-6 py-4">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                {HITTER_VISUAL_STATS.map(({ stat, definition }) => (
                  <tr key={stat} className="transition-smooth hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{stat}</td>
                    <td className="px-6 py-4">{definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DictionaryTableShell>

          <DictionaryTableShell>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="w-40 px-6 py-4">Pitcher View</th>
                  <th className="px-6 py-4">Definition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-600">
                {PITCHER_VISUAL_STATS.map(({ stat, definition }) => (
                  <tr key={stat} className="transition-smooth hover:bg-slate-50">
                    <td className="px-6 py-4 font-mono font-medium text-slate-900">{stat}</td>
                    <td className="px-6 py-4">{definition}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DictionaryTableShell>
        </div>
      </DictionarySection>
    </DictionaryPageShell>
  );
}
