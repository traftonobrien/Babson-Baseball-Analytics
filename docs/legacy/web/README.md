# Pitch Tracker Web

Dark "film room" UI for reviewing pitch miss data, overlay videos, and scatter/heatmap charts.

## Setup

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click a player card to open the dashboard.

## Data Files

Place outing data under `public/data/<outing_id>/`:

```
public/data/2025_10_04_OBrien/
  pitch_data_overlay_lite.csv      # CSV with miss metrics (from batch_process.py)
  results/
    pitch_001_overlay.mp4          # overlay videos
    pitch_002_overlay.mp4
    ...
  clips/
    pitch_001.mp4                  # raw clips (optional fallback)
    pitch_002.mp4
    ...
```

### Naming conventions

- Overlay videos: `pitch_###_overlay.mp4` (zero-padded 3 digits)
- Raw clips: `pitch_###.mp4`
- CSV: any name, referenced in `lib/dataIndex.ts`

### Adding a new outing

1. Copy data into `public/data/<outing_id>/`
2. Add an entry to the player's `outings` array in `lib/dataIndex.ts`

## Current Limitations

- Strike zones are miss-based (centered on target origin at 0,0), not true pitch-location-based in v1
- Single outing view per player (first outing is shown)

## Roadmap

- Multi-outing selector within the player dashboard
- Multi-player support (add entries to `lib/dataIndex.ts`)
- Outing comparison / aggregate views
- True strike zone overlay using absolute pitch coordinates
