# Architecture

**Analysis Date:** 2026-03-06

## Pattern Overview

**Overall:** Hybrid baseball analytics workspace: Python processing pipelines plus a Next.js portal, with static published artifacts as the dominant data path and a smaller dynamic Neon-backed layer for newer features.

**Key Characteristics:**
- Mixed brownfield repo: CV/data pipelines and web product live together
- Static-file-first publishing for command, TrackMan, mechanics, and imported stats
- Operational scripts orchestrate most ingestion and publishing steps
- Small server-side API surface exists for password-gated pages, D3 proxying, Savant fetches, and Neon-backed leaderboards

## Layers

**Operational Script Layer:**
- Purpose: ingest external data, normalize outputs, and publish deterministic files
- Contains: `scripts/*.py`, `run_all.py`, `publish_outing.sh`
- Depends on: `src/` domain modules, local files, external sites/APIs
- Used by: human operators and GitHub Actions

**Domain Logic Layer:**
- Purpose: reusable pipeline logic and analytics computations
- Contains: `src/trackman_pdf/`, `src/trackman/`, `src/mechanics/`, `src/ingest*`
- Depends on: Python libraries, local assets, shared schema/util helpers
- Used by: scripts and tests

**Static Publish Layer:**
- Purpose: web-consumable JSON/CSV/media snapshots
- Contains: `web/public/data/`, `web/public/stats/`, `web/public/trackman/`, `web/public/mechanics/`
- Depends on: operator-run scripts and committed artifacts
- Used by: client-side fetch hooks and server-rendered portal routes

**Web Presentation Layer:**
- Purpose: dashboards, hubs, comparison views, and supporting APIs
- Contains: `web/app/`, `web/lib/`, `web/components/`
- Depends on: static files, Drizzle DB layer, external proxy routes
- Used by: coaches/staff browsing the portal

**Dynamic Data Layer:**
- Purpose: newer leaderboard-style features that no longer fit static commits cleanly
- Contains: `web/db/`, `web/app/api/plus/*`, `web/app/api/stuff-plus/*`
- Depends on: Neon Postgres
- Used by: TrackMan / Stuff+ and future dynamic workflows

## Data Flow

**Command outing flow:**
1. Operator marks pitches in source video (`mark_pitches.py`)
2. Batch processing computes misses and overlay artifacts (`batch_process.py`)
3. Results are copied into `web/public/data/<playerId>/<dateId>/`
4. `web/lib/dataIndex.ts` exposes outings to the UI
5. Client hooks load CSV/media and render command dashboards

**TrackMan flow:**
1. Operator imports TrackMan PDFs via `scripts/import_trackman_pdf.py`
2. Static session summaries and indexes are written to `web/public/trackman/`
3. Optional Stuff+ data is loaded into Neon via `web/scripts/load_stuff_plus.ts`
4. TrackMan and leaderboard routes combine static sessions with dynamic DB reads

**Post-game stats flow:**
1. Sidearm boxscore HTML is fetched and parsed by `scripts/post_game_update.py`
2. Deterministic JSON is written into `web/public/stats/`
3. Optional outing linkage writes `outing_meta.json`
4. Portal views read linked stats by player/game

**State Management:**
- Static-first for most historical baseball data
- Client components fetch static assets directly where possible
- Dynamic APIs wrap only the narrower DB-backed or external-fetch use cases

## Key Abstractions

**Canonical player identity:**
- Purpose: resolve inconsistent names into stable `playerId`/slug values
- Examples: `scripts/lib/canonical_players.py`, `web/lib/canonicalPlayers.ts`, `web/lib/dataIndex.ts`
- Pattern: centralized lookup and normalization

**Published outing/session contract:**
- Purpose: define what the web app expects from static baseball artifacts
- Examples: `docs/generated/web_app_data_contract.md`, `web/public/data/`, `web/public/trackman/`
- Pattern: contract-first file layout

**Router + view-model helpers:**
- Purpose: keep heavy formatting/aggregation logic out of page components
- Examples: `web/lib/reportModel.ts`, `web/lib/comparisonModel.ts`, `web/lib/stats/index.ts`
- Pattern: page shells call focused library functions and hooks

## Entry Points

**Python CLI / scripts:**
- Location: `scripts/` and root scripts like `run_all.py`
- Triggers: operator commands, runbooks, or scheduled GitHub Actions
- Responsibilities: data ingestion, export, migration, publication

**Next.js routes:**
- Location: `web/app/**/page.tsx` and `web/app/api/**/route.ts`
- Triggers: browser navigation and HTTP API calls
- Responsibilities: render portal surfaces, enforce auth, proxy data, and query Neon

## Error Handling

**Strategy:** handle failures at boundaries and degrade to null/404/empty state rather than crashing the entire portal.

**Patterns:**
- Python scripts return exit codes, print warnings, and support dry-run paths
- Route handlers use `try/catch` and return JSON error payloads or 500s
- Client-side loaders often catch fetch failures and return `null`

## Cross-Cutting Concerns

**Validation:**
- Data contracts are documented in `docs/` and reinforced by tests rather than by one shared runtime validation layer

**Authentication:**
- Cookie-based password gates are enforced centrally by `web/proxy.ts`

**Documentation:**
- The repo uses architecture and runbook docs as active operational contracts, not just background reference

---
*Architecture analysis: 2026-03-06*
*Update when major patterns change*
