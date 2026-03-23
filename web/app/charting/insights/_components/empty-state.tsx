"use client";

import { ArrowRight, ClipboardList } from "lucide-react";
import { LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { clipPathForLocationCell } from "@/lib/charting/locationGrid";

import type { ComparisonView } from "../explorerState";
import { TEAM_NAME } from "@/lib/teamConfig";
import {
  countNounForView,
  isPitcherView,
} from "../_lib/helpers";
import { ZONE_BUCKET_LAYOUT } from "../_lib/zone-display";
import type { ExplorerEntry } from "../_lib/types";

export function EmptyState({
  view,
  filteredEntries,
  pinnedSlug,
  onOpenPinned,
}: {
  view: ComparisonView;
  filteredEntries: ExplorerEntry[];
  pinnedSlug: string | null;
  onOpenPinned: (() => void) | null;
}) {
  const isPitcher = isPitcherView(view);

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-surface p-6 shadow-[0_16px_40px_rgba(15,23,42,0.04)] sm:p-7">
      <div className="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#6366F1]">
            <ClipboardList className="h-3.5 w-3.5" />
            Player Visuals
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50">
            Search a {isPitcher ? "pitcher" : "hitter"} to open the visuals.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 dark:text-zinc-400">
            {isPitcher
              ? `This page mirrors the Savant workflow with the ${TEAM_NAME} pitcher data we actually capture: player search, season and pitch filters, pitch-speed scope, command/result slices, rough zone buckets, and a one-line season table below.`
              : `This page mirrors the Savant workflow with the ${TEAM_NAME} data we actually capture: player search, pitcher hand, season and pitch filters, pitch-speed scope, rough zone buckets, and a one-line season table below.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LeaderboardPill tone="sky" variant="light">
              {filteredEntries.length} roster {countNounForView(view)}
              {filteredEntries.length === 1 ? "" : "s"}
            </LeaderboardPill>
            <LeaderboardPill tone="neutral" variant="light">9 rough zone buckets</LeaderboardPill>
            <LeaderboardPill tone="neutral" variant="light">No EV or contour layer</LeaderboardPill>
          </div>
          {pinnedSlug && onOpenPinned ? (
            <button
              type="button"
              onClick={onOpenPinned}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-zinc-700 bg-background px-4 py-2 text-sm font-semibold text-[#334155] transition-smooth hover:border-[var(--brand-primary-border)] hover:text-[var(--brand-primary-subtle-text)]"
            >
              Reopen pinned {countNounForView(view)}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-slate-200 dark:border-zinc-700 bg-background p-4">
          <div className="relative aspect-square rounded-[1.75rem] border border-slate-200 dark:border-zinc-700 bg-surface">
            <div className="pointer-events-none absolute inset-[22%] rounded-[1.5rem] border border-dashed border-[#CBD5E1]" />
            {Object.values(ZONE_BUCKET_LAYOUT).map((bucket) => (
              <div
                key={bucket.label}
                className="absolute overflow-hidden rounded-[1.4rem] border border-slate-200 dark:border-zinc-700 bg-background"
                style={{
                  ...bucket.style,
                  clipPath: bucket.chaseKind ? clipPathForLocationCell(bucket.chaseKind) : "none",
                }}
              >
                <div className="p-2.5">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:text-zinc-500">
                    {bucket.label}
                  </div>
                  <div className="mt-6 text-right text-xl font-black tracking-tight text-[#CBD5E1]">
                    —
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
