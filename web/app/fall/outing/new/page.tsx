import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { getPlayerAccountByEmail } from "@/lib/accounts/repository";
import { readAccountSessionEmail } from "@/lib/accounts/session";
import { FallOutingForm } from "./FallOutingForm";

export const runtime = "nodejs";

export default async function NewFallOutingPage() {
  const cookieStore = await cookies();
  const accountEmail = readAccountSessionEmail(cookieStore);

  if (!accountEmail) {
    redirect("/login");
  }

  const account = await getPlayerAccountByEmail(accountEmail).catch(() => null);

  // Players without a linked roster identity go to setup first
  if (account?.role === "player" && !account.playerId) {
    redirect("/account/setup");
  }

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-2xl">
      <div className="py-4 sm:py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
              Fall 2025
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground">
              New Session
            </h1>
            <p className="mt-2 text-sm text-muted">
              Choose a session type and pitcher to open the charting editor.
            </p>
          </div>
          <Link
            href="/fall"
            className="inline-flex min-h-[2.75rem] items-center justify-center rounded-xl border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground transition-smooth hover:bg-surface-muted"
          >
            Fall Hub
          </Link>
        </div>

        <FallOutingForm account={account} />
      </div>
    </LeaderboardPageFrame>
  );
}
