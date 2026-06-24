import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
    Activity,
    BarChart3,
    CalendarDays,
    ChevronLeft,
    ClipboardCheck,
    PencilLine,
    ShieldCheck,
    TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import {
    HitterBreakdownSection,
    PitcherBreakdownSection,
} from "@/app/charting/_components/ChartingSessionBreakdowns";
import { EditableChartingGameTitle } from "@/app/charting/_components/EditableChartingGameTitle";
import { GameSessionActions } from "./GameSessionActions";
import { GameDetailsSidebar } from "./GameDetailsSidebar";
import { computeSegmentStats_pure } from "@/lib/charting/analytics";
import { buildChartingExportFilename } from "@/lib/charting/export";
import { buildChartingPdfFilename } from "@/lib/charting/pdf";
import {
    buildHitterOverviewModels,
    buildPitcherOverviewModels,
    type HitterOverviewModel,
    type PitcherOverviewModel,
} from "@/lib/charting/sessionOverview";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import { resolvePlateAppearanceInitialCount } from "@/lib/charting/plateAppearanceInitialCount";
import type { ChartingPitch, ChartingPlateAppearance } from "@/lib/charting/types";

export const revalidate = 0; // Always fetch fresh data

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}>
            {children}
        </span>
    );
}

function formatReviewPct(value: number | null): string {
    return value === null ? "—" : `${value.toFixed(1)}%`;
}

function calculateStrikeRate(pitches: ChartingPitch[]): number | null {
    if (pitches.length === 0) {
        return null;
    }

    const strikeResults = new Set([
        "called_strike",
        "swinging_strike",
        "foul",
        "bunt_foul",
        "in_play",
    ]);
    const strikes = pitches.filter((pitch) => strikeResults.has(pitch.pitchResult)).length;
    return (strikes / pitches.length) * 100;
}

function countClosedPas(plateAppearances: ChartingPlateAppearance[]): number {
    return plateAppearances.filter((plateAppearance) => plateAppearance.resultCode).length;
}

function buildInningRange(plateAppearances: ChartingPlateAppearance[]): string {
    const innings = plateAppearances
        .map((plateAppearance) => plateAppearance.inning)
        .filter((inning) => Number.isFinite(inning));

    if (innings.length === 0) {
        return "No innings";
    }

    const first = Math.min(...innings);
    const last = Math.max(...innings);
    return first === last ? `Inning ${first}` : `Innings ${first}-${last}`;
}

function ReviewMetricCard({
    label,
    value,
    detail,
    icon: Icon,
}: {
    label: string;
    value: string;
    detail: string;
    icon: typeof Activity;
}) {
    return (
        <div className="rounded-2xl border border-border bg-surface p-4 text-foreground shadow-[0_18px_42px_rgba(15,23,42,0.05)] dark:shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
            <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                    {label}
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-muted text-muted">
                    <Icon className="h-4 w-4" />
                </div>
            </div>
            <div className="mt-3 text-2xl font-black tracking-tight">{value}</div>
            <div className="mt-1 text-xs leading-5 text-muted">{detail}</div>
        </div>
    );
}

