import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import path from "path";
import { promises as fs } from "fs";
import { and, eq, ne } from "drizzle-orm";
import rosterData from "@/data/roster.json";
import { db } from "@/db";
import { stuffPlusArsenal } from "@/db/schema";
import { fetchBattingLeaderboard, fetchNcaaStatsMeta, fetchPitchingLeaderboard } from "@/lib/collegeStats";
import {
  getCanonicalPlayerId,
  getHand,
  getSlugForPlayerId,
} from "@/lib/canonicalPlayers";
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
    <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 px-4 py-3 last:border-b-0">
      <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`text-[15px] font-bold tracking-tight ${
          accent
            ? "text-[var(--brand-primary-subtle-text)] dark:text-[var(--brand-primary-spotlight)]"
            : "text-slate-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </span>
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

  const playerCanonicalId = getCanonicalPlayerId(player.slug) ?? getCanonicalPlayerId(player.name);
  const normalizedName = normalizePlayerName(player.name);
  return (
    leaderboardRows.find((row) => {
      const rowName = normalizePlayerName(String(row.player_name ?? row.name ?? ""));
      const rowTeam = normalizePlayerName(String(row.team_name ?? row.team ?? ""));
      if (rowTeam && rowTeam !== "babson") {
        return false;
      }

      const rowCanonicalId = getCanonicalPlayerId(String(row.player_name ?? row.name ?? ""));
      if (playerCanonicalId && rowCanonicalId) {
        return rowCanonicalId === playerCanonicalId;
      }

      return rowName === normalizedName;
    }) ?? null
  );
}

function buildRedirectQueryString(
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      params.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
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
  const canonicalPlayerId = getCanonicalPlayerId(slug);
  const canonicalSlug = canonicalPlayerId ? getSlugForPlayerId(canonicalPlayerId) : null;
  if (canonicalSlug && canonicalSlug !== slug) {
    redirect(`/players/${canonicalSlug}${buildRedirectQueryString(sp)}`);
  }
  const initialTab = typeof sp.tab === "string" ? sp.tab : undefined;
  const player = getPlayerBySlug(canonicalSlug ?? slug);

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
  const roster = rosterData as Record<string, { height?: string; weight?: string; class?: string; photo?: string }>;
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
    sessionType: "game",
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
  const profilePhoto = rosterInfo?.photo?.trim() || null;
  const classYear = rosterInfo?.class ?? resolvedPlayer.academicYear ?? "Unknown";
  const sizeLine = [
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
    { label: "Class year", value: classYear },
  ];

  return (
    <div
      className="font-sans relative min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_36%,#f8fafc_100%)] text-slate-900 dark:bg-[linear-gradient(180deg,#09090b_0%,#18181b_36%,#09090b_100%)] dark:text-zinc-50"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-100 dark:opacity-50"
        style={{
          background:
            "radial-gradient(circle at top, rgba(var(--brand-primary-rgb), 0.1), transparent 58%)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full blur-3xl opacity-100 dark:opacity-35"
        style={{ backgroundColor: "rgba(var(--brand-primary-rgb), 0.18)" }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1820px] flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-100 dark:border-zinc-800 bg-surface/90 backdrop-blur">
          <div className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
              <Link
                href="/players"
                className="inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 dark:border-zinc-700 bg-surface px-3 text-[12px] font-semibold leading-none text-slate-500 dark:text-zinc-400 transition-colors hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:hover:text-zinc-50 sm:self-center"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                Back to roster
              </Link>
              <h1
                className="font-display m-0 min-w-0 flex-1 self-center text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 dark:text-zinc-50 sm:text-[28px] lg:text-[30px]"
              >
                {resolvedPlayer.name}
              </h1>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
              <Link
                href="/players"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-surface px-4 py-2 text-[13px] font-semibold text-slate-500 dark:text-zinc-400 transition-colors hover:border-slate-300 dark:hover:border-zinc-600 hover:text-slate-900 dark:hover:text-zinc-50"
              >
                <ScanLine className="h-4 w-4" />
                Roster index
              </Link>
              <button className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-primary)] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(var(--brand-primary-rgb),0.22)] transition-colors hover:bg-[var(--brand-primary-hover)]">
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 xl:px-10 lg:py-8 2xl:px-12">
          <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="order-2 space-y-6 self-start xl:order-1 xl:sticky xl:top-[104px]">
              <section className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-zinc-700 bg-surface shadow-[0_24px_64px_rgba(15,23,42,0.06)]">
                <div
                  className="px-6 pb-8 pt-6 text-white"
                  style={{
                    background:
                      "radial-gradient(circle at top left, rgba(var(--brand-primary-rgb), 0.38), transparent 34%), linear-gradient(135deg, var(--brand-primary-deep) 0%, var(--brand-primary-deep-alt) 58%, var(--brand-primary) 100%)",
                  }}
                >
                  <div className="flex flex-col items-start gap-5">
                    <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-surface/10 text-[2rem] font-extrabold tracking-tight shadow-[0_24px_40px_rgba(15,23,42,0.20)] backdrop-blur">
                      {profilePhoto ? (
                        <Image
                          src={profilePhoto}
                          alt={`${resolvedPlayer.name} headshot`}
                          fill
                          sizes="96px"
                          className="object-cover object-[center_15%]"
                          unoptimized
                        />
                      ) : (
                        profileInitials
                      )}
                    </div>

                    <div>
                      <h2 className="font-display text-[30px] font-extrabold tracking-tight">
                        {resolvedPlayer.name}
                      </h2>
                      <p className="mt-2 text-sm font-medium text-white/80">
                        {resolvedPlayer.team} • {roleLabel}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {resolvedPlayer.positions.slice(0, 3).map((position) => (
                        <span
                          key={position}
                          className="rounded-full border border-white/15 bg-surface/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90"
                        >
                          {position}
                        </span>
                      ))}
                      {handBadge ? (
                        <span className="rounded-full border border-white/15 bg-surface/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                          {handBadge}
                        </span>
                      ) : null}
                      {sizeLine ? (
                        <span className="rounded-full border border-white/15 bg-surface/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
                          {sizeLine}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 px-6 py-6">
                  <div className="grid gap-2 rounded-[24px] border border-[var(--brand-primary-border)] bg-[var(--brand-primary-surface)] p-2 dark:border-zinc-700 dark:bg-zinc-900/90 dark:shadow-[inset_0_1px_0_rgba(var(--brand-primary-rgb),0.18)]">
                    {profileDetails.map((detail) => (
                      <StatRow key={detail.label} label={detail.label} value={detail.value} />
                    ))}
                  </div>
                </div>
              </section>
            </aside>

            <div className="order-1 min-w-0 space-y-8 xl:order-2">
              <section className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-zinc-700 bg-surface shadow-[0_24px_64px_rgba(15,23,42,0.06)]">
                <div className="px-6 pb-6 pt-3 sm:px-7 sm:pb-7 sm:pt-4">
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
