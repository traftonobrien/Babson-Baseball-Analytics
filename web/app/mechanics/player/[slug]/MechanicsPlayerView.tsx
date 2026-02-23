"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { scoreColor } from "@/lib/mechanics/labels";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact } from "@/lib/handBadge";

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
          (p) => p.slug === playerSlug || p.profile_slug === playerSlug
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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm">Loading sessions…</p>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4">
        <p className="text-zinc-400 text-sm">{error ?? "Not found."}</p>
        <Link href="/" className="text-xs text-zinc-600 hover:text-zinc-400">
          ← Home
        </Link>
      </div>
    );
  }

  const sorted = [...player.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const displayName = getCanonicalName(player.name ?? playerSlug);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Nav */}
      <div className="bg-zinc-950/90 backdrop-blur-sm border-b border-zinc-800/40 px-6 py-2.5 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto">
          <Link
            href={backHref}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-smooth w-fit"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {fromProfile ? "Profile" : "Home"}
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">
          Mechanics Analysis
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50 mb-1">{displayName}</h1>
        <p className="text-sm text-zinc-500 mb-8">
          {sorted.length} session{sorted.length !== 1 ? "s" : ""}
        </p>

        <div className="space-y-3">
          {sorted.map((session) => {
            const color = scoreColor(session.efficiency_score);
            return (
              <Link
                key={session.slug}
                href={`/mechanics/session/${player.slug}/${session.slug}${fromProfile && profileSlug ? `?from=profile&slug=${profileSlug}` : ""}`}
                className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-smooth group"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-zinc-600 mb-0.5">{session.date}</p>
                  <p className="text-sm font-semibold text-zinc-100 mb-1">{session.label}</p>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(session.hand)}`}
                    >
                      {session.hand === "R" ? "RHP" : "LHP"}
                    </span>
                    <span>·</span>
                    <span className="capitalize">{session.view_mode.replace(/_/g, " ")}</span>
                  </div>
                </div>

                {/* Score + pass/fail */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-2xl font-black font-mono tabular-nums"
                      style={{ color }}
                    >
                      {session.efficiency_score.toFixed(1)}
                    </span>
                    <span className="text-xs text-zinc-600 font-mono">/10</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="text-green-500">{session.pass_count} PASS</span>
                    <span className="text-zinc-700">·</span>
                    <span className="text-red-500">{session.fail_count} FAIL</span>
                  </div>
                </div>

                <span className="text-zinc-700 group-hover:text-zinc-400 transition-smooth text-lg">
                  →
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
