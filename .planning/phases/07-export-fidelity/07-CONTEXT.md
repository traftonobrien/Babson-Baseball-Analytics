# Phase 7: Export Fidelity - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the stable chart data into staff-usable CSV and PDF outputs. Phase 7 covers export surfaces only: normalized CSV download from the portal, paper-style PDF generation, and export verification against the known sample chart. It does not reopen the charting data model, sync protocol, or the broader pilot hardening work reserved for Phase 8.

</domain>

<decisions>
## Implementation Decisions

### CSV export shape
- Normalized CSV is already the first shipped artifact for this phase.
- Export is served from `/api/charting/games/[id]/export`.
- CSV rows are generated from a shared chart snapshot loader so the portal detail page and export read identical game data.
- The portal game detail view exposes the download button directly instead of routing staff through a separate export screen.

### PDF target
- PDF remains in phase scope and should approximate the current paper chart layout rather than reproduce it pixel-for-pixel.
- PDF output must stay consistent with per-pitcher totals and the same underlying chart snapshot used by CSV and portal detail views.

### iPad charting layout baseline
- Future charting UI work should preserve the elastic top zone canvas for location selection.
- Count, pitch type, pitch result, and plate-appearance closeout belong in the bottom operator dock.
- Matchup and pitch history are secondary support surfaces and should stay compact or move into rail/drawer patterns rather than reclaiming the zone canvas.

### Claude's Discretion
- Exact CSV column ordering for any new export fields beyond the current normalized pitch log.
- PDF rendering technology and pagination strategy.
- Whether compact secondary info is rendered inline or collapsible in future app iterations.

</decisions>

<specifics>
## Specific Ideas

- Staff should be able to open `/charting/games/[id]` and immediately download a spreadsheet-friendly export.
- The export path should stay aligned with the existing paper-chart mental model, but normalized data takes precedence over ornamental formatting.
- The iPad charting page needs to maximize usable space before more controls are added, so future modules should extend the bottom dock sideways or via drawers rather than stacking new rows above the zone.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/lib/charting/snapshot.ts`: shared game loader used by detail views and export code.
- `web/lib/charting/export.ts`: normalized CSV row generation and serialization helpers.
- `web/app/api/charting/games/[id]/export/route.ts`: API surface for CSV download.
- `web/app/charting/games/[id]/page.tsx`: portal detail page with the current export entry point.

### Established Patterns
- Charting portal pages already compute analytics from synced game data; export should keep using the same normalized server-side snapshot rather than re-querying bespoke shapes.
- The iPad live view is landscape-first and now structured as top canvas plus bottom dock; future UI additions should respect that partition.
- `ZoneGridView` matches the 14-cell Trackman geometry using custom `Path`-based L-brackets and a separate `PO` cell.

### Integration Points
- PDF generation will attach to the same phase 7 export surface, likely as a sibling API route or alternate response mode.
- Any future app-side export affordance should reuse the same normalized snapshot contract rather than build a second export serializer in Swift.

</code_context>

<deferred>
## Deferred Ideas

- Exact paper-sheet fidelity beyond a staff-recognizable PDF remains v2 (`EXPT-04`).
- TestFlight packaging, operator runbook, diagnostics, and pilot support stay in Phase 8.
- Broader charting workspace expansion beyond the top-canvas / bottom-dock baseline is future UI work, not part of this export phase.

</deferred>

---

*Phase: 07-export-fidelity*
*Context gathered: 2026-03-06*
