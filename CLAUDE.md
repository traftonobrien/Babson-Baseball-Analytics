## Pitch Tracker — Constitution (Read First)

Pitch Tracker measures command by comparing a catcher target (glove) to ball arrival in **image space** using a **center-field camera**. It produces per-pitch metrics and publishes review assets to a Next.js web app.

This file is the **constitution**: hard invariants + the minimal mental model. Detailed workflows live in `docs/`.

### Canonical perspective (non-negotiable)

- **Camera**: center-field, behind pitcher, looking toward home plate.
- **Image axes**: origin top-left; +X right (toward 1B), +Y down (toward ground).

### Miss vector definition (non-negotiable)

- **Definition**: `dx = ball_x - target_x`, `dy = ball_y - target_y`.
- **Meaning**:
  - `dx > 0`: ball is right of target in the image (toward 1B)
  - `dy > 0`: ball is below target in the image (low)

Do not redefine these. Any "direction" labeling derives from these values.

### Arm-side / glove-side labeling (non-negotiable)

Horizontal direction is labeled relative to pitcher handedness:

```python
arm_sign = 1 if pitcher_hand == "R" else -1
h_direction = "arm-side" if dx * arm_sign > 0 else "glove-side"
```

This repo's single source of truth for web-side handedness normalization is `web/lib/handedness.ts`.

### Canonical folder backbone (non-negotiable)

These two directory contracts are the backbone of the system:

- **Processing outputs (local)**: `outings/<playerId>/<dateId>/`
- **Published web assets**: `web/public/data/<playerId>/<dateId>/`

`playerId` format: e.g. `DJames1`, `CBurrows1`

`dateId` format: `yyyy_mm_dd` (zero padded), optionally `yyyy_mm_dd_01` for same-day suffix.

Legacy `mm_dd_yy` dateIds are not allowed. Normalize with `scripts/normalize_dateIds.py`.

### Golden paths (high level)

- **Primary pipeline**: `src/mark_pitches.py` → `src/batch_process.py` → publish to web app.
- **Legacy/Debug**: standalone scripts exist for debugging only.

### Where to look (routing)

- Task routing index (agents and humans): `docs/ROUTING.md`
- Architecture invariants: `docs/architecture/*`
- Runbooks (publish/migrate/etc.): `docs/runbooks/*`
- Mechanics engine (start here): `docs/mechanics/README.md`
- Pipeline details: `docs/pipeline/*`
- Web app conventions: `docs/web/*`
- Auto-generated reference (CLI args, web contract): `docs/generated/*`
- Troubleshooting: `docs/troubleshooting/common_failures.md`

### Editing rules (doc governance)

- Treat `docs/generated/*` as derived artifacts — do not hand-edit.
- When code behavior changes, update the **canonical** doc for that topic (see `docs/ROUTING.md`).
- Keep this constitution slim. If a section needs step-by-step instructions, it belongs in `docs/runbooks/` or `docs/pipeline/`.

### Known drift to resolve

If you find a mismatch between code, data folders, and docs, record it in `memory/MEMORY.md` and fix at the canonical source.
