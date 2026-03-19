import { NextResponse } from "next/server";
import { clearAllGateCookies } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearAllGateCookies(response);
  return response;
}
