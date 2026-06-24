"use client";

import Image from "next/image";
import { LeaderboardPageFrame, LeaderboardPill } from "@/app/components/leaderboards/LeaderboardChrome";
import { AccountLoginForm } from "@/app/account/login/AccountLoginForm";
import { TEAM_NAME } from "@/lib/teamConfig";

export default function LoginPage() {
  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-5xl">
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-border bg-surface shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
          <div className="p-6 sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
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
              {TEAM_NAME} Baseball Analytics
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-slate-600 dark:text-zinc-400">
              Enter your email to receive a login link. Coach accounts are
              approved immediately. Players and staff require coach approval.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LeaderboardPill tone="brand" variant="light">
                Private access
              </LeaderboardPill>
              <LeaderboardPill tone="neutral" variant="light">
                Coaching data only
              </LeaderboardPill>
            </div>

            <div className="mt-6">
              <AccountLoginForm />
            </div>
          </div>
        </div>
      </div>
    </LeaderboardPageFrame>
  );
}
