"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Outing } from "@/lib/dataIndex";
import { seasonFromDateId } from "@/lib/season";
import Segment from "@/app/components/Segment";

type SeasonValue = "2026" | "2025" | "all";

type OutingSelectProps = {
  playerId: string;
  outings: Outing[];
  selectedOutingId: string;
};

const CURRENT_SEASON = 2026;

export default function OutingSelect({
  playerId,
  outings,
  selectedOutingId,
}: OutingSelectProps) {
  const router = useRouter();

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
    return Array.from(s).sort((a, b) => b - a);
  }, [outings]);

  const hasMultipleSeasons = seasons.length > 1;

  const [seasonFilter, setSeasonFilter] = useState<SeasonValue>(
    String(CURRENT_SEASON) as SeasonValue
  );

  const filtered = useMemo(() => {
    if (!hasMultipleSeasons || seasonFilter === "all") return outings;
    const yr = Number(seasonFilter);
    return outings.filter((o) => {
      const dateId = o.id.split("/")[1];
      return dateId && seasonFromDateId(dateId) === yr;
    });
  }, [outings, seasonFilter, hasMultipleSeasons]);

  return (
    <div className="flex items-center gap-3">
      {hasMultipleSeasons && (
        <Segment
          label="Season"
          options={[
            ...seasons.map((yr) => ({ value: String(yr), display: String(yr) })),
            { value: "all", display: "All" },
          ]}
          selected={seasonFilter}
          onChange={(v) => setSeasonFilter(v as SeasonValue)}
        />
      )}
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <span>Outing</span>
        <select
          className="bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-md px-2 py-1 text-xs"
          value={filtered.some((o) => o.id === selectedOutingId) ? selectedOutingId : filtered[0]?.id ?? ""}
          onChange={(event) =>
            router.push(`/player/${playerId}?outingId=${event.target.value}`)
          }
        >
          {filtered.map((outing) => (
            <option key={outing.id} value={outing.id}>
              {outing.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
