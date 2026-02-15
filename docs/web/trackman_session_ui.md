## Trackman Session UI

The Trackman session dashboard displays pitch type data imported from Trackman PDF exports. It lives at `/trackman/session/[playerId]/[date]`.

### View modes

The session view has two modes based on available data:

**Aggregate mode** (pitch_types.json): Shows per pitch type averages from PDF exports. This is the primary mode for imported sessions.

**Per pitch mode** (pitches.json): Shows individual pitch data when available. Not produced by the PDF import pipeline.

### Aggregate mode layout

Top to bottom:
1. **Session header strip**: Player name (First Last format), session date (M/D/YY), session label if present. Left aligned with typographic hierarchy.
2. **Pitch type filter chips**: Toggle individual pitch types. Color coded per pitch type.
3. **Pitch type table**: Per type averages for velo, spin, IVB, HB, extension. Totals row from session summary.
4. **Two column layout** (desktop):
   • Left: Movement Profile chart (Savant inspired, concentric rings)
   • Right: Pitch Arsenal cards (one per pitch type, stacked vertically)

### Movement Profile chart

Savant inspired scatter of IVB (y) vs HB (x) with:
• Fixed axis range: -24 to 24 inches (plot extends to 27 for breathing room)
• Concentric rings at 6, 12, 18, 24 inches with a subtle outer ring at 27
• Crosshair axes through origin
• Color coded dots: solid inner core + low opacity halo disk + faint outline stroke
• Labels: pitch name (normal weight) with IVB/HB values beneath (smaller, muted)
• Basic vertical collision avoidance for overlapping labels
• Caption noting halo radius is a visual cue (PDF provides averages, not variance)

### Pitch Arsenal cards

One card per pitch type, sorted by avg velo descending:
• Colored accent bar at top
• Pitch name with color dot
• Hero number: avg velocity (large, bold)
• Secondary metrics: Spin (rpm), IVB, HB, Extension

### Pitch type colors

Defined in `web/lib/pitchColors.ts`. Single source of truth for all components. Supports both abbreviations (FF, SL, CH) and full names from the PDF pipeline (Fastball, Slider, Changeup).

### Filtering

• "Other" pitch type is excluded everywhere (filtered at data load)
• Pitch type filter chips toggle visibility across all components
• Totals in the table recompute based on visible pitch types

### Player name display

Names from the PDF are stored as "Last, First" in meta.json. The header flips this to "First Last" for display.

### Date display

The header reads `session_date` from meta.json and formats it as M/D/YY (e.g. 2/13/26). This date comes from the PDF filename, not the internal date range.
