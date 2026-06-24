import Link from "next/link";
import { Clock } from "lucide-react";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";

export const runtime = "nodejs";

export default function AccountPendingPage() {
  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-lg">
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface-muted text-muted">
          <Clock className="h-8 w-8" />
        </div>

        <h1 className="mt-6 text-2xl font-black tracking-tight text-foreground">
          Account Pending Approval
        </h1>

        <p className="mt-4 max-w-sm text-sm leading-7 text-muted">
          Email confirmed. Account under review — Babson Baseball staff will approve
          access shortly. You will receive another link once approved.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            Why approval?
          </div>
          <p className="mt-3 text-sm leading-7 text-muted">
            Coach accounts are approved immediately. Other email addresses
            require coach approval to keep analytics data within the program.
          </p>
        </div>

        <Link
          href="/account/login"
          className="mt-8 text-sm font-semibold text-muted underline underline-offset-2 hover:text-foreground"
        >
          ← Back to login
        </Link>
      </div>
    </LeaderboardPageFrame>
  );
}
