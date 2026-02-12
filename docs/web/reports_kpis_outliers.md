## Reports, KPIs, and Outlier System

### On-target threshold

`ON_TARGET_THRESHOLD_IN = 8` (inches) in `web/lib/reportModel.ts`.

A pitch is "on target" if `total_miss_inches <= 8`.

Used in: `buildReport()`, KPI calculations, per-pitch-type and per-lane on-target percentages.

### Outlier threshold

`OUTLIER_MISS_THRESHOLD_IN = 20` (inches) in `web/lib/reportModel.ts`.

A pitch is an outlier if `total_miss_inches > 20`.

### Exclude outliers option

`buildReport()` accepts `{ excludeOutliers: true }`. When enabled:

- Outliers are filtered from all aggregations (KPIs, per-pitch-type, lanes)
- `meta.outlierCount` reports how many were excluded
- `meta.includedPitchCount` is the count after filtering

### Visual behavior

- **PitchTable:** Outliers are greyed out (50% opacity, grayscale) and show an "OUTLIER" badge
- **StrikeZoneScatter:** Outliers may be filtered or visually distinct

### Lane breakdown

Lanes are classified using the arm-side-positive value from `toArmSideX()` in `web/lib/handedness.ts`:

- **Arm side:** armSideX >= 4 inches
- **Glove side:** armSideX <= -4 inches
- **Middle:** between -4 and 4 inches

Lane labels via `laneDisplayName()`:
- **RHP:** Arm (1B), Glove (3B)
- **LHP:** Arm (3B), Glove (1B)

### Team Leaderboards

See `docs/web/leaderboards.md` for full documentation. Uses the same on-target and outlier thresholds defined above.
