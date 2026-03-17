@/Users/traftonobrien/.claude/primer.md
@.claude-memory.md

## PROJECT CONTEXT
Project: Pitch Tracker

## PROJECT RULES
- Read `tasks/lessons.md` at session start
- Update `tasks/todo.md` as you work

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
1. Read tasks/lessons.md — apply all lessons before touching anything
2. Read tasks/todo.md — understand current state
3. If neither exists, create them before starting

## WORKFLOW

### 1. Plan First
- Enter plan mode for any non-trivial task (3+ steps)
- Write plan to tasks/todo.md before implementing
- If something goes wrong, STOP and re-plan — never push through

### 2. Subagent Strategy
- Use subagents to keep main context clean
- One task per subagent
- Throw more compute at hard problems

### 3. Self-Improvement Loop
- After any correction: update tasks/lessons.md
- Format: [date] | what went wrong | rule to prevent it
- Review lessons at every session start

### 4. Verification Standard
- Never mark complete without proving it works
- Run tests, check logs, diff behavior
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance
- For non-trivial changes: is there a more elegant solution?
- If a fix feels hacky: rebuild it properly
- Don't over-engineer things

### 6. Autonomous Bug Fixing
- When given a bug: just fix it
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
