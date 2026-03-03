## Plus Leaderboards

Canonical reference for the unified plus-model leaderboard page.

Route: `/pitching-plus/leaderboard`

This page is the single leaderboard surface for:

- `Pitching+`
- `Command+`
- `Stuff+`

It is `playerId`-first end to end. All player joins and drilldowns use canonical `playerId`, with `web/public/data/Arsenals.csv` as the identity source of truth.

### Backing API

- Route: `web/app/api/plus/leaderboard/route.ts`
- Runtime: Node.js
- Query: `?season=2025`, `?season=2026`, or `?season=both`

The API returns one payload with three row sets:

- `players`
- `pitchTypes`
- `sessions`

The page fetches one payload per season selection, then applies search, handedness, minimum sample, and sort controls client-side.

### Data Sources

- Command outing CSVs from `web/public/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv`
- Player identity and handedness from `web/public/data/Arsenals.csv`
- Stuff+ session rows from Neon via `stuff_plus_outings`

### Views

| View | Row meaning | Primary use |
|---|---|---|
| `Players` | One row per pitcher across the selected season scope | Rank full pitcher model output |
| `Pitch Types` | One row per pitcher command pitch type | See pitch-level blend inputs and overlap |
| `Sessions` | One row per tracked command outing | Inspect same-day snapshot blends |

### Metric Rules

- `Command+` uses the existing live command model from `web/lib/commandPlus.ts`
- `Stuff+` is aggregated from `stuff_plus_outings` rows in the selected season scope
- `Pitching+` uses the existing overlap model from `web/lib/pitchingPlus.ts`
- For `Both`, cross-season rollups are weighted, not simple averages:
  - `Command+` weights by qualified pitch count
  - `Pitching+` weights by overlap pitch count

### Readiness States

Rows can be not-ready for three reasons:

- `missing_live_command`
- `missing_stuff`
- `no_overlap`

Pitch-type rows can also show `ambiguous_stuff_match` when Stuff+ labels do not map cleanly to one command pitch type.

### Navigation

- Leaderboard hub entry: `web/app/leaderboards-hub/page.tsx`
- Player drilldown: `/players/[slug]` when a canonical slug exists, otherwise `/player/[playerId]`
- Session drilldown: `/player/[playerId]?outingId=<playerId>/<dateId>`
