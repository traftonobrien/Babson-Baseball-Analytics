---
type: wiki
updated: 2026-04-05
status: active
tags: [feature, ui, stats, charting]
---

# Spray Chart Feature

## Summary

- The interactive Spray Chart is a full-featured visual component built to surface depth-aware batting data (infield dirt vs. outfield grass) natively on hitter profile pages.

## Key Details

- Data extraction processes raw play-by-play scraped text into classified directional locations using a customized `zoneMapper`.
- Geometry relies on a true 90-degree fan layout split into 5 proportional core zones (LF, LCF, CF, RCF, RF).
- Depth logic classifies BIPs into `infield` (groundballs, popups) vs. `outfield` (line drives, fly balls).
- The `viewBox` is mathematically cropped perfectly to the SVG wedge bounds, scaling the entire component upward and destroying all dead container space.
- Aesthetic clutter is cleared by stripping out string tags and leveraging raw percentages tightly packed inside each native wedge.
- The heat scale algorithm calculates player-relative maximums and interpolates volume on a custom Baseball Savant-style `Blue to Red` gradient across both light and dark site themes.

## Implications For Pitch Tracker

- Deep-dive components strongly benefit from a clean, data-dense, graphical approach rather than defaulting to tables.
- Baseball Savant formatting standards (specific mapping grades, dynamic heat, localized scaling) remain the absolute benchmark for how the player-profile architecture is designed and consumed.

## Open Questions

- What is the timeline for filtering situational spray charts (e.g., Two Strikes, Under Pressure, Fastballs only, vs Lefties), and will those queries execute via the client map or require a separate backend index?
- Should the heatmap density pivot from an internal player-baseline to an NCAA Division-III global baseline comparison?

## Related

- Individual Player Profiles (`web/app/players/[slug]`)
- Data Pipeline / Aggregation (`web/lib/spraychart/aggregate.ts`)
