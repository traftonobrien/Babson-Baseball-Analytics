import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: true,
    redirectTo: "/charting",
    message: "Charting no longer requires a separate password.",
  });
}
