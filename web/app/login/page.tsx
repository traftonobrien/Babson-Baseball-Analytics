"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";
import {
  LeaderboardPageFrame,
  LeaderboardPill,
} from "@/app/components/leaderboards/LeaderboardChrome";
import { TEAM_NAME } from "@/lib/teamConfig";

function resolveReturnToPath(rawPath: string | null): string {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return "/";
  }
  return rawPath;
}

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
        const returnTo =
          typeof window === "undefined"
            ? "/"
            : resolveReturnToPath(
                new URLSearchParams(window.location.search).get("returnTo"),
              );
        window.location.assign(returnTo);
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
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700">
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
            <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 dark:text-zinc-50 sm:text-4xl">
              {TEAM_NAME} Baseball Pitching Portal
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">
              Enter the site password to open the full player, leaderboard, and reporting stack.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeaderboardPill tone="brand" variant="light">
                Private access
              </LeaderboardPill>
              <LeaderboardPill tone="neutral" variant="light">
                Coaching data only
              </LeaderboardPill>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-2xl border border-slate-200 bg-background p-5 sm:p-6"
            >
              <label className="block text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter site password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-surface px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-transparent transition-smooth placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[rgba(var(--brand-primary-rgb),0.25)]"
                autoFocus
              />
              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
              <button
                type="submit"
                disabled={loading}
                className="mt-4 inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_12px_28px_rgba(var(--brand-primary-rgb),0.22)] transition-smooth hover:bg-[var(--brand-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
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
