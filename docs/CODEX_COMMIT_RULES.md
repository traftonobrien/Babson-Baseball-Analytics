# Codex Commit Rules

## Commit Discipline
Every change must:
- Be scoped
- Be atomic
- Not mix feature + refactor unless required
- Include tests if behavior changed

## Required Pre-Commit Commands
Run and inspect:
- `git status`
- `git diff`
- `git log -1 --oneline`

## Commit Message Format
`[Subsystem] Short precise description`

Examples:
- `[mechanics] Stabilize hip_shoulder_sep_v3 jitter gating`
- `[ingest] Preserve clip order in manual export`
- `[confidence] Centralize conf scaling helpers`
