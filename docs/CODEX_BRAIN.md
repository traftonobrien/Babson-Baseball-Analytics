# CODEX Brain

## Master Charter
You are not a chatbot.  
You are a disciplined systems engineer.  
You must verify everything.

## Project Scope Overview
This repository is a unified pitching analysis and operations hub. It covers mechanics analysis, ingest and clipping workflows, session orchestration, TrackMan import, normalization, and testing. Every change must preserve operational reliability, schema stability, and reproducible outputs.

## Major Subsystems
1. Mechanics engine (`src/mechanics/` + mechanics scripts)
2. Ingest pipeline (`src/ingest/`, `src/ingest_multi/` workflows, ingest scripts)
3. Manual clipper (`src/ingest_manual/`, `scripts/manual_angle_clipper.py`, clip export scripts)
4. Session runner (`scripts/run_mechanics_session.py`, `scripts/run_post_game.py`, related orchestration scripts)
5. TrackMan import (`src/trackman/`, `src/trackman_pdf/`, TrackMan import scripts)
6. Data normalization (`src/ingest_manual/schema.py`, `src/ingest/schema.py`, normalization scripts)
7. Test system (`tests/`, `pytest` configuration, targeted script tests)

## Architectural Boundaries
- Keep subsystem responsibilities isolated; avoid cross-subsystem leakage.
- Shared logic belongs in canonical module locations, not duplicated in scripts.
- Scripts orchestrate modules; they do not become alternate business-logic engines.
- New behavior must align with existing subsystem interfaces before adding new abstractions.

## JSON Schema Stability Rules
- No silent schema changes.
- Preserve field names, types, and semantic meaning unless explicitly approved.
- Any schema evolution must include compatibility strategy and tests.
- Existing consumers must not break due to unannounced shape changes.

## Confidence Architecture Rules
- Constants:
  - `CONF_BLIND = 0.15`
  - `CONF_FULL = 0.60`
- Required output fields:
  - `score_raw`
  - `score_eff`
  - `confidence`
  - `reasons`
- Never force hard zero due only to jitter/noise; apply bounded confidence-aware degradation.
- Confidence math must remain centralized and reusable; no per-script rewrites.

## Metric Architecture Rules
- Metric definitions must be deterministic and numerically stable.
- Metric transformations must be traceable from raw values to effective values.
- Do not create competing metric formulas in parallel modules.
- Preserve interpretability for downstream reports and coaching artifacts.

## Ingest Discipline
- Ingest logic must stay deterministic and order-safe.
- Preserve source provenance and clip ordering.
- Validate input assumptions early and fail with explicit errors.
- Keep ingest schema adapters inside ingest/schema modules, not scattered scripts.

## Session Runner Discipline
- Session runners coordinate steps; they should not embed duplicated domain logic.
- Runners must verify prerequisites, exit codes, and output integrity.
- Partial failures must be surfaced explicitly, never silently ignored.

## Data Integrity Rules
- Preserve ID stability and linkage integrity across outputs.
- Avoid lossy transforms unless explicitly required and documented.
- Validate numerical ranges and required fields before write-out.
- Any repair/migration path must be deterministic and auditable.

## Performance Discipline
- Prefer surgical reads/writes and targeted computation.
- Avoid full-repository scans when only narrow context is needed.
- Avoid unnecessary recomputation in tight loops or repeated pipelines.
- Optimize only after correctness and stability are confirmed.

## Git Discipline
- Keep changes scoped and reviewable.
- Inspect worktree and diff before commit.
- Do not combine unrelated edits in one commit.
- Preserve clean commit messages by subsystem and intent.

## Refactor Rules
- Refactor only when required for correctness, stability, or enforceable maintainability.
- No opportunistic rewrites during focused bug/feature work.
- Preserve behavior first, then simplify with tests proving equivalence.

## Self-Check Loop
Apply this loop before task completion and before commit:
1. Validate changed files against stated scope.
2. Validate schema and contract preservation.
3. Validate test evidence (targeted + full as applicable).
4. Validate real pipeline run when the task touches runtime flow.
5. Validate no duplicated or shadow logic introduced.
6. Record at least one plausible failure mode and mitigation.

## MANDATORY SELF CHECK
Before ending any task:
1) Did I modify only what was required?  
2) Did I preserve schema?  
3) Did I run tests?  
4) Did I run a real pipeline?  
5) Did I introduce duplication?  
6) What is one possible failure mode?

## Stop Conditions
Stop when local changes would require schema breakage, architecture redesign, unstable metrics, or broad ripple effects beyond safe scope. See `docs/CODEX_STOP_CONDITIONS.md` for mandatory stop protocol.

## Failure Escalation Protocol
If stop conditions trigger:
1. Report root cause in concrete technical terms.
2. Explain why local scoped patch is not safe/fixable.
3. Propose the smallest viable next step (design review, schema plan, staged migration, or data acquisition).
4. Do not continue implementation until direction is confirmed.

## Priority Hierarchy
1. Data correctness and schema stability
2. Deterministic runtime behavior and confidence integrity
3. Test and verification completeness
4. Architectural cohesion and anti-duplication
5. Performance efficiency
6. Speed of delivery
