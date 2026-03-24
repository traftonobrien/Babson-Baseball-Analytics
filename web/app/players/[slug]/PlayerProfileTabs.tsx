"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, ArrowRight, Target, ScanLine } from "lucide-react";
import { ProfileHeroTile, type HeroTileConfig } from "./_components/ProfileHeroTile";
import { ProfileHubLink } from "./_components/ProfileHubLink";
import SavantPercentileBar from "./SavantPercentileBar";
import LiveAbProfilePanel from "./LiveAbProfilePanel";
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
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import { computeTotalStuffPlus, plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import type { CommandPlusResult } from "@/lib/commandPlus";
import type { PitchingPlusResult } from "@/lib/pitchingPlus";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";
import type { ChartingPlayerProfile } from "@/lib/charting/playerProfile";

const ALL_TABS = ["Overview", "Charting", "Trackman", "Command", "Mechanics"] as const;
const HITTER_TABS = ["Overview", "Charting"] as const;
type Tab = (typeof ALL_TABS)[number];
type ProfileMode = "pitcher" | "hitter" | "two-way";
type OverviewMode = "pitching" | "hitting";

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
  profileMode: ProfileMode;
  defaultOverviewMode: OverviewMode;
  pitchingPercentileAudienceLabel: string;
  hittingPercentileAudienceLabel: string;
  pitchingSeasonStats: SeasonStat[];
  hittingSeasonStats: SeasonStat[];
  seasonYear: number;
  seasonNote?: string;
  ncaaProvenance?: { label: string; tone: "amber" | "neutral" };
  pitchingSeasonPercentiles: PercentileMetric[];
  hittingSeasonPercentiles: PercentileMetric[];
  trackmanSessions: TrackmanSession[];
  commandOutings: CommandOuting[];
  playerSlug: string;
  initialCommandHero: CommandHeroState | null;
  initialCommandResult: CommandPlusResult | null;
  initialPitchingModel: PitchingHeroState;
  initialStuffLookupPlayerId: string | null;
  initialStuffPitches: StuffPlusApiPitch[];
  initialTab?: string;
  mechanicsEntry?: HubPlayerEntry | null;
  liveAbProfile: ChartingPlayerProfile;
}

