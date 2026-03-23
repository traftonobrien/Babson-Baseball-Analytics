"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import { cn } from "@/lib/utils";

type SeasonValue = "2026" | "2025" | "all";

type OutingSelectProps = {
  playerId: string;
  outings: Outing[];
  selectedOutingId: string;
  /** Optional overrides for outing labels (e.g. from localStorage edits) */
  labelOverrides?: Record<string, string>;
};

const CURRENT_SEASON = 2026;

export default function OutingSelect({
  playerId,
  outings,
  selectedOutingId,
  labelOverrides,
}: OutingSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Determine which seasons exist
  const seasons = useMemo(() => {
    const s = new Set<number>();
    for (const o of outings) {
      const dateId = o.id.split("/")[1];
      if (dateId) {
        const yr = seasonFromDateId(dateId);
        if (yr) s.add(yr);
      }
    }
    return Array.from(s).sort((a, b) => a - b);
  }, [outings]);

  const hasMultipleSeasons = seasons.length > 1;

  const [seasonFilter, setSeasonFilter] = useState<SeasonValue>("all");

  useEffect(() => {
    if (!hasMultipleSeasons) {
      setSeasonFilter("all");
      return;
    }

    const selectedDateId = selectedOutingId.split("/")[1];
    const selectedSeason = selectedDateId ? seasonFromDateId(selectedDateId) : null;

    if (selectedSeason && seasons.includes(selectedSeason)) {
      setSeasonFilter(String(selectedSeason) as SeasonValue);
      return;
    }

    if (seasons.includes(CURRENT_SEASON)) {
      setSeasonFilter(String(CURRENT_SEASON) as SeasonValue);
      return;
    }

    setSeasonFilter(String(seasons[0] ?? CURRENT_SEASON) as SeasonValue);
  }, [hasMultipleSeasons, seasons, selectedOutingId]);

  const filtered = useMemo(() => {
    if (!hasMultipleSeasons || seasonFilter === "all") return outings;
    const yr = Number(seasonFilter);
    return outings.filter((o) => {
      const dateId = o.id.split("/")[1];
      return dateId && seasonFromDateId(dateId) === yr;
    });
  }, [outings, seasonFilter, hasMultipleSeasons]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      {hasMultipleSeasons && (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
            Season
          </div>
          <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-border bg-background p-1.5">
            {[
              ...seasons.map((yr) => ({ value: String(yr), display: String(yr) })),
              { value: "all", display: "All" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSeasonFilter(option.value as SeasonValue)}
                className={cn(
                  "min-w-[4.75rem] whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-smooth",
                  seasonFilter === option.value
                    ? "border border-orange-300 bg-orange-50 text-orange-900 shadow-sm"
                    : "border border-transparent bg-transparent text-slate-500 dark:text-zinc-400 hover:border-slate-200 dark:border-zinc-700 hover:bg-surface hover:text-slate-900 dark:hover:text-zinc-50",
                )}
              >
                {option.display}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="space-y-2 text-xs text-slate-500 dark:text-zinc-400">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-400 dark:text-zinc-500">
          Outing
        </span>
        <select
          className="min-w-[16rem] rounded-2xl border border-border bg-surface px-3 py-2.5 text-xs text-slate-900 dark:text-zinc-50 outline-none transition-all duration-300 hover:border-slate-300 dark:hover:border-zinc-600 focus:border-orange-300 focus:ring-2 focus:ring-orange-500/15"
          value={filtered.some((o) => o.id === selectedOutingId) ? selectedOutingId : filtered[0]?.id ?? ""}
          onChange={(event) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("outingId", event.target.value);
            router.push(`/player/${playerId}?${params.toString()}`);
          }}
        >
          {filtered.map((outing) => (
            <option key={outing.id} value={outing.id}>
              {labelOverrides?.[outing.id] ?? outing.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
