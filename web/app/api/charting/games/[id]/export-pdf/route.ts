import { NextRequest, NextResponse } from "next/server";
import {
  buildChartingPdf,
  buildChartingPdfFilename,
} from "@/lib/charting/pdf";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]/export-pdf
 * Returns a paper-style PDF export for the requested charted game.
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

    const pdfBytes = await buildChartingPdf(snapshot);
    const filename = buildChartingPdfFilename(snapshot.game);

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${filename}"`,
        "content-type": "application/pdf",
      },
    });
  } catch (err) {
    console.error(`charting/games/${id}/export-pdf GET:`, err);
    return NextResponse.json(
      { error: "Failed to export charting game PDF" },
      { status: 500 }
    );
  }
}
