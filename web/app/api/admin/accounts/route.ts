import { NextRequest, NextResponse } from "next/server";
import { getPlayerAccountFromRequest, listAllAccounts } from "@/lib/accounts/repository";
import { hasGateCookie } from "@/lib/auth-gates";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasGateCookie(request, "site")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requester = await getPlayerAccountFromRequest(request);
    if (requester?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const accounts = await listAllAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    logApiError({
      route: "/api/admin/accounts",
      method: "GET",
      status: 500,
      action: "list all accounts",
      error: err,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
