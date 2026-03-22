import Link from "next/link";
import { notFound } from "next/navigation";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import { cache } from "react";
import path from "path";
import { promises as fs } from "fs";
import { and, eq, ne } from "drizzle-orm";
import rosterData from "@/data/roster.json";
import { db } from "@/db";
import { stuffPlusArsenal } from "@/db/schema";
import { fetchBattingLeaderboard, fetchNcaaStatsMeta, fetchPitchingLeaderboard } from "@/lib/collegeStats";
import { getHand } from "@/lib/canonicalPlayers";
import {
  buildCommandPlusBaselines,
  computeCommandPlus,
  type CommandPlusResult,
} from "@/lib/commandPlus";
import { players as dataIndexPlayers } from "@/lib/dataIndex";
import { readMechanicsIndex, getMechanicsForPlayer } from "@/lib/mechanics/registry";
import { parsePitchCsvText } from "@/lib/pitchCsv";
import {
  computePitchingPlus,
  type PitchingPlusResult,
} from "@/lib/pitchingPlus";
import { getPlayerBySlug, type PlayerRegistryEntry } from "@/lib/playerRegistry";
import { seasonFromDateId } from "@/lib/season";
import { buildStuffPlusLookupCandidates } from "@/lib/stuffPlusLookup";
import {
  ArrowLeft,
  ChevronDown,
  Download,
  ScanLine,
} from "lucide-react";
import PlayerProfileTabs from "./PlayerProfileTabs";
import { loadChartingPlayerProfile } from "@/lib/charting/playerProfile";
import { computeTotalStuffPlus } from "@/lib/stuffPlusUtils";
import {
  type PercentileMetric,
  PITCHING_SNAPSHOT_METRICS,
  PITCHING_PERCENTILE_METRICS,
  BATTING_SNAPSHOT_METRICS,
  BATTING_PERCENTILE_METRICS,
  extractRows,
  buildSeasonStats,
  buildSeasonPercentiles,
} from "./_lib/metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LeaderboardRow = Record<string, unknown>;

type TrackmanIndexEntry = {
  playerSlug?: string;
  date?: string;
  sessionType?: string | null;
};

type StuffPlusProfilePitch = {
  pitchType: string;
  meanStuffPlus: number | null;
  nSessions: number | null;
};

type StuffPlusProfileData = {
  lookupPlayerId: string | null;
  pitches: StuffPlusProfilePitch[];
};

type CommandHeroSummary = {
  playerId: string;
  score: number | null;
  season: number | null;
  outingCount: number;
  pitchCount: number;
};

type PitchingProfileModel = {
  ready: boolean;
  overall: number | null;
  note: string;
  result: PitchingPlusResult | null;
};

type ProfileMode = "pitcher" | "hitter" | "two-way";
type OverviewMode = "pitching" | "hitting";
type OverviewStats = {
  seasonStats: { label: string; value: string }[];
  seasonPercentiles: PercentileMetric[];
  percentileAudienceLabel: string;
  statsUnavailable: boolean;
  hasRow: boolean;
};

const TARGET_YEAR = 2026;
const plusJakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });
const manrope = Manrope({ subsets: ["latin"] });

