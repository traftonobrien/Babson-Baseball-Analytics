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
  const confLabel =
    latest.avg_confidence != null ? confidenceLabel(latest.avg_confidence) : null;
  const confPct =
    latest.avg_confidence != null
      ? `${(latest.avg_confidence * 100).toFixed(0)}%`
      : null;

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
      <div className="px-4 py-2.5 border-b border-zinc-800">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500">Mechanics Analysis</p>
      </div>
      <div className="p-4">
        {/* Score + metadata row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-zinc-600 mb-0.5">{latest.date}</p>
            <p className="text-sm text-zinc-200 font-medium leading-tight">{latest.label}</p>
            {/* Pass/fail + confidence */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[9px]">
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
          className="block w-full text-center text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 transition-smooth"
        >
          Open Mechanics
        </Link>
      </div>
    </div>
  );
}
