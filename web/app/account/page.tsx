import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  Activity,
  BarChart3,
  ClipboardList,
  Gauge,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { buildBootstrapRosterPlayers } from "@/lib/charting/bootstrapRoster";
import {
  getPlayerAccountByEmail,
  listAllAccounts,
} from "@/lib/accounts/repository";
import { readAccountSessionEmail } from "@/lib/accounts/session";
import {
  listAllFallPitcherOutingsForTeam,
  listFallPitcherOutingsForAccount,
  aggregateFallPitcherOutings,
  type FallPitcherSeasonSummary,
} from "@/lib/fall/pitcherOutings";
import {
  listFallChartingSessionWorkloads,
  listFallChartingSessionWorkloadsForPitcher,
  type FallChartingSessionWorkload,
} from "@/lib/charting/fallWorkload";
import { FALL_SESSION_LABELS } from "@/lib/charting/fallSessionTypes";
import type { FallWorkloadStressLevel } from "@/lib/fall/workload";
import { deriveFallHitterStatsForPlayer, type FallHitterAggregate } from "@/lib/charting/fallHitterAggregation";
import { formatHitterAvg } from "@/lib/fall/hitterStatsFmt";

export const runtime = "nodejs";

function PortalCard({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof UserRound;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          {title}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-muted text-muted">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-2xl font-black tracking-tight text-foreground">{value}</div>
      <p className="mt-2 text-sm leading-6 text-muted">{detail}</p>
    </div>
  );
}

function PortalLink({
  href,
  title,
  detail,
  icon: Icon,
}: {
  href: string;
  title: string;
  detail: string;
  icon: typeof UserRound;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface px-5 py-4 text-foreground transition-smooth hover:border-[var(--brand-primary-border)] hover:bg-surface-muted"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-muted text-muted">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold">{title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted">{detail}</span>
        </span>
      </span>
      <span className="text-sm font-bold text-muted">Open</span>
    </Link>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">{label}</span>
      <span className="text-lg font-black tracking-tight text-foreground">{value}</span>
    </div>
  );
}

const STRESS_BADGE_CLASS: Record<FallWorkloadStressLevel, string> = {
  low: "border-border bg-surface-muted text-muted",
  watch: "border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-subtle-text)]",
  high: "border-foreground bg-foreground text-background",
};

