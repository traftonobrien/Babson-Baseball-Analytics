"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";
import { BarChart3, Search, BookOpen, CircleHelp } from "lucide-react";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { useSelectedPlayer } from "@/lib/selectedPlayer";
import {
  TEAM_STATS_HITTER_QUALIFICATION_OPTIONS,
  TEAM_STATS_MIN_HITTER_PA,
  TEAM_STATS_MIN_PITCHER_IP,
  TEAM_STATS_PITCHER_QUALIFICATION_OPTIONS,
} from "@/lib/teamStatsQualifications";

type StatMode = "pitching" | "batting";
type StatSection = "standard" | "advanced";

interface BabsonPitcherRow {
  playerId: string;
  playerName: string;
  slug?: string;
  // counting
  app: number;
  gs: number;
  w: number;
  l: number;
  sv: number;
  ip: number;
  h: number;
  r: number;
  er: number;
  hr: number;
  bb: number;
  hb: number;
  so: number;
  bf: number;
  go: number;
  fo: number;
  ibb: number;
  pitches: number;
  // computed advanced
  babip: number;
  lobPct: number;
  gbPct: number;
  fbPct: number;
  hrFbPct: number;
  soBb: number;
  // rate / advanced
  era: number;
  whip: number;
  fip: number;
  xfip: number;
  siera: number;
  eraPlus: number;
  k9: number;
  bb9: number;
  h9: number;
  hr9: number;
  kPct: number;
  bbPct: number;
  kMinusBbPct: number;
  war: number;
}

interface BabsonHitterRow {
  playerId: string;
  playerName: string;
  slug?: string;
  // counting
  gp: number;
  gs: number;
  pa: number;
  ab: number;
  h: number;
  doubles: number;
  triples: number;
  tb: number;
  hr: number;
  rbi: number;
  r: number;
  sb: number;
  cs: number;
  bb: number;
  so: number;
  hbp: number;
  // rate / advanced
  avg: number;
  obp: number;
  slg: number;
  ops: number;
  kPct: number;
  bbPct: number;
  wrcPlus: number;
  war: number;
  sf: number;
  iso: number;
  babip: number;
  bbk: number;
  sbPct: number;
}

type PitcherSortKey = keyof Omit<BabsonPitcherRow, "playerId" | "playerName" | "slug">;
type HitterSortKey = keyof Omit<BabsonHitterRow, "playerId" | "playerName" | "slug">;

interface PitcherCol {
  key: PitcherSortKey;
  label: string;
  lowerBetter?: boolean;
  tooltip?: string;
  fmt: (p: BabsonPitcherRow) => string;
}

interface HitterCol {
  key: HitterSortKey;
  label: string;
  lowerBetter?: boolean;
  tooltip?: string;
  fmt: (h: BabsonHitterRow) => string;
}

function HeaderTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <div className="group relative inline-flex items-center gap-1">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`${label} explanation`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-zinc-600 transition-smooth hover:text-zinc-300 focus-visible:outline-none"
      >
        <CircleHelp className="h-3 w-3" />
      </button>
      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-72 -translate-x-1/2 rounded-2xl border border-zinc-700/80 bg-zinc-950/95 px-3 py-2.5 text-left text-[11px] normal-case font-normal tracking-normal leading-relaxed text-zinc-300 shadow-2xl shadow-black/60 whitespace-normal group-hover:block group-focus-within:block">
        {tooltip}
      </div>
    </div>
  );
}

const fmtInt = (v: number) => String(v);
const fmtDec1 = (v: number) => v.toFixed(1);
const fmtDec2 = (v: number) => (v > 0 ? v.toFixed(2) : "—");
const fmtPct1 = (v: number) => v.toFixed(1) + "%";
const fmtRate = (v: number) => (v > 0 ? v.toFixed(3).replace(/^0/, "") : ".000");
const fmtPlus = (v: number) => (v > 0 ? v.toFixed(0) : "—");

