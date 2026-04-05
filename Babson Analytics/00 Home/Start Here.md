---
type: home
updated: 2026-04-03
---

# Start Here

This vault is set up in the style of the Karpathy `raw -> compiled wiki -> generated outputs` workflow, adapted for the Pitch Tracker repo.

## What This Vault Is For

- Capture raw source material quickly
- Build linked project knowledge without scattering repo truth
- Generate wiki notes, briefs, and output artifacts from that source material
- Give Obsidian a clean graph for the project

## What This Vault Is Not

- It is not the canonical source of repo state
- It should not replace `.claude-memory.md`, `AGENTS.md`, or the canonical docs under `docs/`
- It should not become a second hand-edited documentation system that drifts from the codebase

## Source Of Truth Order

1. [[06 Canonical/Repo Memory]]
2. [[06 Canonical/AGENTS]]
3. [[06 Canonical/Lessons]]
4. [[06 Canonical/Docs/INDEX]]

## Folder Map

- `01 Raw/`: captured source material, rough notes, imported exports, PDFs, screenshots, chat transcripts
- [[02 Maps of Content/Project Operating System]]: navigation and system rules
- `03 Wiki/`: cleaned, linked, topic-based notes derived from raw material
- `04 Outputs/`: generated briefs, slide drafts, reports, and other artifacts
- `05 Sessions/`: working notes for time-bounded research or implementation sessions
- `06 Canonical/`: symlinked repo truth and canonical docs
- `99 Templates/`: note templates for consistent capture and synthesis

## Recommended Workflow

1. Drop new material into `01 Raw/`
2. Create a note from [[99 Templates/Raw Source Template]]
3. Ask Claude Code to synthesize that source into one or more notes under `03 Wiki/`
4. Save deliverables under `04 Outputs/`
5. Update repo memory only when the result changes actual project state

## Suggested Claude Code Prompt

```text
Use the raw materials in 01 Raw and the canonical repo sources in 06 Canonical to update this Obsidian vault.

Rules:
- Treat 06 Canonical and the repo code/docs as source of truth.
- Do not replace or contradict .claude-memory.md.
- Create or update focused notes in 03 Wiki.
- Create deliverables in 04 Outputs when useful.
- Use wikilinks heavily so related notes connect in the graph.
- Prefer synthesis over duplication.
```

## Foundation Sources

- [[01 Raw/2026-04-03 Karpathy LLM Knowledge Bases]]
- [[01 Raw/2026-04-03 Build Your AI Brain Guide]]
- [[03 Wiki/Obsidian for Pitch Tracker]]
