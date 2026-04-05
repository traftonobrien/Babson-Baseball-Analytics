---
type: wiki
updated: 2026-04-03
status: active
tags:
  - obsidian
  - project-ops
  - knowledge-base
---

# Obsidian for Pitch Tracker

## Decision

Use Obsidian as the project knowledge surface, not as the canonical source of repo truth.

## Why This Fits

- The project already has substantial Markdown documentation
- There is already an Obsidian vault in the repo
- The repo benefits from a graphable layer for research, workflows, and generated briefs
- The existing memory rules are strict, so a separate synthesis layer is safer than moving truth into the vault

## Working Model

### Raw

Store rough inputs in `01 Raw/`:

- external PDFs
- screenshots
- copied notes
- web captures
- chat exports
- rough research

### Compiled Wiki

Create cleaned notes in `03 Wiki/`:

- topic summaries
- feature maps
- research syntheses
- decision context
- glossary/entity notes

### Outputs

Create deliverables in `04 Outputs/`:

- slide drafts
- memos
- implementation briefs
- launch checklists
- visual analyses

## Guardrails

- `06 Canonical/` stays authoritative
- `.claude-memory.md` remains repo-local truth
- `docs/` remains the canonical hand-written doc system
- avoid duplicating long repo docs into the vault unless there is a clear synthesis purpose

## First Useful Next Steps

1. Pull the highest-value existing project docs into topic hubs and synthesis notes
2. Add a session note whenever research or implementation spans multiple files/sources
3. Start building entity/topic pages for major concepts:
   - charting
   - command metrics
   - pitching plus
   - team stats
   - mechanics
   - player identity
   - runbooks

## Related

- [[00 Home/Start Here]]
- [[02 Maps of Content/Project Operating System]]
- [[01 Raw/2026-04-03 Karpathy LLM Knowledge Bases]]
- [[01 Raw/2026-04-03 Build Your AI Brain Guide]]
