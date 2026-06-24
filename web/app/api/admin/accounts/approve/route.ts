import { NextRequest, NextResponse } from "next/server";
import {
  approvePlayerAccount,
  getPlayerAccountFromRequest,
  rejectPlayerAccount,
} from "@/lib/accounts/repository";
import { hasGateCookie } from "@/lib/auth-gates";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasGateCookie(request, "site")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const { id, action } = body as { id?: string; action?: string };
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const requester = await getPlayerAccountFromRequest(request);
    if (requester?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    if (action === "reject") {
      const account = await rejectPlayerAccount(id);
      if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
      return NextResponse.json({ ok: true, status: account.status });
    }

    const account = await approvePlayerAccount(id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json({ ok: true, status: account.status });
  } catch (err) {
    logApiError({
      route: "/api/admin/accounts/approve",
      method: "POST",
      status: 500,
      action: "approve/reject account",
      error: err,
    });
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
