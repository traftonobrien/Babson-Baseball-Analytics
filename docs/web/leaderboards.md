## Team Leaderboards

Route: `/leaderboards`

Ranks pitchers by command metrics across the full roster.

### Mode toggle

Two aggregate views, selected via segmented control:

| Mode | Rows represent | Date/Outings column | Row drilldown |
|---|---|---|---|
| **Outings** (default) | One row per outing | Date of outing | Opens outing report |
| **Players** | One row per pitcher | Number of outings | Opens player dashboard |

In Players mode, KPIs are computed across all pitches from all of a player's outings matching the current filters. Consistency is the exact standard deviation across all pitches (not an average of per-outing stddevs).

### Season filter

Three options: **2025**, **2026**, **Both**. No other years are displayed even if data exists for them. Internally the season is parsed from each outing's `dateId` via `seasonFromDateId()` in `web/lib/season.ts`.

Changing the season triggers a data refetch. Other filters recompute from the cached data without refetching.

### Handedness filter

Three options: **All**, **RHP**, **LHP**. Filters outings/players by pitcher hand. This is separate from the per-pitch arm-side normalization used in the Avg H column.

### Pitch group filter

Three options: **Overall**, **Fastballs**, **Breaking Balls**. Filters which pitches are included in KPI calculations.

Pitch type classification is defined in `web/lib/leaderboards/pitchGroups.ts`:

| Group | Pitch types |
|---|---|
| Fastballs | FF, FT, SI, FC, FS, FB |
| Breaking Balls | SL, CU, KC, CS, SV, CB |

Unrecognized types (e.g. CH, EP) are included in Overall but excluded from Fastballs and Breaking Balls.

### Player search

Text input filters rows by player name (case insensitive substring match). Works in both Outings and Players modes.

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

Outings with fewer than 5 pitches (after pitch group filtering) are excluded from the leaderboard.

### Data loading

• CSV files are fetched client-side with a concurrency limit of 6 parallel requests
• Results are cached in memory by `outingId` so re-filtering is instant
• Progressive loading: a counter shows how many outings have been loaded

### Sortable columns

Click any column header to sort. Click again to reverse direction. Default sort: On-target % descending. Lower-is-better metrics (Avg Miss, Avg H, Avg V, Consistency, Outlier %) default to ascending on first click.

### Row drilldown

• **Outings mode:** Click a row to open the full outing report at `/player/<playerId>/report?outingId=<outingId>`.
• **Players mode:** Click a row to open the player dashboard at `/player/<playerId>`.

### Code files

| File | Purpose |
|---|---|
| `web/lib/season.ts` | `parseDateId`, `seasonFromDateId` |
| `web/lib/leaderboards/types.ts` | `OutingLeaderboardRow`, `PlayerAggregateRow`, `OutingKpis` |
| `web/lib/leaderboards/metrics.ts` | `computeOutingKpis`, `mergeKpis` |
| `web/lib/leaderboards/pitchGroups.ts` | `PitchGroup`, `pitchMatchesGroup`, pitch type sets |
| `web/lib/leaderboards/load.ts` | `loadAllOutingData`, `computeLeaderboardRows`, `computePlayerAggregateRows`, CSV caching |
| `web/app/leaderboards/page.tsx` | Page component |
