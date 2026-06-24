import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { AccountLoginForm } from "./AccountLoginForm";

export const runtime = "nodejs";

export default function AccountLoginPage() {
  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-3xl">
      <div className="py-4 sm:py-8">
        <div className="mb-6 max-w-2xl">
          <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Account Access
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Confirm your email
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Enter your Babson email. Open the confirmation link from that inbox, then
            choose your roster identity once.
          </p>
        </div>

        <AccountLoginForm />
      </div>
    </LeaderboardPageFrame>
  );
}
