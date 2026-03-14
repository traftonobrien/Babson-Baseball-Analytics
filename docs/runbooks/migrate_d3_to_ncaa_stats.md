# NCAA Stats Migration Status

## Status

Completed on March 14, 2026. The app now uses live NCAA Division III leaderboard data cached through `robert-frey/collegebaseball` plus a browser-backed `chromote` fetch path, while preserving the same percentile behavior in the app.

## What Changed

- `scripts/sync_collegebaseball_leaderboard.R` builds cached NCAA leaderboards in `web/public/college-stats/`
- `.github/workflows/sync-college-stats-nightly.yml` refreshes the 2026 batting and pitching caches nightly
- `web/lib/collegeStats.ts` is the server-side source adapter
- `web/app/players/[slug]/page.tsx` computes percentiles locally against the NCAA leaderboard population
- `web/app/api/team-stats/route.ts` and `web/lib/college-stats/babsonPitchers.ts` consume the normalized NCAA row shape
- `web/data/players.json` now supports `ncaa_player_id`

## Retired Components

- `web/lib/d3db.ts`
- `web/app/api/d3db/[...path]/route.ts`
- `scripts/sync_d3_leaderboard.py`
- `web/public/d3/`
- the D3 dashboard runtime dependency for leaderboard data

## Remaining Notes

- NCAA stat pages still require a browser-backed fetch path; plain HTTP scraping is not reliable enough for unattended runs.
- Player matching prefers `ncaa_player_id` and can still fall back to `d3_player_id` while roster cleanup continues.
- Percentiles are computed inside the app when upstream percentile columns are absent, so the leaderboard source can change without changing percentile behavior.

## Operational Reference

Use [docs/runbooks/sync_collegebaseball_leaderboard.md](/Users/traftonobrien/Desktop/pitch-tracker/docs/runbooks/sync_collegebaseball_leaderboard.md) for the current nightly sync and local rebuild workflow.
