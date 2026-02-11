## Documentation Maintenance

How the documentation system works and how to keep it healthy.

### Doc hierarchy

1. **CLAUDE.md** (constitution) — Hard invariants and routing. Must stay under 40k chars.
2. **docs/** (canonical hand-written docs) — Architecture, pipeline, web, runbooks, troubleshooting.
3. **docs/generated/** (auto-generated) — Derived from code by `scripts/update_docs.py`. Never hand-edit.

### Auto-generation

`scripts/update_docs.py` generates 6 files under `docs/generated/`:

| File | Derived from |
|---|---|
| `web_app_data_contract.md` | `web/lib/dataIndex.ts` |
| `publishing_workflow.md` | `docs/runbooks/publish_outing.md`, skill files |
| `outing_selection_logic.md` | `web/app/player/[playerId]/page.tsx` |
| `perspective_and_lanes.md` | `web/lib/handedness.ts`, `web/lib/reportModel.ts` |
| `thresholds_on_target_outliers.md` | `web/lib/reportModel.ts`, `PitchTable.tsx` |
| `cli_args.md` | `src/batch_process.py`, `src/mark_pitches.py`, `src/segment_pitches.py`, `src/generate_report.py` |

### Commands

```bash
# Show what would change
python3 scripts/update_docs.py --propose --full

# Show diffs
python3 scripts/update_docs.py --diff

# Apply changes
python3 scripts/update_docs.py --apply

# Check if stale (exit 0 always, prints status)
python3 scripts/update_docs.py --check
```

### Pre-commit hook

The `.githooks/pre-commit` hook runs `--propose` on every commit. If changes are detected:

- Interactive terminal: prompts to apply and stage
- Non-interactive: prints a reminder to run `--apply` manually

The hook never blocks commits (always exits 0).

### Drift checks

`scripts/check_docs.py` runs 4 checks:

1. CLAUDE.md size (warn at 25k, fail at 40k)
2. `docs/ROUTING.md` exists with core keywords
3. All expected `docs/generated/*` files exist
4. Generated docs are not stale

Run manually or in CI: `python3 scripts/check_docs.py`

### When to update docs

- **Code behavior changes**: Update the canonical doc for that topic (find it via `docs/ROUTING.md`).
- **New workflow**: Add one canonical doc and one row to `docs/ROUTING.md`.
- **CLI args change**: Run `python3 scripts/update_docs.py --apply` to regenerate.
- **Threshold constants change**: Same — regenerate.

### Rules

- Never hand-edit files in `docs/generated/`.
- Keep CLAUDE.md slim. Move step-by-step content to `docs/runbooks/` or `docs/pipeline/`.
- One canonical doc per topic. No duplication between hand-written and generated.
