import { NextRequest, NextResponse } from "next/server";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const unauthorized = requireRequestGates(request, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  return NextResponse.json({
    ok: true,
    service: "charting",
    timestamp: new Date().toISOString(),
  });
}
