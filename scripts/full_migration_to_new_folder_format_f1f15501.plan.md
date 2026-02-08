---
name: Full Migration to New Folder Format
overview: Migrate all existing outings from web/public/data/<oldOutingId>/ to web/public/data/<playerId>/<dateId>/ structure. Update dataIndex.ts entries to use buildDataPaths() and new outing.id format. Includes migration script, mapping file, validation, and rollback safety.
todos: []
---

# FULL MIGRATION TO NEW FOLDER FORMAT (PlayerId/dateId)

## OVERVIEW

Migrate all 7 existing outings from flat `web/public/data/<oldOutingId>/` to hierarchical `web/public/data/<playerId>/<dateId>/`. Update all `dataIndex.ts` entries to new ids and to use `buildDataPaths()`.

## OUTINGS MAPPING (7)

1. `2025_10_04_OBrien` → `TOBrien1/2025_10_04`
2. `2024_04_27_Finkelstein` → `JFinkelstein1/2024_04_27`
3. `2024_04_14_Finkelstein` → `JFinkelstein1/2024_04_14`
4. `2024_04_09_Clark` → `JClark1/2024_04_09`
5. `2024_04_27_Clark` → `JClark1/2024_04_27`
6. `2024_04_27_Teator` → `ZTeator1/2024_04_27`
7. `2024_04_27_Doan` → `CDoan1/2024_04_27`

## BREAKING CHANGE

`outing.id` changes from `yyyy_mm_dd_LastName` to `playerId/dateId`.

**This impacts:**

- URL query params: `?outingId=2024_04_27_Finkelstein` → `?outingId=JFinkelstein1/2024_04_27`
- localStorage keys: `pitchTypeOverrides:2024_04_27_Finkelstein` → `pitchTypeOverrides:JFinkelstein1/2024_04_27`
- Bookmarks with old outingId values

**This does NOT affect:**

- Video loading (uses explicit paths, not id)
- CSV reading (uses explicit paths, not id)

## MIGRATION MODEL

No manual edits. Script performs:

1. Read current `dataIndex.ts`
2. Detect old format outings
3. Map `oldId` → `playerId/dateId` via CSV mapping
4. Move folders on disk
5. Rewrite `dataIndex.ts` outing objects to new format using `buildDataPaths()`
6. Inject `buildDataPaths()` into `dataIndex.ts` if missing
7. Run `npm --prefix web run build`
8. Abort on build failure and print rollback command

## CRITICAL SCRIPT REQUIREMENTS

1. **`is_old_format()` uses path segment count:**

   - Old: `/data/<oldOutingId>/pitch_data_overlay_lite.csv` → 3 segments after strip
   - New: `/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv` → 4 segments after strip

2. **Replace entire outing object blocks** by locating `id: "oldId"` and brace-walking to replace the full object.

3. **Ensure `buildDataPaths()` exists** in `web/lib/dataIndex.ts` (insert after `getPlayer` if missing).

4. **Skip if destination exists** to prevent overwrites.

5. **Always run build after execute**; fail fast if build fails; print rollback.

6. **Print exact git commands** after success.

## FILES TO ADD

1. `scripts/mapping_existing_outings.csv`
2. `scripts/migrate_existing_outings.py`

## MAPPING FILE CONTENT

**File: `scripts/mapping_existing_outings.csv`**

```csv
oldOutingId,playerId,dateId,newOutingId
2025_10_04_OBrien,TOBrien1,2025_10_04,TOBrien1/2025_10_04
2024_04_27_Finkelstein,JFinkelstein1,2024_04_27,JFinkelstein1/2024_04_27
2024_04_14_Finkelstein,JFinkelstein1,2024_04_14,JFinkelstein1/2024_04_14
2024_04_09_Clark,JClark1,2024_04_09,JClark1/2024_04_09
2024_04_27_Clark,JClark1,2024_04_27,JClark1/2024_04_27
2024_04_27_Teator,ZTeator1,2024_04_27,ZTeator1/2024_04_27
2024_04_27_Doan,CDoan1,2024_04_27,CDoan1/2024_04_27
```

## MIGRATION SCRIPT

**File: `scripts/migrate_existing_outings.py`**

See complete implementation in plan document. Key functions:

