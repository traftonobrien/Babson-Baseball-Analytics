## Team Leaderboards

Route: `/leaderboards`

Ranks outings by command metrics across all players.

### Season filter

UI shows three options: **2025**, **2026**, **Both**. No other years are displayed even if data exists for them. Internally the season is parsed from each outing's `dateId` via `seasonFromDateId()` in `web/lib/season.ts`.

### KPI definitions

All thresholds match the report page (defined in `web/lib/reportModel.ts`):

| KPI | Definition |
|---|---|
| On-target % | `total_miss_inches <= 8` |
| Avg Miss | Mean `total_miss_inches` |
| Avg H | Mean absolute arm-side-positive miss via `pitchArmSideX()` |
| Avg V | Mean absolute `v_miss_signed` |
| Outlier % | `total_miss_inches > 20` |
| Consistency | Sample standard deviation of `total_miss_inches` |

### Handedness resolution

Pitcher hand comes from Arsenals.csv via `getPlayerMeta()`. If missing: fallback to `"R"`, log a `console.warn`, and show a "Hand unknown" badge on the row.

### Minimum pitch count

Outings with fewer than 5 pitches are excluded from the leaderboard.

### Data loading

• CSV files are fetched client-side with a concurrency limit of 6 parallel requests
• Results are cached in memory by `outingId` so re-filtering is instant
• Progressive loading: a counter shows how many outings have been loaded

### Sortable columns

Click any column header to sort. Click again to reverse direction. Default sort: On-target % descending.

### Row drilldown

Click a row to open the full outing report at `/player/<playerId>/report?outingId=<outingId>`.

### Code files

| File | Purpose |
|---|---|
| `web/lib/season.ts` | `parseDateId`, `seasonFromDateId` |
| `web/lib/leaderboards/types.ts` | `OutingLeaderboardRow`, `PitcherSeasonRow`, `OutingKpis` |
| `web/lib/leaderboards/metrics.ts` | `computeOutingKpis`, `mergeKpis` |
| `web/lib/leaderboards/load.ts` | `loadAllLeaderboardData`, CSV caching, concurrency limit |
| `web/app/leaderboards/page.tsx` | Page component |
