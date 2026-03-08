import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ChevronLeft, Download, FileText, MapPin, User, Users } from "lucide-react";
import Link from "next/link";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { buildChartingExportFilename } from "@/lib/charting/export";
import { buildChartingPdfFilename } from "@/lib/charting/pdf";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import type { ChartingPitch } from "@/lib/charting/types";

export const revalidate = 0; // Always fetch fresh data

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${className}`}>
            {children}
        </span>
    );
}

// -- Analytics Engine --

function calculateStats(pitches: ChartingPitch[]) {
    if (!pitches.length) return null;

    const total = pitches.length;
    const locatedPitches = pitches.filter(
        (pitch): pitch is ChartingPitch & { locationCell: number } =>
            pitch.locationCell !== null
    );

    // Basic outcomes
    const strikes = pitches.filter(p => ["called_strike", "swinging_strike", "foul", "in_play", "bunt_foul"].includes(p.pitchResult)).length;
    const whiffs = pitches.filter(p => p.pitchResult === "swinging_strike").length;
    const inPlay = pitches.filter(p => p.pitchResult === "in_play").length;

    // Location
    const inZone = locatedPitches.filter(p => p.locationCell >= 1 && p.locationCell <= 9).length;
    const totalLocated = locatedPitches.length;

    // Swings
    const swings = whiffs + inPlay + pitches.filter(p => ["foul", "bunt_foul"].includes(p.pitchResult)).length;
    const swingsOZone = locatedPitches.filter(p => p.locationCell > 9 && ["swinging_strike", "foul", "in_play", "bunt_foul"].includes(p.pitchResult)).length;
    const totalOZone = locatedPitches.filter(p => p.locationCell > 9).length;

    // First pitch strikes
    const firstPitches = pitches.filter(p => p.ballsBefore === 0 && p.strikesBefore === 0);
    const firstPitchStrikes = firstPitches.filter(p => ["called_strike", "swinging_strike", "foul", "in_play", "bunt_foul"].includes(p.pitchResult)).length;

    return {
        total,
        strikePct: (strikes / total) * 100,
        whiffPct: swings > 0 ? (whiffs / swings) * 100 : 0,
        zonePct: totalLocated > 0 ? (inZone / totalLocated) * 100 : 0,
        chasePct: totalOZone > 0 ? (swingsOZone / totalOZone) * 100 : 0,
        fpsPct: firstPitches.length > 0 ? (firstPitchStrikes / firstPitches.length) * 100 : 0
    };
}

function StatCard({ label, value, suffix = "%" }: { label: string, value: number | null, suffix?: string }) {
    if (value === null) return null;
    return (
        <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center">
            <div className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-1">{label}</div>
            <div className="text-2xl font-black text-white">{value.toFixed(1)}<span className="text-sm font-medium text-zinc-500 ml-0.5">{suffix}</span></div>
        </div>
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
        lineup: lineupEntries,
        plateAppearances,
        pitches,
    } = snapshot;
    const stats = calculateStats(pitches);
    const paById = new Map(plateAppearances.map((pa) => [pa.id, pa]));
    const exportHref = `/api/charting/games/${game.id}/export`;
    const exportFilename = buildChartingExportFilename(game);
    const pdfExportHref = `/api/charting/games/${game.id}/export-pdf`;
    const pdfExportFilename = buildChartingPdfFilename(game);

    return (
        <LeaderboardPageFrame maxWidth="max-w-6xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                    <Link
                        href="/charting"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white">
                            {game.opponent}
                            {game.status === "final" ? (
                                <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Final</Badge>
                            ) : game.status === "active" ? (
                                <Badge className="border-sky-500/20 bg-sky-500/10 text-sky-300">Live</Badge>
                            ) : (
                                <Badge className="border-zinc-500/20 bg-zinc-500/10 text-zinc-300">Draft</Badge>
                            )}
                        </h1>
                        <p className="mt-1 text-zinc-400">
                            {format(parseISO(game.gameDate), "EEEE, MMMM do, yyyy")}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <a
                        href={pdfExportHref}
                        download={pdfExportFilename}
                        className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-sky-500/20 bg-sky-500/10 px-4 text-sm font-semibold text-sky-200 transition-colors hover:border-sky-400/30 hover:bg-sky-500/15 hover:text-white"
                    >
                        <FileText className="h-4 w-4" />
                        Download PDF
                    </a>
                    <a
                        href={exportHref}
                        download={exportFilename}
                        className="inline-flex h-11 items-center gap-2 self-start rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition-colors hover:border-emerald-400/30 hover:bg-emerald-500/15 hover:text-white"
                    >
                        <Download className="h-4 w-4" />
                        Download CSV
                    </a>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3 mb-8">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <div className="flex items-center gap-2 mb-4 text-zinc-300 font-semibold">
                        <FileText className="h-4 w-4" /> Game Details
                    </div>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Charter</dt>
                            <dd className="text-zinc-200 font-medium">{game.charter || "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Weather</dt>
                            <dd className="text-zinc-200 font-medium">{game.weather || "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Home Catcher</dt>
                            <dd className="text-zinc-200 font-medium">{game.homeCatcher || "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-zinc-500">Away Catcher</dt>
                            <dd className="text-zinc-200 font-medium">{game.awayCatcher || "—"}</dd>
                        </div>
                    </dl>
                    {game.notes && (
                        <div className="mt-4 pt-4 border-t border-zinc-800/60">
                            <p className="text-xs text-zinc-500 mb-1">Notes</p>
                            <p className="text-sm text-zinc-300 leading-relaxed">{game.notes}</p>
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <div className="flex items-center gap-2 mb-4 text-zinc-300 font-semibold">
                        <User className="h-4 w-4" /> Pitchers Used
                    </div>
                    {segments.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">No pitchers mapped yet.</p>
                    ) : (
                        <ul className="space-y-3">
                            {segments.map((seg, idx) => (
                                <li key={seg.id} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-3">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                                            {idx + 1}
                                        </span>
                                        <span className="text-zinc-200 font-medium">{seg.displayName}</span>
                                    </div>
                                    {seg.runsOverride != null && (
                                        <span className="text-zinc-500 font-mono text-xs">
                                            {seg.runsOverride}R {seg.earnedRunsOverride}ER
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                    <div className="flex items-center gap-2 mb-4 text-zinc-300 font-semibold">
                        <Users className="h-4 w-4" /> Starting Lineup
                    </div>
                    {lineupEntries.length === 0 ? (
                        <p className="text-sm text-zinc-500 italic">No lineup configured.</p>
                    ) : (
                        <ul className="space-y-2">
                            {lineupEntries.map((p: any) => (
                                <li key={p.id} className="flex items-center gap-3 text-sm">
                                    <span className="w-4 text-right text-zinc-500 font-mono text-xs">{p.lineupSlot}</span>
                                    <span className="text-zinc-300">{p.hitterName}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {pitches.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <StatCard label="Strike %" value={stats?.strikePct ?? null} />
                    <StatCard label="Zone %" value={stats?.zonePct ?? null} />
                    <StatCard label="Whiff %" value={stats?.whiffPct ?? null} />
                    <StatCard label="Chase %" value={stats?.chasePct ?? null} />
                    <StatCard label="1st Pitch Strike %" value={stats?.fpsPct ?? null} />
                </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden mt-2">
                <div className="border-b border-zinc-800/60 bg-zinc-900/80 px-5 py-4 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-zinc-400" />
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

        </LeaderboardPageFrame>
    );
}