- `parse_data_index()` - Extract all outings from dataIndex.ts
- `is_old_format(csv_path)` - Detect old format using path segment count
- `load_mapping(mapping_file)` - Load CSV mapping
- `validate_outing_folder(folder_path)` - Validate required files and counts
- `migrate_outings()` - Main migration logic
- `replace_outing_block()` - Replace entire outing object safely
- `ensure_build_data_paths_exists()` - Inject buildDataPaths if missing
- `update_data_index()` - Rewrite dataIndex.ts with new format

## EXECUTION STEPS

1. **Create backup branch:**
   ```bash
   git checkout -b backup/pre-folder-migration
   git commit -am "backup before folder migration"
   git checkout main  # or your working branch
   ```

2. **Run dry-run:**
   ```bash
   python3 scripts/migrate_existing_outings.py --mapping scripts/mapping_existing_outings.csv
   ```


**Expect:** DRY RUN output only, no file changes

3. **Execute migration:**
   ```bash
   python3 scripts/migrate_existing_outings.py --mapping scripts/mapping_existing_outings.csv --execute
   ```


**Expect:**

   - Folders moved
   - dataIndex.ts rewritten
   - Build runs automatically
   - Script fails if build fails

4. **Manual smoke test:**

   - Load each player
   - Switch outings
   - Verify clips/overlays play
   - Test report page
   - Test compare page

5. **Commit changes:**
   ```bash
   git add -A
   git commit -m "Migrate outings to playerId/dateId structure"
   git push
   ```


## POST-MIGRATION VALIDATION

1. **Build check:**
   ```bash
   npm --prefix web run build
   ```


**Expected:** Build passes

2. **Confirm old folders gone:**
   ```bash
   ls web/public/data | grep '^2024_\|^2025_'
   ```


**Expected:** Empty output (no old flat folders)

3. **Confirm no old paths in dataIndex.ts:**
   ```bash
   grep '/data/2024_\|/data/2025_' web/lib/dataIndex.ts
   ```


**Expected:** Empty output (no old flat paths)

## OPTIONAL localStorage MIGRATION

Run browser console script to copy `pitchTypeOverrides:<oldId>` to `pitchTypeOverrides:<newId>` after migration to preserve user overrides:

```javascript
const mappings = {
  "2025_10_04_OBrien": "TOBrien1/2025_10_04",
  "2024_04_27_Finkelstein": "JFinkelstein1/2024_04_27",
  "2024_04_14_Finkelstein": "JFinkelstein1/2024_04_14",
  "2024_04_09_Clark": "JClark1/2024_04_09",
  "2024_04_27_Clark": "JClark1/2024_04_27",
  "2024_04_27_Teator": "ZTeator1/2024_04_27",
  "2024_04_27_Doan": "CDoan1/2024_04_27"
};

for (const [oldId, newId] of Object.entries(mappings)) {
  const oldKey = `pitchTypeOverrides:${oldId}`;
  const newKey = `pitchTypeOverrides:${newId}`;
  const data = localStorage.getItem(oldKey);
  if (data) {
    localStorage.setItem(newKey, data);
    localStorage.removeItem(oldKey);
  }
}
```

## ROLLBACK

If something breaks:

```bash
git checkout HEAD -- web/lib/dataIndex.ts web/public/data/
```

## DATAINDEX FORMAT CHANGE

**Before:**

```typescript
{
  id: "2024_04_27_Finkelstein",
  label: "Apr 27, 2024 – Finkelstein (63 pitches)",
  csvPath: "/data/2024_04_27_Finkelstein/pitch_data_overlay_lite.csv",
  overlayDir: "/data/2024_04_27_Finkelstein/results",
  clipsDir: "/data/2024_04_27_Finkelstein/clips",
}
```

**After:**

```typescript
{
  id: "JFinkelstein1/2024_04_27",
  label: "Apr 27, 2024 – Finkelstein (63 pitches)",
  ...buildDataPaths("JFinkelstein1", "2024_04_27"),
}
```

## RESULT AFTER MIGRATION

**Every outing will follow the canonical structure:**

```
player → games → assets
```

**This enables:**

- ✓ Simpler publishing workflow
- ✓ Automatic indexing by player
- ✓ Clean automation scripts
- ✓ Future database sync capabilities
- ✓ Easier scouting history tracking
- ✓ Multi-game logic per player
- ✓ Career aggregation across outings
- ✓ Less human error forever
- ✓ Consistent structure for all tooling