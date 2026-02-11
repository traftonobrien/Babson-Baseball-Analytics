## Migrate Outings (Legacy to New Folder Format)

Runbook for migrating outings from any legacy folder layout to the canonical `<playerId>/<dateId>` structure.

### Canonical layout

```
outings/<playerId>/<dateId>/
web/public/data/<playerId>/<dateId>/
```

See `docs/architecture/folder_contract.md` for naming rules.

### When to use

Use this runbook when outings exist under a non-canonical path (flat directories, wrong naming, missing player prefix, etc.) and need to be moved to the standard layout.

### Steps

1. **Identify source**: Locate the outing files (CSV, clips, overlays).

2. **Determine playerId and dateId**: Look up the player in `data/Arsenals.csv`. Format dateId as `yyyy_mm_dd`.

3. **Create target directories**:
   ```bash
   mkdir -p outings/<playerId>/<dateId>/clips
   mkdir -p outings/<playerId>/<dateId>/results
   ```

4. **Move files**:
   ```bash
   mv <old_path>/pitch_data_overlay_lite.csv outings/<playerId>/<dateId>/
   mv <old_path>/clips/pitch_*.mp4 outings/<playerId>/<dateId>/clips/
   mv <old_path>/results/pitch_*_overlay.mp4 outings/<playerId>/<dateId>/results/
   ```

5. **Validate counts** (CSV rows = clip count = overlay count).

6. **Publish** if needed: follow `docs/runbooks/publish_outing.md`.

### dateId normalization

If any dateIds are in the legacy `mm_dd_yy` format, run `scripts/normalize_dateIds.py` first. See `docs/runbooks/normalize_dateIds.md`.