const PITCHER_STANDARD: PitcherCol[] = [
  { key: "app",  label: "APP",  fmt: p => fmtInt(p.app) },
  { key: "gs",   label: "GS",   fmt: p => fmtInt(p.gs) },
  { key: "w",    label: "W",    fmt: p => fmtInt(p.w) },
  { key: "l",    label: "L",    lowerBetter: true, fmt: p => fmtInt(p.l) },
  { key: "sv",   label: "SV",   fmt: p => fmtInt(p.sv) },
  { key: "ip",   label: "IP",   fmt: p => fmtDec1(p.ip) },
  { key: "h",    label: "H",    lowerBetter: true, fmt: p => fmtInt(p.h) },
  { key: "r",    label: "R",    lowerBetter: true, fmt: p => fmtInt(p.r) },
  { key: "er",   label: "ER",   lowerBetter: true, fmt: p => fmtInt(p.er) },
  { key: "hr",   label: "HR",   lowerBetter: true, fmt: p => fmtInt(p.hr) },
  { key: "bb",   label: "BB",   lowerBetter: true, fmt: p => fmtInt(p.bb) },
  { key: "hb",   label: "HB",   lowerBetter: true, fmt: p => fmtInt(p.hb) },
  { key: "so",   label: "SO",   fmt: p => fmtInt(p.so) },
  { key: "era",  label: "ERA",  lowerBetter: true, fmt: p => p.era.toFixed(2) },
  { key: "whip", label: "WHIP", lowerBetter: true, fmt: p => p.whip.toFixed(2) },
];

const PITCHER_ADVANCED: PitcherCol[] = [
  { key: "ip",          label: "IP",     fmt: p => fmtDec1(p.ip) },
  { key: "era",         label: "ERA",    lowerBetter: true, fmt: p => p.era.toFixed(2) },
  {
    key: "fip", label: "FIP", lowerBetter: true,
    tooltip: "Fielding Independent Pitching — strips out defense and luck by focusing only on outcomes the pitcher controls: strikeouts, walks, hit batters, and home runs. Scaled to look like ERA. Lower is better.",
    fmt: p => fmtDec2(p.fip),
  },
  {
    key: "xfip", label: "xFIP", lowerBetter: true,
    tooltip: "Expected FIP — same as FIP but replaces actual home runs allowed with an expected HR rate based on fly balls. Reduces noise from home run variance. Lower is better.",
    fmt: p => fmtDec2(p.xfip),
  },
  {
    key: "siera", label: "SIERA", lowerBetter: true,
    tooltip: "Skill-Interactive ERA — the most context-neutral ERA estimator. Accounts for strikeout rate, walk rate, and ground ball tendency. Recognizes that high-strikeout pitchers get more value from ground balls. Lower is better. Note: computed from available counting stats; uses ground outs and fly outs as GB/FB proxy.",
    fmt: p => fmtDec2(p.siera),
  },
  {
    key: "eraPlus", label: "ERA+",
    tooltip: "ERA+ adjusts ERA for park factors and league average, then inverts it so higher is better. 100 = exactly league average. 120 = 20% better than average. 80 = 20% worse.",
    fmt: p => fmtPlus(p.eraPlus),
  },
  { key: "k9",          label: "K/9",    fmt: p => fmtDec1(p.k9) },
  { key: "bb9",         label: "BB/9",   lowerBetter: true, fmt: p => fmtDec1(p.bb9) },
  { key: "h9",          label: "H/9",    lowerBetter: true, fmt: p => fmtDec1(p.h9) },
  { key: "hr9",         label: "HR/9",   lowerBetter: true, fmt: p => fmtDec1(p.hr9) },
  { key: "kPct",        label: "K%",     fmt: p => fmtPct1(p.kPct) },
  { key: "bbPct",       label: "BB%",    lowerBetter: true, fmt: p => fmtPct1(p.bbPct) },
  {
    key: "kMinusBbPct", label: "K-BB%",
    tooltip: "Strikeout rate minus walk rate. One of the strongest single-number predictors of future ERA. Removes luck and defense — if a pitcher misses bats and avoids walks, results tend to follow. Higher is better.",
    fmt: p => fmtPct1(p.kMinusBbPct),
  },
  {
    key: "war", label: "WAR",
    tooltip: "Wins Above Replacement — estimates how many additional wins this pitcher contributed compared to a freely available replacement-level pitcher. Combines all contributions into one number. Higher is better.",
    fmt: p => fmtDec1(p.war),
  },
  {
    key: "babip", label: "BABIP", lowerBetter: true,
    tooltip: "Batting Average on Balls in Play — how often batted balls fall for hits. League average is ~.300. Pitchers have limited control; values far from .300 tend to regress. High BABIP + high ERA = bad luck. Low BABIP + low ERA may not sustain.",
    fmt: p => p.babip > 0 ? p.babip.toFixed(3).replace(/^0/, "") : ".000",
  },
  {
    key: "lobPct", label: "LOB%",
    tooltip: "Left on Base Percentage — share of baserunners a pitcher strands. League average ~72%. High LOB% (>75%) often regresses down; low LOB% (<68%) may improve. Separates ERA from true run prevention skill.",
    fmt: p => p.lobPct > 0 ? p.lobPct.toFixed(1) + "%" : "—",
  },
  {
    key: "gbPct", label: "GB%",
    tooltip: "Ground Ball Percentage — share of batted balls (via ground outs) that are grounders. Higher GB% suppresses HR and extra-base hits. 50%+ is a ground ball pitcher; pairs well with weak infield defense.",
    fmt: p => p.gbPct > 0 ? p.gbPct.toFixed(1) + "%" : "—",
  },
  {
    key: "fbPct", label: "FB%", lowerBetter: true,
    tooltip: "Fly Ball Percentage — share of batted balls that are fly balls. High FB% pitchers are more home run vulnerable. Pairs with HR/FB% to assess HR risk.",
    fmt: p => p.fbPct > 0 ? p.fbPct.toFixed(1) + "%" : "—",
  },
  {
    key: "hrFbPct", label: "HR/FB%", lowerBetter: true,
    tooltip: "Home Run to Fly Ball rate — what percent of fly balls leave the park. League average ~10-12%. Pitchers have limited control over this; extreme values tend to regress toward the mean.",
    fmt: p => p.hrFbPct > 0 ? p.hrFbPct.toFixed(1) + "%" : "—",
  },
  {
    key: "soBb", label: "SO/BB",
    tooltip: "Strikeout-to-Walk ratio — one of the simplest indicators of pitcher dominance and control. Above 3.0 is solid; above 4.0 is elite. Measures ability to miss bats without losing the zone.",
    fmt: p => p.soBb > 0 ? p.soBb.toFixed(2) : "—",
  },
];

