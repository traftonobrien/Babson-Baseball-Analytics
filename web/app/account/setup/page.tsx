import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { LeaderboardPageFrame } from "@/app/components/leaderboards/LeaderboardChrome";
import { buildBootstrapRosterPlayers } from "@/lib/charting/bootstrapRoster";
import {
  getPlayerAccountByEmail,
} from "@/lib/accounts/repository";
import { readAccountSessionEmail } from "@/lib/accounts/session";
import { AccountSetupForm } from "./AccountSetupForm";

export const runtime = "nodejs";

export default async function AccountSetupPage() {
  const cookieStore = await cookies();
  const accountEmail = readAccountSessionEmail(cookieStore);

  if (!accountEmail) {
    redirect("/account/login");
  }

  const existingAccount = accountEmail
    ? await getPlayerAccountByEmail(accountEmail).catch(() => null)
    : null;
  const rosterPlayers = buildBootstrapRosterPlayers();

  if (existingAccount?.playerId) {
    redirect("/account");
  }

  return (
    <LeaderboardPageFrame variant="light" maxWidth="max-w-6xl">
      <div className="py-4 sm:py-8">
        <div className="mb-6 max-w-3xl">
          <div className="inline-flex rounded-full border border-border bg-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Player Identity
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Set your Babson Analytics identity
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Your email is confirmed. Select your roster profile once. The site stays open
            for browsing, while dashboards and future outing forms can default to you.
          </p>
        </div>

        <AccountSetupForm accountEmail={accountEmail} rosterPlayers={rosterPlayers} />
      </div>
    </LeaderboardPageFrame>
  );
}
