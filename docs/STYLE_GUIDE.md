## Documentation Style Guide

### Naming conventions

- `playerId`: `InitialLastNameN` (e.g. `DJames1`, `CBurrows1`)
- `dateId`: `yyyy_mm_dd` or `yyyy_mm_dd_01` for same-day suffix
- `outingId`: `<playerId>/<dateId>` (e.g. `DJames1/2025_03_26`)

### Formatting

- Use `##` for doc title, `###` for major sections, `####` for subsections.
- Use `•` for bullets in user-facing text. No hyphens for bullets.
- Use `″` for inches, not double quotes, in user-facing text.
- Code blocks use triple backticks with language tags (`bash`, `python`, `typescript`).

### Tone

- Directive, operational, unambiguous. Prefer "Do X" over "You might want to".
- Short sentences. Direct and practical.

### Content rules

- **Do**: put "single source of truth" or "canonical" at the top of each doc that owns a topic.
- **Do**: include at least one realistic example per runbook.
- **Do**: update `docs/ROUTING.md` when adding a new workflow.
- **Do**: link to canonical doc instead of copying content.
- **Don't**: add step-by-step checklists to `CLAUDE.md`.
- **Don't**: hand-edit `docs/generated/*`.
- **Don't**: encode arm/glove logic outside `web/lib/handedness.ts`.
- **Don't**: use emojis in documentation.

### Headings with bold labels

When listing mixed items, start each bullet with a bold label:

- **Fast mode (default):** Uses SAM 2 image predictor on 2 frames only.
- **Overlay-lite:** Same approach but renders overlay MP4.
