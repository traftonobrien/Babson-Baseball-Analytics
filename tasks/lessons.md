# Lessons Learned

<!-- Add lessons here as you encounter them. Format: date, context, lesson. -->

## 2026-03-23
- [UI rule] Every styling change must keep both light and dark mode working. Use semantic tokens (`text-foreground`, `bg-background`, `bg-surface`, `border-border`, `text-muted`). Pair every light Tailwind color class with a `dark:` variant if they differ. Site dark uses `html[data-site-appearance="dark"]` via `globals.css` — not `prefers-color-scheme`. Brand tints go through `web/lib/brandSurfaces.ts`. Never leave one mode unverified.
- [Canonical player IDs] Stuff+ rows can arrive with slug-style player IDs like `smith_cooper` while charting/leaderboards use roster IDs like `CSmith1`; canonical resolution must check exact / parsed slugs via `PLAYER_ID_BY_SLUG` before alias fallback so Pitching+ merges the same player correctly.

## 2026-03-15
- Zone heatmaps in PitcherZoneHeatmap.tsx use SVG; SimpleBatterSilhouette was removed as unused.
- sessionType must be passed through from the games DB query all the way to PitcherRawPitchRecord for game/live_ab filtering to work.
- Thermographic color gradients (black → purple → red → orange → yellow) work better than emerald/cyan for heat maps.
- `config` in PitcherZoneHeatmap must use named import syntax, not default import.
