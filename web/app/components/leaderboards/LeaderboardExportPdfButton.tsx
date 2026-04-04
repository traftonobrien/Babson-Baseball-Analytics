"use client";

import { FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

function sanitizeFileStem(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function LeaderboardExportPdfButton({
  fileStem,
  label = "Export PDF",
  className,
}: {
  fileStem: string;
  label?: string;
  className?: string;
}) {
  const handleExport = () => {
    if (typeof window === "undefined") {
      return;
    }

    const previousTitle = document.title;
    const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const safeStem = sanitizeFileStem(fileStem) || "leaderboard";
    document.title = `${safeStem}_${dateStamp}`;

    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };

    window.addEventListener("afterprint", restoreTitle);
    window.print();
    window.setTimeout(restoreTitle, 1000);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={cn(
        "leaderboard-print-hide inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-surface px-4 text-sm font-semibold text-slate-700 shadow-sm transition-smooth hover:border-slate-300 hover:text-slate-900 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:text-zinc-50",
        className,
      )}
    >
      <FileDown className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </button>
  );
}
