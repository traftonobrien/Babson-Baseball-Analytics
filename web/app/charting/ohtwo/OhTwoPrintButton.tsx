"use client";

import { FileDown } from "lucide-react";

export function OhTwoPrintButton() {
  return (
    <button
      onClick={() => {
        const prev = document.title;
        document.title = "0-2 Fastball Report — Babson Baseball";
        window.print();
        document.title = prev;
      }}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
    >
      <FileDown className="h-4 w-4" aria-hidden />
      Export PDF
    </button>
  );
}
