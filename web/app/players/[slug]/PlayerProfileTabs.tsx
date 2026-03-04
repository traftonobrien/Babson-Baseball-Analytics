"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Target, ArrowRight, ScanLine, ChevronDown, ChevronUp } from "lucide-react";
import SavantPercentileBar from "./SavantPercentileBar";
import MechanicsProfileCard from "@/app/components/mechanics/MechanicsProfileCard";
import {
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardStatBlock,
} from "@/app/components/leaderboards/LeaderboardChrome";
import Segment from "@/app/components/Segment";
import CommandPlusModelCard from "@/app/components/CommandPlusModelCard";
import PitchingPlusModelCard from "@/app/components/PitchingPlusModelCard";
import StuffPlusModelCard from "@/app/components/StuffPlusModelCard";
import { seasonFromDateId } from "@/lib/season";
import { computeTotalStuffPlus, plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type { CommandPlusResult } from "@/lib/commandPlus";
import type { PitchingPlusResult } from "@/lib/pitchingPlus";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";

const TABS = ["Overview", "Trackman", "Command", "Mechanics"] as const;
type Tab = (typeof TABS)[number];
type HeroTone = "amber" | "orange" | "blue";
type HubTone = "blue" | "orange" | "violet";

interface SeasonStat {
  label: string;
  value: string;
}

interface PercentileMetric {
  label: string;
  value: string;
  percentile: number | null;
  note?: string;
}

interface TrackmanSession {
  date: string;
  dateSlug: string;
  sessionLabel: string;
}

interface CommandOuting {
  outingId: string;
  playerId: string;
  dateId: string;
  label: string;
  csvPath: string;
}

interface HeroTileConfig {
  label: string;
  value: string;
  note: string;
  tone: HeroTone;
  badgeStyle?: CSSProperties;
  onClick?: () => void;
  active?: boolean;
  featured?: boolean;
}

interface CommandHeroState {
  playerId: string;
  score: number | null;
  season: number | null;
  outingCount: number;
  pitchCount: number;
}

interface StuffPlusApiPitch {
  pitchType?: string;
  meanStuffPlus: number | null;
  nSessions?: number | null;
}

interface StuffHeroState {
  playerSlug: string;
  lookupPlayerId: string | null;
  total: number | null;
  pitchTypeCount: number;
  sessionCount: number | null;
  pitches: { pitchType: string; meanStuffPlus: number | null }[];
}

interface PitchingHeroState {
  ready: boolean;
  overall: number | null;
  note: string;
  result: PitchingPlusResult | null;
}

interface Props {
  seasonStats: SeasonStat[];
  seasonYear: number;
  seasonNote?: string;
  d3Percentiles: PercentileMetric[];
  trackmanSessions: TrackmanSession[];
  commandOutings: CommandOuting[];
  commandPlayerId?: string | null;
  playerSlug: string;
  initialCommandHero: CommandHeroState | null;
  initialCommandResult: CommandPlusResult | null;
  initialPitchingModel: PitchingHeroState;
  initialStuffLookupPlayerId: string | null;
  initialStuffPitches: StuffPlusApiPitch[];
  initialTab?: string;
  mechanicsEntry?: HubPlayerEntry | null;
}

const HUB_TONE_STYLES: Record<
  HubTone,
  {
    border: string;
    icon: string;
    arrow: string;
  }
> = {
  blue: {
    border: "border-blue-500/25 hover:border-blue-400/40",
    icon: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    arrow: "text-blue-300",
  },
  orange: {
    border: "border-orange-500/25 hover:border-orange-400/40",
    icon: "border-orange-500/20 bg-orange-500/10 text-orange-300",
    arrow: "text-orange-300",
  },
  violet: {
    border: "border-violet-500/25 hover:border-violet-400/40",
    icon: "border-violet-500/20 bg-violet-500/10 text-violet-300",
    arrow: "text-violet-300",
  },
};

function formatDateLabel(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

function resolveInitialTab(raw?: string): Tab {
  if (!raw) return "Overview";
  const lower = raw.toLowerCase();
  if (lower === "trackman") return "Trackman";
  if (lower === "command") return "Command";
  if (lower === "mechanics") return "Mechanics";
  return "Overview";
}

const HERO_TONE_STYLES: Record<
  HeroTone,
  {
    border: string;
    surface: string;
    glow: string;
    rail: string;
    label: string;
    value: string;
    note: string;
  }
> = {
  amber: {
    border: "border-amber-500/20",
    surface: "from-amber-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-amber-500/15",
    rail: "bg-amber-300/80",
    label: "text-amber-200/80",
    value: "text-amber-50",
    note: "text-amber-100/60",
  },
  orange: {
    border: "border-orange-500/20",
    surface: "from-orange-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-orange-500/15",
    rail: "bg-orange-400/80",
    label: "text-orange-200/80",
    value: "text-orange-50",
    note: "text-orange-100/60",
  },
  blue: {
    border: "border-blue-500/20",
    surface: "from-blue-500/10 via-zinc-900/95 to-zinc-950",
    glow: "bg-blue-500/15",
    rail: "bg-blue-400/80",
    label: "text-blue-200/80",
    value: "text-blue-50",
    note: "text-blue-100/60",
  },
};

function ProfileHeroTile({
  index,
  label,
  value,
  note,
  tone,
  badgeStyle,
  onClick,
  active = false,
  featured = false,
}: HeroTileConfig & { index: number }) {
  const toneStyles = HERO_TONE_STYLES[tone];
  const interactive = typeof onClick === "function";

  const valueNode = badgeStyle ? (
    <span
      className={`inline-flex items-center justify-center rounded-2xl font-mono font-black tracking-tight ${
        featured
          ? "min-h-[4.75rem] min-w-[8rem] px-6 py-3 text-[44px]"
          : "min-h-[3rem] min-w-[5.5rem] px-4 py-2 text-[30px]"
      }`}
      style={badgeStyle}
    >
      {value}
    </span>
  ) : (
    <span
      className={`font-mono font-black tracking-tight ${toneStyles.value} ${
        featured ? "text-[44px]" : "text-[30px]"
      }`}
    >
      {value}
    </span>
  );

  const content = featured ? (
    <>
      <div className={`absolute inset-y-4 left-0 w-[4px] rounded-full ${toneStyles.rail}`} />
      <div className={`pointer-events-none absolute -right-2 top-1/2 h-28 w-28 -translate-y-1/2 rounded-full blur-3xl ${toneStyles.glow}`} />

      <div className="relative z-10 flex items-center justify-between gap-6 pl-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <p className={`text-[11px] font-black uppercase tracking-[0.24em] ${toneStyles.label}`}>
              {label}
            </p>
            {interactive && (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
                {active ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </span>
            )}
          </div>
          <p className={`mt-3 max-w-xl text-[12px] sm:text-[13px] ${toneStyles.note}`}>
            {note}
          </p>
        </div>

        <div className="relative shrink-0">{valueNode}</div>
      </div>
    </>
  ) : (
    <>
      <div className={`absolute inset-y-4 left-0 w-[3px] rounded-full ${toneStyles.rail}`} />
      <div className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-3xl ${toneStyles.glow}`} />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <p className={`pl-4 text-[10px] font-black uppercase tracking-[0.18em] ${toneStyles.label}`}>
          {label}
        </p>
        {interactive && (
          <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
            {active ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>

      <div className="relative z-10 mt-4 pl-4">{valueNode}</div>

      <p className={`relative z-10 mt-3 pl-4 text-[11px] ${toneStyles.note}`}>
        {note}
      </p>
    </>
  );

  const sharedClassName =
    `group relative overflow-hidden rounded-2xl border ${toneStyles.border} bg-gradient-to-br ${toneStyles.surface} opacity-0 backdrop-blur-sm ${
      featured ? "p-5 sm:p-6" : "p-4"
    }`;

  return interactive ? (
    <button
      type="button"
      onClick={onClick}
      className={`${sharedClassName} w-full text-left transition-smooth hover:border-white/15`}
      style={{
        animation: `savantFadeIn 0.4s ease-out ${index * 60}ms forwards`,
      }}
      aria-expanded={active}
      aria-label={`${label} breakdown`}
    >
      {content}
    </button>
  ) : (
    <div
      className={`relative overflow-hidden rounded-2xl border ${toneStyles.border} bg-gradient-to-br ${toneStyles.surface} p-4 opacity-0 backdrop-blur-sm`}
      style={{
        animation: `savantFadeIn 0.4s ease-out ${index * 60}ms forwards`,
      }}
    >
      {content}
    </div>
  );
}

function buildStuffHeroState(
  playerSlug: string,
  lookupPlayerId: string | null,
  pitches: StuffPlusApiPitch[],
): StuffHeroState {
  const validPitchCount = pitches.filter((pitch) => pitch.meanStuffPlus != null).length;
  const sessionCount = pitches.reduce((max, pitch) => {
    if (typeof pitch.nSessions !== "number") return max;
    return Math.max(max, pitch.nSessions);
  }, 0);

  return {
    playerSlug,
    lookupPlayerId,
    total: computeTotalStuffPlus(pitches),
    pitchTypeCount: validPitchCount,
    sessionCount: sessionCount > 0 ? sessionCount : null,
    pitches: pitches.map((pitch) => ({
      pitchType: pitch.pitchType ?? "",
      meanStuffPlus: pitch.meanStuffPlus ?? null,
    })),
  };
}

function ProfileHubLink({
  href,
  icon: Icon,
  title,
  note,
  tone,
}: {
  href: string;
  icon: typeof Activity;
  title: string;
  note: string;
  tone: HubTone;
}) {
  const toneStyles = HUB_TONE_STYLES[tone];

  return (
    <Link href={href}>
      <div
        className={`group rounded-[1.7rem] border bg-zinc-950/72 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.24)] transition-smooth hover:-translate-y-0.5 ${toneStyles.border}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneStyles.icon}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold text-zinc-100">{title}</div>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">{note}</p>
            </div>
          </div>
          <ArrowRight
            className={`h-4 w-4 shrink-0 opacity-70 transition-smooth group-hover:opacity-100 ${toneStyles.arrow}`}
          />
        </div>
      </div>
    </Link>
  );
}

