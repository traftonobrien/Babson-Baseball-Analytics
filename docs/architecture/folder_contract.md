## Folder Contract

Canonical reference for folder structure, naming conventions, and file mapping rules.

### Naming Conventions

- **playerId:** `InitialLastNameN` (e.g. `DJames1`, `CBurrows1`)
- **dateId:** `yyyy_mm_dd` zero-padded (e.g. `2025_03_26`). Optional `_01` suffix for same-day.
- **outingId:** `playerId/dateId` (e.g. `DJames1/2025_03_26`)

### Identity Contract

- `web/public/data/Arsenals.csv` is the single source of truth for `playerId`.
- Resolve all player names, aliases, and slugs back to a canonical `playerId` before writing persistent data.
- `playerId` is the active storage key for post-game stats and web routing. Slug-based stats paths are legacy migration inputs only.

### Local Outing Structure

```
outings/<playerId>/<dateId>/
├── clips/
│   ├── pitch_001.mp4 ... pitch_NNN.mp4
│   └── pitch_log.json
├── results/
│   ├── pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
│   └── pitch_001_result.png ... (optional)
├── pitch_data_overlay_lite.csv
└── roi.json
```

### Web Published Structure

```
web/public/data/<playerId>/<dateId>/
├── pitch_data_overlay_lite.csv
├── clips/
│   └── pitch_001.mp4 ... pitch_NNN.mp4
└── results/
    └── pitch_001_overlay.mp4 ... pitch_NNN_overlay.mp4
```

Result PNGs, `pitch_log.json`, and `roi.json` are not published.

### Stats Published Structure

```
web/public/stats/
├── games/<season>/<gameId>.json
├── players-by-id/<playerId>/<season>/<gameId>.json
└── seasons/<season>/games.json
```

- Player stat payloads persist `playerId` and never rely on a slug path for lookup.
- Season indexes persist `playerIdsIncluded`.
- `web/public/stats/players/` is a legacy migration source and should not be written by current scripts.

### File Mapping

The CSV `pitch_number` column drives filename construction:

- Clip: `pitch_${padded_number}.mp4` (pitch_number 1 = `pitch_001.mp4`)
- Overlay: `pitch_${padded_number}_overlay.mp4` (pitch_number 1 = `pitch_001_overlay.mp4`)

Padding is 3 digits with leading zeros.

### CSV as Source of Truth

The CSV (`pitch_data_overlay_lite.csv`) is the source of truth for pitch count. The `dataIndex.ts` outing label must match the CSV row count (excluding header).

### Mismatch Behavior

If CSV row count does not match file count, or pitch_number does not match filenames:

- Wrong videos may play when clicking pitches in the table
- Video player may show 404 errors
- Report aggregations may be incorrect

### dataIndex.ts Registration

Every published outing must be registered in `web/lib/dataIndex.ts`:

- New players need `throws: "R" | "L"` from `Arsenals.csv`
- Format: `{ id: "<playerId>/<dateId>", label: "<date> - <name> (<count> pitches)", ...buildDataPaths("<playerId>", "<dateId>") }`
