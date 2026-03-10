"use client";

import { useState, useRef, useEffect, startTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, FileText, LoaderCircle, Trash2 } from "lucide-react";

interface GameSessionActionsProps {
    gameId: string;
    opponent: string;
    gameDate: string;
    pdfExportHref: string;
    pdfExportFilename: string;
    csvExportHref: string;
    csvExportFilename: string;
}

export function GameSessionActions({
    gameId,
    opponent,
    gameDate,
    pdfExportHref,
    pdfExportFilename,
    csvExportHref,
    csvExportFilename,
}: GameSessionActionsProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleDelete = async () => {
        const confirmed = window.confirm(
            `Delete charting session for ${opponent} on ${gameDate}?\n\nThis permanently removes the game shell, pitches, plate appearances, lineup, and pitcher segments.`
        );

        if (!confirmed) return;

        setIsDeleting(true);
        setIsOpen(false);

        try {
            const response = await fetch(`/api/charting/games/${gameId}`, { method: "DELETE" });
            if (!response.ok) throw new Error("Could not delete charting session.");

            startTransition(() => {
                router.push("/charting");
                router.refresh();
            });
        } catch (error) {
            alert(error instanceof Error ? error.message : "Could not delete charting session.");
            setIsDeleting(false);
        }
    };

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-300 transition-colors hover:bg-zinc-700"
            >
                Session Actions
                <ChevronDown className="h-3.5 w-3.5" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-800 bg-zinc-900 py-1 shadow-2xl z-50">
                    <a
                        href={pdfExportHref}
                        download={pdfExportFilename}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800/80 transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <FileText className="h-4 w-4 text-sky-400" />
                        Download PDF
                    </a>
                    <a
                        href={csvExportHref}
                        download={csvExportFilename}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-zinc-300 hover:bg-zinc-800/80 transition-colors"
                        onClick={() => setIsOpen(false)}
                    >
                        <Download className="h-4 w-4 text-emerald-400" />
                        Download CSV
                    </a>
                    <div className="m-1 border-t border-zinc-800"></div>
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {isDeleting ? "Deleting..." : "Delete Session"}
                    </button>
                </div>
            )}
        </div>
    );
}
