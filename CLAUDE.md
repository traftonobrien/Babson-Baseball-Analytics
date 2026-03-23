@/Users/traftonobrien/.claude/primer.md
@.claude-memory.md

## PROJECT CONTEXT
Project: Pitch Tracker

## PROJECT RULES
- Read `tasks/lessons.md` at session start
- Update `tasks/todo.md` as you work

## UI RULES — LIGHT & DARK MODE (non-negotiable)
Every UI edit must preserve both light and dark mode. Neither mode is allowed to regress.

### Checklist for any styling change
1. **Use semantic tokens** — always prefer `text-foreground`, `bg-background`, `bg-surface`, `border-border`, `text-muted` over hardcoded colors or raw Tailwind grays.
2. **Pair every light class with a dark variant** — if you write a Tailwind color class that differs in dark mode, add the matching `dark:` class. Never leave one mode unhandled.
3. **Site dark vs system dark** — this app uses `html[data-site-appearance="dark"]` (user toggle), not just `prefers-color-scheme`. The `dark:` prefix maps to that attribute via `globals.css`. Do not mix them up.
4. **Brand surfaces** — use helpers from `web/lib/brandSurfaces.ts` for brand-tinted pills/panels/highlights. Do not inline one-off brand hex values.
5. **After any UI change, mentally verify both modes** — ask: "Does this look correct with `data-site-appearance` set to both `light` and `dark`?"
6. **`npm --prefix web run build` must pass** — run it after every UI change before marking done.

## MEMORY SYSTEM
All persistent memory for this project flows through `./memory.sh`.
- **Launch sessions** via `./memory.sh` — it injects primer + git context + lessons as system prompt
- **Session log**: `.claude-memory.md` — auto-appended on every git commit via `.git/hooks/post-commit`
- **Cross-session primer**: `~/.claude/primer.md` — rewrite at end of every session (active project, completed, exact next step, blockers; keep under 100 lines)
- **Lessons**: `tasks/lessons.md` — append after every correction
- **Todo**: `tasks/todo.md` — write plan here before implementing, mark complete as you go
- Never store memory in ad-hoc notes or chat. If it matters, it goes in one of the above files.

---

## SESSION START
1. `/sc:load` — loads project context, lessons, git state automatically
2. Read tasks/todo.md — understand current state and active work
3. If lessons.md or todo.md don't exist, create them before starting

## SUPERCLAUDE COMMANDS
SuperClaude enhances each stage of the workflow. Use these commands at the right moment.

### Session Start
- `/sc:load` — intelligent context load (project state, lessons, git, todos)
- `/sc:recommend` — if unsure what to work on next, get a prioritized suggestion

### Planning (use before implementing)
- `/sc:workflow [feature description]` — generates structured implementation plan (use this instead of writing todo.md plans manually for non-trivial features)
- `/sc:design [component]` — architecture design for new systems or major changes
- `/sc:spec-panel [spec]` — multi-expert review before committing to a major spec
- `/sc:estimate [task]` — effort estimate before scoping a large task

### Research & Analysis
- `/sc:research [topic]` — deep web research for unknowns (new libraries, NCAA scraping, APIs)
- `/sc:analyze [file or module]` — comprehensive quality/security/performance review before touching a large module
- `/sc:index-repo` — 94% token reduction codebase map; use when entering an unfamiliar part of the repo

### Implementation
- `/sc:implement [feature]` — intelligent feature implementation with persona routing (frontend/backend/data)
- `/sc:pm [task]` — orchestrate complex multi-step work with delegation (replaces manual subagent strategy)

### Quality & Verification
- `/sc:test` — run tests with coverage analysis after any implementation pass
- `/sc:reflect` — validate completed work against original requirements before marking done
- `/sc:improve [file]` — systematic quality pass after implementation is functional

### Bug Fixing
- `/sc:troubleshoot [issue]` — systematic diagnosis with scientific method (use this for any bug before going ad-hoc)

## WORKFLOW

### 1. Plan First
- For non-trivial tasks (3+ steps): run `/sc:workflow` to generate the plan, write output to tasks/todo.md
- For architecture decisions: run `/sc:design` before writing any code
- If something goes wrong, STOP and re-plan — never push through

### 2. Implementation
- Use `/sc:implement` for feature work — it routes to the right persona (senior-frontend, senior-backend, etc.)
- Use `/sc:pm` for complex orchestration across multiple files/systems
- Use subagents for parallel independent tasks to keep main context clean

### 3. Self-Improvement Loop
- After any correction: update tasks/lessons.md
- Format: [date] | what went wrong | rule to prevent it
- `/sc:load` reads these lessons automatically at session start

### 4. Verification Standard
- Run `/sc:test` after implementation
- Run `/sc:reflect` before marking complete
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance
- For non-trivial changes: is there a more elegant solution?
- If a fix feels hacky: rebuild it properly
- Don't over-engineer things

### 6. Autonomous Bug Fixing
- When given a bug: run `/sc:troubleshoot` first
- Go to logs, find root cause, resolve it
- No hand-holding needed

## CORE PRINCIPLES
- Simplicity First — touch minimal code
- No Laziness — root causes only, no temp fixes
- Never Assume — verify paths, APIs, variables before using
- Ask Once — one question upfront if unclear, never interrupt mid-task

## TASK MANAGEMENT
1. Plan → tasks/todo.md
2. Verify → confirm before implementing
3. Track → mark complete as you go
4. Explain → high-level summary each step
5. Learn → tasks/lessons.md after corrections

## LEARNED
(Claude fills this in over time)

---

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
