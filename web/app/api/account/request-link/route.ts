import { NextRequest, NextResponse } from "next/server";
import { createAccountEmailVerification } from "@/lib/accounts/repository";
import { normalizeAccountEmail } from "@/lib/accounts/identity";
import { sendAccountVerificationEmail } from "@/lib/accounts/emailDelivery";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

function readEmail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("email" in body)) {
    return null;
  }

  const value = (body as Record<string, unknown>).email;
  return typeof value === "string" ? normalizeAccountEmail(value) : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const email = readEmail(body);
  if (!email) {
    return NextResponse.json(
      { error: "Enter a valid email address" },
      { status: 400 },
    );
  }

  try {
    const verification = await createAccountEmailVerification(email);
    const verificationUrl = new URL("/api/account/confirm", request.nextUrl.origin);
    verificationUrl.searchParams.set("token", verification.token);
    const delivery = await sendAccountVerificationEmail({
      to: verification.email,
      verificationUrl: verificationUrl.toString(),
    });

    return NextResponse.json({
      ok: true,
      delivery: delivery.delivery,
      previewUrl: delivery.previewUrl,
      expiresAt: verification.expiresAt,
    });
  } catch (err) {
    logApiError({
      route: "/api/account/request-link",
      method: "POST",
      status: 500,
      action: "request account verification link",
      error: err,
    });
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500 },
    );
  }
}
