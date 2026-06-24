import { NextRequest, NextResponse } from "next/server";
import { consumeAccountEmailVerification } from "@/lib/accounts/repository";
import { sendPendingAccountNotificationEmail } from "@/lib/accounts/emailDelivery";
import { getAccountNotificationEmails } from "@/lib/accounts/identity";
import { setAccountSessionCookie } from "@/lib/accounts/session";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

const SITE_GATE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const redirectUrl = request.nextUrl.clone();

  if (!token) {
    redirectUrl.pathname = "/login";
    redirectUrl.search = "?error=missing";
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const result = await consumeAccountEmailVerification(token);
    if (!result) {
      redirectUrl.pathname = "/login";
      redirectUrl.search = "?error=invalid";
      return NextResponse.redirect(redirectUrl);
    }
    const { account, wasCreated } = result;

    if (account.status === "rejected") {
      redirectUrl.pathname = "/login";
      redirectUrl.search = "?error=rejected";
      return NextResponse.redirect(redirectUrl);
    }

    if (account.status === "pending") {
      if (wasCreated) {
        const adminUrl = new URL("/admin/accounts", request.nextUrl.origin).toString();
        await Promise.allSettled(
          getAccountNotificationEmails().map((to) =>
            sendPendingAccountNotificationEmail({
              to,
              requesterEmail: account.email,
              adminUrl,
            }),
          ),
        );
      }
      redirectUrl.pathname = "/account/pending";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    // approved — set account session + site gate cookie, then proceed
    redirectUrl.pathname = account.playerId ? "/account" : "/account/setup";
    redirectUrl.search = "";
    const response = NextResponse.redirect(redirectUrl);
    setAccountSessionCookie(response, account.email);
    // grant site gate access so the account session IS the site password
    response.cookies.set("pt_auth", "authenticated", SITE_GATE_COOKIE_OPTIONS);
    return response;
  } catch (err) {
    logApiError({
      route: "/api/account/confirm",
      method: "GET",
      status: 500,
      action: "confirm account email",
      error: err,
    });
    redirectUrl.pathname = "/login";
    redirectUrl.search = "?error=server";
    return NextResponse.redirect(redirectUrl);
  }
}
