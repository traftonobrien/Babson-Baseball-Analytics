## Normalize Legacy dateIds

Converts `mm_dd_yy` dateIds to the canonical `yyyy_mm_dd` format across the codebase.

### The problem

Legacy dateIds like `03_26_25` are ambiguous (March 26, 2025 or some other interpretation). The canonical format is `2025_03_26`.

### What the script does

`scripts/normalize_dateIds.py` scans three locations:

1. `web/lib/dataIndex.ts` — outing IDs and `buildDataPaths()` calls
2. `outings/<playerId>/` — local processing folders
3. `web/public/data/<playerId>/` — published web folders

It reports all legacy dateIds found and their proposed normalization.

### Dry run (default)

```bash
python3 scripts/normalize_dateIds.py
```

Shows what would change without modifying anything.

### Execute

```bash
python3 scripts/normalize_dateIds.py --execute
```

This will:

1. Update `dataIndex.ts` (text replacement of old dateId to new)
2. Rename `outings/<playerId>/<old>` → `outings/<playerId>/<new>`
3. Rename `web/public/data/<playerId>/<old>` → `web/public/data/<playerId>/<new>`
4. Validate CSV pitch counts still align after rename

The script updates `dataIndex.ts` **before** renaming folders (order matters for safety).

### After running

1. Run `npm --prefix web run build` to verify the build passes.
2. Commit: `git add -A && git commit -m "Normalize dateIds to yyyy_mm_dd"`
3. Push to deploy.

### Options

- `--execute` — Apply changes (default is dry run)
- `--century N` — Century prefix for yy → yyyy (default: 20, so `25` becomes `2025`)