function formatDateLabel(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

function resolveInitialTab(raw: string | undefined, tabs: readonly Tab[]): Tab {
  if (!raw) return tabs[0] ?? "Overview";
  const lower = raw.toLowerCase();
  const resolved =
    lower === "trackman"
      ? "Trackman"
      : lower === "command"
        ? "Command"
        : lower === "mechanics"
          ? "Mechanics"
          : lower === "live-ab" || lower === "liveab" || lower === "charting"
            ? "Charting"
            : "Overview";

  return tabs.includes(resolved) ? resolved : tabs[0] ?? "Overview";
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

export default function PlayerProfileTabs({
  profileMode,
  defaultOverviewMode,
  pitchingPercentileAudienceLabel,
  hittingPercentileAudienceLabel,
  pitchingSeasonStats,
  hittingSeasonStats,
  seasonYear,
  seasonNote,
  ncaaProvenance,
  pitchingSeasonPercentiles,
  hittingSeasonPercentiles,
  trackmanSessions,
  commandOutings,
  playerSlug,
  initialCommandHero,
  initialCommandResult,
  initialPitchingModel,
  initialStuffLookupPlayerId,
  initialStuffPitches,
  initialTab,
  mechanicsEntry,
  liveAbProfile,
}: Props) {
  const { setSelectedPlayer } = useSelectedPlayer();

  // Persist this player as the "active" player whenever the profile is viewed.
  // This lets other surfaces (Trackman, Command, Team Stats, Charting Insights)
  // pre-filter or highlight this player without additional navigation.
  useEffect(() => {
    setSelectedPlayer(playerSlug);
  }, [playerSlug, setSelectedPlayer]);

  const availableTabs = profileMode === "hitter" ? HITTER_TABS : ALL_TABS;
  const [activeTab, setActiveTab] = useState<Tab>(resolveInitialTab(initialTab, availableTabs));
  const [activeOverviewMode, setActiveOverviewMode] = useState<OverviewMode>(defaultOverviewMode);
  const [commandSeasonFilter, setCommandSeasonFilter] = useState<string>("2026");
  const [expandedMetric, setExpandedMetric] = useState<"pitching" | "command" | "stuff" | null>(null);
  const seasonStats = activeOverviewMode === "pitching" ? pitchingSeasonStats : hittingSeasonStats;
  const seasonPercentiles =
    activeOverviewMode === "pitching" ? pitchingSeasonPercentiles : hittingSeasonPercentiles;
  const percentileAudienceLabel =
    activeOverviewMode === "pitching"
      ? pitchingPercentileAudienceLabel
      : hittingPercentileAudienceLabel;
  const seasonStatMap = useMemo(
    () => new Map(seasonStats.map((stat) => [stat.label, stat.value])),
    [seasonStats],
  );

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
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-[1.5rem] border border-slate-200/80 bg-surface/95 p-2 shadow-[0_18px_44px_rgba(15,23,42,0.06)] scrollbar-hide dark:border-zinc-700/80 dark:bg-zinc-950/70 dark:shadow-[0_18px_44px_rgba(0,0,0,0.4)]">
        <div
          className="grid min-w-[22rem] gap-2 sm:min-w-[28rem] md:min-w-full"
          style={{ gridTemplateColumns: `repeat(${availableTabs.length}, minmax(0, 1fr))` }}
        >
          {availableTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-[1.1rem] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-smooth sm:px-4 sm:py-3 sm:text-[11px] ${
                activeTab === tab
                  ? "border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)] shadow-[0_10px_24px_rgba(var(--brand-primary-rgb),0.08)] dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-[var(--brand-primary-spotlight)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
                  : "border border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80 dark:hover:text-zinc-50"
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
            className="space-y-8"
          >
            {profileMode === "two-way" && (
              <section className="space-y-3">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                    Overview Mode
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Switch this profile between pitching and hitting season views.
                  </p>
                </div>
                <div className="flex justify-start">
                  <Segment
                    label="Overview"
                    options={[
                      { value: "pitching", display: "Pitching" },
                      { value: "hitting", display: "Hitting" },
                    ]}
                    selected={activeOverviewMode}
                    onChange={(value) => setActiveOverviewMode(value as OverviewMode)}
                    variant="light"
                  />
                </div>
              </section>
            )}

            {profileMode === "hitter" || activeOverviewMode === "hitting" ? (
              <section className="space-y-5">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                    Hitting Snapshot
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Season production and plate-discipline context for this hitter profile.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
                  <LeaderboardStatBlock
                    label="AVG"
                    value={seasonStatMap.get("AVG") ?? "--"}
                    detail="batting average"
                    emphasisClassName="text-emerald-600 dark:text-emerald-300"
                    variant="light"
                  />
                  <LeaderboardStatBlock
                    label="OPS"
                    value={seasonStatMap.get("OPS") ?? "--"}
                    detail="on-base plus slugging"
                    emphasisClassName="text-slate-900 dark:text-zinc-50"
                    variant="light"
                  />
                  <LeaderboardStatBlock
                    label="HR"
                    value={seasonStatMap.get("HR") ?? "--"}
                    detail="home runs"
                    emphasisClassName="text-slate-900 dark:text-zinc-50"
                    variant="light"
                  />
                  <LeaderboardStatBlock
                    label="RBI"
                    value={seasonStatMap.get("RBI") ?? "--"}
                    detail="runs batted in"
                    emphasisClassName="text-slate-900 dark:text-zinc-50"
                    variant="light"
                  />
                  <LeaderboardStatBlock
                    label="BB%"
                    value={seasonStatMap.get("BB%") ?? "--"}
                    detail="walk rate"
                    emphasisClassName="text-slate-900 dark:text-zinc-50"
                    variant="light"
                  />
                  <LeaderboardStatBlock
                    label="K%"
                    value={seasonStatMap.get("K%") ?? "--"}
                    detail="strikeout rate"
                    emphasisClassName="text-slate-900 dark:text-zinc-50"
                    variant="light"
                  />
                </div>
              </section>
            ) : (
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
            )}

            {seasonStats.length === 0 && seasonPercentiles.length === 0 ? (
              <LeaderboardPanel className="p-5 text-sm text-slate-500 dark:text-zinc-400" variant="light">
                No {seasonYear} stats available.
              </LeaderboardPanel>
            ) : (
              <>
                <section className="space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                        Season Stats
                      </h2>
                    </div>
                    {seasonNote ? <LeaderboardPill tone="neutral" variant="light">{seasonNote}</LeaderboardPill> : null}
                    {ncaaProvenance ? (
                      <>
                        <LeaderboardPill tone={ncaaProvenance.tone} variant="light">{ncaaProvenance.label}</LeaderboardPill>
                        <LeaderboardPill tone="neutral" variant="light">NCAA D3</LeaderboardPill>
                      </>
                    ) : null}
                  </div>

                  <LeaderboardPanel className="p-4 sm:p-6" variant="light">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {seasonStats.map((stat, i) => (
                        <div
                          key={stat.label}
                          className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-2 py-3 text-center opacity-0 sm:px-3 sm:py-3.5 dark:border-zinc-700 dark:bg-zinc-900/75"
                          style={{
                            animation: `savantFadeIn 0.4s ease-out ${i * 50}ms forwards`,
                          }}
                        >
                          <div className="text-[10px] font-bold uppercase leading-snug tracking-wide text-slate-400 dark:text-zinc-500 sm:tracking-[0.16em]">
                            {stat.label}
                          </div>
                          <div className="mt-2 font-mono text-xl font-black tabular-nums leading-none tracking-tight text-slate-900 dark:text-zinc-50 sm:text-2xl">
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
                      <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                        NCAA Percentile Rankings
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                        Versus Division III {percentileAudienceLabel} in {seasonYear}.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <LeaderboardPill tone="blue" variant="light">Poor</LeaderboardPill>
                      <LeaderboardPill tone="neutral" variant="light">Average</LeaderboardPill>
                      <LeaderboardPill tone="orange" variant="light">Elite</LeaderboardPill>
                    </div>
                  </div>

                  <LeaderboardPanel className="overflow-hidden p-4 sm:p-5" variant="light">
                    <div className="space-y-0">
                      {seasonPercentiles.map((m, i) => (
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

        {profileMode !== "hitter" && activeTab === "Trackman" && (
          <motion.div
            key="Trackman"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
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
                  emphasisClassName="text-blue-600 dark:text-blue-300"
                  variant="light"
                />
                <LeaderboardStatBlock
                  label="Pitch Types"
                  value={String(currentStuffHero?.pitchTypeCount ?? 0)}
                  detail="graded shapes in the mix"
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
                />
                <LeaderboardStatBlock
                  label="Sessions"
                  value={String(sortedSessions.length)}
                  detail={
                    latestTrackmanSession
                      ? `latest ${formatDateLabel(latestTrackmanSession.date)}`
                      : "no Trackman sessions yet"
                  }
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
                />
              </div>
            </section>

            <section className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                    Sessions
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Recent Trackman work for this player.
                  </p>
                </div>
                <LeaderboardPill tone="blue" variant="light">
                  {sortedSessions.length} Session{sortedSessions.length === 1 ? "" : "s"}
                </LeaderboardPill>
              </div>

              <LeaderboardPanel className="overflow-hidden p-2 sm:p-3" variant="light">
                {sortedSessions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/75 dark:text-zinc-400">
                    No sessions yet.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sortedSessions.map((s) => (
                      <li key={`${s.dateSlug}-${s.sessionLabel}`}>
                        <Link
                          href={`/trackman/session/${playerSlug}/${s.dateSlug}?from=profile&slug=${playerSlug}`}
                          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-surface px-4 py-4 transition-smooth hover:border-blue-200 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/75 dark:hover:border-blue-500/35 dark:hover:bg-zinc-900"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-900 transition-smooth dark:text-zinc-50">
                              {formatDateLabel(s.date)}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                              {s.sessionLabel}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400 opacity-70 transition-smooth group-hover:opacity-100 group-hover:text-blue-600 dark:text-zinc-500 dark:group-hover:text-blue-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}

        {profileMode !== "hitter" && activeTab === "Command" && (
          <motion.div
            key="Command"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
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
                  emphasisClassName="text-orange-600 dark:text-orange-300"
                  variant="light"
                />
                <LeaderboardStatBlock
                  label="Outings"
                  value={String(filteredCommandOutings.length)}
                  detail={
                    latestCommandOuting
                      ? `latest ${formatDateLabel(latestCommandOuting.dateId)}`
                      : "no command outings yet"
                  }
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
                />
                <LeaderboardStatBlock
                  label="Tracked Pitches"
                  value={String(currentCommandHero?.pitchCount ?? 0)}
                  detail="live command sample size"
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
                />
              </div>
            </section>

            <section className="space-y-7">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                    Outings
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                    Command reports tied to this player profile.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <LeaderboardPill tone="orange" variant="light">
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
                      variant="light"
                    />
                  )}
                </div>
              </div>

              <LeaderboardPanel className="overflow-hidden p-2 sm:p-3" variant="light">
                {filteredCommandOutings.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/75 dark:text-zinc-400">
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
                          className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-surface px-4 py-4 transition-smooth hover:border-orange-200 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/75 dark:hover:border-orange-500/35 dark:hover:bg-zinc-900"
                        >
                          <div>
                            <div className="text-sm font-bold text-slate-900 transition-smooth dark:text-zinc-50">
                              {formatDateLabel(o.dateId)}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                              {o.label}
                            </div>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-400 opacity-70 transition-smooth group-hover:opacity-100 group-hover:text-orange-600 dark:text-zinc-500 dark:group-hover:text-orange-300" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}

        {profileMode !== "hitter" && activeTab === "Mechanics" && (
          <motion.div
            key="Mechanics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
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
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
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
                  emphasisClassName="text-violet-600 dark:text-violet-300"
                  variant="light"
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
                  emphasisClassName="text-slate-900 dark:text-zinc-50"
                  variant="light"
                />
              </div>
            </section>

            <section className="space-y-4">
              <div>
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-zinc-400">
                  Sessions
                </h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                  Delivery review and recent mechanics access.
                </p>
              </div>

              <LeaderboardPanel className="overflow-hidden p-4 sm:p-5" variant="light">
                <MechanicsProfileCard entry={mechanicsEntry ?? null} profileSlug={playerSlug} />
              </LeaderboardPanel>
            </section>
          </motion.div>
        )}

        {activeTab === "Charting" && (
          <motion.div
            key="LiveAB"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="space-y-6"
          >
            <LiveAbProfilePanel profile={liveAbProfile} seasonStats={pitchingSeasonStats} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
