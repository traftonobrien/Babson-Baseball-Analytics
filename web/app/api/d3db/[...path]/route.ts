import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ path?: string[] }> };

const isDev = process.env.NODE_ENV !== "production";

async function proxy(request: Request, ctx: Ctx) {
  const apiKey = process.env.D3_DASHBOARD_API_KEY;
  if (!apiKey) {
    console.error("[d3db proxy] D3_DASHBOARD_API_KEY is not set");
    return NextResponse.json(
      { error: "Missing D3_DASHBOARD_API_KEY" },
      { status: 500 },
    );
  }

  const { path } = await ctx.params;
  const endpoint = (path ?? []).join("/");
  const incomingUrl = new URL(request.url);
  const upstream = new URL(`https://d3-dashboard.com/api/${endpoint}`);
  upstream.search = incomingUrl.search;

  if (isDev) {
    console.log("[d3db proxy] endpoint:", endpoint || "(root)");
    console.log("[d3db proxy] upstream URL:", upstream.toString());
  }

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    Accept: "application/json",
  };

  const accept = request.headers.get("accept");
  if (accept) headers.Accept = accept;

  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstream.toString(), {
      method,
      redirect: "manual",
      headers,
      body,
    });
  } catch (err) {
    console.error("[d3db proxy] fetch failed:", err);
    return NextResponse.json(
      { error: "Upstream fetch failed", detail: String(err) },
      { status: 502 },
    );
  }

  if (isDev) {
    console.log("[d3db proxy] upstream status:", upstreamRes.status);
  }

  // Block redirects — never let a 30x become a /login redirect
  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    return NextResponse.json(
      {
        error: "Upstream redirect blocked",
        status: upstreamRes.status,
        location: upstreamRes.headers.get("location"),
      },
      { status: 502 },
    );
  }

  const upstreamType = upstreamRes.headers.get("content-type") ?? "";

  // If upstream returned HTML (likely an error page), block it
  if (
    upstreamType.includes("text/html") &&
    !upstreamType.includes("application/json")
  ) {
    const snippet = await upstreamRes.text().catch(() => "");
    console.error(
      "[d3db proxy] upstream returned HTML instead of JSON, status:",
      upstreamRes.status,
    );
    return NextResponse.json(
      {
        error: "Upstream returned HTML (likely error page)",
        status: upstreamRes.status,
        bodySnippet: snippet.slice(0, 500),
      },
      { status: 502 },
    );
  }

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return NextResponse.json(
      {
        error: "Upstream request failed",
        status: upstreamRes.status,
        bodySnippet: text.slice(0, 2000),
      },
      { status: upstreamRes.status },
    );
  }

  if (upstreamType.includes("application/json")) {
    const text = await upstreamRes.text();
    try {
      const data = text ? JSON.parse(text) : null;
      return NextResponse.json(data, { status: upstreamRes.status });
    } catch {
      return new Response(text, {
        status: upstreamRes.status,
        headers: {
          "content-type": "application/json",
        },
      });
    }
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: {
      "content-type": upstreamType || "application/octet-stream",
    },
  });
}

export async function GET(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}

export async function POST(request: Request, ctx: Ctx) {
  return proxy(request, ctx);
}
