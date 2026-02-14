"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Radio, Trophy, Search } from "lucide-react";

interface Session {
  playerId?: string;
  playerName: string;
  playerSlug?: string;
  date: string;
  sessionType?: string;
  pitchCount: number | null;
  pitchTypes?: string[];
  weightedAvgVelo: number | null;
  maxVelo: number | null;
  path?: string;
  pitchesPath?: string;
  pitchTypesPath?: string;
  summaryPath?: string;
  team?: string;
  handedness?: string;
  updatedAt?: string;
}

function normalizeSession(raw: Record<string, unknown>): Session {
  return {
    playerId: (raw.playerId as string) ?? (raw.playerSlug as string) ?? "",
    playerName: (raw.playerName as string) ?? "Unknown",
    playerSlug: (raw.playerSlug as string) ?? "",
    date: (raw.date as string) ?? "",
    sessionType: (raw.sessionType as string) ?? undefined,
    pitchCount: (raw.pitchCount as number) ?? (raw.totalPitches as number) ?? null,
    pitchTypes: Array.isArray(raw.pitchTypes) ? raw.pitchTypes : undefined,
    weightedAvgVelo: (raw.weightedAvgVelo as number) ?? null,
    maxVelo: (raw.maxVelo as number) ?? null,
    path: (raw.path as string) ?? undefined,
    pitchesPath: (raw.pitchesPath as string) ?? undefined,
    pitchTypesPath: (raw.pitchTypesPath as string) ?? undefined,
    summaryPath: (raw.summaryPath as string) ?? undefined,
    team: (raw.team as string) ?? undefined,
    handedness: (raw.handedness as string) ?? undefined,
    updatedAt: (raw.updatedAt as string) ?? undefined,
  };
}

function extractDateSlug(path?: string): string | null {
  if (!path) return null;
  const match = path.match(/\/trackman\/sessions\/[^/]+\/([^/]+)\//);
  return match?.[1] ?? null;
}

function formatDateLabel(raw: string): string {
  if (raw.includes("__")) {
    const [start, end] = raw.split("__");
    const startLabel = start.replace(/_/g, "/").replace(/-/g, "/");
    const endLabel = end.replace(/_/g, "/").replace(/-/g, "/");
    return `${startLabel} \u2014 ${endLabel}`;
  }
  return raw.replace(/_/g, "/").replace(/-/g, "/");
}

function sessionHref(s: Session): string {
  // If there's a pitchesPath from the PDF pipeline, build a route that can load it
  if (s.pitchesPath || s.pitchTypesPath) {
    const slug = s.playerSlug || s.playerId || "unknown";
    const dateSlug =
      extractDateSlug(s.pitchesPath) ??
      extractDateSlug(s.pitchTypesPath) ??
      s.date.replace(/-/g, "_");
    return `/trackman/session/${slug}/${dateSlug}`;
  }
  // Legacy: direct player/date route
  return `/trackman/session/${s.playerId}/${s.date}`;
}

export default function TrackmanSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Load from both index sources
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
        const key = `${s.playerSlug || s.playerId}-${s.date}`;
        if (!seen.has(key) || (s.updatedAt ?? "") > (seen.get(key)!.updatedAt ?? "")) {
          seen.set(key, s);
        }
      }

      // Sort by date descending
      const merged = Array.from(seen.values()).sort((a, b) => b.date.localeCompare(a.date));
      setSessions(merged);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(
      (s) =>
        s.playerName.toLowerCase().includes(q) ||
        (s.sessionType ?? "").toLowerCase().includes(q) ||
        s.date.includes(q),
    );
  }, [sessions, search]);

  // Unique players for quick stats
  const playerCount = useMemo(
    () => new Set(sessions.map((s) => s.playerSlug || s.playerId)).size,
    [sessions],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Radio className="w-4 h-4 text-emerald-400" />
          <h1 className="text-sm font-semibold">Trackman Sessions</h1>
        </div>
        <Link
          href="/trackman/leaderboards"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          Leaderboards
        </Link>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-zinc-500 text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
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
              <span>{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
              <span>{playerCount} player{playerCount !== 1 ? "s" : ""}</span>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by player, date, or session type..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-md pl-9 pr-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
              />
            </div>

            {/* Session list */}
            <div className="space-y-2">
              {filtered.map((s, i) => {
                const dateSlug =
                  extractDateSlug(s.pitchesPath) ??
                  extractDateSlug(s.pitchTypesPath) ??
                  s.date;
                const dateLabel = formatDateLabel(dateSlug);
                return (
                  <Link
                    key={`${s.playerSlug || s.playerId}-${s.date}-${i}`}
                    href={sessionHref(s)}
                    className="block bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.playerName}</span>
                        {s.handedness && (
                          <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1 py-0.5 rounded">
                            {s.handedness}
                          </span>
                        )}
                      </div>
                      {s.pitchCount !== null && (
                        <span className="text-xs text-zinc-500 font-mono">
                          {s.pitchCount} pitches
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-400">{dateLabel}</span>
                      {s.sessionType && (
                        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {s.sessionType}
                        </span>
                      )}
                      {s.weightedAvgVelo != null && s.maxVelo != null && (
                        <span className="text-[10px] text-zinc-600 font-mono">
                          Avg {s.weightedAvgVelo.toFixed(1)} mph &middot; Max {s.maxVelo.toFixed(1)} mph
                        </span>
                      )}
                      {s.pitchTypes && s.pitchTypes.length > 0 && (
                        <span className="text-[10px] text-zinc-600">
                          {s.pitchTypes.join(", ")}
                        </span>
                      )}
                    </div>
                    {s.pitchCount === null && (
                      <div className="text-[10px] text-zinc-600 mt-1">
                        Pitch counts not provided in this PDF export.
                      </div>
                    )}
                  </Link>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-zinc-500 text-sm text-center py-4">No sessions match your search.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