export default function PlayerProfileTabs({
  seasonStats,
  seasonYear,
  seasonNote,
  d3Percentiles,
  trackmanSessions,
  commandOutings,
  commandPlayerId,
  playerSlug,
  initialCommandHero,
  initialCommandResult,
  initialPitchingModel,
  initialStuffLookupPlayerId,
  initialStuffPitches,
  initialTab,
  mechanicsEntry,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(resolveInitialTab(initialTab));
  const [commandSeasonFilter, setCommandSeasonFilter] = useState<string>("2026");
  const [expandedMetric, setExpandedMetric] = useState<"pitching" | "command" | "stuff" | null>(null);

  const sortedSessions = useMemo(() => {
    return [...trackmanSessions].sort((a, b) => b.date.localeCompare(a.date));
  }, [trackmanSessions]);

  const commandSeasons = useMemo(() => {
    const s = new Set<number>();
    for (const o of commandOutings) {
      const yr = seasonFromDateId(o.dateId);
      if (yr) s.add(yr);
    }
    return Array.from(s).sort((a, b) => b - a);
  }, [commandOutings]);

  const filteredCommandOutings = useMemo(() => {
    if (commandSeasonFilter === "all" || commandSeasons.length <= 1) return commandOutings;
    const yr = Number(commandSeasonFilter);
    return commandOutings.filter((o) => seasonFromDateId(o.dateId) === yr);
  }, [commandOutings, commandSeasonFilter, commandSeasons]);

  const latestCommandSeason = commandSeasons[0] ?? null;
  const isCommandHeroLoading = false;
  const currentCommandHero = initialCommandHero;
  const isStuffHeroLoading = false;
  const currentStuffHero = useMemo(
    () => buildStuffHeroState(playerSlug, initialStuffLookupPlayerId, initialStuffPitches),
    [initialStuffLookupPlayerId, initialStuffPitches, playerSlug],
  );
  const isPitchingHeroLoading = false;
  const pitchingModel = initialPitchingModel;
  const toggleMetric = (metric: "pitching" | "command" | "stuff") => {
    setExpandedMetric((current) => (current === metric ? null : metric));
  };

  const heroTiles = useMemo(() => {
    const commandValue = isCommandHeroLoading
      ? "..."
      : currentCommandHero?.score != null
        ? currentCommandHero.score.toFixed(0)
        : "--";
    const commandNote = isCommandHeroLoading
      ? latestCommandSeason != null
        ? `Loading ${latestCommandSeason} live baseline`
        : "Loading live baseline"
      : currentCommandHero?.score != null && currentCommandHero.season != null
        ? `${currentCommandHero.outingCount} outing${currentCommandHero.outingCount === 1 ? "" : "s"} | ${currentCommandHero.pitchCount} pitch${currentCommandHero.pitchCount === 1 ? "" : "es"} in ${currentCommandHero.season}`
        : latestCommandSeason != null
          ? `No qualified score yet for ${latestCommandSeason}`
          : "No command outings yet";

    const stuffValue = isStuffHeroLoading
      ? "..."
      : currentStuffHero?.total != null
        ? currentStuffHero.total.toFixed(1)
        : "--";
    const stuffNote = isStuffHeroLoading
      ? "Loading Trackman arsenal"
      : currentStuffHero?.total != null
        ? `${currentStuffHero.pitchTypeCount} pitch type${currentStuffHero.pitchTypeCount === 1 ? "" : "s"} across ${currentStuffHero.sessionCount ?? 0} session${currentStuffHero.sessionCount === 1 ? "" : "s"}`
        : trackmanSessions.length > 0
          ? "Trackman sessions found, no Stuff+ grade yet"
          : "No Trackman arsenal yet";

    const pitchingTile: HeroTileConfig = {
        label: "Pitching+",
        value: isPitchingHeroLoading
          ? "..."
          : pitchingModel.ready && pitchingModel.overall != null
            ? pitchingModel.overall.toFixed(0)
            : "NR",
        note: isPitchingHeroLoading ? "Building live-season blend" : pitchingModel.note,
        tone: "amber",
        onClick: () => toggleMetric("pitching"),
        active: expandedMetric === "pitching",
        badgeStyle:
          pitchingModel.ready && pitchingModel.overall != null
            ? plusMetricBadgeStyle(pitchingModel.overall)
            : undefined,
        featured: true,
      };

    const commandTile: HeroTileConfig = {
        label: "Command+",
        value: commandValue,
        note: commandNote,
        tone: "orange",
        onClick: () => toggleMetric("command"),
        active: expandedMetric === "command",
        badgeStyle: currentCommandHero?.score != null ? plusMetricBadgeStyle(currentCommandHero.score) : undefined,
      };

    const stuffTile: HeroTileConfig = {
        label: "Stuff+",
        value: stuffValue,
        note: stuffNote,
        tone: "blue",
        onClick: () => toggleMetric("stuff"),
        active: expandedMetric === "stuff",
        badgeStyle: currentStuffHero?.total != null ? plusMetricBadgeStyle(currentStuffHero.total) : undefined,
      };

    return {
      pitchingTile,
      secondaryTiles: [commandTile, stuffTile],
    };
  }, [
    currentCommandHero,
    currentStuffHero,
    isCommandHeroLoading,
    isPitchingHeroLoading,
    isStuffHeroLoading,
    latestCommandSeason,
    expandedMetric,
    pitchingModel,
    trackmanSessions.length,
  ]);

  const latestTrackmanSession = sortedSessions[0] ?? null;
  const latestCommandOuting = filteredCommandOutings[0] ?? null;
  const latestCommandReportHref = latestCommandOuting
    ? `/player/${latestCommandOuting.playerId}?outingId=${encodeURIComponent(
        latestCommandOuting.outingId,
      )}&from=profile&slug=${playerSlug}`
    : null;
  const latestMechanicsSession = useMemo(() => {
    if (!mechanicsEntry?.sessions?.length) return null;
    return [...mechanicsEntry.sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [mechanicsEntry]);

  return (
    <div className="mt-8">
      <div className="rounded-[1.5rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.64),rgba(9,9,11,0.9))] p-2 shadow-[0_20px_48px_rgba(0,0,0,0.20)]">
        <div className="grid gap-2 sm:grid-cols-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-[1.1rem] px-4 py-3 text-[11px] font-black uppercase tracking-[0.2em] transition-smooth ${
                activeTab === tab
                  ? "border border-emerald-500/25 bg-emerald-500/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(16,185,129,0.08)]"
                  : "border border-transparent text-zinc-500 hover:border-zinc-800 hover:bg-zinc-950/70 hover:text-zinc-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "Overview" && (
          <motion.div
            key="Overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 space-y-8"
          >
            <section className="space-y-7">
              <div className="space-y-3">
                <ProfileHeroTile
                  index={0}
                  label={heroTiles.pitchingTile.label}
                  value={heroTiles.pitchingTile.value}
                  note={heroTiles.pitchingTile.note}
                  tone={heroTiles.pitchingTile.tone}
                  badgeStyle={heroTiles.pitchingTile.badgeStyle}
                  onClick={heroTiles.pitchingTile.onClick}
                  active={heroTiles.pitchingTile.active}
                  featured={heroTiles.pitchingTile.featured}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  {heroTiles.secondaryTiles.map((tile, index) => (
                    <ProfileHeroTile
                      key={tile.label}
                      index={index + 1}
                      label={tile.label}
                      value={tile.value}
                      note={tile.note}
                      tone={tile.tone}
                      badgeStyle={tile.badgeStyle}
                      onClick={tile.onClick}
                      active={tile.active}
                      featured={tile.featured}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false} mode="wait">
                {expandedMetric === "pitching" && (
                  <motion.div
                    key="pitching-plus-model"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <PitchingPlusModelCard
                      season={latestCommandSeason}
                      loading={isPitchingHeroLoading}
                      note={pitchingModel.note}
                      result={pitchingModel.result}
                    />
                  </motion.div>
                )}
                {expandedMetric === "command" && (
                  <motion.div
                    key="command-plus-model"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <CommandPlusModelCard
                      season={latestCommandSeason}
                      note={
                        currentCommandHero?.score != null && currentCommandHero.season != null
                          ? `${currentCommandHero.outingCount} outing${currentCommandHero.outingCount === 1 ? "" : "s"} | ${currentCommandHero.pitchCount} pitch${currentCommandHero.pitchCount === 1 ? "" : "es"} in ${currentCommandHero.season}`
                          : latestCommandSeason != null
                            ? `No qualified score yet for ${latestCommandSeason}`
                            : "No command outings yet"
                      }
                      result={initialCommandResult}
                    />
                  </motion.div>
                )}
                {expandedMetric === "stuff" && (
                  <motion.div
                    key="stuff-plus-model"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <StuffPlusModelCard
                      note={
                        currentStuffHero?.total != null
                          ? `${currentStuffHero.pitchTypeCount} pitch type${currentStuffHero.pitchTypeCount === 1 ? "" : "s"} across ${currentStuffHero.sessionCount ?? 0} session${currentStuffHero.sessionCount === 1 ? "" : "s"}`
                          : trackmanSessions.length > 0
                            ? "Trackman sessions found, no Stuff+ grade yet"
                            : "No Trackman arsenal yet"
                      }
                      overall={currentStuffHero?.total ?? null}
                      pitches={initialStuffPitches}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            {seasonStats.length === 0 && d3Percentiles.length === 0 ? (
              <LeaderboardPanel className="p-5 text-sm text-zinc-500">
                No {seasonYear} stats available.
              </LeaderboardPanel>
            ) : (
              <>
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                        Season Snapshot
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {seasonYear} production at a glance.
                      </p>
                    </div>
                    {seasonNote ? <LeaderboardPill tone="neutral">{seasonNote}</LeaderboardPill> : null}
                  </div>

                  <LeaderboardPanel className="p-5 sm:p-6">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9">
                      {seasonStats.map((stat, i) => (
                        <div
                          key={stat.label}
                          className="rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 text-center opacity-0"
                          style={{
                            animation: `savantFadeIn 0.4s ease-out ${i * 50}ms forwards`,
                          }}
                        >
                          <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                            {stat.label}
                          </div>
                          <div className="mt-2 font-mono text-[24px] font-black tabular-nums leading-none text-white">
                            {stat.value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </LeaderboardPanel>
                </section>

                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                        D3 Percentile Rankings
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        Versus Division III pitchers in {seasonYear}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeaderboardPill tone="blue">Poor</LeaderboardPill>
                      <LeaderboardPill tone="neutral">Average</LeaderboardPill>
                      <LeaderboardPill tone="orange">Elite</LeaderboardPill>
                    </div>
                  </div>

                  <LeaderboardPanel className="overflow-hidden p-4 sm:p-5">
                    <div className="space-y-0">
                      {d3Percentiles.map((m, i) => (
                        <SavantPercentileBar
                          key={m.label}
                          label={m.label}
                          value={m.value}
                          percentile={m.percentile}
                          index={i}
                        />
                      ))}
                    </div>
                  </LeaderboardPanel>
                </section>
              </>
            )}
          </motion.div>
        )}

        {activeTab === "Trackman" && (
          <motion.div
            key="Trackman"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 space-y-6"
          >
            <section className="space-y-5">
              <ProfileHubLink
                href={`/trackman/player/${playerSlug}?from=profile`}
                icon={Activity}
                title="Trackman Hub"
                note="Averages, trends, and movement profiles"
                tone="blue"
              />

              <div className="grid gap-3 pt-2 md:grid-cols-3">
                <LeaderboardStatBlock
                  label="Stuff+"
                  value={
                    currentStuffHero?.total != null
                      ? currentStuffHero.total.toFixed(1)
                      : "--"
                  }
                  detail={
                    currentStuffHero?.total != null
                      ? "current live arsenal grade"
                      : "waiting on a full grade"
                  }
                  emphasisClassName="text-blue-300"
                />
                <LeaderboardStatBlock
                  label="Pitch Types"
                  value={String(currentStuffHero?.pitchTypeCount ?? 0)}
                  detail="graded shapes in the mix"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Sessions"
                  value={String(sortedSessions.length)}
                  detail={
                    latestTrackmanSession
                      ? `latest ${formatDateLabel(latestTrackmanSession.date)}`
                      : "no Trackman sessions yet"
                  }
                  emphasisClassName="text-zinc-100"
                />
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                    Sessions
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Recent Trackman work for this player.
                  </p>
                </div>
                <LeaderboardPill tone="blue">
                  {sortedSessions.length} Session{sortedSessions.length === 1 ? "" : "s"}
                </LeaderboardPill>
              </div>

              <LeaderboardPanel className="overflow-hidden p-2 sm:p-3">
                {sortedSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                    No sessions yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sortedSessions.map((s) => (
                      <li key={`${s.dateSlug}-${s.sessionLabel}`}>
                        <Link
                          href={`/trackman/session/${playerSlug}/${s.dateSlug}?from=profile&slug=${playerSlug}`}
                          className="group flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950/50 px-4 py-4 transition-smooth hover:border-blue-500/20 hover:bg-zinc-900/60"
                        >
                          <div>
                            <div className="text-sm font-bold text-zinc-200 transition-smooth group-hover:text-white">
                              {formatDateLabel(s.date)}
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-500">
                              {s.sessionLabel}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-600 opacity-70 transition-smooth group-hover:opacity-100 group-hover:text-blue-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}

        {activeTab === "Command" && (
          <motion.div
            key="Command"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 space-y-6"
          >
            <section className="space-y-7">
              <ProfileHubLink
                href={latestCommandReportHref ?? "/command"}
                icon={Target}
                title="Command Outings"
                note="Open the latest live report for this player"
                tone="orange"
              />

              <div className="grid gap-3 pt-2 md:grid-cols-3">
                <LeaderboardStatBlock
                  label="Command+"
                  value={
                    currentCommandHero?.score != null
                      ? currentCommandHero.score.toFixed(0)
                      : "--"
                  }
                  detail={
                    currentCommandHero?.season != null
                      ? `live baseline in ${currentCommandHero.season}`
                      : "not qualified yet"
                  }
                  emphasisClassName="text-orange-300"
                />
                <LeaderboardStatBlock
                  label="Outings"
                  value={String(filteredCommandOutings.length)}
                  detail={
                    latestCommandOuting
                      ? `latest ${formatDateLabel(latestCommandOuting.dateId)}`
                      : "no command outings yet"
                  }
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Tracked Pitches"
                  value={String(currentCommandHero?.pitchCount ?? 0)}
                  detail="live command sample size"
                  emphasisClassName="text-zinc-100"
                />
              </div>
            </section>

            <section className="space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                    Outings
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    Command reports tied to this player profile.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <LeaderboardPill tone="orange">
                    {filteredCommandOutings.length} Outing{filteredCommandOutings.length === 1 ? "" : "s"}
                  </LeaderboardPill>
                  {commandSeasons.length > 1 && (
                    <Segment
                      label="Season"
                      options={[
                        ...commandSeasons.map((yr) => ({ value: String(yr), display: String(yr) })),
                        { value: "all", display: "All" },
                      ]}
                      selected={commandSeasonFilter}
                      onChange={setCommandSeasonFilter}
                    />
                  )}
                </div>
              </div>

              <LeaderboardPanel className="overflow-hidden p-2 sm:p-3">
                {filteredCommandOutings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 px-4 py-8 text-center text-sm text-zinc-500">
                    No outings yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {filteredCommandOutings.map((o) => (
                      <li key={o.outingId}>
                        <Link
                          href={`/player/${o.playerId}?outingId=${encodeURIComponent(
                            o.outingId,
                          )}&from=profile&slug=${playerSlug}`}
                          className="group flex items-center justify-between rounded-2xl border border-zinc-900 bg-zinc-950/50 px-4 py-4 transition-smooth hover:border-orange-500/20 hover:bg-zinc-900/60"
                        >
                          <div>
                            <div className="text-sm font-bold text-zinc-200 transition-smooth group-hover:text-white">
                              {formatDateLabel(o.dateId)}
                            </div>
                            <div className="mt-1 text-[11px] text-zinc-500">
                              {o.label}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-600 opacity-70 transition-smooth group-hover:opacity-100 group-hover:text-orange-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}

        {activeTab === "Mechanics" && (
          <motion.div
            key="Mechanics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-8 space-y-6"
          >
            <section className="space-y-4">
              <ProfileHubLink
                href={`/mechanics/player/${playerSlug}?from=profile&slug=${playerSlug}`}
                icon={ScanLine}
                title="Mechanics Hub"
                note="Video analysis, efficiency scores, and session history"
                tone="violet"
              />

              <div className="grid gap-3 pt-2 md:grid-cols-3">
                <LeaderboardStatBlock
                  label="Sessions"
                  value={String(mechanicsEntry?.sessions.length ?? 0)}
                  detail="mechanics sessions on file"
                  emphasisClassName="text-zinc-100"
                />
                <LeaderboardStatBlock
                  label="Latest Score"
                  value={
                    latestMechanicsSession
                      ? latestMechanicsSession.efficiency_score.toFixed(1)
                      : "--"
                  }
                  detail={
                    latestMechanicsSession
                      ? `${latestMechanicsSession.pass_count} pass / ${latestMechanicsSession.fail_count} fail`
                      : "no mechanics session yet"
                  }
                  emphasisClassName="text-violet-300"
                />
                <LeaderboardStatBlock
                  label="Latest Date"
                  value={
                    latestMechanicsSession
                      ? formatDateLabel(latestMechanicsSession.date)
                      : "--"
                  }
                  detail={
                    latestMechanicsSession
                      ? latestMechanicsSession.view_mode.replace(/_/g, " ")
                      : "waiting on first upload"
                  }
                  emphasisClassName="text-zinc-100"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                  Sessions
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Delivery review and recent mechanics access.
                </p>
              </div>

              <LeaderboardPanel className="overflow-hidden p-4 sm:p-5">
                <MechanicsProfileCard entry={mechanicsEntry ?? null} profileSlug={playerSlug} />
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
