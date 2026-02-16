import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ path?: string[] }> };

async function proxy(request: Request, ctx: Ctx) {
  const apiKey = process.env.D3_DASHBOARD_API_KEY;
  if (!apiKey) {
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

  if (process.env.NODE_ENV !== "production") {
    console.log("D3 proxy endpoint:", endpoint || "(root)");
    console.log("Calling D3:", upstream.toString());
  }

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
  };

  const accept = request.headers.get("accept");
  if (accept) headers.accept = accept;

  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const method = request.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const upstreamRes = await fetch(upstream.toString(), {
    method,
    redirect: "manual",
    headers,
    body,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("D3 upstream status:", upstreamRes.status);
  }

  if (upstreamRes.status >= 300 && upstreamRes.status < 400) {
    return NextResponse.json(
      {
        error: "Upstream redirect blocked",
        status: upstreamRes.status,
        location: upstreamRes.headers.get("location"),
        upstream: upstream.toString(),
      },
      { status: 502 },
    );
  }

  const upstreamType = upstreamRes.headers.get("content-type") ?? "";

  if (!upstreamRes.ok) {
    const text = await upstreamRes.text();
    return NextResponse.json(
      {
        error: "Upstream request failed",
        status: upstreamRes.status,
        upstream: upstream.toString(),
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
          "content-type": upstreamType || "application/json",
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