const HITTER_STANDARD: HitterCol[] = [
  { key: "gp",      label: "GP",   fmt: h => fmtInt(h.gp) },
  { key: "gs",      label: "GS",   fmt: h => fmtInt(h.gs) },
  { key: "pa",      label: "PA",   fmt: h => fmtInt(h.pa) },
  { key: "ab",      label: "AB",   fmt: h => fmtInt(h.ab) },
  { key: "h",       label: "H",    fmt: h => fmtInt(h.h) },
  { key: "doubles", label: "2B",   fmt: h => fmtInt(h.doubles) },
  { key: "triples", label: "3B",   fmt: h => fmtInt(h.triples) },
  { key: "hr",      label: "HR",   fmt: h => fmtInt(h.hr) },
  { key: "rbi",     label: "RBI",  fmt: h => fmtInt(h.rbi) },
  { key: "r",       label: "R",    fmt: h => fmtInt(h.r) },
  { key: "sb",      label: "SB",   fmt: h => fmtInt(h.sb) },
  { key: "bb",      label: "BB",   fmt: h => fmtInt(h.bb) },
  { key: "so",      label: "SO",   lowerBetter: true, fmt: h => fmtInt(h.so) },
  { key: "avg",     label: "AVG",  fmt: h => fmtRate(h.avg) },
  { key: "obp",     label: "OBP",  fmt: h => fmtRate(h.obp) },
  { key: "slg",     label: "SLG",  fmt: h => fmtRate(h.slg) },
  { key: "ops",     label: "OPS",  fmt: h => fmtRate(h.ops) },
];

