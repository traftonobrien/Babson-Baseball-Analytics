import { NextRequest, NextResponse } from "next/server";
import {
  buildChartingExportCsv,
  buildChartingExportFilename,
} from "@/lib/charting/export";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]/export
 * Returns a normalized pitch-level CSV for the requested charted game.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
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
    console.error(`charting/games/${id}/export GET:`, err);
    return NextResponse.json(
      { error: "Failed to export charting game" },
      { status: 500 }
    );
  }
}
