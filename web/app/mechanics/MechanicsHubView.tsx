"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowRight, BookOpen, GaugeCircle, Video } from "lucide-react";
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
import {
  Button,
  leaderboardFilterButtonBaseClassName,
  leaderboardFilterButtonGhostInactiveClassName,
} from "@/components/ui/neon-button";
import {
  LeaderboardHero,
  LeaderboardIntro,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
  LeaderboardToolbar,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { GlowingEffect } from "@/components/ui/glowing-effect";

const mechanicsActiveFilterClassName =
  "border-violet-400/45 bg-violet-500/16 text-violet-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(167,139,250,0.16),0_0_20px_rgba(139,92,246,0.12)]";

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
      className="group relative flex h-full flex-col overflow-hidden rounded-[1.7rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.7),rgba(9,9,11,0.9))] shadow-[0_22px_56px_rgba(0,0,0,0.22)] transition-all duration-300 cursor-pointer hover:border-violet-500/35 hover:-translate-y-0.5 hover:shadow-[0_28px_64px_rgba(0,0,0,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
    >
      <GlowingEffect
        glow
        disabled={false}
        proximity={72}
        inactiveZone={0.2}
        spread={30}
        movementDuration={0.9}
        borderWidth={2}
        className="opacity-90"
      />
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-2xl border border-zinc-800/80 bg-zinc-950/88 text-zinc-500 transition-all duration-300 group-hover:border-violet-500/30 group-hover:text-violet-300">
        <ArrowRight className="h-3.5 w-3.5" />
      </div>

      {!thumbError && (
        <div className="relative h-28 overflow-hidden bg-zinc-950">
          <Image
            src={thumbSrc}
            alt={`${getCanonicalName(player.name ?? player.slug)} release`}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover object-top"
            onError={() => setThumbError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950 to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Latest Session
            </p>
            <p className="mt-2 truncate text-base font-semibold leading-tight text-zinc-100">
              {getCanonicalName(player.name ?? player.slug)}
            </p>
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(latest.hand)}`}
              >
                {latest.hand === "R" ? "RHP" : "LHP"}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 text-right">
            <div
              className="text-2xl font-black font-mono leading-none tabular-nums"
              style={{ color }}
            >
              {latest.efficiency_score.toFixed(1)}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
              /10
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Confidence
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              {confPct !== null ? `${confPct}%` : "—"}
            </div>
            {confPct !== null ? (
              <div className="mt-1 text-[10px] text-zinc-600">
                {confidenceLabel(latest.avg_confidence ?? null)}
              </div>
            ) : null}
          </div>
          <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/80 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Flags
            </div>
            <div className="mt-1 text-[11px] font-semibold">
              <span className="text-green-500">{latest.pass_count} Pass</span>
              <span className="text-zinc-700"> · </span>
              <span className="text-red-500">{latest.fail_count} Fail</span>
            </div>
            {latest.low_confidence_count != null && latest.low_confidence_count > 0 ? (
              <div className="mt-1 text-[10px] text-zinc-600">
                {latest.low_confidence_count} low-confidence
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/80 px-3.5 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
              {latest.date}
            </div>
            <div className="mt-1 truncate text-[11px] text-zinc-400">
              {latest.label}
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300">
            Open
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
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

  const totalSessions = getTotalSessions(index.players);

  const displayed = useMemo(() => {
    const filtered = filterPlayers(index.players, search, false);
    return sortPlayers(filtered, sortKey);
  }, [index.players, search, sortKey]);

  return (
    <LeaderboardPageFrame maxWidth="max-w-6xl">
      <div className="flex flex-col gap-6 pb-10">
        <LeaderboardIntro breadcrumbs={[{ label: "Home", href: "/" }, { label: "Mechanics Hub" }]}>
        <LeaderboardHero
          tone="violet"
          icon={GaugeCircle}
          eyebrow="Mechanics Hub"
          title="Mechanics Hub"
          description="Review mechanics sessions, quick reads, and clips for every pitcher."
          meta={
            <>
              <LeaderboardPill tone="violet">
                {index.players.length} Pitcher{index.players.length !== 1 ? "s" : ""}
              </LeaderboardPill>
              <LeaderboardPill tone="neutral">
                {totalSessions} Session{totalSessions !== 1 ? "s" : ""}
              </LeaderboardPill>
            </>
          }
          side={
            <>
              <Link href="/mechanics/faq" className="block">
                <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-violet-500/25">
                  <GlowingEffect
                    glow
                    disabled={false}
                    proximity={56}
                    inactiveZone={0.22}
                    spread={24}
                    movementDuration={0.8}
                    borderWidth={2}
                    className="opacity-80"
                  />
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Guide
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">
                        Metrics Dictionary
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
              <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <GlowingEffect
                  glow
                  disabled={false}
                  proximity={56}
                  inactiveZone={0.22}
                  spread={24}
                  movementDuration={0.8}
                  borderWidth={2}
                  className="opacity-75"
                />
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                    <Video className="h-4 w-4" />
                  </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Workflow
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">
                        Latest session first
                      </div>
                    </div>
                </div>
              </div>
            </>
          }
        />
        </LeaderboardIntro>

        <LeaderboardToolbar>
          <div className="grid gap-4 xl:grid-cols-[minmax(14rem,1fr)_auto] xl:items-end">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Search
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-2xl border border-zinc-800/80 bg-zinc-950/75 py-2.5 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-smooth focus:border-violet-500/30"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                Sort
              </div>
              <div className="inline-flex flex-wrap gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-1.5">
                {([
                  { value: "date_desc", label: "Latest" },
                  { value: "score_desc", label: "Score" },
                  { value: "conf_desc", label: "Confidence" },
                  { value: "name_asc", label: "A-Z" },
                ] as const).map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant="ghost"
                    neon
                    tone="zinc"
                    onClick={() => setSortKey(option.value)}
                    className={`${leaderboardFilterButtonBaseClassName} min-w-[5rem] ${
                      sortKey === option.value
                        ? mechanicsActiveFilterClassName
                        : leaderboardFilterButtonGhostInactiveClassName
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </LeaderboardToolbar>

        <LeaderboardPanel className="p-5 sm:p-6">
        {displayed.length === 0 ? (
          <div className="px-4 py-16 text-center">
            {index.players.length === 0 ? (
              <>
                <p className="mb-2 text-sm text-zinc-500">No mechanics sessions yet</p>
                <p className="mx-auto max-w-md text-xs text-zinc-600">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((player) => (
              <PlayerCard key={player.slug} player={player} />
            ))}
          </div>
        )}
        </LeaderboardPanel>
      </div>
    </LeaderboardPageFrame>
  );
}
