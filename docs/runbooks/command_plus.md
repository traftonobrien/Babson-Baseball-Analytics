# Command+

Official grading layer for command in the web app.

## Scope

`Command+` grades the existing command measurement output. It does **not** change how target or arrival are measured.

Inputs remain the existing per-pitch CSV fields:

- `pitch_type`
- `total_miss_inches`
- existing outing / season grouping from `web/lib/dataIndex.ts`

## Definition

`Command+` is **live season-relative**.

- `100` = current team average for that same pitch type in that same season
- `>100` = better than current team average
- `<100` = worse than current team average

Per pitch type:

```text
PitchTypeCommand+ = (SeasonPitchTypeBaselineMiss / PitcherPitchTypeAvgMiss) * 100
```

Overall:

```text
OverallCommand+ = weighted average of PitchTypeCommand+ using that pitcher/outing's pitch counts
```

## Eligibility

The official score excludes:

- blank pitch types
- unknown pitch types (`UNK`, `UNKNOWN`, etc.)
- `OTHER`

Pitch types also need at least 3 pitches in the subject sample before they contribute to the official score.

## Live Baselines

Season baselines are rebuilt from the currently loaded outing CSVs for the selected season.

That means:

- adding a new outing updates the baseline
- existing `Command+` scores can move as the season grows

This is intentional.

## Source Files

- `web/lib/commandPlus.ts`
- `web/lib/leaderboards/load.ts`
- `web/lib/leaderboards/metrics.ts`
- `web/app/components/CommandPlusSection.tsx`
- `web/app/player/[playerId]/report/page.tsx`
