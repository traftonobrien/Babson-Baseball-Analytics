# Coding Conventions

**Analysis Date:** 2026-03-06

## Naming Patterns

**Files:**
- Python source uses `snake_case.py`
- React components and many feature views use `PascalCase.tsx`
- Next.js route files use framework conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `route.ts`
- TypeScript tests use `*.test.ts`; Python tests use `test_*.py`

**Functions:**
- TypeScript and Python both use `camelCase` / `snake_case` idiomatically for their language
- Event handlers in React commonly use `handle*`
- Loaders/selectors/helpers in `web/lib/` are descriptive and noun-domain-driven rather than framework-generic

**Variables and Types:**
- TypeScript types/interfaces use `PascalCase`
- Constants often use `UPPER_SNAKE_CASE`
- Player IDs, outing IDs, and pitch-type labels are treated as stable business identifiers

## Code Style

**Formatting:**
- TypeScript uses double quotes and semicolons in current files
- Python style is pragmatic and not formatter-enforced in repo docs, but modules generally follow standard readable spacing and docstring patterns
- Comments are sparse and usually explain domain rules or caveats

**Linting:**
- Web linting uses ESLint via `npm --prefix web run lint`
- No repo-wide Python formatter or linter config is visible

## Import Organization

**TypeScript:**
1. External packages
2. `@/` internal aliases
3. Relative imports

**Python:**
- Standard library, then local try/except import fallbacks are common in scripts that can be run from multiple working directories

**Path Aliases:**
- `@/*` maps to `web/*` via `web/tsconfig.json`

## Error Handling

**Patterns:**
- Scripts validate input early, print warnings, and exit with explicit codes
- Route handlers use boundary `try/catch` and return JSON errors
- Client-side data loaders often swallow fetch failures and return `null`

**Important repo rule:**
- `scripts/` orchestrate, `src/` computes
- Ownership boundaries in `docs/architecture/ownership_map.md` are treated as coding rules, not optional guidance

## Logging

**Framework:**
- Plain `console.log` / `console.error` in TypeScript server code
- `print()` and stderr warnings in Python scripts

**Patterns:**
- Logging is mostly boundary-level and troubleshooting-oriented
- Development-only verbose logging appears in proxy/debug helpers
- No structured logging abstraction is established yet

## Comments

**When to Comment:**
- Explain data contracts, baseball-domain conventions, and dangerous assumptions
- Document coordinate systems and handedness rules when they affect correctness
- Avoid noise comments for obvious assignments or JSX structure

**Docs as conventions:**
- Several rules live in docs instead of code comments:
  - `docs/architecture/coordinates_and_handedness.md`
  - `docs/architecture/ownership_map.md`
  - `docs/generated/web_app_data_contract.md`

## Function Design

**Patterns:**
- Pure computation is preferred in `web/lib/` and `src/`
- Hooks and page components coordinate data fetching and UI state
- Script entrypoints keep parsing/orchestration near the top and delegate implementation to helpers

## Module Design

**Exports:**
- Default exports are common for page/view components
- Named exports are common for helpers, models, DB schema, and reusable UI utilities

**Separation rules:**
- Do not duplicate core formulas or schemas across scripts and modules
- Prefer existing canonical sources like `Arsenals.csv`, `web/lib/dataIndex.ts`, and documented contracts over local one-off copies

---
*Convention analysis: 2026-03-06*
*Update when patterns change*
