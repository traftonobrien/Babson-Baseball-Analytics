import { NextRequest, NextResponse } from "next/server";

const CHARTING_PASSWORD = process.env.CHARTING_PASSWORD || "mitch";

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (body.password !== CHARTING_PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const isProduction = process.env.NODE_ENV === "production";

  const response = NextResponse.json({ ok: true });
  response.cookies.set("pt_charting", "authorized", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 604800, // 7 days
  });

  return response;
}
