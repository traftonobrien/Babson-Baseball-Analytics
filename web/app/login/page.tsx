"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";
import {
  LeaderboardPageFrame,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        window.location.assign("/");
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
    <LeaderboardPageFrame maxWidth="max-w-5xl">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-[rgba(var(--babson-grey-rgb),0.24)] bg-zinc-950/80 shadow-2xl shadow-black/30">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(var(--babson-green-rgb),0.18),transparent_28%),radial-gradient(circle_at_84%_22%,rgba(var(--babson-grey-rgb),0.12),transparent_24%),linear-gradient(135deg,rgba(24,24,27,0.92),rgba(3,7,18,0.98))]" />
          <div className="relative p-6 sm:p-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-[rgba(var(--babson-grey-rgb),0.28)] bg-[linear-gradient(135deg,rgba(var(--babson-green-rgb),0.18),rgba(var(--babson-grey-rgb),0.1)_58%,rgba(9,9,11,0.92)_100%)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[rgb(226,236,232)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(var(--babson-green-rgb),0.05)]">
              <Image
                src="/babson-logo.svg"
                alt=""
                aria-hidden="true"
                width={14}
                height={14}
                className="h-3.5 w-3.5 shrink-0 opacity-90"
              />
              Secure Access
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-zinc-50 sm:text-4xl">
              Babson Baseball Pitching Portal
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-zinc-400">
              Enter the site password to open the full player, leaderboard, and reporting stack.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeaderboardPill tone="brand">Private access</LeaderboardPill>
              <LeaderboardPill tone="neutral">Coaching data only</LeaderboardPill>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-3xl border border-[rgba(var(--babson-grey-rgb),0.18)] bg-[linear-gradient(180deg,rgba(24,24,27,0.74),rgba(9,9,11,0.9))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_0_0_1px_rgba(var(--babson-green-rgb),0.04)] sm:p-6"
            >
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter site password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-3 w-full rounded-2xl border border-zinc-800 bg-zinc-950/85 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 outline-none transition-smooth focus:border-[rgba(var(--babson-green-rgb),0.45)] focus:shadow-[0_0_0_1px_rgba(var(--babson-green-rgb),0.12)]"
                autoFocus
              />
              {error ? <p className="mt-3 text-sm text-red-400">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-2xl border border-[rgba(var(--babson-grey-rgb),0.26)] bg-[rgba(var(--babson-green-rgb),0.14)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-[rgb(230,237,233)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_rgba(var(--babson-green-rgb),0.16)] transition-all duration-300 hover:border-[rgba(var(--babson-grey-rgb),0.38)] hover:bg-[rgba(var(--babson-green-rgb),0.2)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Opening..." : "Log In"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
