"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";

interface Session {
  playerId: string;
  playerName: string;
  date: string;
  sessionType?: string;
  pitchCount: number;
  path: string;
  updatedAt?: string;
}

export default function TrackmanSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/stats/trackman/sessions.json")
      .then((res) => {
        if (!res.ok) return [];
        return res.json();
      })
      .then((data) => {
        setSessions(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <Link href="/" className="text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-400" />
          <h1 className="text-sm font-semibold">Trackman Sessions</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-zinc-500 text-sm">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
            <Radio className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 text-sm">No Trackman sessions imported yet.</p>
            <p className="text-zinc-600 text-xs mt-2">
              Run <code className="bg-zinc-800 px-1 py-0.5 rounded">scripts/import_trackman_session.py</code> to import sessions.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
              {sessions.length} session{sessions.length !== 1 ? "s" : ""}
            </div>
            {sessions.map((s) => (
              <Link
                key={`${s.playerId}-${s.date}`}
                href={`/trackman/session/${s.playerId}/${s.date}`}
                className="block bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{s.playerName}</span>
                  <span className="text-xs text-zinc-500 font-mono">
                    {s.pitchCount} pitches
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-400">
                    {s.date.replace(/_/g, "/")}
                  </span>
                  {s.sessionType && (
                    <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                      {s.sessionType}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
