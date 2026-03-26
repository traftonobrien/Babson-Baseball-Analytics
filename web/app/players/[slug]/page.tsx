import Link from "next/link";
import { notFound } from "next/navigation";
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
import { handBadgeClasses } from "@/lib/handBadge";
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
  LeaderboardPageFrame,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import PlayerProfileTabs from "./PlayerProfileTabs";
import { loadChartingPlayerProfile } from "@/lib/charting/playerProfile";
import {
  type MetricDefinition,
  type PercentileMetric,
  PITCHING_SNAPSHOT_METRICS,
  PITCHING_PERCENTILE_METRICS,
  BATTING_SNAPSHOT_METRICS,
  BATTING_PERCENTILE_METRICS,
  extractRows,
  getMetricValue,
  buildSeasonStats,
  buildSeasonPercentiles,
  getNumberByCandidates,
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

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <div className="mx-auto w-full">
        <Link
          href="/players"
          className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500 transition-smooth hover:border-zinc-700 hover:text-zinc-200"
        >
          Back To Roster
        </Link>

        <header className="mt-6">
          <div className="relative overflow-hidden rounded-[2.1rem] border border-emerald-500/18 bg-zinc-950/82 p-6 shadow-[0_28px_70px_rgba(0,0,0,0.30)] sm:p-7">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(16,185,129,0.16),transparent_26%),radial-gradient(circle_at_84%_20%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="relative">
              <div className="flex flex-wrap items-center gap-2">
                <LeaderboardPill tone="emerald">Player Profile</LeaderboardPill>
                {handBadge && throwHand && (
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${handBadgeClasses(throwHand)}`}
                  >
                    {handBadge}
                  </span>
                )}
              </div>

              <h1 className="mt-5 text-[34px] font-black tracking-tight text-white sm:text-[3rem] sm:leading-[1.02]">
                {resolvedPlayer.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-2">
                <LeaderboardPill tone="neutral">{resolvedPlayer.team}</LeaderboardPill>
                <LeaderboardPill tone="neutral">{roleLabel}</LeaderboardPill>
                <LeaderboardPill tone="neutral">{TARGET_YEAR}</LeaderboardPill>
                {resolvedPlayer.positions.length > 0 && (
                  <LeaderboardPill tone="neutral">{resolvedPlayer.positions.join(" / ")}</LeaderboardPill>
                )}
                {(rosterInfo?.height || rosterInfo?.weight || rosterInfo?.class || resolvedPlayer.academicYear) && (
                  <LeaderboardPill tone="neutral">
                    {[
                      rosterInfo?.height,
                      rosterInfo?.weight && `${rosterInfo.weight} lbs`,
                      rosterInfo?.class ?? resolvedPlayer.academicYear,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </LeaderboardPill>
                )}
              </div>
            </div>
          </div>
        </header>

        {activeOverview.statsUnavailable && (
          <div className="mt-4 rounded-2xl border border-amber-800/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">
            {TARGET_YEAR} {defaultOverviewMode} stats temporarily unavailable. Check back soon.
          </div>
        )}

        {!activeOverview.hasRow && !activeOverview.statsUnavailable && (
          <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-500">
            No {TARGET_YEAR} {defaultOverviewMode} stats available
          </div>
        )}

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
    </LeaderboardPageFrame>
  );
}
