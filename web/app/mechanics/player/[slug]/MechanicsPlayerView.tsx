"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, GaugeCircle } from "lucide-react";
import { scoreColor } from "@/lib/mechanics/labels";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact } from "@/lib/handBadge";
import Breadcrumbs from "@/app/components/Breadcrumbs";
import {
  LeaderboardHero,
  LeaderboardPageFrame,
  LeaderboardPanel,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";

interface SessionEntry {
  slug: string;
  date: string;
  label: string;
  efficiency_score: number;
  efficiency_low_confidence: boolean;
  hand: "R" | "L";
  view_mode: string;
  pass_count: number;
  fail_count: number;
}

interface PlayerEntry {
  slug: string;
  profile_slug?: string;
  player_id: string;
  name: string;
  sessions: SessionEntry[];
}

interface MechanicsIndex {
  players: PlayerEntry[];
}

export default function MechanicsPlayerView({ playerSlug }: { playerSlug: string }) {
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get("from") === "profile";
  const profileSlug = searchParams.get("slug");
  const backHref = fromProfile && profileSlug ? `/players/${profileSlug}?tab=mechanics` : "/mechanics";

  const [player, setPlayer] = useState<PlayerEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/mechanics/index.json")
      .then((r) => {
        if (!r.ok) throw new Error("Index not found");
        return r.json() as Promise<MechanicsIndex>;
      })
      .then((data) => {
        const found = data.players.find(
          (p) => p.slug === playerSlug || p.profile_slug === playerSlug,
        );
        if (!found) throw new Error("Player not found");
        setPlayer(found);
        setLoading(false);
      })
      .catch((e) => {
        setError((e as Error).message ?? "Failed to load");
        setLoading(false);
      });
  }, [playerSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)]">
        <p className="text-sm text-zinc-500">Loading sessions…</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.12),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.08),_transparent_26%),linear-gradient(180deg,_#09090b_0%,_#111827_56%,_#09090b_100%)]">
        <p className="text-sm text-zinc-400">{error ?? "Not found."}</p>
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    );
  }

  const sorted = [...player.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const displayName = getCanonicalName(player.name ?? playerSlug);
  const latest = sorted[0] ?? null;

  return (
    <LeaderboardPageFrame maxWidth="max-w-5xl">
      <div className="flex flex-col gap-6 pb-10">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Mechanics Hub", href: "/mechanics" },
            { label: displayName },
          ]}
        />

        <LeaderboardHero
          tone="violet"
          icon={GaugeCircle}
          eyebrow="Mechanics Profile"
          title={displayName}
          description="Review session history and open any mechanics breakdown, starting with the latest session."
          meta={
            <>
              <LeaderboardPill tone="violet">
                {sorted.length} Session{sorted.length !== 1 ? "s" : ""}
              </LeaderboardPill>
              {latest ? (
                <LeaderboardPill tone="neutral">Latest {latest.date}</LeaderboardPill>
              ) : null}
            </>
          }
          side={
            <>
              <Link href="/mechanics/faq" className="block">
                <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-violet-500/25">
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
              <Link href={backHref} className="block">
                <div className="rounded-3xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-smooth hover:border-violet-500/25">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
                      <ArrowLeft className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        Return
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">
                        {fromProfile ? "Back to Profile" : "Back to Mechanics Hub"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </>
          }
        />

        <LeaderboardPanel className="p-5 sm:p-6">
          <div className="mb-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">
              Session History
            </div>
            <div className="mt-1 text-sm text-zinc-300">
              Ordered by most recent. Open any session to view the full breakdown.
            </div>
          </div>

          {sorted.length === 0 ? (
            <div className="rounded-[1.4rem] border border-zinc-800/70 bg-zinc-950/55 px-4 py-10 text-center text-sm text-zinc-500">
              No mechanics sessions recorded for this player yet.
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((session) => {
                const color = scoreColor(session.efficiency_score);
                return (
                  <Link
                    key={session.slug}
                    href={`/mechanics/session/${player.slug}/${session.slug}${fromProfile && profileSlug ? `?from=profile&slug=${profileSlug}` : ""}`}
                    className="group grid gap-4 rounded-[1.6rem] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(17,24,39,0.64),rgba(9,9,11,0.88))] p-5 transition-all duration-300 hover:border-violet-500/28 hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
                  >
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                        {session.date}
                      </p>
                      <p className="mb-2 text-sm font-semibold text-zinc-100">{session.label}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-600">
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(session.hand)}`}
                        >
                          {session.hand === "R" ? "RHP" : "LHP"}
                        </span>
                        <span className="text-zinc-700">·</span>
                        <span className="capitalize">{session.view_mode.replace(/_/g, " ")}</span>
                        {session.efficiency_low_confidence ? (
                          <>
                            <span className="text-zinc-700">·</span>
                            <span className="text-amber-500">Low confidence</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3 sm:min-w-[13rem]">
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                          Session Score
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="text-green-500">{session.pass_count} PASS</span>
                          <span className="text-zinc-700">·</span>
                          <span className="text-red-500">{session.fail_count} FAIL</span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span
                          className="text-2xl font-black font-mono tabular-nums"
                          style={{ color }}
                        >
                          {session.efficiency_score.toFixed(1)}
                        </span>
                        <span className="text-xs font-mono text-zinc-600">/10</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800/80 bg-zinc-950/85 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-300 transition-smooth group-hover:border-violet-500/25">
                        Open
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </LeaderboardPanel>
      </div>
    </LeaderboardPageFrame>
  );
}