const HITTER_ADVANCED: HitterCol[] = [
  { key: "pa",    label: "PA",  fmt: h => fmtInt(h.pa) },
  { key: "avg",   label: "AVG", fmt: h => fmtRate(h.avg) },
  {
    key: "obp", label: "OBP",
    tooltip: "On-Base Percentage — how often a hitter reaches base via hit, walk, or hit by pitch. A better indicator of offensive value than batting average because it captures walks.",
    fmt: h => fmtRate(h.obp),
  },
  {
    key: "slg", label: "SLG",
    tooltip: "Slugging Percentage — total bases divided by at-bats. Weights extra-base hits by rewarding doubles, triples, and home runs more than singles. Measures raw power production.",
    fmt: h => fmtRate(h.slg),
  },
  {
    key: "ops", label: "OPS",
    tooltip: "On-Base Plus Slugging — adds OBP and SLG into a single number. Correlates well with run production. League average is typically around .750. Above .900 is elite.",
    fmt: h => fmtRate(h.ops),
  },
  { key: "bbPct", label: "BB%", fmt: h => fmtPct1(h.bbPct) },
  { key: "kPct",  label: "K%",  lowerBetter: true, fmt: h => fmtPct1(h.kPct) },
  {
    key: "wrcPlus", label: "wRC+",
    tooltip: "Weighted Runs Created Plus — measures total offensive value (hits, walks, extra bases, etc.) adjusted for park and league. 100 = league average. 130 = 30% above average. Context-neutral and the best single offensive stat.",
    fmt: h => h.wrcPlus > 0 ? h.wrcPlus.toFixed(0) : "—",
  },
  {
    key: "war", label: "WAR",
    tooltip: "Wins Above Replacement — estimates how many wins this hitter contributed above a freely available replacement-level player. Combines batting, baserunning, and positional value. Higher is better.",
    fmt: h => fmtDec1(h.war),
  },
  {
    key: "iso", label: "ISO",
    tooltip: "Isolated Power — Slugging minus Batting Average. Strips out singles to measure pure extra-base power. .150 is average, .200+ is above average, .250+ is elite.",
    fmt: h => h.iso > 0 ? h.iso.toFixed(3).replace(/^0/, "") : ".000",
  },
  {
    key: "babip", label: "BABIP",
    tooltip: "Batting Average on Balls in Play — how often a hitter's batted balls fall for hits. League average ~.300. High BABIP hitters are often fast or hard-hitting; extreme values tend to regress toward the mean.",
    fmt: h => h.babip > 0 ? h.babip.toFixed(3).replace(/^0/, "") : ".000",
  },
  {
    key: "bbk", label: "BB/K",
    tooltip: "Walk-to-Strikeout ratio — plate discipline in one number. Above 1.0 means more walks than strikeouts. Elite hitters are often above 0.5; below 0.3 signals poor plate discipline.",
    fmt: h => h.bbk > 0 ? h.bbk.toFixed(2) : "—",
  },
  {
    key: "sbPct", label: "SB%",
    tooltip: "Stolen Base Success Rate — percentage of steal attempts that succeed. Below 70% is generally a net negative on run expectancy; above 80% adds real value.",
    fmt: h => (h.sbPct > 0 || (h.sb ?? 0) + (h.cs ?? 0) > 0) ? h.sbPct.toFixed(1) + "%" : "—",
  },
];

function rankColor(i: number): string {
  const glow = "[text-shadow:0_0_8px_currentColor]";
  if (i === 0) return `text-amber-400 ${glow}`;
  if (i === 1) return `text-zinc-400 ${glow}`;
  if (i === 2) return `text-amber-600 ${glow}`;
  return "text-zinc-500";
}

const DEFAULT_MIN_IP = 1;
const DEFAULT_MIN_PA = 1;

