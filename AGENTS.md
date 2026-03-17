# Repository Agent Workflow

This repo uses a strict memory priority order. Follow it exactly and keep it compatible with the existing Claude workflow.

## Memory Priority
1. `.claude-memory.md` = canonical repo memory and source of repo truth
2. `/Users/traftonobrien/.claude/primer.md` = personal/global background context, not repo truth
3. `tasks/lessons.md` = durable operating rules and corrections
4. git state = live execution context for the current branch, recent commits, and working tree

## Startup Behavior
- Before doing any work, read `.claude-memory.md`.
- Treat `.claude-memory.md` as the canonical source of repo state.
- Then read `/Users/traftonobrien/.claude/primer.md` if it exists, but use it only as background context.
- Then read `tasks/lessons.md` if it exists, and follow its durable rules.
- Inspect git branch, recent commits, and working tree status when useful.

## During Work
- Keep decisions and updates consistent with `.claude-memory.md`.
- Follow durable rules from `tasks/lessons.md`.
- Do not fragment memory across multiple repo files unless explicitly required.
- Prefer concise updates to the existing `.claude-memory.md` file instead of creating new memory documents.
- Do not treat `primer.md` as repo truth.

## End Of Task Or Session
- Update `.claude-memory.md`.
- Do not rewrite `/Users/traftonobrien/.claude/primer.md` unless explicitly asked.
- Record current state.
- Record what was completed.
- Record the exact next step.
- Record blockers / risks.
- Record relevant files changed.
- Record durable lessons learned if they belong in repo memory.

## Guardrails
- Do not remove or replace `memory.sh`.
- Do not replace `primer.md`.
- Prefer updating existing files over creating duplicate memory files.
