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
  Download,
  ScanLine,
} from "lucide-react";
import PlayerProfileTabs from "./PlayerProfileTabs";
import { loadChartingPlayerProfile } from "@/lib/charting/playerProfile";
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
  const chartingSessionCount =
    (liveAbProfile.pitcher?.sessions.length ?? 0) + (liveAbProfile.hitter?.sessions.length ?? 0);
  const coverageStats = [
    { label: "Trackman sessions", value: String(trackmanSessions.length) },
    { label: "Command outings", value: String(commandOutings.length) },
    { label: "Mechanics sessions", value: String(mechanicsEntry?.sessions?.length ?? 0) },
    { label: "Charting sessions", value: String(chartingSessionCount) },
  ];

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

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