const loadTrackmanIndex = cache(async (): Promise<TrackmanIndexEntry[]> => {
  try {
    const filePath = path.join(process.cwd(), "public", "trackman", "index.json");
    const raw = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(raw) as TrackmanIndexEntry[];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
});

async function loadStuffPlusProfileData(
  candidates: string[],
): Promise<StuffPlusProfileData> {
  for (const candidate of candidates) {
    try {
      const rows = await db
        .select()
        .from(stuffPlusArsenal)
        .where(
          and(
            eq(stuffPlusArsenal.playerId, candidate),
            ne(stuffPlusArsenal.pitchType, "Other"),
          ),
        );

      if (rows.length === 0) continue;

      return {
        lookupPlayerId: candidate,
        pitches: rows.map((row) => ({
          pitchType: row.pitchType,
          meanStuffPlus: row.meanStuffPlus,
          nSessions: row.nSessions,
        })),
      };
    } catch (error) {
      console.error("[PlayerProfile] stuff+ load failed:", candidate, error);
    }
  }

  return {
    lookupPlayerId: candidates[0] ?? null,
    pitches: [],
  };
}

const loadPublicPitchCsv = cache(async (publicPath: string) => {
  try {
    const relativePath = publicPath.replace(/^\/+/, "");
    const filePath = path.join(process.cwd(), "public", relativePath);
    const raw = await fs.readFile(filePath, "utf-8");
    return parsePitchCsvText(raw);
  } catch (error) {
    console.error("[PlayerProfile] command csv load failed:", publicPath, error);
    return [];
  }
});

const loadSeasonCommandBaselines = cache(async (season: number) => {
  const seasonCsvPaths = dataIndexPlayers.flatMap((player) =>
    player.outings
      .filter((outing) => {
        const dateId = outing.id.split("/")[1] ?? "";
        return seasonFromDateId(dateId) === season;
      })
      .map((outing) => outing.csvPath),
  );

  const arrays = await Promise.all(seasonCsvPaths.map((csvPath) => loadPublicPitchCsv(csvPath)));
  return buildCommandPlusBaselines(arrays.flat());
});

function getExternalPlayerIds(player: PlayerRegistryEntry): string[] {
  return [player.ncaa_player_id, player.d3_player_id]
    .filter((value): value is string => value != null && value !== "")
    .map(String);
}

function normalizePlayerName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getInitials(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function StatRow({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#F1F5F9] px-4 py-3 last:border-b-0">
      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
        {label}
      </span>
      <span
        className={`text-[15px] font-bold tracking-tight ${accent ? "text-[#4F46E5]" : "text-[#0F172A]"}`}
      >
        {value}
      </span>
    </div>
  );
}

type GradeToneKey = "pitching" | "command" | "stuff";

const GRADE_TILE_STYLES: Record<
  GradeToneKey,
  {
    border: string;
    canvas: string;
    accent: string;
    label: string;
    icon: string;
    scoreWrap: string;
    scoreText: string;
  }
> = {
  pitching: {
    border: "border-[#F8D06B]",
    canvas:
      "bg-[radial-gradient(circle_at_top_left,rgba(254,240,138,0.22),transparent_36%),linear-gradient(135deg,rgba(255,249,235,0.92),rgba(255,255,255,0.98)_60%,rgba(254,240,138,0.12))]",
    accent: "bg-[#FFB300]",
    label: "text-[#B45309]",
    icon: "text-[#64748B]",
    scoreWrap:
      "border-[#FDBA74] bg-[linear-gradient(180deg,#FFB45E_0%,#FFA24B_100%)] shadow-[0_22px_42px_rgba(251,146,60,0.24)]",
    scoreText: "text-white",
  },
  command: {
    border: "border-[#FDBA74]",
    canvas:
      "bg-[radial-gradient(circle_at_top_left,rgba(254,215,170,0.22),transparent_34%),linear-gradient(135deg,rgba(255,247,237,0.95),rgba(255,255,255,0.98)_62%,rgba(255,237,213,0.18))]",
    accent: "bg-[#F97316]",
    label: "text-[#C2410C]",
    icon: "text-[#64748B]",
    scoreWrap:
      "border-[#FB7185] bg-[linear-gradient(180deg,#FB7185_0%,#FB7185_12%,#FB7185_100%)] shadow-[0_22px_42px_rgba(244,114,182,0.22)]",
    scoreText: "text-white",
  },
  stuff: {
    border: "border-[#BFDBFE]",
    canvas:
      "bg-[radial-gradient(circle_at_top_left,rgba(191,219,254,0.28),transparent_34%),linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.99)_62%,rgba(219,234,254,0.18))]",
    accent: "bg-[#60A5FA]",
    label: "text-[#1D4ED8]",
    icon: "text-[#64748B]",
    scoreWrap:
      "border-[#94A3B8] bg-[linear-gradient(180deg,#64748B_0%,#76859A_100%)] shadow-[0_22px_42px_rgba(100,116,139,0.20)]",
    scoreText: "text-white",
  },
};

function PlusGradeTile({
  label,
  value,
  note,
  tone,
  compact = false,
  className = "",
}: {
  label: string;
  value: string;
  note: string;
  tone: GradeToneKey;
  compact?: boolean;
  className?: string;
}) {
  const toneStyle = GRADE_TILE_STYLES[tone];

  return (
    <div
      className={`relative overflow-hidden rounded-[34px] border ${toneStyle.border} ${toneStyle.canvas} p-6 shadow-[0_26px_56px_rgba(15,23,42,0.05)] sm:p-8 ${className}`}
    >
      <div className={`absolute left-0 top-8 w-1.5 rounded-r-full ${toneStyle.accent} ${compact ? "h-24" : "h-32"}`} />
      <div className={`relative ${compact ? "space-y-10" : "flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-12"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-4">
            <p className={`${plusJakarta.className} text-[13px] font-extrabold uppercase tracking-[0.28em] ${toneStyle.label}`}>
              {label}
            </p>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/70 bg-white/75 shadow-[0_12px_24px_rgba(148,163,184,0.14)] backdrop-blur">
              <ChevronDown className={`h-5 w-5 ${toneStyle.icon}`} />
            </span>
          </div>
          <p className="mt-6 max-w-2xl text-[17px] leading-8 text-[#64748B]">{note}</p>
        </div>
        <div
          className={`flex h-[120px] w-[160px] shrink-0 items-center justify-center rounded-[30px] border ${toneStyle.scoreWrap} sm:h-[150px] sm:w-[200px]`}
        >
          <span className={`${plusJakarta.className} text-[56px] font-extrabold tracking-tight drop-shadow-[0_2px_4px_rgba(15,23,42,0.16)] sm:text-[74px] ${toneStyle.scoreText}`}>
            {value}
          </span>
        </div>
      </div>
    </div>
  );
}

function PercentileStrip({
  label,
  value,
  percentile,
  note,
}: {
  label: string;
  value: string;
  percentile: number | null;
  note: string;
}) {
  const safePercentile = percentile == null ? 0 : Math.max(6, Math.min(100, percentile));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">
          {label}
        </span>
        <span className="text-sm font-bold text-[#0F172A]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E2E8F0]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#6366F1,#A5B4FC)]"
          style={{ width: `${safePercentile}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
        <span>{note}</span>
        <span>{percentile == null ? "--" : `${Math.round(percentile)}th percentile`}</span>
      </div>
    </div>
  );
}

function CoverageStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[20px] border border-[#E2E8F0] bg-white p-4 shadow-[0_14px_30px_rgba(15,23,42,0.03)]">
      <div className={`${plusJakarta.className} text-[24px] font-extrabold tracking-tight text-[#0F172A]`}>
        {value}
      </div>
      <p className="mt-1 text-[12px] leading-5 text-[#64748B]">{label}</p>
    </div>
  );
}

function SeasonStatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-[152px] flex-col justify-between rounded-[28px] border border-[#E2E8F0] bg-white p-6 shadow-[0_16px_34px_rgba(15,23,42,0.03)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
        {label}
      </p>
      <div className={`${plusJakarta.className} mt-6 text-[2.45rem] font-extrabold tracking-tight text-[#0F172A] sm:text-[2.7rem]`}>
        {value}
      </div>
    </div>
  );
}

function resolveProfileMode(player: PlayerRegistryEntry): ProfileMode {
  if (player.isTwoWay) {
    return "two-way";
  }
  return player.isPitcher ? "pitcher" : "hitter";
}

function findLeaderboardRow(
  leaderboardRows: LeaderboardRow[],
  player: PlayerRegistryEntry,
): LeaderboardRow | null {
  const externalIds = getExternalPlayerIds(player);
  if (externalIds.length > 0) {
    for (const playerId of externalIds) {
      const byId = leaderboardRows.find((row) => String(row.player_id ?? "") === playerId);
      if (byId) {
        return byId;
      }
    }
  }

  const normalizedName = normalizePlayerName(player.name);
  return (
    leaderboardRows.find((row) => {
      const rowName = normalizePlayerName(String(row.player_name ?? row.name ?? ""));
      const rowTeam = normalizePlayerName(String(row.team_name ?? row.team ?? ""));
      return rowName === normalizedName && (!rowTeam || rowTeam === "babson");
    }) ?? null
  );
}

export default async function PlayerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const player = getPlayerBySlug(slug);

  if (!player) {
    notFound();
  }
  const resolvedPlayer = player;

  const profileMode = resolveProfileMode(resolvedPlayer);
  const defaultOverviewMode: OverviewMode = profileMode === "hitter" ? "hitting" : "pitching";

  async function loadOverviewStats(mode: OverviewMode): Promise<OverviewStats> {
    let leaderboardRows: LeaderboardRow[] = [];
    let fetchError: string | null = null;

    try {
      const data =
        mode === "pitching"
          ? await fetchPitchingLeaderboard(String(TARGET_YEAR), 3)
          : await fetchBattingLeaderboard(String(TARGET_YEAR), 3);
      leaderboardRows = Array.isArray(data) ? data : extractRows(data);
    } catch (err) {
      fetchError = String(err);
      console.error("[PlayerProfile] leaderboard fetch failed:", resolvedPlayer.name, mode, fetchError);
    }

    const playerRow = findLeaderboardRow(leaderboardRows, resolvedPlayer);
    const snapshotMetrics =
      mode === "pitching" ? PITCHING_SNAPSHOT_METRICS : BATTING_SNAPSHOT_METRICS;
    const percentileMetrics =
      mode === "pitching" ? PITCHING_PERCENTILE_METRICS : BATTING_PERCENTILE_METRICS;

    const seasonStats = playerRow ? buildSeasonStats(snapshotMetrics, playerRow) : [];
    const seasonPercentiles = playerRow
      ? buildSeasonPercentiles(percentileMetrics, leaderboardRows, playerRow, playerRow)
      : [];

    const debugInfo = {
      foundRow: Boolean(playerRow),
      playerId: getExternalPlayerIds(resolvedPlayer)[0] ?? "Unresolved",
      leaderboardCount: leaderboardRows.length,
      sourceUsed: playerRow ? mode : "none",
      error: fetchError,
    };

    console.log("[PlayerProfile]", resolvedPlayer.name, mode, debugInfo);

    return {
      seasonStats,
      seasonPercentiles,
      percentileAudienceLabel: mode === "pitching" ? "pitchers" : "hitters",
      statsUnavailable: !playerRow && fetchError != null,
      hasRow: Boolean(playerRow),
    };
  }

  const [pitchingOverview, hittingOverview] = await Promise.all([
    loadOverviewStats("pitching"),
    loadOverviewStats("hitting"),
  ]);

  const activeOverview =
    defaultOverviewMode === "pitching" ? pitchingOverview : hittingOverview;

  const roleLabel = resolvedPlayer.role;
  const seasonNote = undefined;
  const ncaaMeta = await fetchNcaaStatsMeta();
  const ncaaProvenance: { label: string; tone: "amber" | "neutral" } | undefined = ncaaMeta
    ? (() => {
        const anyStale = Object.values(ncaaMeta.results).some((r) => r.stale);
        const date = new Date(ncaaMeta.synced_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        return {
          label: anyStale ? `Stale — ${date}` : `Synced ${date}`,
          tone: (anyStale ? "amber" : "neutral") as "amber" | "neutral",
        };
      })()
    : undefined;
  const roster = rosterData as Record<string, { height?: string; weight?: string; class?: string }>;
  const rosterInfo = roster[resolvedPlayer.slug];
  const throwHand =
    getHand(resolvedPlayer.slug) ??
    (resolvedPlayer.throws === "R" || resolvedPlayer.throws === "L" ? resolvedPlayer.throws : null);
  const handBadge =
    resolvedPlayer.bats && resolvedPlayer.throws
      ? `${resolvedPlayer.bats}/${resolvedPlayer.throws}`
      : throwHand
        ? resolvedPlayer.isPitcher && !resolvedPlayer.isHitter
          ? throwHand === "R"
            ? "RHP"
            : "LHP"
          : `T ${throwHand}`
        : null;
  const liveAbProfile = await loadChartingPlayerProfile(resolvedPlayer.slug, {
    batterHand:
      resolvedPlayer.bats === "R" || resolvedPlayer.bats === "L" || resolvedPlayer.bats === "S"
        ? resolvedPlayer.bats
        : null,
  });

  const mechanicsIndex = await readMechanicsIndex();
  const mechanicsEntry = getMechanicsForPlayer(mechanicsIndex, {
    profileSlug: resolvedPlayer.slug,
    playerName: resolvedPlayer.name,
  });

  const trackmanIndex = await loadTrackmanIndex();
  const trackmanSessions = trackmanIndex
    .filter((entry) => entry.playerSlug === resolvedPlayer.slug && entry.date)
    .map((entry) => {
      const date = entry.date ?? "";
      const dateSlug = date.replace(/-/g, "_");
      const rawLabel = entry.sessionType ?? "Session";
      const sessionLabel = rawLabel
        .split(/[_-]/g)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      return {
        date,
        dateSlug,
        sessionLabel: sessionLabel || "Session",
      };
    });

  // Command outings from dataIndex — match by normalized name
  const normName = (n: string) => n.toLowerCase().replace(/[^a-z]/g, "");
  const diPlayer = dataIndexPlayers.find(
    (p) => normName(p.name) === normName(resolvedPlayer.name),
  );
  const commandOutings = (diPlayer?.outings ?? []).map((o) => {
    const dateId = o.id.split("/")[1] ?? "";
    return {
      outingId: o.id,
      playerId: diPlayer!.id,
      dateId,
      label: o.label,
      csvPath: o.csvPath,
    };
  });
  const stuffPlusCandidates = buildStuffPlusLookupCandidates([
    resolvedPlayer.slug,
    diPlayer?.id ?? null,
  ]);
  const initialStuff = await loadStuffPlusProfileData(stuffPlusCandidates);
  const latestCommandSeason =
    commandOutings
      .map((outing) => seasonFromDateId(outing.dateId))
      .filter((season): season is number => season != null)
      .sort((a, b) => b - a)[0] ?? null;

  let initialCommandHero: CommandHeroSummary | null = null;
  let initialCommandResult: CommandPlusResult | null = null;
  let initialPitchingModel: PitchingProfileModel = {
    ready: false,
    overall: null,
    note: commandOutings.length > 0 ? "Missing live command variable" : "No live command outings yet",
    result: null,
  };

  if (diPlayer?.id && latestCommandSeason != null) {
    const latestSeasonOutings = commandOutings.filter(
      (outing) => seasonFromDateId(outing.dateId) === latestCommandSeason,
    );
    const latestSeasonPitchArrays = await Promise.all(
      latestSeasonOutings.map((outing) => loadPublicPitchCsv(outing.csvPath)),
    );
    const latestSeasonPitches = latestSeasonPitchArrays.flat();
    const latestSeasonBaselines = await loadSeasonCommandBaselines(latestCommandSeason);
    const commandResult = computeCommandPlus(latestSeasonPitches, latestSeasonBaselines);
    initialCommandResult = commandResult;
    const measuredPitchCount = commandResult.pitchTypeScores.reduce(
      (sum, row) => sum + row.subjectCount,
      0,
    );

    initialCommandHero = {
      playerId: diPlayer.id,
      score: commandResult.overall,
      season: latestCommandSeason,
      outingCount: latestSeasonOutings.length,
      pitchCount: measuredPitchCount,
    };

    const pitchingResult = computePitchingPlus(
      initialStuff.lookupPlayerId ?? resolvedPlayer.slug,
      commandResult,
      initialStuff.pitches,
    );

    if (!pitchingResult.ready || pitchingResult.overall == null) {
      initialPitchingModel = {
        ready: false,
        overall: null,
        note:
          pitchingResult.reason === "missing_live_command"
            ? "Missing live command variable"
            : pitchingResult.reason === "missing_stuff"
              ? "Missing Stuff+ variable"
              : "No clean pitch overlap yet",
        result: pitchingResult,
      };
    } else {
      initialPitchingModel = {
        ready: true,
        overall: pitchingResult.overall,
        note: `${pitchingResult.overlapPitchTypeCount} pitch type${pitchingResult.overlapPitchTypeCount === 1 ? "" : "s"} | ${pitchingResult.overlapPitchCount} live pitch${pitchingResult.overlapPitchCount === 1 ? "" : "es"} in ${latestCommandSeason}`,
        result: pitchingResult,
      };
    }
  }

  const profileInitials = getInitials(resolvedPlayer.name);
  const overviewStats = activeOverview.seasonStats.slice(0, 4);
  const overviewPercentiles = activeOverview.seasonPercentiles.slice(0, 4);
  const availableRolesLabel =
    liveAbProfile.availableRoles.length > 0
      ? liveAbProfile.availableRoles
          .map((role) => role.charAt(0).toUpperCase() + role.slice(1))
          .join(" / ")
      : "No charting roles";
  const rosterLine = [
    rosterInfo?.class ?? resolvedPlayer.academicYear,
    rosterInfo?.height,
    rosterInfo?.weight ? `${rosterInfo.weight} lbs` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const profileDetails = [
    { label: "Team", value: resolvedPlayer.team },
    { label: "Role", value: roleLabel },
    { label: "Positions", value: resolvedPlayer.positions.join(" / ") || "Unlisted" },
    { label: "Handedness", value: handBadge ?? "Unknown" },
    { label: "Academic year", value: rosterLine || resolvedPlayer.academicYear || "Unknown" },
  ];
  const stuffOverall = initialStuff.pitches.length > 0 ? computeTotalStuffPlus(initialStuff.pitches) : null;
  const trackedShapeCount = initialStuff.pitches.filter(
    (pitch) => pitch.pitchType && pitch.pitchType !== "Other",
  ).length;
  const trackedShapeSessions = initialStuff.pitches.reduce(
    (max, pitch) => Math.max(max, pitch.nSessions ?? 0),
    0,
  );
  const chartingSessionCount =
    (liveAbProfile.pitcher?.sessions.length ?? 0) + (liveAbProfile.hitter?.sessions.length ?? 0);
  const summaryNarrative =
    profileMode === "hitter"
      ? `${resolvedPlayer.name} is surfaced with ${activeOverview.seasonStats.length} season metrics, ${chartingSessionCount} charted sessions, and ${trackmanSessions.length} Trackman sessions for fast scouting context.`
      : initialPitchingModel.ready && initialPitchingModel.overall != null
        ? `${resolvedPlayer.name} carries a live Pitching+ grade of ${initialPitchingModel.overall.toFixed(1)} with ${trackmanSessions.length} Trackman sessions and ${commandOutings.length} command outings connected to this profile.`
        : `${resolvedPlayer.name} has ${trackmanSessions.length} Trackman sessions, ${commandOutings.length} command outings, and ${chartingSessionCount} charted sessions attached here for a single scouting readout.`;
  const contextChips = [
    resolvedPlayer.team,
    roleLabel,
    handBadge,
    profileMode.replace("-", " "),
    ncaaProvenance?.label ?? null,
  ].filter((chip): chip is string => Boolean(chip));
  const coverageStats = [
    { label: "Trackman sessions", value: String(trackmanSessions.length) },
    { label: "Command outings", value: String(commandOutings.length) },
    { label: "Mechanics sessions", value: String(mechanicsEntry?.sessions?.length ?? 0) },
    { label: "Charting sessions", value: String(chartingSessionCount) },
  ];
  const pitchingCardValue =
    initialPitchingModel.ready && initialPitchingModel.overall != null
      ? Math.round(initialPitchingModel.overall).toString()
      : "NR";
  const pitchingCardNote =
    initialPitchingModel.ready && initialPitchingModel.result
      ? `${initialPitchingModel.result.overlapPitchTypeCount} pitch type${initialPitchingModel.result.overlapPitchTypeCount === 1 ? "" : "s"} | ${initialPitchingModel.result.overlapPitchCount} live pitch${initialPitchingModel.result.overlapPitchCount === 1 ? "" : "es"} in ${latestCommandSeason ?? TARGET_YEAR}`
      : initialPitchingModel.note;
  const commandCardNote =
    initialCommandHero?.season != null
      ? `${initialCommandHero.outingCount} outing${initialCommandHero.outingCount === 1 ? "" : "s"} | ${initialCommandHero.pitchCount} pitch${initialCommandHero.pitchCount === 1 ? "" : "es"} in ${initialCommandHero.season}`
      : "No live command sample yet";
  const stuffCardNote =
    trackedShapeCount > 0
      ? `${trackedShapeCount} pitch type${trackedShapeCount === 1 ? "" : "s"} across ${trackedShapeSessions} session${trackedShapeSessions === 1 ? "" : "s"}`
      : "No tracked arsenal grade yet";

  return (
    <div className={`${manrope.className} min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_36%,#f8fafc_100%)] text-[#0F172A]`}>
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.10),transparent_58%)]" />
      <div className="absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-[rgba(165,180,252,0.18)] blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1820px] flex-col">
        <header className="sticky top-0 z-20 border-b border-[#F1F5F9] bg-white/90 backdrop-blur">
          <div className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/players"
                className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to roster
              </Link>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  Player Profile
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h1 className={`${plusJakarta.className} text-[24px] font-extrabold tracking-tight sm:text-[30px]`}>
                    {resolvedPlayer.name}
                  </h1>
                  <span className="hidden h-1 w-1 rounded-full bg-[#CBD5E1] sm:block" />
                  <span className="text-sm font-medium text-[#64748B]">
                    {resolvedPlayer.team} · {TARGET_YEAR}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/players"
                className="inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-white px-4 py-2 text-[13px] font-semibold text-[#475569] transition-colors hover:border-[#CBD5E1] hover:text-[#0F172A]"
              >
                <ScanLine className="h-4 w-4" />
                Roster index
              </Link>
              <button className="inline-flex items-center gap-2 rounded-full bg-[#4F46E5] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(79,70,229,0.22)] transition-colors hover:bg-[#4338CA]">
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 lg:py-8 2xl:px-12">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="order-2 space-y-6 self-start xl:order-1 xl:sticky xl:top-[104px]">
              <section className="overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.06)]">
                <div className="bg-[radial-gradient(circle_at_top_left,rgba(165,180,252,0.95),transparent_34%),linear-gradient(135deg,#1E1B4B_0%,#4338CA_58%,#818CF8_100%)] px-6 pb-8 pt-6 text-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                        Player dossier
                      </p>
                      <h2 className={`${plusJakarta.className} mt-3 text-[30px] font-extrabold tracking-tight`}>
                        {resolvedPlayer.name}
                      </h2>
                      <p className="mt-2 text-sm font-medium text-white/80">
                        {resolvedPlayer.team} • {roleLabel}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/12 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
                      {profileMode.replace("-", " ")}
                    </span>
                  </div>

                  <div className="mt-8 flex items-end justify-between gap-4">
                    <div className="flex h-24 w-24 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[2rem] font-extrabold tracking-tight shadow-[0_24px_40px_rgba(15,23,42,0.20)] backdrop-blur">
                      {profileInitials}
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {resolvedPlayer.positions.slice(0, 3).map((position) => (
                        <span
                          key={position}
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90"
                        >
                          {position}
                        </span>
                      ))}
                      {handBadge ? (
                        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                          {handBadge}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                  <div className="grid gap-2 rounded-[24px] border border-[#EEF2FF] bg-[#FAFBFF] p-2">
                    {profileDetails.map((detail) => (
                      <StatRow key={detail.label} label={detail.label} value={detail.value} />
                    ))}
                  </div>

                  <div className="rounded-[24px] border border-[#EEF2FF] bg-[#FAFBFF] p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                          Coverage
                        </p>
                        <p className="mt-1 text-[13px] leading-6 text-[#475569]">
                          {availableRolesLabel}
                          {liveAbProfile.defaultRole ? ` • default ${liveAbProfile.defaultRole}` : ""}
                        </p>
                      </div>
                      {ncaaProvenance ? (
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
                            ncaaProvenance.tone === "amber"
                              ? "bg-[#FEF3C7] text-[#B45309]"
                              : "bg-[#EEF2FF] text-[#4F46E5]"
                          }`}
                        >
                          {ncaaProvenance.label}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {coverageStats.map((stat) => (
                        <CoverageStat key={stat.label} label={stat.label} value={stat.value} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </aside>

            <div className="order-1 min-w-0 space-y-8 xl:order-2">
              <section className="overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.06)]">
                <div className="border-b border-[#F1F5F9] px-6 py-5 sm:px-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#64748B]">
                    Deep dive modules
                  </p>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-[#475569]">
                    Use the overview, charting, Trackman, command, and mechanics tabs as one continuous player workspace instead of separate dashboard fragments.
                  </p>
                </div>

                <div className="px-6 pb-7 sm:px-7">
                  <PlayerProfileTabs
                    profileMode={profileMode}
                    defaultOverviewMode={defaultOverviewMode}
                    pitchingSeasonStats={pitchingOverview.seasonStats}
                    hittingSeasonStats={hittingOverview.seasonStats}
                    seasonYear={TARGET_YEAR}
                    seasonNote={seasonNote}
                    ncaaProvenance={ncaaProvenance}
                    pitchingSeasonPercentiles={pitchingOverview.seasonPercentiles}
                    hittingSeasonPercentiles={hittingOverview.seasonPercentiles}
                    pitchingPercentileAudienceLabel={pitchingOverview.percentileAudienceLabel}
                    hittingPercentileAudienceLabel={hittingOverview.percentileAudienceLabel}
                    trackmanSessions={trackmanSessions}
                    commandOutings={commandOutings}
                    playerSlug={resolvedPlayer.slug}
                    initialCommandHero={initialCommandHero}
                    initialCommandResult={initialCommandResult}
                    initialPitchingModel={initialPitchingModel}
                    initialStuffLookupPlayerId={initialStuff.lookupPlayerId}
                    initialStuffPitches={initialStuff.pitches}
                    initialTab={initialTab}
                    mechanicsEntry={mechanicsEntry ?? null}
                    liveAbProfile={liveAbProfile}
                  />
                </div>
              </section>

              <section className="overflow-hidden rounded-[32px] border border-[#E2E8F0] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.06)]">
                <div className="p-6 sm:p-7">
                  <div className="flex flex-wrap gap-2">
                    {contextChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#475569]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  <p className="mt-4 max-w-4xl text-sm leading-7 text-[#475569]">{summaryNarrative}</p>

                  {profileMode === "pitcher" || profileMode === "two-way" ? (
                    <div className="mt-7 grid gap-5 xl:grid-cols-2">
                      <PlusGradeTile
                        label="Pitching+"
                        value={pitchingCardValue}
                        note={pitchingCardNote}
                        tone="pitching"
                        className="xl:col-span-2"
                      />
                      <PlusGradeTile
                        label="Command+"
                        value={
                          initialCommandHero?.score != null
                            ? Math.round(initialCommandHero.score).toString()
                            : "NR"
                        }
                        note={commandCardNote}
                        tone="command"
                        compact
                      />
                      <PlusGradeTile
                        label="Stuff+"
                        value={stuffOverall != null ? stuffOverall.toFixed(1) : "NR"}
                        note={stuffCardNote}
                        tone="stuff"
                        compact
                      />
                    </div>
                  ) : null}

                  <div className="mt-8 rounded-[30px] border border-[#EEF2FF] bg-[#FAFBFF] p-6 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                          Season stats
                        </p>
                        <h3 className={`${plusJakarta.className} mt-1 text-[22px] font-extrabold tracking-tight text-[#0F172A]`}>
                          {TARGET_YEAR} overview
                        </h3>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                        {defaultOverviewMode}
                      </span>
                    </div>

                    <div className="mt-6">
                      {overviewStats.length > 0 ? (
                        <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-4">
                          {overviewStats.map((stat) => (
                            <SeasonStatCard key={stat.label} label={stat.label} value={stat.value} />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-white p-5 text-sm text-[#64748B]">
                          {activeOverview.statsUnavailable
                            ? `${TARGET_YEAR} ${defaultOverviewMode} stats are temporarily unavailable.`
                            : `No ${TARGET_YEAR} ${defaultOverviewMode} stats available yet.`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 rounded-[30px] border border-[#EEF2FF] bg-white p-6 sm:p-7">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                          Percentile readout
                        </p>
                        <h3 className={`${plusJakarta.className} mt-1 text-[22px] font-extrabold tracking-tight text-[#0F172A]`}>
                          {activeOverview.percentileAudienceLabel}
                        </h3>
                      </div>
                      <span className="rounded-full bg-[#F8FAFC] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#64748B]">
                        NCAA
                      </span>
                    </div>

                    <div className="mt-6">
                      {overviewPercentiles.length > 0 ? (
                        <div className="grid gap-6 xl:grid-cols-2">
                          {overviewPercentiles.map((metric) => (
                            <PercentileStrip
                              key={metric.label}
                              label={metric.label}
                              value={metric.value}
                              percentile={metric.percentile}
                              note={metric.note ?? activeOverview.percentileAudienceLabel}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#FAFBFF] p-5 text-sm text-[#64748B]">
                          Percentile data will appear once the leaderboard row resolves.
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
