import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { hasGateCookie } from "@/lib/auth-gates";
import { getPlayerAccountFromRequest } from "@/lib/accounts/repository";
import { readAccountSessionEmail } from "@/lib/accounts/session";
import { createPlayerNote } from "@/lib/fall/playerNotes";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!hasGateCookie(req, "site")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await getPlayerAccountFromRequest(req);
  if (!account || (account.role !== "coach" && account.role !== "admin")) {
    return NextResponse.json({ error: "Coach or admin role required" }, { status: 403 });
  }

  const cookieStore = await cookies();
  const email = readAccountSessionEmail(cookieStore) ?? account.email;

  const body = await req.json().catch(() => null);
  if (
    !body ||
    typeof body.playerId !== "string" ||
    typeof body.playerName !== "string" ||
    typeof body.note !== "string"
  ) {
    return NextResponse.json({ error: "Missing playerId, playerName, or note" }, { status: 400 });
  }

  const note = body.note.trim();
  if (!note) return NextResponse.json({ error: "Note is empty" }, { status: 400 });

  const record = await createPlayerNote({
    playerId: body.playerId,
    playerName: body.playerName,
    authorEmail: email,
    note,
  });
  return NextResponse.json({ note: record }, { status: 201 });
}
