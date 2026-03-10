import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
    Activity,
    ChevronLeft,
    Download,
    FileText,
    MapPin,
    PencilLine,
    User,
    Users,
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
} from "@/lib/charting/sessionOverview";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";

export const revalidate = 0; // Always fetch fresh data

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${className}`}>
            {children}
        </span>
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
    const hitterOverviewModels = buildHitterOverviewModels(
        plateAppearances,
        pitches,
        lineupEntries
    );
    const paById = new Map(plateAppearances.map((pa) => [pa.id, pa]));
    const exportHref = `/api/charting/games/${game.id}/export`;
    const exportFilename = buildChartingExportFilename(game);
    const pdfExportHref = `/api/charting/games/${game.id}/export-pdf`;
    const pdfExportFilename = buildChartingPdfFilename(game);

    return (
        <LeaderboardPageFrame maxWidth="max-w-[1400px]">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-zinc-800/60 pb-5">
                <div className="flex items-center gap-4">
                    <Link
                        href="/charting"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
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
                                    <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Final</Badge>
                                ) : game.status === "active" ? (
                                    <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-300">Live</Badge>
                                ) : (
                                    <Badge className="border-zinc-500/20 bg-zinc-500/10 text-zinc-300">Draft</Badge>
                                )
                            }
                        />
                        <p className="mt-1 text-zinc-400">
                            {format(parseISO(game.gameDate), "EEEE, MMMM do, yyyy")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/charting/games/${game.id}/edit`}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-200 transition-colors hover:border-emerald-400/35 hover:bg-emerald-500/15"
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

            <div className="flex flex-col gap-6 w-full">
                <div className="flex flex-col min-w-0">
                    <PitcherBreakdownSection models={pitcherOverviewModels} />
                    <HitterBreakdownSection models={hitterOverviewModels} />

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden mt-2">
                        <div className="border-b border-zinc-800/60 bg-zinc-900/80 px-5 py-4 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-zinc-400" />
                            <h2 className="font-semibold text-zinc-200">Play-by-Play Pitch Log</h2>
                        </div>

                        {plateAppearances.length === 0 ? (
                            <div className="p-8 text-center text-zinc-500 text-sm italic">
                                No plate appearances charted yet.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-zinc-900/30 text-xs uppercase tracking-wider text-zinc-500 border-b border-zinc-800">
                                        <tr>
                                            <th className="px-5 py-3 font-medium">Seq</th>
                                            <th className="px-5 py-3 font-medium">Inning</th>
                                            <th className="px-5 py-3 font-medium">Batter</th>
                                            <th className="px-5 py-3 font-medium">Count</th>
                                            <th className="px-5 py-3 font-medium">Pitch</th>
                                            <th className="px-5 py-3 font-medium">Result</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-800/40">
                                        {pitches.map((pitch, idx) => {
                                            const pa = paById.get(pitch.paId);
                                            const isLastInPA = idx === pitches.length - 1 || pitches[idx + 1].paId !== pitch.paId;

                                            return (
                                                <tr key={pitch.id} className={`hover:bg-zinc-800/20 ${isLastInPA ? 'border-b-2 border-zinc-800' : ''}`}>
                                                    <td className="px-5 py-2.5 text-zinc-500 font-mono text-xs">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-zinc-400">
                                                        Top {pa?.inning ?? "?"}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-zinc-300 font-medium">
                                                        {pa?.hitterName ?? "Unknown"}
                                                    </td>
                                                    <td className="px-5 py-2.5 text-zinc-400 font-mono">
                                                        {pitch.ballsBefore}-{pitch.strikesBefore}
                                                    </td>
                                                    <td className="px-5 py-2.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300">
                                                            {pitch.pitchType}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-2.5 font-medium text-zinc-300">
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
