## Documentation Governance

### Canonical sources

| Topic | Owner |
|---|---|
| Constitution (invariants) | `CLAUDE.md` |
| Task routing | `docs/ROUTING.md` |
| Folder contract | `docs/architecture/folder_contract.md` |
| Coordinates / handedness | `docs/architecture/coordinates_and_handedness.md` + `web/lib/handedness.ts` |
| Publishing workflow | `docs/runbooks/publish_outing.md` |
| Generated references | `docs/generated/*` (via `scripts/update_docs.py`) |

### Generated vs hand-written boundary

- `docs/generated/*` — Written exclusively by `scripts/update_docs.py`. Never hand-edit.
- Everything else under `docs/` — Hand-written. Updated by humans or agents when code changes.
- `CLAUDE.md` — Constitution. Never touched by the generator.

### How contributors edit docs

1. If changing code behavior, update the canonical doc for that topic (see `docs/ROUTING.md`).
2. If adding a new workflow, add exactly one new canonical doc and one routing entry.
3. Never copy-paste runbooks into multiple places. Link to the canonical source.

### When to update generated docs

Any change to watched files in `scripts/update_docs.py` should trigger a proposed update. The pre-commit hook handles this automatically.

### Keeping CLAUDE.md slim

- Size gate in `scripts/check_docs.py` (< 40k chars).
- No checklists or CLI enumerations in the constitution.
- Move detailed content to `docs/` subdirectories.
