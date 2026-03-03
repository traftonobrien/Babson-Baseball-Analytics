"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Trophy, Search, BookOpen } from "lucide-react";
import { getCanonicalName } from "@/lib/canonicalPlayers";
import { handBadgeClassesCompact, parseHand } from "@/lib/handBadge";
import { useSelectedPlayer } from "@/lib/selectedPlayer";

interface Session {
  playerName: string;
  playerSlug: string;
  date: string;
  sessionType?: string;
  pitchCount: number | null;
  pitchTypes?: string[];
  weightedAvgVelo: number | null;
  handedness?: string;
  team?: string;
}

interface Player {
  name: string;
  slug: string;
  handedness?: string;
  team?: string;
  sessionCount: number;
  latestDate: string;
  latestAvgVelo: number | null;
  pitchTypes: string[];
}

function normalizeSession(raw: Record<string, unknown>): Session {
  return {
    playerName: (raw.playerName as string) ?? "Unknown",
    playerSlug: (raw.playerSlug as string) ?? "",
    date: (raw.date as string) ?? "",
    sessionType: (raw.sessionType as string) ?? undefined,
    pitchCount: (raw.pitchCount as number) ?? (raw.totalPitches as number) ?? null,
    pitchTypes: Array.isArray(raw.pitchTypes) ? raw.pitchTypes : undefined,
    weightedAvgVelo: (raw.weightedAvgVelo as number) ?? null,
    handedness: (raw.handedness as string) ?? undefined,
    team: (raw.team as string) ?? undefined,
  };
}

/** "2026-02-13" → "2/13/26" */
function formatDate(raw: string): string {
  const parts = raw.replace(/_/g, "-").split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    const shortYear = y.length === 4 ? y.slice(2) : y;
    return `${parseInt(m)}/${parseInt(d)}/${shortYear}`;
  }
  return raw;
}

function groupByPlayer(sessions: Session[]): Player[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = s.playerSlug;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const players: Player[] = [];
  for (const [slug, playerSessions] of map) {
    // Sort by date descending to find latest
    const sorted = [...playerSessions].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted[0];

    // Collect unique pitch types across all sessions
    const typeSet = new Set<string>();
    for (const s of playerSessions) {
      if (s.pitchTypes) {
        for (const t of s.pitchTypes) {
          if (t !== "Other") typeSet.add(t);
        }
      }
    }

    players.push({
      name: latest.playerName,
      slug,
      handedness: latest.handedness,
      team: latest.team,
      sessionCount: playerSessions.length,
      latestDate: latest.date,
      latestAvgVelo: latest.weightedAvgVelo,
      pitchTypes: Array.from(typeSet).sort(),
    });
  }

  // Sort by most recent session first
  players.sort((a, b) => b.latestDate.localeCompare(a.latestDate));
  return players;
}

export default function TrackmanPlayersPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { slug: selectedSlug } = useSelectedPlayer();

  useEffect(() => {
    const legacyFetch = fetch("/stats/trackman/sessions.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    const pdfFetch = fetch("/trackman/index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);

    Promise.all([legacyFetch, pdfFetch]).then(([legacy, pdf]) => {
      const all = [
        ...(Array.isArray(legacy) ? legacy : []),
        ...(Array.isArray(pdf) ? pdf : []),
      ].map((raw) => normalizeSession(raw));

      // Deduplicate by playerSlug + date
      const seen = new Map<string, Session>();
      for (const s of all) {
        const key = `${s.playerSlug}-${s.date}`;
        if (!seen.has(key)) seen.set(key, s);
      }

      setSessions(Array.from(seen.values()));
      setLoading(false);
    });
  }, []);

  const players = useMemo(() => groupByPlayer(sessions), [sessions]);

  const filtered = useMemo(() => {
    let result = players;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          getCanonicalName(p.name).toLowerCase().includes(q) ||
          p.slug.toLowerCase().includes(q),
      );
    }
    if (selectedSlug) {
      const idx = result.findIndex((p) => p.slug === selectedSlug);
      if (idx > 0) {
        const copy = [...result];
        const [me] = copy.splice(idx, 1);
        return [me, ...copy];
      }
    }
    return result;
  }, [players, search, selectedSlug]);

  const totalSessions = sessions.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition-smooth">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Radio className="w-4 h-4 text-blue-400" />
          <h1 className="text-sm font-semibold">Trackman Hub</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/trackman/faq"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-smooth"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Dictionary
          </Link>
          <div className="w-px h-3 bg-zinc-800" />
          <Link
            href="/trackman/leaderboard"
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-smooth"
          >
            <Trophy className="w-3.5 h-3.5" />
            Leaderboards
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-zinc-500 text-sm">Loading...</div>
        ) : players.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <Radio className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No Trackman sessions imported yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Run <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/import_trackman_pdf.py</code> to import a PDF export.
            </p>
          </div>
        ) : (
          <>
            {/* Stats strip */}
            <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
              <span>{players.length} player{players.length !== 1 ? "s" : ""}</span>
              <span>{totalSessions} session{totalSessions !== 1 ? "s" : ""}</span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search players..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Player cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map((p) => {
                const hand = parseHand(p.handedness);
                const isMe = p.slug === selectedSlug;
                return (
                  <Link
                    key={p.slug}
                    href={`/trackman/player/${p.slug}`}
                    className={`block bg-zinc-900 border rounded-lg p-4 hover:border-zinc-600 transition-smooth ${isMe ? "border-emerald-500/40" : "border-zinc-800"}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-50">
                          {getCanonicalName(p.name)}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-md px-1.5 py-0.5">
                            You
                          </span>
                        )}
                        {hand && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${handBadgeClassesCompact(hand)}`}
                          >
                            {hand === "L" ? "LHP" : "RHP"}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">
                        {p.sessionCount} session{p.sessionCount !== 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span className="text-zinc-600">
                        Last: {formatDate(p.latestDate)}
                      </span>
                    </div>
                  </Link>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4 col-span-2">
                  No players match your search.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
