"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { scoreColor } from "@/lib/mechanics/labels";

interface SessionEntry {
  slug: string;
  date: string;
  label: string;
  efficiency_score: number;
  hand: "R" | "L";
  view_mode: string;
  pass_count: number;
  fail_count: number;
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
      <div className="border border-zinc-800/60 rounded-xl p-4 bg-zinc-900/40">
        <p className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">
          Mechanics Analysis
        </p>
        <p className="text-xs text-zinc-700">No mechanics sessions recorded.</p>
      </div>
    );
  }

  const sorted = [...player.sessions].sort((a, b) => b.date.localeCompare(a.date));
  const latest = sorted[0];
  const color = scoreColor(latest.efficiency_score);

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Mechanics Analysis</p>
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-600 mb-0.5">{latest.date}</p>
            <p className="text-sm text-zinc-200 font-medium">{latest.label}</p>
            <div className="flex items-center gap-2 mt-1 text-[9px]">
              <span className="text-green-500">{latest.pass_count} PASS</span>
              <span className="text-zinc-700">·</span>
              <span className="text-red-500">{latest.fail_count} FAIL</span>
            </div>
          </div>
          <div className="flex items-baseline gap-1 shrink-0">
            <span className="text-3xl font-black font-mono tabular-nums" style={{ color }}>
              {latest.efficiency_score.toFixed(1)}
            </span>
            <span className="text-xs text-zinc-600">/10</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/mechanics/session/${player.slug}/${latest.slug}`}
            className="flex-1 text-center text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 transition-colors"
          >
            Open Mechanics
          </Link>
          {sorted.length > 1 && (
            <Link
              href={`/mechanics/player/${player.slug}`}
              className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap"
            >
              View All →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
