"use client";

import { ArrowRight, ClipboardList } from "lucide-react";
import {
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
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
    <LeaderboardPanel className="overflow-hidden p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(14,165,233,0.14),transparent_24%),radial-gradient(circle_at_86%_22%,rgba(16,185,129,0.12),transparent_22%),linear-gradient(180deg,rgba(13,18,21,0.86),rgba(9,9,11,0.95))]" />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)] xl:items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200">
            <ClipboardList className="h-3.5 w-3.5" />
            Player Visuals
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-50">
            Search a {isPitcher ? "pitcher" : "hitter"} to open the visuals.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-zinc-400">
            {isPitcher
              ? `This page mirrors the Savant workflow with the ${TEAM_NAME} pitcher data we actually capture: player search, season and pitch filters, pitch-speed scope, command/result slices, rough zone buckets, and a one-line season table below.`
              : `This page mirrors the Savant workflow with the ${TEAM_NAME} data we actually capture: player search, pitcher hand, season and pitch filters, pitch-speed scope, rough zone buckets, and a one-line season table below.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <LeaderboardPill tone="sky">
              {filteredEntries.length} roster {countNounForView(view)}
              {filteredEntries.length === 1 ? "" : "s"}
            </LeaderboardPill>
            <LeaderboardPill tone="neutral">9 rough zone buckets</LeaderboardPill>
            <LeaderboardPill tone="neutral">No EV or contour layer</LeaderboardPill>
          </div>
          {pinnedSlug && onOpenPinned ? (
            <button
              type="button"
              onClick={onOpenPinned}
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-sm font-semibold text-zinc-200 transition-smooth hover:border-emerald-400/25 hover:text-emerald-200"
            >
              Reopen pinned {countNounForView(view)}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-zinc-800/80 bg-[radial-gradient(circle_at_50%_30%,rgba(45,212,191,0.08),transparent_34%),linear-gradient(180deg,rgba(24,24,27,0.96),rgba(9,9,11,0.96))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <div className="relative aspect-square rounded-[1.75rem] border border-zinc-800/80 bg-zinc-950/60">
            <div className="pointer-events-none absolute inset-[22%] rounded-[1.5rem] border border-dashed border-zinc-500/30" />
            {Object.values(ZONE_BUCKET_LAYOUT).map((bucket) => (
              <div
                key={bucket.label}
                className="absolute overflow-hidden rounded-[1.4rem] border border-zinc-800/80 bg-zinc-950/70"
                style={{
                  ...bucket.style,
                  clipPath: bucket.chaseKind ? clipPathForLocationCell(bucket.chaseKind) : "none",
                }}
              >
                <div className="p-2.5">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">
                    {bucket.label}
                  </div>
                  <div className="mt-6 text-right text-xl font-black tracking-tight text-zinc-700">
                    —
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </LeaderboardPanel>
  );
}
