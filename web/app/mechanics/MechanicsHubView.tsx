"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight } from "lucide-react";
import { scoreColor, confidenceLabel } from "@/lib/mechanics/labels";
import {
  getLatestSession,
  getTotalSessions,
  filterPlayers,
  sortPlayers,
  type MechanicsIndex,
  type HubPlayerEntry,
  type SortKey,
} from "@/lib/mechanics/hub";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact } from "@/lib/handBadge";

// ---------------------------------------------------------------------------
// PlayerCard
// ---------------------------------------------------------------------------
function PlayerCard({ player }: { player: HubPlayerEntry }) {
  const router = useRouter();
  const [thumbError, setThumbError] = useState(false);
  const latest = getLatestSession(player);

  if (!latest) return null;

  const color = scoreColor(latest.efficiency_score);
  const confPct = latest.avg_confidence != null ? Math.round(latest.avg_confidence * 100) : null;
  const thumbSrc = `/mechanics/${player.slug}/${latest.slug}/release.png`;
  const latestHref = `/mechanics/session/${player.slug}/${latest.slug}`;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`View mechanics for ${getCanonicalName(player.name ?? player.slug)}, score ${latest.efficiency_score.toFixed(1)} out of 10`}
      onClick={() => router.push(latestHref)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          router.push(latestHref);
        }
      }}
      className="group relative bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col hover:border-violet-500/50 hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/10 transition-smooth duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {/* Hover affordance */}
      <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-medium text-violet-400">
        <span>View</span>
        <ArrowRight className="w-3 h-3" />
      </div>
      {/* Phase thumbnail strip — silently hidden on 404 */}
      {!thumbError && (
        // eslint-disable-next-line @next/next/no-img-element
        <div className="relative h-24 bg-zinc-950 overflow-hidden">
          <img
            src={thumbSrc}
            alt={`${getCanonicalName(player.name ?? player.slug)} release`}
            className="w-full h-full object-cover object-top"
            onError={() => setThumbError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Identity row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-100 text-sm leading-tight truncate">
              {getCanonicalName(player.name ?? player.slug)}
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-1.5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(latest.hand)}`}
              >
                {latest.hand === "R" ? "RHP" : "LHP"}
              </span>
            </p>
          </div>
        </div>

        {/* Score + stats */}
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-0.5 shrink-0">
            <span
              className="text-3xl font-black font-mono tabular-nums leading-none"
              style={{ color }}
            >
              {latest.efficiency_score.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-600 font-mono">/10</span>
          </div>

          <div className="flex flex-col gap-0.5 text-[10px]">
            {confPct !== null && (
              <span className="text-zinc-500">
                {confPct}% conf&thinsp;
                <span className="text-zinc-600">({confidenceLabel(latest.avg_confidence ?? null)})</span>
              </span>
            )}
            <span>
              <span className="text-green-500">{latest.pass_count}P</span>
              <span className="text-zinc-700"> · </span>
              <span className="text-red-500">{latest.fail_count}F</span>
              {latest.low_confidence_count != null && latest.low_confidence_count > 0 && (
                <span className="text-zinc-600"> · {latest.low_confidence_count} low</span>
              )}
            </span>
          </div>
        </div>

        {/* Latest session label */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[9px] text-zinc-600 shrink-0">{latest.date}</span>
          <span className="text-[9px] text-zinc-700">·</span>
          <span className="text-[9px] text-zinc-500 truncate">{latest.label}</span>
        </div>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MechanicsHubView
// ---------------------------------------------------------------------------
export default function MechanicsHubView({ index }: { index: MechanicsIndex }) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [filterLowConf, setFilterLowConf] = useState(false);

  const totalSessions = getTotalSessions(index.players);

  const displayed = useMemo(() => {
    const filtered = filterPlayers(index.players, search, filterLowConf);
    return sortPlayers(filtered, sortKey);
  }, [index.players, search, sortKey, filterLowConf]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Header */}
      <div className="border-b border-zinc-800/50 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
            Analysis Portal
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50 mb-1">Mechanics Hub</h1>
          <p className="text-sm text-zinc-500 mb-4">
            Video-first mechanics snapshots and session history
          </p>
          <div className="flex items-center gap-3 text-[11px] text-zinc-600">
            <span>
              {index.players.length} pitcher{index.players.length !== 1 ? "s" : ""}
            </span>
            <span>·</span>
            <span>
              {totalSessions} session{totalSessions !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 py-4 border-b border-zinc-800/30 bg-zinc-950/80">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-smooth"
            />
          </div>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-600 cursor-pointer transition-smooth"
          >
            <option value="date_desc">Latest first</option>
            <option value="score_desc">Highest score</option>
            <option value="conf_desc">Highest confidence</option>
            <option value="name_asc">Name A→Z</option>
          </select>

          {/* Low confidence filter toggle */}
          <button
            onClick={() => setFilterLowConf(!filterLowConf)}
            className={`text-[11px] px-3 py-2 rounded-lg border transition-smooth whitespace-nowrap ${
              filterLowConf
                ? "bg-amber-950/50 border-amber-800/60 text-amber-400"
                : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700"
            }`}
          >
            Low confidence only
          </button>
        </div>
      </div>

      {/* Player grid */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {displayed.length === 0 ? (
          <div className="text-center py-16 px-4">
            {index.players.length === 0 ? (
              <>
                <p className="text-zinc-500 text-sm mb-2">No mechanics sessions yet</p>
                <p className="text-zinc-600 text-xs max-w-md mx-auto">
                  Mechanics data is added when video analysis sessions are processed. Check back after new sessions are run.
                </p>
              </>
            ) : (
              <p className="text-zinc-600 text-sm">
                No players match your filters. Try a different search or clear the low-confidence filter.
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((player) => (
              <PlayerCard key={player.slug} player={player} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
