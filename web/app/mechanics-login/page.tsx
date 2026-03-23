"use client";

import { useState, FormEvent } from "react";
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/mechanics-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        window.location.assign("/mechanics");
        return;
      }

      const data = await response.json().catch(() => null);
      setError(data?.error || "Unable to sign in");
    } catch {
      setError("Unable to reach the server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-5xl">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-violet-800">
              <Film className="h-3.5 w-3.5" aria-hidden />
              Mechanics Access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-4xl">
              Mechanics Portal
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
              Enter the mechanics access code to open the AWRE session and player views.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeaderboardPill tone="violet" variant="light">
                Restricted section
              </LeaderboardPill>
              <LeaderboardPill tone="neutral" variant="light">
                Video and model review
              </LeaderboardPill>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-2xl border border-slate-200 bg-background p-5 sm:p-6"
            >
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Access Code
              </label>
              <input
                type="password"
                placeholder="Enter mechanics access code"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition-smooth placeholder:text-slate-400 focus:border-violet-300 focus:ring-2 focus:ring-violet-500/20"
                autoFocus
              />
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-sm transition-smooth hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Opening..." : "Enter"}
              </button>
              <Link
                href="/"
                className="mt-4 block text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition-smooth hover:text-slate-800"
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
