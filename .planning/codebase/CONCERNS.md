# Codebase Concerns

**Analysis Date:** 2026-03-06

## Tech Debt

**Static publish flow as product backbone:**
- Issue: large parts of the portal still depend on git-committed static assets in `web/public/`
- Why: current baseball workflows are operator-run and deterministic
- Impact: live or collaborative workflows do not fit naturally into the current architecture
- Fix approach: move new live workflows to DB-backed APIs without breaking legacy static readers

**Manual indexing for command outings:**
- Issue: `web/lib/dataIndex.ts` is still the single source of truth for which outings appear
- Why: fast and explicit for a small static dataset
- Impact: easy to forget index updates; unsuitable for live-created content
- Fix approach: keep static index for legacy command data, but avoid extending it for new charting records

## Known Bugs / Reliability Risks

**Password fallback secrets in code:**
- Symptoms: internal auth still works even if env vars are missing
- Trigger: production/deployment without proper env setup
- Workaround: set `PT_PASSWORD` and `MECHANICS_PASSWORD`
- Root cause: hardcoded fallback values in auth routes
- Fix approach: replace with env-required auth before broad rollout

**Mixed local/runtime assumptions:**
- Symptoms: scripts can depend on local files, models, or directory shapes that are not enforced automatically
- Trigger: new machine setup or partial repo checkout
- Workaround: follow docs/runbooks carefully
- Root cause: repo evolved from operator workflows before stronger bootstrap automation existed

## Security Considerations

**Auth is not enterprise-grade:**
- Risk: password-only cookie gates are too weak for a wider staff-facing production product
- Current mitigation: internal-only usage and environment-configurable passwords
- Recommendations: adopt user-based auth before expanding beyond trusted operators

**Sensitive local artifacts live beside source:**
- Risk: real data, media, or credentials can leak into planning/docs/commits accidentally
- Current mitigation: mostly process discipline
- Recommendations: keep secret scanning in planning workflows and be cautious about generated docs referencing env vars or local paths

## Performance Bottlenecks

**Media-heavy web app:**
- Problem: `web/public/data/**` and `web/public/mechanics/**` hold many videos/images
- Cause: app serves review assets directly
- Improvement path: keep new charting data lightweight and separate from heavy media artifacts

**Python CV dependencies:**
- Problem: mechanics/command pipelines are expensive and environment-sensitive
- Cause: PyTorch, SAM2, video processing, and local model dependencies
- Improvement path: isolate new charting work from existing CV runtime wherever possible

## Fragile Areas

**Canonical player identity path:**
- Why fragile: multiple surfaces depend on consistent `playerId`, slug, and alias resolution
- Common failures: mismatched names create broken links or duplicate players
- Safe modification: reuse existing canonical helpers and `Arsenals.csv`
- Test coverage: decent around stats import, but not centralized across all product areas

**Data-contract-driven UI pages:**
- Why fragile: many pages assume exact static file locations and shapes
- Common failures: missing files, row-count mismatches, broken asset paths
- Safe modification: document and test any new contract explicitly
- Test coverage: contract tests exist in some areas, but not uniformly

## Scaling Limits

**Current product shape is operator-first, not multi-user SaaS:**
- Current capacity: good for internal staff using deterministic workflows
- Limit: live mobile charting, conflict resolution, and frequent writes are not first-class yet
- Symptoms at limit: manual handoffs, index drift, stale data sources
- Scaling path: add dedicated charting schemas/APIs and keep legacy static content isolated

## Dependencies at Risk

**Next.js / React bleeding-edge versions:**
- Risk: `next@16` and `react@19` can shift patterns quickly
- Impact: new web work should follow current repo usage, not older examples
- Migration plan: keep new code aligned with the versions already committed here

**CV stack complexity:**
- Risk: heavy Python ML dependencies complicate onboarding and CI
- Impact: avoid coupling charting v1 to these dependencies
- Migration plan: charting should use its own lighter stack

## Missing Critical Features

**No live charting domain exists yet:**
- Problem: current repo can review outings after processing but cannot chart a game in real time
- Current workaround: paper / 6-4-3 style manual charting
- Blocks: direct iPad workflow, live sync, TestFlight pilot
- Implementation complexity: high, but isolated if added as a new subsystem

## Test Coverage Gaps

**Web route and auth flows:**
- What's not tested: most route handlers, cookie guards, and full page flows
- Risk: regressions in live product behavior can slip through unit-focused tests
- Priority: High for any new charting subsystem
- Difficulty to test: moderate; requires API and UI-level coverage patterns that are not yet established

---
*Concerns audit: 2026-03-06*
*Update as issues are fixed or new ones discovered*
