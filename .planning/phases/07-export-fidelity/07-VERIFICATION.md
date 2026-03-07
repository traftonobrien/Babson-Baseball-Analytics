---
phase: 07-export-fidelity
verified: 2026-03-06T18:25:00Z
status: passed
score: 2/2 must-haves verified
---

# Phase 7: Export Fidelity — Verification

## Observable Truths
| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staff can download structured CSV and paper-style PDF exports from the portal game detail view | passed | `web/app/charting/games/[id]/page.tsx` exposes both download actions; `web/app/api/charting/games/[id]/export/route.ts` and `web/app/api/charting/games/[id]/export-pdf/route.ts` serve the file responses |
| 2 | Export output stays consistent with the shared chart snapshot and finalized pitcher totals | passed | `web/lib/charting/snapshot.ts`, `web/lib/charting/export.ts`, and `web/lib/charting/pdf.ts` all read the same normalized snapshot; fixture tests in `web/lib/charting/export.test.ts` and `web/lib/charting/pdf.test.ts` verify totals and document shape |

## Required Artifacts
| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `web/app/api/charting/games/[id]/export/route.ts` | CSV export route | passed | Returns attachment response with normalized CSV content |
| `web/app/api/charting/games/[id]/export-pdf/route.ts` | PDF export route | passed | Returns attachment response with generated PDF bytes |
| `web/lib/charting/export.ts` | Shared CSV export pipeline | passed | Builds deterministic pitch-level rows and filenames from the synced snapshot |
| `web/lib/charting/pdf.ts` | Shared PDF export pipeline | passed | Builds a paper-style landscape chart from the same synced snapshot |
| `web/lib/charting/export.test.ts` | CSV fixture coverage | passed | 5 tests passed on 2026-03-06 |
| `web/lib/charting/pdf.test.ts` | PDF fixture coverage | passed | 4 tests passed on 2026-03-06 |

## Key Link Verification
| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Synced game snapshot | CSV export | `loadChartingGameSnapshot` -> `buildChartingExportCsv` | passed | CSV stays bound to the same ordered game data used by the portal detail view |
| Synced game snapshot | PDF export | `loadChartingGameSnapshot` -> `buildChartingPdf` | passed | PDF renderer consumes the same normalized snapshot as CSV export |
| Portal detail page | CSV/PDF downloads | Direct anchor links to both export routes | passed | Staff can download both formats without leaving `/charting/games/[id]` |

## Requirements Coverage
| Requirement | Status | Blocking Issue |
|-------------|--------|----------------|
| EXPT-01 | passed | |
| EXPT-02 | passed | |

## Verification Evidence
- `npm --prefix web test -- export.test.ts pdf.test.ts`
- `cd web && ./node_modules/.bin/tsc --noEmit`
- Fixture PDF rendered successfully to `/tmp/charting-fixture.pdf` during verification

## Result
Phase 7 goal is achieved. The portal now exports both structured CSV and paper-style PDF files from the shared chart snapshot, and fixture-backed verification covers export structure plus finalized pitcher totals.