function StressBadge({ session }: { session: FallChartingSessionWorkload }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${STRESS_BADGE_CLASS[session.stress.level]}`}
      title={session.stress.detail}
    >
      {session.stress.label}
    </span>
  );
}

function FallSeasonStatsPanel({ stats }: { stats: FallPitcherSeasonSummary }) {
  const fmt1 = (n: number | null) => (n !== null ? n.toFixed(1) : "—");
  const fmt2 = (n: number | null) => (n !== null ? n.toFixed(2) : "—");
  const fmtPct = (n: number | null) => (n !== null ? n.toFixed(1) + "%" : "—");

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        Fall Season Stats
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        <StatCell label="IP" value={fmt1(stats.inningsPitched)} />
        <StatCell label="Pitches" value={String(stats.pitchCount)} />
        <StatCell label="Strike%" value={fmtPct(stats.strikePct)} />
        <StatCell label="FPS%" value={fmtPct(stats.fpsPct)} />
        <StatCell label="K" value={String(stats.strikeouts)} />
        <StatCell label="BB" value={String(stats.walks)} />
        <StatCell label="WHIP" value={fmt2(stats.whip)} />
        <StatCell label="ERA" value={fmt2(stats.era)} />
      </div>
    </section>
  );
}

function FallHitterStatsPanel({ stats }: { stats: FallHitterAggregate }) {
  const fmtAvg = (v: number | null) => formatHitterAvg(v);
  const fmt3 = (v: number | null) => (v !== null ? v.toFixed(3).replace(/^0\./, ".") : "—");

  return (
    <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
          Fall Hitting Stats
        </div>
        {stats.source === "excel_import" && (
          <span className="text-[10px] text-muted">Workbook import · updates when sessions are charted</span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-8">
        <StatCell label="PA" value={String(stats.pa)} />
        <StatCell label="AB" value={String(stats.ab)} />
        <StatCell label="AVG" value={fmtAvg(stats.avg)} />
        <StatCell label="OBP" value={fmt3(stats.obp)} />
        <StatCell label="SLG" value={fmt3(stats.slg)} />
        <StatCell label="OPS" value={fmt3(stats.ops)} />
        <StatCell label="K" value={String(stats.k)} />
        <StatCell label="BB" value={String(stats.bb)} />
      </div>
      {(stats.hr > 0 || stats.triples > 0 || stats.doubles > 0) && (
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-4">
          <StatCell label="2B" value={String(stats.doubles)} />
          <StatCell label="3B" value={String(stats.triples)} />
          <StatCell label="HR" value={String(stats.hr)} />
          <StatCell label="wOBA" value={fmt3(stats.woba)} />
        </div>
      )}
    </section>
  );
}

const OUTING_TYPE_LABELS: Record<string, string> = {
  bullpen: "Bullpen",
  live_ab: "Live AB",
  intersquad: "Intersquad",
  scrimmage: "Scrimmage",
  game: "Game",
  other: "Other",
};

function WorkloadByTypePanel({ stats }: { stats: FallPitcherSeasonSummary }) {
  const entries = Object.entries(stats.byType).filter(([, v]) => v.outings > 0);
  const maxPitches = Math.max(...entries.map(([, v]) => v.pitches), 1);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        <Gauge className="h-4 w-4" />
        Workload by Type
      </div>
      {entries.length === 0 ? (
        <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
          <p>Log outings to see your workload breakdown by session type.</p>
          <p>Bullpen, live AB, intersquad, scrimmage, and game pitch counts will track here.</p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {entries.map(([type, v]) => (
            <div key={type}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">{OUTING_TYPE_LABELS[type] ?? type}</span>
                <span className="text-muted">{v.pitches} pitches · {v.outings} outing{v.outings !== 1 ? "s" : ""} · {v.innings.toFixed(1)} IP</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-[var(--brand-primary)]"
                  style={{ width: `${Math.round((v.pitches / maxPitches) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChartingWorkloadPanel({
  sessions,
  title = "Charting Workload",
}: {
  sessions: FallChartingSessionWorkload[];
  title?: string;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
        <Gauge className="h-4 w-4" />
        {title}
      </div>
      {sessions.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          Chart a fall session to see pitch-count stress here.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sessions.slice(0, 6).map((session) => (
            <div
              key={session.id}
              className="rounded-xl border border-border bg-surface-muted p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-foreground">
                    {session.pitcher ?? "Pitcher pending"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {FALL_SESSION_LABELS[session.sessionType]} · {session.gameDate}
                  </div>
                </div>
                <StressBadge session={session} />
              </div>
              <div className="mt-2 text-xs leading-5 text-muted">
                {session.pitchCount} charted pitches. {session.stress.detail}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function CoachPortal({
  account,
}: {
  account: NonNullable<Awaited<ReturnType<typeof getPlayerAccountByEmail>>>;
}) {
  const rosterPlayers = buildBootstrapRosterPlayers();
  const [accounts, fallOutingData, chartingWorkloads] = await Promise.all([
    account.role === "admin" ? listAllAccounts().catch(() => []) : Promise.resolve([]),
    listAllFallPitcherOutingsForTeam().catch(() => ({ allOutings: [], byPlayer: [] })),
    listFallChartingSessionWorkloads().catch(() => []),
  ]);
  const isAdmin = account.role === "admin";
  const playerAccounts = accounts.filter((a) => a.role === "player");
  const pendingAccounts = accounts.filter((a) => a.status === "pending");
  const accountsByPlayerId = new Map(
    playerAccounts
      .filter((a) => a.playerId)
      .map((a) => [a.playerId, a]),
  );
  const legacyByPlayerId = new Map(
    fallOutingData.byPlayer.map((entry) => [entry.playerId, entry]),
  );
  const normalizeName = (name: string) => name.trim().toLowerCase();
  const chartingByPitcher = new Map<string, FallChartingSessionWorkload[]>();
  for (const session of chartingWorkloads) {
    if (!session.pitcher) continue;
    const key = normalizeName(session.pitcher);
    chartingByPitcher.set(key, [...(chartingByPitcher.get(key) ?? []), session]);
  }
  const highStressSessions = chartingWorkloads.filter((s) => s.stress.level === "high");
  const watchSessions = chartingWorkloads.filter((s) => s.stress.level !== "low");

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-6xl">
      <div className="py-4 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Coach Portal
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              Fall Team View
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Signed in as {account.email}. Review player links,
              and charted fall-session workload from one place.
            </p>
          </div>
          {isAdmin ? (
            <Link
              href="/admin/accounts"
              className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition-smooth hover:bg-surface-muted"
            >
              Account Approvals
            </Link>
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <PortalCard
            icon={Users}
            title="Roster Players"
            value={String(rosterPlayers.length)}
            detail={
              isAdmin
                ? `${pendingAccounts.length} pending approval`
                : "Full Babson roster view"
            }
          />
          <PortalCard
            icon={ClipboardList}
            title="Charted Sessions"
            value={String(chartingWorkloads.length)}
            detail={`${watchSessions.length} workload watch session${watchSessions.length !== 1 ? "s" : ""}`}
          />
          <PortalCard
            icon={Gauge}
            title="High Stress"
            value={String(highStressSessions.length)}
            detail="Sessions above the session-type pitch target."
          />
          <PortalCard
            icon={BarChart3}
            title="Legacy Outings"
            value={String(fallOutingData.allOutings.length)}
            detail={`${fallOutingData.byPlayer.length} pitchers in workbook-style logs`}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-surface-muted p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              All Players
            </div>
            <div className="mt-4 space-y-2">
              {rosterPlayers.map((player) => {
                const playerAccount = player.playerId
                  ? accountsByPlayerId.get(player.playerId)
                  : null;
                const legacySummary = player.playerId
                  ? legacyByPlayerId.get(player.playerId)
                  : null;
                const playerWorkloads =
                  chartingByPitcher.get(normalizeName(player.name)) ?? [];
                const latestWorkload = playerWorkloads[0] ?? null;
                const positionLabel = player.positions.join(" / ") || "Roster";

                return (
                  <div
                    key={player.slug}
                    className="grid gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                  >
                    <div>
                      <div className="font-bold text-foreground">{player.name}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {positionLabel}
                        {player.academicYear ? ` · ${player.academicYear}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {latestWorkload ? (
                        <StressBadge session={latestWorkload} />
                      ) : (
                        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                          No charted load
                        </span>
                      )}
                      {isAdmin ? (
                        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                          {playerAccount?.status ?? "No account"}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-right sm:min-w-28">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Pitches</div>
                        <div className="font-bold text-foreground">
                          {latestWorkload?.pitchCount ?? legacySummary?.season.pitchCount ?? "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">Outings</div>
                        <div className="font-bold text-foreground">
                          {playerWorkloads.length || legacySummary?.season.outingCount || "—"}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <ChartingWorkloadPanel
            sessions={chartingWorkloads}
            title="Recent Charting Workload"
          />
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}

export default async function AccountPortalPage() {
  const cookieStore = await cookies();
  const accountEmail = readAccountSessionEmail(cookieStore);

  if (!accountEmail) {
    redirect("/account/login");
  }

  const account = await getPlayerAccountByEmail(accountEmail).catch(() => null);
  if (!account) {
    redirect("/account/setup");
  }

  if (account.role === "coach" || account.role === "admin") {
    return <CoachPortal account={account} />;
  }

  if (!account.playerId) {
    redirect("/account/setup");
  }

  const rosterPlayer =
    buildBootstrapRosterPlayers().find((player) => player.playerId === account.playerId) ??
    null;
  const [fallOutings, chartingWorkloads, hitterStats] = await Promise.all([
    listFallPitcherOutingsForAccount(account).catch(() => []),
    listFallChartingSessionWorkloadsForPitcher(
      account.playerName ?? rosterPlayer?.name ?? "",
    ).catch(() => []),
    account.playerId
      ? deriveFallHitterStatsForPlayer(account.playerId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const latestChartingWorkload = chartingWorkloads[0] ?? null;
  const latestOuting = fallOutings[0] ?? null;
  const seasonStats = aggregateFallPitcherOutings(fallOutings);
  const playerSlug = rosterPlayer?.slug ?? null;
  const playerLabel = account.playerName ?? rosterPlayer?.name ?? "Selected player";
  const positionLabel = rosterPlayer?.positions.join(" / ") || "Roster player";

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-6xl">
      <div className="py-4 sm:py-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              My Portal
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
              {playerLabel}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">
              Personalized home base for fall analytics. Current identity is tied to
              {` ${account.email}`} and defaults future forms and dashboards to this roster profile.
            </p>
          </div>
          <Link
            href="/account/setup"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition-smooth hover:bg-surface-muted"
          >
            Change Identity
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <PortalCard
            icon={UserRound}
            title="Roster Identity"
            value={positionLabel}
            detail={`${rosterPlayer?.academicYear ?? "Year pending"} · Bats ${rosterPlayer?.bats ?? "?"} / Throws ${rosterPlayer?.throws ?? "?"}`}
          />
          <PortalCard
            icon={ClipboardList}
            title="Fall Outings"
            value={String(fallOutings.length)}
            detail={
              latestOuting
                ? `Last: ${latestOuting.outingType.replace("_", " ")} on ${latestOuting.outingDate} · ${latestOuting.summary.pitchCount} pitches`
                : "No fall outings logged yet."
            }
          />
          <PortalCard
            icon={Gauge}
            title="Stress"
            value={latestChartingWorkload?.stress.label ?? "—"}
            detail={
              latestChartingWorkload
                ? `${latestChartingWorkload.pitchCount} charted pitches in latest ${FALL_SESSION_LABELS[latestChartingWorkload.sessionType]}`
                : "Chart a fall session to track workload stress."
            }
          />
        </div>

        {fallOutings.length > 0 && <FallSeasonStatsPanel stats={seasonStats} />}
        {hitterStats !== null && <FallHitterStatsPanel stats={hitterStats} />}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <section className="rounded-2xl border border-border bg-surface-muted p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
              Player Links
            </div>
            <div className="mt-4 grid gap-3">
              <PortalLink
                icon={Gauge}
                href="/fall"
                title="Fall Hub"
                detail="Team-wide fall stats — pitcher leaderboard, hitter stats, workload totals."
              />
              <PortalLink
                icon={Plus}
                href="/fall/outing/new"
                title="Log Fall Pitcher Outing"
                detail="Enter workbook-style pitch, result, FPS, and summary rows."
              />
              <PortalLink
                icon={ClipboardList}
                href="/fall/outings"
                title="Outing History"
                detail="Browse all logged fall outings with per-outing stats."
              />
              {playerSlug ? (
                <>
                  <PortalLink
                    icon={BarChart3}
                    href={`/players/${playerSlug}`}
                    title="Player Page"
                    detail="Open the current player profile and available season/fall context."
                  />
                  <PortalLink
                    icon={Activity}
                    href={`/charting/insights?player=${playerSlug}`}
                    title="Charting Insights"
                    detail="Jump into live AB and charting explorer views for this player."
                  />
                </>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-muted">
                  This account is linked to a player ID that is not in the current roster file.
                </div>
              )}
            </div>
          </section>

          <div className="space-y-6">
            <ChartingWorkloadPanel sessions={chartingWorkloads} />
            <WorkloadByTypePanel stats={seasonStats} />
          </div>
        </div>


      </div>
    </LeaderboardPageFrame>
  );
}
