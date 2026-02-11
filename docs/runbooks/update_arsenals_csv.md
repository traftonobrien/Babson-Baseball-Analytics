## Update Arsenals CSV

The Arsenals CSV defines player names, pitcher hands, and pitch type arsenals. Two copies must be kept in sync.

### File locations

| Copy | Used by |
|---|---|
| `data/Arsenals.csv` | Python scripts (`src/arsenals.py`, `batch_process.py`) |
| `web/public/data/Arsenals.csv` | Web app (fetched at runtime) |

### Columns

`player_id`, `player_name`, `pitcher_hand`, `pitch_type`, `abbreviation`

### Update workflow

1. Export updated CSV from Google Sheets (or edit locally).
2. Replace both copies:
   ```bash
   cp data/Arsenals.csv web/public/data/Arsenals.csv
   ```
   Or if updating from an external source:
   ```bash
   cp ~/Downloads/Arsenals.csv data/Arsenals.csv
   cp ~/Downloads/Arsenals.csv web/public/data/Arsenals.csv
   ```
3. Verify both files are identical:
   ```bash
   diff data/Arsenals.csv web/public/data/Arsenals.csv
   ```
4. Build check:
   ```bash
   npm --prefix web run build
   ```
5. Commit both:
   ```bash
   git add data/Arsenals.csv web/public/data/Arsenals.csv
   git commit -m "Update Arsenals.csv"
   ```

### New player checklist

When adding a new player:

1. Add row(s) to `Arsenals.csv` (one row per pitch type).
2. Sync both copies as above.
3. When publishing their first outing, `web/lib/dataIndex.ts` will need a new player entry with `throws: "R" | "L"` matching the `pitcher_hand` column.

### Common mistakes

- Updating only one copy of the CSV. Always sync both.
- Forgetting to set `pitcher_hand` for a new player. The web app uses this for arm-side/glove-side labeling.
