# Repository Agent Workflow

This repo uses a strict memory priority order. Follow it exactly and keep it compatible with the existing Claude workflow.

## Memory Priority
1. `.claude-memory.md` = canonical repo memory and source of repo truth
2. `/Users/traftonobrien/.claude/primer.md` = personal/global background context, not repo truth
3. `tasks/lessons.md` = durable operating rules and corrections
4. git state = live execution context for the current branch, recent commits, and working tree

## Startup Behavior
- Before doing any work, read `AGENTS.md` and `.claude-memory.md`.
- Treat `.claude-memory.md` as the canonical source of repo state.
- Then read `/Users/traftonobrien/.claude/primer.md` if it exists, but use it only as background context.
- Then read `tasks/lessons.md` if it exists, and follow its durable rules.
- Inspect git branch, recent commits, and working tree status when useful.

### START — required summary before any code
After reading the above files, output exactly this before touching any code:
1. Current repo state (branch, working tree, last commit)
2. Exact next step
3. Blockers
4. Files most relevant to the next task

## During Work
- Keep decisions and updates consistent with `.claude-memory.md`.
- Follow durable rules from `tasks/lessons.md`.
- Do not fragment memory across multiple repo files unless explicitly required.
- Prefer concise updates to the existing `.claude-memory.md` file instead of creating new memory documents.
- Do not treat `primer.md` as repo truth.

### UI Rule — Light & Dark Mode (non-negotiable)
Every UI/styling change must keep both light and dark mode working. Neither mode may regress.
- Use semantic tokens: `text-foreground`, `bg-background`, `bg-surface`, `border-border`, `text-muted` — not hardcoded colors or raw Tailwind grays.
- Pair every light Tailwind color class with a `dark:` variant when they differ. Never leave one mode unhandled.
- Site dark = `html[data-site-appearance="dark"]` (user toggle via `globals.css`) — not `prefers-color-scheme`. Do not mix them up.
- Brand tints go through `web/lib/brandSurfaces.ts`. Do not inline one-off brand hex values.
- After any UI change, verify both modes mentally before marking done.
- `npm --prefix web run build` must pass after every UI change.

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
