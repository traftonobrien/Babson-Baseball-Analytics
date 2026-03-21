---
phase: 15-ops-foundations
plan: 04
subsystem: observability
tags: [logging, api, vercel, charting]

# Dependency graph
requires:
  - phase: 15-ops-foundations
    provides: "middleware.ts and error boundaries already in place; charting routes stable enough for logging pass"
provides:
  - "Structured API error logger at web/lib/server/logger.ts"
  - "Consistent JSON-compatible server error logs across charting API routes"
affects:
  - 15-03 (human env audit can now inspect cleaner Vercel logs)
  - future production debugging for charting routes

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Structured API logging: logApiError({ route, method, status, action, error, context })"
    - "JSON-compatible console.error payload for Vercel function log filtering"

key-files:
  created:
    - web/lib/server/logger.ts
  modified:
    - web/app/api/charting/bootstrap/route.ts
    - web/app/api/charting/games/route.ts
    - web/app/api/charting/games/[id]/route.ts
    - web/app/api/charting/games/[id]/csv/route.ts
    - web/app/api/charting/games/[id]/export/route.ts
    - web/app/api/charting/games/[id]/export-pdf/route.ts
    - web/app/api/charting/games/[id]/lineup/route.ts
    - web/app/api/charting/games/[id]/lineup/[slot]/route.ts
    - web/app/api/charting/games/[id]/segments/route.ts
    - web/app/api/charting/games/[id]/segments/[segId]/route.ts

key-decisions:
  - "Included status: 500 in logger payloads so failure severity is explicit in Vercel logs"
  - "Applied the logger to the actual charting API tree rather than the stale plan file list; pitches/finalize routes do not exist in the current repo"
  - "Expanded scope beyond the original six planned files so no bare console.error calls remain anywhere under web/app/api/charting"

patterns-established:
  - "Server route catch blocks should call logApiError instead of bare console.error"
  - "Include context identifiers (gameId, slot, segmentId) when route params exist"

requirements-completed:
  - OPS-04

# Metrics
completed: 2026-03-21
---

# Phase 15 Plan 04: Structured Logger Summary

**Added a thin structured server logger and replaced bare charting API console.error calls with JSON-compatible log entries for cleaner Vercel debugging (OPS-04)**

## Verification

- `web/lib/server/logger.ts` created and exports `logApiError`
- `rg -n "console\\.error" web/app/api/charting -g 'route.ts'` returns no matches
- `rg -n "logApiError" web/app/api/charting web/lib/server/logger.ts` confirms logger usage across the charting API route tree
- `npm --prefix web run build` exits `0`

## Accomplishments

- Created `web/lib/server/logger.ts` as a synchronous wrapper around `console.error`
- Standardized charting API route error logs to emit route, method, status, action, message, stack, timestamp, and optional context
- Replaced all bare `console.error` calls under `web/app/api/charting`, including bootstrap/export helper routes that were outside the original plan file list

## Deviations from Plan

- The Phase 15-04 plan referenced `web/app/api/charting/games/[id]/pitches/route.ts` and `web/app/api/charting/games/[id]/finalize/route.ts`, but those files do not exist in the current repo
- Instead of leaving other charting routes untouched, the logger was applied to the full live charting API surface so the success criteria (`no bare console.error in charting API routes`) hold against the actual codebase

## Issues Encountered

- Build still shows the pre-existing `auth.ts` Edge Runtime warning and the `middleware` deprecation notice, but `next build` exits `0`
- No new logger-specific build or type issues were introduced

## User Setup Required

None for `15-04` itself. The next step is the `15-03` human checkpoint in Vercel.

## Next Phase Readiness

- OPS-04 is complete locally
- Ready to pause for `15-03` env var + middleware audit

---
*Phase: 15-ops-foundations*
*Completed: 2026-03-21*
