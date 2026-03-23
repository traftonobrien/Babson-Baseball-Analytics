---
name: fetch-roster-photos
description: Fetch and wire player headshots from the Babson Athletics baseball roster page. Use when the user says "fetch roster photos", "update player photos", "sync babson photos", "download headshots", or "refresh player photos". Downloads photos to web/public/images/players/, updates web/data/roster.json with photo paths, and verifies the UI renders correctly.
---

# Fetch Babson Roster Photos

Downloads player headshots from https://babsonathletics.com/sports/baseball/roster, saves them as WebP files, updates roster.json with photo paths, and verifies the build passes.

Photos are wired into the UI automatically via roster.json — no component changes needed after the first setup.

## Decide: fresh sync or force refresh?

- **First time / new season**: run with `--photos` (skips files that already exist)
- **Roster photos updated on Babson's site**: run with `--photos --force` (re-downloads everything)

Ask the user which they want if it's not clear from context.

## Step 1: Run the script

```bash
python3 scripts/fetch_babson_roster.py --photos
```

Or to force re-download all:

```bash
python3 scripts/fetch_babson_roster.py --photos --force
```

Expected output lines for each player:
- `[saved]    miller_wyatt.webp  (18 KB)` — downloaded
- `[exists]   miller_wyatt.webp` — skipped (already present, no `--force`)
- `[skip]     <slug> — no photo URL` — player has no photo on the roster page (rare)
- `[error]    <slug>: ...` — network error; report and stop

If any `[error]` lines appear: STOP. Report the slugs that failed. Do not continue.

## Step 2: Verify photo count

```bash
ls web/public/images/players/*.webp | wc -l
```

Expected: matches the number of players on the Babson roster (typically 45–55).
If count is 0: STOP. The script likely failed silently.

## Step 3: Verify roster.json updated

```bash
grep '"photo"' web/data/roster.json | head -5
```

Expected: lines like `"photo": "/images/players/miller_wyatt.webp"`

If paths still show `.jpg` extension: re-run the script without `--photos` flag to regenerate roster.json only:

```bash
python3 scripts/fetch_babson_roster.py
```

## Step 4: Build

```bash
npm --prefix web run build
```

If build fails: report the error. Do not commit broken code.

## Step 5: Commit

Stage only the changed assets and data file:

```bash
git add web/public/images/players/ web/data/roster.json
git commit -m "feat(roster): sync player headshots from Babson Athletics"
```

Do not stage unrelated modified files.

## Final output

Print a summary:

```
Photos downloaded: <N>
Photos skipped (already existed): <N>
roster.json updated: yes
Build: OK
Committed: <hash>
```

## Rules

• Never manually edit roster.json photo paths — always re-run the script.
• Do not rename photo files manually — slugs must match roster.json keys exactly.
• Photos render at 44×44px in the roster list and 96×96px on profile pages — object-cover/object-top is applied; no cropping needed.
• The script detects WebP content-type automatically even when URLs end in .jpg — do not change file extensions manually.
• If a player has no photo on the Babson roster page, the UI falls back to an initials avatar — this is expected behavior, not a bug.
• Only commit web/public/images/players/ and web/data/roster.json — do not commit source code changes unless explicitly asked.
• The `<Image>` components for player photos MUST keep `unoptimized` prop — the Babson CDN returns small WebP files that the Next.js image optimizer cannot process. If photos show as broken icons, check that `unoptimized` is present on all three Image tags in `PlayersHubView.tsx` and `players/[slug]/page.tsx`.
