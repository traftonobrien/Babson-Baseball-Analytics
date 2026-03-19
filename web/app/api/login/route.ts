import { NextRequest } from "next/server";
import { handlePasswordGateLogin } from "@/lib/auth";

export async function POST(request: NextRequest) {
  return handlePasswordGateLogin(request, "site");
}
