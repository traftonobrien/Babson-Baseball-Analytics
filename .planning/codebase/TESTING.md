# Testing Patterns

**Analysis Date:** 2026-03-06

## Test Framework

**Runner:**
- Pytest for Python tests
- Vitest for TypeScript library tests in the web app

**Assertion Library:**
- Pytest built-ins for Python
- Vitest `expect` API for TypeScript

**Run Commands:**
```bash
pytest -q                           # Run Python tests
npm --prefix web run test           # Run web Vitest suite
npm --prefix web run lint           # Lint web code
python3 -m compileall scripts src   # Fast syntax sanity check for Python workflows
```

## Test File Organization

**Python:**
- Centralized `tests/` tree
- Subdirectories mirror subsystems: `tests/mechanics/`, `tests/ingest/`, `tests/ingest_manual/`
- Fixtures live in `tests/fixtures/`

**TypeScript:**
- Tests live alongside library modules under `web/lib/`
- Vitest include pattern is `lib/**/*.test.ts`

## Test Structure

**Python patterns:**
- Directly import script `run()` functions or library functions
- Use `tmp_path`, fixture files, and `capsys` for filesystem/CLI-style verification
- Favor deterministic output assertions over broad snapshot-style checks

**TypeScript patterns:**
- `describe` / `it` / `expect`
- Factory helpers create representative pitch/session objects inline
- Tests mainly target pure calculations and selectors, not rendered UI

## Mocking

**Python:**
- Limited mocking visible in sampled tests; fixtures and temp dirs are preferred
- Integration-style tests often use real parsing code with fixture HTML/PDF files

**TypeScript:**
- Current sampled tests avoid heavy mocking by focusing on pure library logic
- Future API-heavy tests will likely need fetch or DB mocking patterns because no shared convention is established yet

## Fixtures and Factories

**Shared fixtures:**
- `tests/fixtures/sidearm/14570.html`
- `tests/fixtures/trackman_pdf/Baseball Team Portal Export.pdf`
- `tests/mechanics/manual_phases_template.json`

**Factories:**
- Web tests commonly define inline `makePitch()` helper functions
- Python tests use small in-test builders and temp output roots

## Coverage

**Current posture:**
- Good coverage around parsing, stats import, and mechanics utilities
- Sparse coverage for end-to-end web routing and browser-driven flows
- No explicit coverage percentage threshold is configured

## Test Types

**Unit tests:**
- Pure math, classification, label, parsing, and aggregation logic

**Integration tests:**
- Script-level dry runs
- File generation and migration behavior
- Fixture-backed parsing workflows

**E2E / browser tests:**
- Playwright is available in Python deps and a `webapp-testing` skill exists, but no committed first-class web E2E suite is present in this repo

## Common Patterns

**Error testing:**
- Python: assert exit code / warning text / generated files
- TypeScript: assert nullability, eligibility flags, and exact computed values

**Safe additions:**
- Add tests close to the domain being changed
- Preserve existing fixture-driven style when working in import/pipeline code
- Prefer contract tests for file layouts and derived metrics

---
*Testing analysis: 2026-03-06*
*Update when test patterns change*
