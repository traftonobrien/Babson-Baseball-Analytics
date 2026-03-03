"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { scoreColor, confidenceLabel } from "@/lib/mechanics/labels";

interface SessionEntry {
  slug: string;
  date: string;
  label: string;
  efficiency_score: number;
  hand: "R" | "L";
  view_mode: string;
  pass_count: number;
  fail_count: number;
  avg_confidence?: number;
  low_confidence_count?: number;
}

interface PlayerEntry {
  slug: string;
  player_id: string;
  name: string;
  sessions: SessionEntry[];
}

interface MechanicsIndex {
  players: PlayerEntry[];
}

interface MechanicsProfileSectionProps {
  playerId: string;
}

export function MechanicsProfileSection({ playerId }: MechanicsProfileSectionProps) {
  const [player, setPlayer] = useState<PlayerEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/mechanics/index.json")
      .then((r) => (r.ok ? (r.json() as Promise<MechanicsIndex>) : null))
      .then((data) => {
        if (!data) {
          setLoaded(true);
          return;
        }
        setPlayer(data.players.find((p) => p.player_id === playerId) ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [playerId]);

  if (!loaded) return null;

  if (!player || player.sessions.length === 0) {
    return (
      <div className="rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/72 p-5 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500 mb-2">
          Mechanics Analysis
        </p>
        <p className="text-sm text-zinc-500">No mechanics sessions recorded.</p>
      </div>
    );
  }

  const sorted = [...player.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const color = scoreColor(latest.efficiency_score);
  const confLabel =
    latest.avg_confidence != null ? confidenceLabel(latest.avg_confidence) : null;
  const confPct =
    latest.avg_confidence != null
      ? `${(latest.avg_confidence * 100).toFixed(0)}%`
      : null;

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-zinc-800/80 bg-zinc-950/72 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="border-b border-zinc-800/80 px-5 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-zinc-500">Mechanics Analysis</p>
        <p className="mt-1 text-sm text-zinc-300">Latest movement-efficiency read tied to this pitcher.</p>
      </div>
      <div className="p-5">
        {/* Score + metadata row */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">{latest.date}</p>
            <p className="text-sm text-zinc-200 font-medium leading-tight">{latest.label}</p>
            {/* Pass/fail + confidence */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium">
              <span className="text-green-500">{latest.pass_count} PASS</span>
              <span className="text-zinc-700">·</span>
              <span className="text-red-500">{latest.fail_count} FAIL</span>
              {confPct && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span
                    className={
                      latest.avg_confidence != null && latest.avg_confidence < 0.5
                        ? "text-amber-500"
                        : "text-zinc-500"
                    }
                  >
                    {confPct} conf{confLabel ? ` · ${confLabel}` : ""}
                  </span>
                </>
              )}
              {latest.low_confidence_count != null && latest.low_confidence_count > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-amber-600">
                    {latest.low_confidence_count} low-conf metric
                    {latest.low_confidence_count !== 1 ? "s" : ""}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="flex items-baseline gap-0.5 shrink-0">
            <span className="text-3xl font-black font-mono tabular-nums" style={{ color }}>
              {latest.efficiency_score.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-600">/10</span>
          </div>
        </div>

        <Link
          href={`/mechanics/session/${player.slug}/${latest.slug}`}
          className="block w-full rounded-full border border-zinc-800 bg-zinc-950/85 px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-300 transition-smooth hover:border-zinc-700 hover:text-zinc-100"
        >
          Open Mechanics
        </Link>
      </div>
    </div>
  );
}