export default function TeamStatsPage() {
  const [statMode, setStatMode] = useState<StatMode>("pitching");
  const [statSection, setStatSection] = useState<StatSection>("standard");
  const [pitchers, setPitchers] = useState<BabsonPitcherRow[]>([]);
  const [hitters, setHitters] = useState<BabsonHitterRow[]>([]);
  const [seasonYear, setSeasonYear] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pitcherSortKey, setPitcherSortKey] = useState<PitcherSortKey>("ip");
  const [hitterSortKey, setHitterSortKey] = useState<HitterSortKey>("ops");
  const [pitcherSortDesc, setPitcherSortDesc] = useState(true);
  const [hitterSortDesc, setHitterSortDesc] = useState(true);
  const [minIp, setMinIp] = useState(DEFAULT_MIN_IP);
  const [minPa, setMinPa] = useState(DEFAULT_MIN_PA);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const { slug: selectedSlug } = useSelectedPlayer();

  const activePitcherCols = statSection === "standard" ? PITCHER_STANDARD : PITCHER_ADVANCED;
  const activeHitterCols = statSection === "standard" ? HITTER_STANDARD : HITTER_ADVANCED;

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/team-stats?statType=${statMode}&minIp=1`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setPitchers(data.pitchers ?? []);
        setHitters(data.hitters ?? []);
        setSeasonYear(typeof data.year === "string" ? data.year : null);
        if (data.meta?.synced_at) {
          setSyncedAt(data.meta.synced_at as string);
          const results = data.meta.results as Record<string, { stale: boolean }> | undefined;
          const anyStale = results ? Object.values(results).some((r) => r.stale) : false;
          setIsStale(anyStale);
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [statMode]);

  const filteredPitchers = useMemo(() => {
    if (!search.trim()) return pitchers;
    const q = search.toLowerCase();
    return pitchers.filter((p) => p.playerName.toLowerCase().includes(q));
  }, [pitchers, search]);

  const filteredHitters = useMemo(() => {
    if (!search.trim()) return hitters;
    const q = search.toLowerCase();
    return hitters.filter((h) => h.playerName.toLowerCase().includes(q));
  }, [hitters, search]);

  const sortedPitchers = useMemo(() => {
    const col = activePitcherCols.find((c) => c.key === pitcherSortKey);
    const desc = col?.lowerBetter !== undefined ? !col.lowerBetter === pitcherSortDesc : pitcherSortDesc;
    return [...filteredPitchers].sort((a, b) => {
      const aQ = a.ip >= minIp ? 1 : 0;
      const bQ = b.ip >= minIp ? 1 : 0;
      if (aQ !== bQ) return bQ - aQ;
      const av = a[pitcherSortKey] as number;
      const bv = b[pitcherSortKey] as number;
      return desc ? bv - av : av - bv;
    });
  }, [filteredPitchers, pitcherSortKey, pitcherSortDesc, minIp, activePitcherCols]);

  const sortedHitters = useMemo(() => {
    const col = activeHitterCols.find((c) => c.key === hitterSortKey);
    const desc = col?.lowerBetter !== undefined ? !col.lowerBetter === hitterSortDesc : hitterSortDesc;
    return [...filteredHitters].sort((a, b) => {
      const aQ = a.pa >= minPa ? 1 : 0;
      const bQ = b.pa >= minPa ? 1 : 0;
      if (aQ !== bQ) return bQ - aQ;
      const av = a[hitterSortKey] as number;
      const bv = b[hitterSortKey] as number;
      return desc ? bv - av : av - bv;
    });
  }, [filteredHitters, hitterSortKey, hitterSortDesc, minPa, activeHitterCols]);

  const handlePitcherSort = useCallback((key: PitcherSortKey) => {
    setPitcherSortKey(key);
    setPitcherSortDesc((prev) => {
      if (pitcherSortKey === key) return !prev;
      const col = activePitcherCols.find((c) => c.key === key);
      return col?.lowerBetter !== true;
    });
  }, [pitcherSortKey, activePitcherCols]);

  const handleHitterSort = useCallback((key: HitterSortKey) => {
    setHitterSortKey(key);
    setHitterSortDesc((prev) => {
      if (hitterSortKey === key) return !prev;
      const col = activeHitterCols.find((c) => c.key === key);
      return col?.lowerBetter !== true;
    });
  }, [hitterSortKey, activeHitterCols]);

  const activeCols = statMode === "pitching" ? activePitcherCols : activeHitterCols;
  const totalCols = activeCols.length + 2; // rank + player name

  return (
    <LeaderboardPageFrame maxWidth="max-w-7xl">
      <LeaderboardIntro
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Leaderboards", href: "/leaderboards-hub" },
          { label: "Statistics" },
        ]}
      >
        <LeaderboardHero
          tone="sky"
          icon={BarChart3}
          eyebrow="Statistics"
          title={<>Statistics Leaderboard</>}
          meta={(
            <>
              <LeaderboardPill tone="sky">
                {seasonYear ? `${seasonYear} season` : "Season stats"}
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {statMode === "pitching" ? `${minIp}+ IP qualifies` : `${minPa}+ PA qualifies`}
              </LeaderboardPill>
              {syncedAt && (
                <LeaderboardPill tone={isStale ? "amber" : "neutral"}>
                  {isStale ? "Stale — " : "Synced "}
                  {new Date(syncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </LeaderboardPill>
              )}
              <LeaderboardPill tone="neutral">NCAA D3</LeaderboardPill>
            </>
          )}
          side={(
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Guide</div>
              <Link
                href="/team-stats/faq"
                className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3.5 text-sm font-semibold text-sky-300 transition-smooth hover:border-sky-400/40 hover:text-sky-200"
              >
                <BookOpen className="h-4 w-4" />
                Metrics Dictionary
              </Link>
            </div>
          )}
        />
      </LeaderboardIntro>

      <LeaderboardToolbar>
        <div className="grid gap-4 xl:grid-cols-[minmax(13rem,16rem)_minmax(13rem,16rem)_minmax(12rem,14rem)_minmax(0,1fr)_auto] xl:items-end">

          {/* Pitchers / Hitters */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">View</div>
            <div className="inline-flex rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
              {(["pitching", "batting"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setStatMode(mode)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-smooth ${
                    statMode === mode ? "bg-sky-500/15 text-sky-200" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {mode === "pitching" ? "Pitchers" : "Hitters"}
                </button>
              ))}
            </div>
          </div>

          {/* Standard / Advanced */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Stats</div>
            <div className="inline-flex rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
              {(["standard", "advanced"] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setStatSection(sec)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-smooth ${
                    statSection === sec ? "bg-violet-500/15 text-violet-200" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {sec === "standard" ? "Standard" : "Advanced"}
                </button>
              ))}
            </div>
          </div>

          {/* Qualification Floor */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Qualification Floor</div>
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
              {statMode === "pitching" ? (
                <select
                  value={minIp}
                  onChange={(e) => setMinIp(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                >
                  {TEAM_STATS_PITCHER_QUALIFICATION_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} IP</option>
                  ))}
                </select>
              ) : (
                <select
                  value={minPa}
                  onChange={(e) => setMinPa(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2.5 text-sm font-semibold text-zinc-100 outline-none"
                >
                  {TEAM_STATS_HITTER_QUALIFICATION_OPTIONS.map((n) => (
                    <option key={n} value={n}>{n} PA</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Search</div>
            <label className="flex items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                type="text"
                placeholder={statMode === "pitching" ? "Search pitcher..." : "Search hitter..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {search.trim() ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/70 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </LeaderboardToolbar>

      {loading ? (
        <LeaderboardPanel className="mt-6 p-10 text-center text-zinc-500">
          Loading statistics...
        </LeaderboardPanel>
      ) : error ? (
        <div className="mt-6 rounded-3xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-rose-200">
          {error}
        </div>
      ) : (
        <LeaderboardPanel className="mt-6 overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Player</th>
                  {statMode === "pitching"
                    ? activePitcherCols.map(({ key, label, tooltip }) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-sky-300 transition-smooth whitespace-nowrap"
                          onClick={() => handlePitcherSort(key)}
                        >
                          <span className="inline-flex items-center justify-end gap-0.5">
                            {tooltip ? <HeaderTooltip label={label} tooltip={tooltip} /> : label}
                            {pitcherSortKey === key ? (
                              <span className="ml-1 text-sky-300">{pitcherSortDesc ? "▼" : "▲"}</span>
                            ) : null}
                          </span>
                        </th>
                      ))
                    : activeHitterCols.map(({ key, label, tooltip }) => (
                        <th
                          key={key}
                          className="px-4 py-3 text-right text-[11px] font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-sky-300 transition-smooth whitespace-nowrap"
                          onClick={() => handleHitterSort(key)}
                        >
                          <span className="inline-flex items-center justify-end gap-0.5">
                            {tooltip ? <HeaderTooltip label={label} tooltip={tooltip} /> : label}
                            {hitterSortKey === key ? (
                              <span className="ml-1 text-sky-300">{hitterSortDesc ? "▼" : "▲"}</span>
                            ) : null}
                          </span>
                        </th>
                      ))}
                </tr>
              </thead>
              <tbody>
                {(statMode === "pitching" ? sortedPitchers.length : sortedHitters.length) === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-zinc-500">
                          {statMode === "pitching" ? "No pitchers match your search." : "No hitters match your search."}
                        </span>
                        {search.trim() ? (
                          <button
                            type="button"
                            onClick={() => setSearch("")}
                            className="text-sm font-medium text-sky-300 hover:text-sky-200 transition-smooth"
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ) : null}
                {statMode === "pitching"
                  ? sortedPitchers.map((p, i) => {
                      const isQualified = p.ip >= minIp;
                      const isMe = p.slug === selectedSlug;
                      return (
                        <tr
                          key={p.playerId}
                          className={`border-b border-zinc-800/50 transition-smooth ${isMe ? "bg-emerald-500/5" : ""} ${isQualified ? "hover:bg-sky-500/5" : "opacity-60 hover:opacity-75"}`}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${isQualified ? rankColor(i) : "text-zinc-500"}`}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={isQualified ? "font-medium" : "font-medium text-zinc-400"}>
                                {p.slug ? (
                                  <Link
                                    href={`/players/${p.slug}`}
                                    className={`transition-smooth underline decoration-sky-500/30 underline-offset-2 hover:decoration-sky-400 ${isQualified ? "text-sky-300 hover:text-sky-200" : "text-zinc-400 hover:text-zinc-300"}`}
                                  >
                                    {p.playerName}
                                    {isMe ? <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 no-underline">You</span> : null}
                                  </Link>
                                ) : (
                                  p.playerName
                                )}
                              </span>
                              {!isQualified ? (
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                  Unqualified
                                </span>
                              ) : null}
                            </div>
                          </td>
                          {activePitcherCols.map((col) => (
                            <td key={col.key} className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>
                              {col.fmt(p)}
                            </td>
                          ))}
                        </tr>
                      );
                    })
                  : sortedHitters.map((h, i) => {
                      const isQualified = h.pa >= minPa;
                      const isMe = h.slug === selectedSlug;
                      return (
                        <tr
                          key={h.playerId}
                          className={`border-b border-zinc-800/50 transition-smooth ${isMe ? "bg-emerald-500/5" : ""} ${isQualified ? "hover:bg-sky-500/5" : "opacity-60 hover:opacity-75"}`}
                        >
                          <td className={`px-4 py-3 font-mono text-xs font-semibold ${isQualified ? rankColor(i) : "text-zinc-500"}`}>
                            {i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className={isQualified ? "font-medium" : "font-medium text-zinc-400"}>
                                {h.slug ? (
                                  <Link
                                    href={`/players/${h.slug}`}
                                    className={`transition-smooth underline decoration-sky-500/30 underline-offset-2 hover:decoration-sky-400 ${isQualified ? "text-sky-300 hover:text-sky-200" : "text-zinc-400 hover:text-zinc-300"}`}
                                  >
                                    {h.playerName}
                                    {isMe ? <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400 no-underline">You</span> : null}
                                  </Link>
                                ) : (
                                  h.playerName
                                )}
                              </span>
                              {!isQualified ? (
                                <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-400">
                                  Unqualified
                                </span>
                              ) : null}
                            </div>
                          </td>
                          {activeHitterCols.map((col) => (
                            <td key={col.key} className={`px-4 py-3 text-right font-mono ${!isQualified ? "text-zinc-500" : ""}`}>
                              {col.fmt(h)}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>
        </LeaderboardPanel>
      )}
    </LeaderboardPageFrame>
  );
}
