# Lessons Learned

<!-- Add lessons here as you encounter them. Format: date, context, lesson. -->

## 2026-03-15
- Zone heatmaps in PitcherZoneHeatmap.tsx use SVG; SimpleBatterSilhouette was removed as unused.
- sessionType must be passed through from the games DB query all the way to PitcherRawPitchRecord for game/live_ab filtering to work.
- Thermographic color gradients (black → purple → red → orange → yellow) work better than emerald/cyan for heat maps.
- `config` in PitcherZoneHeatmap must use named import syntax, not default import.
