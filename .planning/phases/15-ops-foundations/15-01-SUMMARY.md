---
phase: 15-ops-foundations
plan: 01
subsystem: auth
tags: [next.js, middleware, edge-runtime, auth-gates]

# Dependency graph
requires:
  - phase: 14-completion
    provides: "Verified auth gate logic in web/lib/auth.ts (getRequiredGatesForPath, hasGateCookie, buildGateFailureResponse)"
provides:
  - "Next.js edge middleware at web/middleware.ts running on Vercel automatically"
  - "Dead proxy.ts removed — single source of truth for auth gating"
affects: [15-ops-foundations plans 02-04, 16-code-health, any phase touching protected routes]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Next.js middleware.ts default export pattern at app root for automatic Vercel edge deployment"]

key-files:
  created: ["web/middleware.ts"]
  modified: []

key-decisions:
  - "middleware.ts content identical to proxy.ts except default export — no logic changes, only export name change to satisfy Next.js convention"
  - "proxy.ts deleted entirely rather than left as a stub — avoids future confusion about which file is the active auth gate"

patterns-established:
  - "Auth gate pattern: middleware.ts imports from @/lib/auth (getRequiredGatesForPath + hasGateCookie + buildGateFailureResponse) — all gate logic stays in auth.ts, middleware is a thin dispatcher"

requirements-completed: [OPS-01]

# Metrics
duration: 2min
completed: 2026-03-21
---

# Phase 15 Plan 01: Ops Foundations — Middleware Summary

**Promoted proxy.ts named export to middleware.ts default export so Next.js edge middleware actually runs on Vercel, closing the unprotected page route gap (OPS-01)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-21T19:18:44Z
- **Completed:** 2026-03-21T19:20:10Z
- **Tasks:** 2
- **Files modified:** 2 (1 created, 1 deleted)

## Accomplishments

- Created `web/middleware.ts` with `export default function middleware` — the required convention for Next.js App Router to auto-load auth gates at the Vercel edge
- Deleted `web/proxy.ts` — the `proxy()` named export was dead code; Next.js never called it, leaving all page routes unprotected
- Build confirms detection: Next.js build output legend shows "Proxy (Middleware)" confirming the new file is registered

## Task Commits

Each task was committed atomically:

1. **Task 1: Create web/middleware.ts** - `bcf8370` (feat)
2. **Task 2: Delete web/proxy.ts and verify build** - `985b8b0` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `web/middleware.ts` — Next.js edge middleware with default export; identical auth gate logic to proxy.ts (getRequiredGatesForPath + hasGateCookie + buildGateFailureResponse chain); config matcher covers all paths except _next/static, _next/image, favicon.ico
- `web/proxy.ts` — deleted (was dead code; named export `proxy()` was never invoked by Next.js runtime)

## Decisions Made

- Content is identical to proxy.ts except export name: `export function proxy` → `export default function middleware`. No logic changes — just the rename required by Next.js convention.
- Deleted proxy.ts entirely rather than leaving it as a stub to avoid ambiguity about which file gates routes.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

- Build output included "Ecmascript file had an error" warning — confirmed pre-existing for an unrelated file; `✓ Compiled successfully` was still present and build exits 0.
- `lib/auth.test.ts` fails with `No database connection string was provided` — pre-existing issue requiring DATABASE_URL env var in test environment; unrelated to this plan. 369/370 tests pass.

## User Setup Required

None — no external service configuration required. Vercel will pick up the new middleware.ts on next deploy automatically (it is at the app root, same level as next.config.ts).

## Next Phase Readiness

- OPS-01 resolved: page routes are now protected at the Vercel edge via real middleware
- Vercel protection can be verified manually in Plan 15-03 (human UAT) — hit /charting without a cookie and confirm redirect to /login
- Ready for Plan 15-02 (error boundaries)

---
*Phase: 15-ops-foundations*
*Completed: 2026-03-21*
