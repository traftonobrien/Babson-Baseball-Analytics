import { NextRequest, NextResponse } from "next/server";
import {
  buildChartingExportCsv,
  buildChartingExportFilename,
} from "@/lib/charting/export";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";
import { logApiError } from "@/lib/server/logger";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]/export
 * Returns a normalized pitch-level CSV for the requested charted game.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const unauthorized = requireRequestGates(req, CHARTING_GATE_CHAIN);
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await params;

  try {
    const snapshot = await loadChartingGameSnapshot(id);

    if (!snapshot) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const csv = buildChartingExportCsv(snapshot);
    const filename = buildChartingExportFilename(snapshot.game);

    return new Response(csv, {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-type": "text/csv; charset=utf-8",
      },
    });
  } catch (err) {
    logApiError({
      route: `/api/charting/games/${id}/export`,
      method: "GET",
      status: 500,
      action: "export game",
      error: err,
      context: { gameId: id },
    });
    return NextResponse.json(
      { error: "Failed to export charting game" },
      { status: 500 }
    );
  }
}
