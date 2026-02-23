# Sync D3 Leaderboard

Fetch D3 pitching leaderboard data and cache it in `web/public/d3/` so player profiles have current game stats. Runs automatically every day via GitHub Actions.

## Automatic (daily)

The workflow `.github/workflows/sync-d3-daily.yml` runs at 6:00 AM UTC (1:00 AM ET) every day. It fetches 2025 Division III pitching data (add 2026 when the D3 API supports it), commits changes, and pushes so Vercel redeploys with fresh data.

**Required**: Add `D3_DASHBOARD_API_KEY` as a GitHub repository secret:

1. Repo → Settings → Secrets and variables → Actions
2. New repository secret: `D3_DASHBOARD_API_KEY` = your D3 Dashboard API key

## Manual (initial seed or on-demand)

```bash
D3_DASHBOARD_API_KEY=xxx python3 scripts/sync_d3_leaderboard.py
```

Options:

- `--years 2025 2026` — Years to fetch (default: 2025 2026)
- `--dry-run` — Fetch but do not write files

After running, commit and push:

```bash
git add web/public/d3/
git commit -m "chore: sync D3 leaderboard"
git push
```

## Output

- `web/public/d3/2025.json` — Pitching leaderboard for 2025
- `web/public/d3/meta.json` — Sync timestamp and metadata

## App behavior

`web/lib/d3db.ts` reads from the cache first. If a cached file exists for the requested year, it uses that. Otherwise it falls back to the live D3 API. This keeps page loads fast and reduces API calls.