function ChartingGameReviewHub({
    pitcherOverviewModels,
    hitterOverviewModels,
    plateAppearances,
    pitches,
}: {
    pitcherOverviewModels: PitcherOverviewModel[];
    hitterOverviewModels: HitterOverviewModel[];
    plateAppearances: ChartingPlateAppearance[];
    pitches: ChartingPitch[];
}) {
    const closedPas = countClosedPas(plateAppearances);
    const openPas = plateAppearances.length - closedPas;
    const strikeRate = calculateStrikeRate(pitches);
    const busiestPitcher = [...pitcherOverviewModels].sort(
        (left, right) => right.pitches.length - left.pitches.length,
    )[0];
    const mostActiveHitter = [...hitterOverviewModels].sort(
        (left, right) => right.plateAppearances.length - left.plateAppearances.length,
    )[0];

    const reviewItems = [
        {
            label: "Coach review",
            value: openPas === 0 && plateAppearances.length > 0 ? "Ready" : "Needs cleanup",
            detail:
                openPas === 0
                    ? "All charted plate appearances have a result."
                    : `${openPas} plate ${openPas === 1 ? "appearance is" : "appearances are"} still open.`,
        },
        {
            label: "Workload watch",
            value: busiestPitcher ? busiestPitcher.displayName : "No pitcher",
            detail: busiestPitcher
                ? `${busiestPitcher.pitches.length} pitches logged for the busiest Babson arm.`
                : "Add pitcher segments to unlock workload context.",
        },
        {
            label: "Player portal seed",
            value: mostActiveHitter ? mostActiveHitter.hitterName : "No hitter",
            detail: mostActiveHitter
                ? `${mostActiveHitter.plateAppearances.length} PA sample ready for personalized review.`
                : "Charted hitter data will feed future player dashboards.",
        },
    ];

    return (
        <section className="mb-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        Coach Review Hub
                    </div>
                    <h2 className="mt-3 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                        Session review snapshot
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
                        Post-session coverage, workload context, and player-level review cues from the
                        charted game.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {openPas === 0 ? "Clean results" : `${openPas} open PA`}
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-muted">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Review context
                    </span>
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <ReviewMetricCard
                    icon={Activity}
                    label="Pitches"
                    value={String(pitches.length)}
                    detail={`${closedPas}/${plateAppearances.length} plate appearances closed`}
                />
                <ReviewMetricCard
                    icon={TrendingUp}
                    label="Strike rate"
                    value={formatReviewPct(strikeRate)}
                    detail="All charted pitch results, including balls in play"
                />
                <ReviewMetricCard
                    icon={BarChart3}
                    label="Babson arms"
                    value={String(pitcherOverviewModels.length)}
                    detail={busiestPitcher ? `${busiestPitcher.displayName} leads workload` : "No Babson pitcher mapped"}
                />
                <ReviewMetricCard
                    icon={ClipboardCheck}
                    label="Coverage"
                    value={buildInningRange(plateAppearances)}
                    detail={`${hitterOverviewModels.length} Babson hitters with review rows`}
                />
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {reviewItems.map((item) => (
                    <div
                        key={item.label}
                        className="rounded-2xl border border-border bg-surface-muted p-4"
                    >
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
                            {item.label}
                        </div>
                        <div className="mt-2 text-base font-bold text-foreground">{item.value}</div>
                        <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
                    </div>
                ))}
            </div>
        </section>
    );
}



