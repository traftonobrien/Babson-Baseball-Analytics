# Phase 14.02 Summary

## Outcome
- `14-02` completed as a failed production UAT on `2026-03-20`.
- Production charting game creation and export are working on `https://babsonanalytics.com/charting`.
- Production charting edits are not working: snapshot PATCH requests fail on live, so the two-sided charting workflow is not shippable in its current production state.

## What Passed
- New game creation via `/charting/new`
- CSV/PDF export via `/api/charting/games/[id]/export*`

## What Failed
- Pitch recording
- PA closeout
- Lineup entry
- Baserunner persistence
- History edit

## Key Finding
- `PATCH /api/charting/games/[id]` returns `500 {"error":"Failed to update charting game"}` in production for snapshot-sync edits.
- The failure reproduces even with a direct API PATCH using an unchanged snapshot, so this is not limited to one UI control.
- Failed snapshot PATCHes still increment `charting_games.revision`, which produces stale-revision fallout after the original `500`.

## Likely Root Cause
- [`web/app/api/charting/games/[id]/route.ts`](/Users/traftonobrien/Desktop/pitch-tracker/web/app/api/charting/games/[id]/route.ts) uses `db.transaction(...)` for snapshot sync.
- [`web/db/index.ts`](/Users/traftonobrien/Desktop/pitch-tracker/web/db/index.ts) instantiates `drizzle-orm/neon-http`.
- The installed driver source at [`web/node_modules/drizzle-orm/neon-http/session.js`](/Users/traftonobrien/Desktop/pitch-tracker/web/node_modules/drizzle-orm/neon-http/session.js) throws `No transactions support in neon-http driver`.

## Next Step
- Fix the production snapshot PATCH path, then rerun `14-02` before attempting `14-03` phase closeout.
