# Architecture Map

## Directory Ownership Matrix

### `src/mechanics/`
- Owns:
  - Core mechanics computation, phase logic integration points, confidence-aware metric outputs.
- Must not own:
  - Ingest orchestration, manual clipping UI flow, repository docs governance.
- May call:
  - Internal mechanics helpers and shared low-level utilities already used by mechanics modules.
- Must never reimplement:
  - TrackMan import parsing, ingest schema adapters, test harness infrastructure.

### `src/ingest_manual/`
- Owns:
  - Manual clipping/export data contracts, manual ingest schema handling, manual workflow utilities.
- Must not own:
  - Mechanics scoring formulas or TrackMan parsing logic.
- May call:
  - Shared ingest helpers and stable schema utilities.
- Must never reimplement:
  - Confidence logic, mechanics metrics engine, pytest-level assertions.

### `src/ingest_multi/`
- Owns:
  - Multi-angle ingest coordination and transformations specific to multi-view ingest.
- Must not own:
  - Mechanics metric computation or manual clipper UI behavior.
- May call:
  - `src/ingest/` and shared ingest utilities via stable interfaces.
- Must never reimplement:
  - Manual ingest schema logic from `src/ingest_manual/` or confidence scoring from mechanics.

### `scripts/`
- Owns:
  - Operational entrypoints, pipelines, migrations, local automation runners.
- Must not own:
  - Canonical domain logic that belongs in `src/`.
- May call:
  - Public module interfaces in `src/` and standard CLI/library boundaries.
- Must never reimplement:
  - Core confidence formulas, mechanics metrics, ingest schema validation logic.

### `tests/`
- Owns:
  - Verification of behavior, regression coverage, fixtures, and contract enforcement.
- Must not own:
  - Production behavior branches or runtime-only logic.
- May call:
  - Public module/script interfaces needed for deterministic verification.
- Must never reimplement:
  - Production algorithms as alternate test-only copies.

### `docs/`
- Owns:
  - Governance, architecture references, runbooks, workflow standards.
- Must not own:
  - Executable business logic or hidden runtime requirements.
- May call:
  - References to stable module boundaries and validated operational commands.
- Must never reimplement:
  - Code logic, schema processors, or confidence/math behavior.

## Global Non-Reimplementation Rules
- Confidence logic lives only in `src/mechanics/confidence.py`.
- Never reimplement confidence inside benchmarks, scripts, or reports.
- Schema normalization rules must stay in canonical schema modules, not duplicated in runners.
- Scripts orchestrate; modules compute.
