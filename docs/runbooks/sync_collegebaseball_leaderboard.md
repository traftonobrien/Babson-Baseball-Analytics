# Sync NCAA Leaderboards

Build cached 2026 NCAA Division III batting and pitching leaderboards from `robert-frey/collegebaseball` plus a browser-backed `chromote` fetch path for `stats.ncaa.org`.

## Output

- `web/public/college-stats/pitching-2026.json`
- `web/public/college-stats/batting-2026.json`
- `web/public/college-stats/meta.json`

## Local run

```bash
Rscript scripts/sync_collegebaseball_leaderboard.R --years 2026 --types pitching batting
```

Useful options:

- `--team-name Babson` to seed or debug a single team
- `--limit 10` to run a short validation scrape
- `--dry-run` to test fetches without writing files

## App behavior

- `web/lib/collegeStats.ts` reads the cached NCAA files
- player profile pages and the statistics leaderboard use the 2026 NCAA cache
- percentiles are computed locally in the app when upstream percentile columns are absent

## Automation

The GitHub Actions workflow `.github/workflows/sync-college-stats-nightly.yml` installs R, installs `robert-frey/collegebaseball`, provisions Chrome, and refreshes the NCAA cache daily.

## Notes

- The NCAA stat pages are protected against plain HTTP scraping.
- This repo uses a browser session with a desktop Chrome user agent to fetch the rendered stat tables before parsing them into the cached leaderboard format.
