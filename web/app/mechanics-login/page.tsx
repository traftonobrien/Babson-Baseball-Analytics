"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Film } from "lucide-react";
import {
  LeaderboardPageFrame,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";

export default function MechanicsLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/mechanics-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/mechanics");
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error || "Wrong password");
      setLoading(false);
    }
  }

  return (
    <LeaderboardPageFrame maxWidth="max-w-5xl">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-violet-500/18 bg-zinc-950/82 shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(139,92,246,0.16),transparent_28%),radial-gradient(circle_at_84%_24%,rgba(59,130,246,0.10),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
          <div className="relative p-6 sm:p-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-300">
              <Film className="h-3.5 w-3.5" />
              Mechanics Access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-50 sm:text-4xl">
              Mechanics Portal
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-zinc-400">
              Enter the mechanics access code to open the AWRE session and player views.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeaderboardPill tone="violet">Restricted section</LeaderboardPill>
              <LeaderboardPill tone="neutral">Video and model review</LeaderboardPill>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-3xl border border-zinc-800/80 bg-zinc-900/45 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:p-6"
            >
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Access Code
              </label>
              <input
                type="password"
                placeholder="Enter mechanics access code"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-smooth focus:border-violet-400/35"
                autoFocus
              />
              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-violet-200 transition-all duration-300 hover:border-violet-400/40 hover:bg-violet-500/14 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Opening..." : "Enter"}
              </button>
              <Link
                href="/"
                className="mt-4 block text-center text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-smooth hover:text-zinc-300"
              >
                Back to Home
              </Link>
            </form>
          </div>
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
