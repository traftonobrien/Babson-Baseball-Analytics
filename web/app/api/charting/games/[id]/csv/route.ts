import { NextRequest, NextResponse } from "next/server";
import { loadChartingGameSnapshot } from "@/lib/charting/snapshot";
import {
  buildChartingExportCsv,
  buildChartingExportFilename,
} from "@/lib/charting/export";
import { CHARTING_GATE_CHAIN, requireRequestGates } from "@/lib/auth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/charting/games/[id]/csv
 * Returns the charting data as a downloadable CSV file.
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

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error(`charting/games/${id}/csv GET:`, err);
    return NextResponse.json(
      { error: "Failed to generate CSV" },
      { status: 500 },
    );
  }
}