export default async function ChartingGamePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id: gameId } = await params;
    const snapshot = await loadChartingGameSnapshot(gameId);

    if (!snapshot) {
        return notFound();
    }

    const {
        game,
        segments,
        plateAppearances,
        pitches,
    } = snapshot;

    const lineupEntries = Array.isArray(snapshot.lineup)
        ? snapshot.lineup.sort((a, b) => a.lineupSlot - b.lineupSlot)
        : [];

    const pitcherOverviewModels = buildPitcherOverviewModels(
        segments,
        plateAppearances,
        pitches
    );
    const babsonPitcherOverviewModels = pitcherOverviewModels.filter(
        (model) => model.teamSide === "our"
    );
    const hitterOverviewModels = buildHitterOverviewModels(
        plateAppearances,
        pitches,
        lineupEntries
    );
    const babsonHitterOverviewModels = hitterOverviewModels.filter(
        (model) => model.teamSide === "our"
    );
    const paById = new Map(plateAppearances.map((pa) => [pa.id, pa]));
    const pitchesByPaId = new Map<string, typeof pitches>();
    for (const pitch of pitches) {
        const existing = pitchesByPaId.get(pitch.paId) ?? [];
        existing.push(pitch);
        pitchesByPaId.set(pitch.paId, existing);
    }
    const exportHref = `/api/charting/games/${game.id}/export`;
    const exportFilename = buildChartingExportFilename(game);
    const pdfExportHref = `/api/charting/games/${game.id}/export-pdf`;
    const pdfExportFilename = buildChartingPdfFilename(game);

    return (
        <LeaderboardPageFrame variant="light" maxWidth="max-w-[1400px]">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-5">
                <div className="flex items-center gap-4">
                    <Link
                        href="/charting"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <EditableChartingGameTitle
                            gameId={game.id}
                            initialOpponent={game.opponent}
                            revision={game.revision}
                            statusBadge={
                                game.status === "final" ? (
                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">Final</Badge>
                                ) : game.status === "active" ? (
                                    <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300">Live</Badge>
                                ) : (
                                    <Badge className="border-border bg-surface-muted text-muted">Draft</Badge>
                                )
                            }
                        />
                        <p className="mt-1 text-muted">
                            {format(parseISO(game.gameDate), "EEEE, MMMM do, yyyy")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/charting/games/${game.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-primary-subtle-text)] transition-colors hover:bg-[var(--brand-primary-soft-strong)] dark:border-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_42%,var(--border-subtle))] dark:bg-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_18%,var(--surface))] dark:text-[var(--brand-primary-spotlight)] dark:hover:bg-[color-mix(in_srgb,rgb(var(--brand-primary-rgb))_28%,var(--surface))]"
                    >
                        <PencilLine className="h-3.5 w-3.5" />
                        Open Editor
                    </Link>
                    <GameSessionActions
                        gameId={game.id}
                        opponent={game.opponent}
                        gameDate={format(parseISO(game.gameDate), "MMMM do, yyyy")}
                        pdfExportHref={pdfExportHref}
                        pdfExportFilename={pdfExportFilename}
                        csvExportHref={exportHref}
                        csvExportFilename={exportFilename}
                    />
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[18rem_1fr] items-start">
                <aside className="sticky top-6">
                    <GameDetailsSidebar
                        game={game}
                        pitcherOverviewModels={babsonPitcherOverviewModels}
                        hitterOverviewModels={babsonHitterOverviewModels}
                    />
                </aside>

                <div className="flex flex-col min-w-0">
                    <ChartingGameReviewHub
                        pitcherOverviewModels={babsonPitcherOverviewModels}
                        hitterOverviewModels={babsonHitterOverviewModels}
                        plateAppearances={plateAppearances}
                        pitches={pitches}
                    />
                    <PitcherBreakdownSection models={babsonPitcherOverviewModels} />
                    <HitterBreakdownSection models={babsonHitterOverviewModels} />

                    <div className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface">
                        <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-5 py-4">
                            <Activity className="h-4 w-4 text-muted" />
                            <h2 className="font-semibold text-foreground">Play-by-Play Pitch Log</h2>
                        </div>

                        {plateAppearances.length === 0 ? (
                            <div className="p-8 text-center text-sm italic text-muted">
                                No plate appearances charted yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full whitespace-nowrap text-left text-sm">
                                    <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wider text-muted">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Seq</th>
                                            <th className="px-5 py-3 font-medium">Inning</th>
                                            <th className="px-5 py-3 font-medium">Batter</th>
                                            <th className="px-5 py-3 font-medium">Start</th>
                                            <th className="px-5 py-3 font-medium">Count</th>
                                            <th className="px-5 py-3 font-medium">Pitch</th>
                                            <th className="px-5 py-3 font-medium">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                        {pitches.map((pitch, idx) => {
                                            const pa = paById.get(pitch.paId);
                                            const paPitches = pa ? pitchesByPaId.get(pa.id) ?? [] : [];
                                            const isFirstInPA = idx === 0 || pitches[idx - 1].paId !== pitch.paId;
                                            const isLastInPA = idx === pitches.length - 1 || pitches[idx + 1].paId !== pitch.paId;

                                            return (
                                                <tr key={pitch.id} className={`hover:bg-surface-muted ${isLastInPA ? 'border-b-2 border-border' : ''}`}>
                                                    <td className="px-5 py-2.5 font-mono text-xs text-muted">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-muted">
                                                        Top {pa?.inning ?? "?"}
                                                    </td>
                                                    <td className="px-5 py-2.5 font-medium text-foreground">
                                                        {pa?.hitterName ?? "Unknown"}
                                                    </td>
                                                    <td className="px-5 py-2.5 font-mono text-muted">
                                                        {isFirstInPA && pa
                                                            ? resolvePlateAppearanceInitialCount(pa, paPitches)
                                                            : ""}
                                                    </td>
                                                    <td className="px-5 py-2.5 font-mono text-muted">
                                                        {pitch.ballsBefore}-{pitch.strikesBefore}
                                                    </td>
                                                    <td className="px-5 py-2.5">
                                                        <span className="inline-flex items-center rounded border border-border bg-surface-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground">
                                                            {pitch.pitchType}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-2.5 font-medium text-foreground">
                                                        {pitch.pitchResult} {isLastInPA && pa?.resultCode ? ` → ${pa.resultCode}` : ''}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </LeaderboardPageFrame>
    );
}
