## Import Trackman PDF

Import a Trackman Team Portal PDF export into the web app. Parses pitch type averages, writes session files, and updates the global index.

### Default export folder

The importer looks for PDFs in `Trackman Exports/` at the repo root. If that folder does not exist, it falls back to the absolute path `/Users/traftonobrien/Desktop/pitch-tracker/Trackman Exports/`. Override with `--pdf-dir`.

### Filename convention

PDFs are named `Player Name M/DD.pdf` (Finder shows `/`, filesystem stores `:`).

Examples: `Bobby Burk 2:13.pdf`, `Chase Burrows 1:01.pdf`

The importer extracts the session date from the filename. The year is inferred from the PDF content.

### Quick start

```bash
# Import the most recently modified PDF in the default folder
python3 scripts/import_trackman_pdf.py --latest

# Import a specific PDF
python3 scripts/import_trackman_pdf.py --pdf "Trackman Exports/Bobby Burk 2:13.pdf"

# Import all PDFs in the folder (oldest first, skips duplicates)
python3 scripts/import_trackman_pdf.py --all

# Import with debug output
python3 scripts/import_trackman_pdf.py --latest --debug-dump
```

### CLI flags

| Flag | Description |
|---|---|
| `--pdf PATH` | Import a specific PDF file |
| `--latest` | Import the most recently modified PDF in the export folder |
| `--all` | Import every PDF in the export folder |
| `--pdf-dir DIR` | Override the export folder |
| `--player "Last, First"` | Override player name |
| `--session-date YYYY-MM-DD` | Override session date |
| `--session-label LABEL` | Override session label (e.g. LiveAB, Bullpen) |
| `--no-copy-pdf` | Skip copying the source PDF into the output directory |
| `--debug-dump` | Write debug artifacts to `output/debug/{sha256}/` |

`--pdf`, `--latest`, and `--all` are mutually exclusive. One is required.

### Convenience wrapper

`scripts/import_trackman_exports.py` is a thin wrapper that defaults to `--latest` from the default folder.

```bash
python3 scripts/import_trackman_exports.py           # same as --latest
python3 scripts/import_trackman_exports.py --all      # import everything
```

### What it produces

For each PDF, the importer writes to `web/public/trackman/sessions/<player_slug>/<date_slug>/session/`:

| File | Contents |
|---|---|
| `meta.json` | Player name, slug, team, handedness, session date, source info |
| `pitch_types.json` | Per pitch type averages (velo, spin, IVB, HB, extension, etc.) |
| `session_summary.json` | Weighted averages across all pitch types, max values |
| `source.pdf` | Copy of the original PDF (unless `--no-copy-pdf`) |

It also upserts the session into `web/public/trackman/index.json`.

### Date resolution

Priority order for session date:
1. `--session-date` CLI override
2. Date parsed from the PDF filename (e.g. `Bobby Burk 2:13.pdf` becomes 2026-02-13)
3. PDF internal metadata (session_date, date_to, date_from)

### Duplicate handling

The importer hashes each PDF (SHA-256). If the hash already exists in `index.json`, the import is skipped. Use `--debug-dump` to force re-import for debugging.

### After importing

Run `npm --prefix web run build` to verify the build, then push.

To rebuild leaderboards after importing new sessions:

```bash
python3 scripts/build_trackman_leaderboards.py
```
