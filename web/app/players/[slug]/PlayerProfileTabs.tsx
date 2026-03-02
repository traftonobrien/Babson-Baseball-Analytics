"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Target, ArrowRight, ScanLine } from "lucide-react";
import SavantPercentileBar from "./SavantPercentileBar";
import MechanicsProfileCard from "@/app/components/mechanics/MechanicsProfileCard";
import Segment from "@/app/components/Segment";
import { useAllPitchData } from "@/app/hooks/useAllPitchData";
import {
  computeCommandPlus,
  type CommandPlusBaselines,
} from "@/lib/commandPlus";
import type { SeasonFilter } from "@/lib/leaderboards/types";
import { seasonFromDateId } from "@/lib/season";
import { computeTotalStuffPlus, plusMetricBadgeStyle } from "@/lib/stuffPlusUtils";
import { computePitchingPlus } from "@/lib/pitchingPlus";
import type { HubPlayerEntry } from "@/lib/mechanics/hub";

const TABS = ["Overview", "Trackman", "Command", "Mechanics"] as const;
type Tab = (typeof TABS)[number];
type HeroTone = "amber" | "orange" | "blue";

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
  total: number | null;
  pitchTypeCount: number;
  sessionCount: number | null;
  pitches: { pitchType: string; meanStuffPlus: number | null }[];
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
  initialTab?: string;
  mechanicsEntry?: HubPlayerEntry | null;
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
}: HeroTileConfig & { index: number }) {
  const toneStyles = HERO_TONE_STYLES[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border ${toneStyles.border} bg-gradient-to-br ${toneStyles.surface} p-4 opacity-0 backdrop-blur-sm`}
      style={{
        animation: `savantFadeIn 0.4s ease-out ${index * 60}ms forwards`,
      }}
    >
      <div className={`absolute inset-y-4 left-0 w-[3px] rounded-full ${toneStyles.rail}`} />
      <div className={`pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full blur-3xl ${toneStyles.glow}`} />

      <p className={`pl-4 text-[10px] font-black uppercase tracking-[0.18em] ${toneStyles.label}`}>
        {label}
      </p>

      <div className="mt-4 pl-4">
        {badgeStyle ? (
          <span
            className="inline-flex min-h-[3rem] min-w-[5.5rem] items-center justify-center rounded-2xl px-4 py-2 font-mono text-[30px] font-black tracking-tight"
            style={badgeStyle}
          >
            {value}
          </span>
        ) : (
          <span className={`font-mono text-[30px] font-black tracking-tight ${toneStyles.value}`}>
            {value}
          </span>
        )}
      </div>

      <p className={`mt-3 pl-4 text-[11px] ${toneStyles.note}`}>
        {note}
      </p>
    </div>
  );
}

export default function PlayerProfileTabs({
  seasonStats,
  seasonYear,
  d3Percentiles,
  trackmanSessions,
  commandOutings,
  commandPlayerId,
  playerSlug,
  initialTab,
  mechanicsEntry,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>(resolveInitialTab(initialTab));
  const [commandSeasonFilter, setCommandSeasonFilter] = useState<string>("2026");
  const [commandHero, setCommandHero] = useState<CommandHeroState | null>(null);
  const [stuffHero, setStuffHero] = useState<StuffHeroState | null>(null);
  const [commandBaselines, setCommandBaselines] = useState<{
    season: number;
    baselines: CommandPlusBaselines | null;
  } | null>(null);

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
  const latestSeasonCsvPaths = useMemo(() => {
    if (latestCommandSeason == null) return [];
    return commandOutings
      .filter((o) => seasonFromDateId(o.dateId) === latestCommandSeason)
      .map((o) => o.csvPath);
  }, [commandOutings, latestCommandSeason]);
  const latestCommandOutingCount = useMemo(() => {
    if (latestCommandSeason == null) return 0;
    return commandOutings.filter((o) => seasonFromDateId(o.dateId) === latestCommandSeason).length;
  }, [commandOutings, latestCommandSeason]);
  const {
    pitches: latestSeasonPitches,
    loading: latestSeasonPitchesLoading,
  } = useAllPitchData(latestSeasonCsvPaths, commandPlayerId ?? playerSlug);

  useEffect(() => {
    let cancelled = false;

    if (!commandPlayerId || latestCommandSeason == null) {
      setCommandBaselines(null);
      return () => {
        cancelled = true;
      };
    }

    const seasonFilter = latestCommandSeason as SeasonFilter;

    void (async () => {
      try {
        const {
          computePlayerAggregateRows,
          globalCommandPlusBaselines,
          loadAllOutingData,
        } = await import("@/lib/leaderboards/load");

        if (!globalCommandPlusBaselines[latestCommandSeason]) {
          await loadAllOutingData({ seasonFilter });
        }

        const rows = computePlayerAggregateRows({ seasonFilter, minPitches: 1 });
        const row = rows.find((candidate) => candidate.playerId === commandPlayerId) ?? null;
        const baselines = globalCommandPlusBaselines[latestCommandSeason] ?? null;

        if (cancelled) return;

        setCommandBaselines({
          season: latestCommandSeason,
          baselines,
        });
        setCommandHero({
          playerId: commandPlayerId,
          score: row?.commandPlus ?? null,
          season: latestCommandSeason,
          outingCount: row?.outingCount ?? latestCommandOutingCount,
          pitchCount: row?.pitchCount ?? 0,
        });
      } catch (error) {
        console.error("[PlayerProfileTabs] command hero failed:", error);

        if (cancelled) return;

        setCommandBaselines({
          season: latestCommandSeason,
          baselines: null,
        });
        setCommandHero({
          playerId: commandPlayerId,
          score: null,
          season: latestCommandSeason,
          outingCount: latestCommandOutingCount,
          pitchCount: 0,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commandPlayerId, latestCommandOutingCount, latestCommandSeason]);

  useEffect(() => {
    let cancelled = false;

    if (!playerSlug) {
      return () => {
        cancelled = true;
      };
    }

    void fetch(`/api/stuff-plus/arsenal?playerId=${encodeURIComponent(playerSlug)}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { pitches?: StuffPlusApiPitch[] };
      })
      .then((payload) => {
        if (cancelled) return;

        const pitches = Array.isArray(payload?.pitches) ? payload.pitches : [];
        const validPitchCount = pitches.filter((pitch) => pitch.meanStuffPlus != null).length;
        const sessionCount = pitches.reduce((max, pitch) => {
          if (typeof pitch.nSessions !== "number") return max;
          return Math.max(max, pitch.nSessions);
        }, 0);

        setStuffHero({
          playerSlug,
          total: computeTotalStuffPlus(pitches),
          pitchTypeCount: validPitchCount,
          sessionCount: sessionCount > 0 ? sessionCount : null,
          pitches: pitches.map((pitch) => ({
            pitchType: pitch.pitchType ?? "",
            meanStuffPlus: pitch.meanStuffPlus ?? null,
          })),
        });
      })
      .catch((error) => {
        console.error("[PlayerProfileTabs] stuff hero failed:", error);

        if (cancelled) return;

        setStuffHero({
          playerSlug,
          total: null,
          pitchTypeCount: 0,
          sessionCount: null,
          pitches: [],
        });
      });

    return () => {
      cancelled = true;
    };
  }, [playerSlug]);

  const isCommandHeroLoading =
    commandPlayerId != null &&
    latestCommandSeason != null &&
    (commandHero?.playerId !== commandPlayerId || commandHero?.season !== latestCommandSeason);
  const currentCommandHero =
    commandHero?.playerId === commandPlayerId && commandHero?.season === latestCommandSeason
      ? commandHero
      : null;

  const isStuffHeroLoading =
    Boolean(playerSlug) && stuffHero?.playerSlug !== playerSlug;
  const currentStuffHero =
    stuffHero?.playerSlug === playerSlug
      ? stuffHero
      : null;
  const currentCommandBaselines =
    commandBaselines?.season === latestCommandSeason
      ? commandBaselines.baselines
      : null;
  const isPitchingHeroLoading =
    commandPlayerId != null &&
    latestCommandSeason != null &&
    (isCommandHeroLoading || latestSeasonPitchesLoading || isStuffHeroLoading);
  const pitchingHero = useMemo(() => {
    if (!commandPlayerId || latestCommandSeason == null) {
      return { overall: null, note: "No live command outings yet", ready: false };
    }

    if (isPitchingHeroLoading) {
      return { overall: null, note: "Blending live season inputs", ready: false };
    }

    if (!currentCommandBaselines) {
      return {
        overall: null,
        note: "Missing live command variable",
        ready: false,
      };
    }

    const commandResult = computeCommandPlus(latestSeasonPitches, currentCommandBaselines);
    const result = computePitchingPlus(playerSlug, commandResult, currentStuffHero?.pitches ?? []);

    if (!result.ready || result.overall == null) {
      const note =
        result.reason === "missing_live_command"
          ? "Missing live command variable"
          : result.reason === "missing_stuff"
            ? "Missing Stuff+ variable"
            : "No clean pitch overlap yet";
      return {
        overall: null,
        note,
        ready: false,
      };
    }

    return {
      overall: result.overall,
      note: `${result.overlapPitchTypeCount} pitch type${result.overlapPitchTypeCount === 1 ? "" : "s"} | ${result.overlapPitchCount} live pitch${result.overlapPitchCount === 1 ? "" : "es"} in ${latestCommandSeason}`,
      ready: true,
    };
  }, [
    commandPlayerId,
    currentCommandBaselines,
    currentStuffHero?.pitches,
    isPitchingHeroLoading,
    latestCommandSeason,
    latestSeasonPitches,
    playerSlug,
  ]);

  const heroTiles = useMemo<HeroTileConfig[]>(() => {
    const pitchingValue = isPitchingHeroLoading
      ? "..."
      : pitchingHero.ready && pitchingHero.overall != null
        ? pitchingHero.overall.toFixed(0)
        : "NR";
    const pitchingNote = isPitchingHeroLoading
      ? "Building live-season blend"
      : pitchingHero.note;

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

    return [
      {
        label: "Pitching+",
        value: pitchingValue,
        note: pitchingNote,
        tone: "amber",
        badgeStyle:
          pitchingHero.ready && pitchingHero.overall != null
            ? plusMetricBadgeStyle(pitchingHero.overall)
            : undefined,
      },
      {
        label: "Command+",
        value: commandValue,
        note: commandNote,
        tone: "orange",
        badgeStyle: currentCommandHero?.score != null ? plusMetricBadgeStyle(currentCommandHero.score) : undefined,
      },
      {
        label: "Stuff+",
        value: stuffValue,
        note: stuffNote,
        tone: "blue",
        badgeStyle: currentStuffHero?.total != null ? plusMetricBadgeStyle(currentStuffHero.total) : undefined,
      },
    ];
  }, [
    currentCommandHero,
    currentCommandBaselines,
    currentStuffHero,
    isCommandHeroLoading,
    isPitchingHeroLoading,
    isStuffHeroLoading,
    latestCommandSeason,
    latestSeasonPitches,
    latestSeasonPitchesLoading,
    pitchingHero,
    playerSlug,
    trackmanSessions.length,
  ]);

  return (
    <div className="mt-6">
      {/* Tab bar */}
      <div className="flex gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`relative cursor-pointer px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-smooth ${
              activeTab === tab
                ? "text-white"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-emerald-500" />
            )}
          </button>
        ))}
      </div>
      <div className="h-px bg-zinc-800/60" />

      <AnimatePresence mode="wait">
        {/* OVERVIEW */}
        {activeTab === "Overview" && (
          <motion.div
            key="Overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-12 space-y-16"
          >
          <section>
            <div className="grid gap-3 md:grid-cols-3">
              {heroTiles.map((tile, index) => (
                <ProfileHeroTile
                  key={tile.label}
                  index={index}
                  label={tile.label}
                  value={tile.value}
                  note={tile.note}
                  tone={tile.tone}
                  badgeStyle={tile.badgeStyle}
                />
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <Link
                href="/pitching-plus"
                className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-600 transition-smooth hover:text-zinc-300"
              >
                Pitching+ Methodology
              </Link>
            </div>
          </section>

          {seasonStats.length === 0 && d3Percentiles.length === 0 ? (
            <p className="text-sm text-zinc-600">
              No {seasonYear} stats available.
            </p>
          ) : (
            <>
              {/* Season Snapshot */}
              <section>
                <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                  {seasonYear} Season
                </h2>
                <div className="mt-6 grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5 lg:grid-cols-9">
                  {seasonStats.map((stat, i) => (
                    <div
                      key={stat.label}
                      className="text-center opacity-0"
                      style={{
                        animation: `savantFadeIn 0.4s ease-out ${i * 50}ms forwards`,
                      }}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                        {stat.label}
                      </div>
                      <div className="mt-1 font-mono text-[22px] font-black tabular-nums leading-none text-white">
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* D3 Percentile Rankings */}
              <section>
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
                      D3 Percentile Rankings
                    </h2>
                    <p className="mt-1 text-[10px] tracking-wide text-zinc-700">
                      vs Division III pitchers, {seasonYear}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#3b82f6" }} />
                      Poor
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#a1a1aa" }} />
                      Avg
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-[10px] w-[10px] rounded-full" style={{ background: "#dc2626" }} />
                      Elite
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-0">
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
              </section>
            </>
          )}
          </motion.div>
        )}

        {/* TRACKMAN */}
        {activeTab === "Trackman" && (
          <motion.div
            key="Trackman"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-10"
          >
          {/* Hub button */}
          <Link href={`/trackman/player/${playerSlug}?from=profile`}>
            <div className="group flex items-center justify-between rounded-xl border border-blue-500/30 bg-zinc-900/60 px-5 py-4 transition-smooth hover:border-blue-500/50 hover:bg-zinc-900">
              <div className="flex items-center gap-3">
                <Activity className="h-4 w-4 text-blue-400" />
                <div>
                  <span className="text-sm font-semibold text-zinc-100">Trackman Hub</span>
                  <p className="text-[10px] text-zinc-500">Averages, trends, and movement profiles</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-blue-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          <h2 className="mt-10 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Sessions
          </h2>

          {sortedSessions.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600">No sessions yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-zinc-800/40">
              {sortedSessions.map((s) => (
                <li key={`${s.dateSlug}-${s.sessionLabel}`}>
                  <Link
                    href={`/trackman/session/${playerSlug}/${s.dateSlug}?from=profile&slug=${playerSlug}`}
                    className="flex items-center justify-between py-4 group/row"
                  >
                    <div>
                      <div className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-smooth">
                        {formatDateLabel(s.date)}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {s.sessionLabel}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </motion.div>
        )}

        {/* COMMAND */}
        {activeTab === "Command" && (
          <motion.div
            key="Command"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-10"
          >
          {/* Command Hub button */}
          <Link href="/command">
            <div className="group flex items-center justify-between rounded-xl border border-orange-500/30 bg-zinc-900/60 px-5 py-4 transition-smooth hover:border-orange-500/50 hover:bg-zinc-900">
              <div className="flex items-center gap-3">
                <Target className="h-4 w-4 text-orange-400" />
                <div>
                  <span className="text-sm font-semibold text-zinc-100">Command Hub</span>
                  <p className="text-[10px] text-zinc-500">All pitchers, all outings</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-orange-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          <div className="mt-10 flex items-center justify-between">
            <h2 className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
              Outings
            </h2>
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

          {filteredCommandOutings.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-600">No outings yet.</p>
          ) : (
            <ul className="mt-5 divide-y divide-zinc-800/40">
              {filteredCommandOutings.map((o) => (
                <li key={o.outingId}>
                  <Link
                    href={`/player/${o.playerId}?from=profile&slug=${playerSlug}`}
                    className="flex items-center justify-between py-4 group/row"
                  >
                    <div>
                      <div className="text-sm font-bold text-zinc-200 group-hover/row:text-white transition-smooth">
                        {formatDateLabel(o.dateId)}
                      </div>
                      <div className="text-[10px] text-zinc-600">
                        {o.label}
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-zinc-600 opacity-0 group-hover/row:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          </motion.div>
        )}

        {/* MECHANICS */}
        {activeTab === "Mechanics" && (
          <motion.div
            key="Mechanics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="mt-10"
          >
          <Link href={`/mechanics/player/${playerSlug}?from=profile&slug=${playerSlug}`}>
            <div className="group flex items-center justify-between rounded-xl border border-violet-500/30 bg-zinc-900/60 px-5 py-4 transition-smooth hover:border-violet-500/50 hover:bg-zinc-900">
              <div className="flex items-center gap-3">
                <ScanLine className="h-4 w-4 text-violet-400" />
                <div>
                  <span className="text-sm font-semibold text-zinc-100">Mechanics Hub</span>
                  <p className="text-[10px] text-zinc-500">Video analysis, efficiency scores, and session history</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-violet-400 opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>

          <h2 className="mt-10 text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500">
            Sessions
          </h2>

          <div className="mt-5">
            <MechanicsProfileCard entry={mechanicsEntry ?? null} profileSlug={playerSlug} />
          </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
