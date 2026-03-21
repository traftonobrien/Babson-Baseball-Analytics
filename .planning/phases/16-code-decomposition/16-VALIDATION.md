---
phase: 16
slug: code-decomposition
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-21
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `web/vitest.config.mts` |
| **Quick run command** | `npm --prefix web test -- --run lib/charting/live.test.ts lib/charting/explorerState.test.ts lib/charting/playerComparison.test.ts lib/charting/pitcherComparison.test.ts lib/charting/playerProfile.test.ts` |
| **Full suite command** | `npm --prefix web test -- --run` |
| **Estimated runtime** | ~10s quick / ~40s full |

---

## Sampling Rate

- **After every task commit:** Run the relevant targeted suite for the touched surface plus the source-only line-count audit
- **After every plan wave:** Run `npm --prefix web run build`
- **Before `$gsd-verify-work`:** Run the quick suite and a final source-only line-count audit; run the full suite if `DATABASE_URL` is available
- **Max feedback latency:** ~10 seconds for targeted checks

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 16-01-01 | 01 | 1 | CODE-01 | structural | `test $(wc -l < web/app/charting/_components/ChartingEditor.tsx) -lt 1000 && find web/app/charting/_components/charting-editor -type f \\( -name '*.ts' -o -name '*.tsx' \\) -exec sh -c 'n=$(wc -l < "$1"); [ "$n" -lt 500 ]' _ {} \\;` | ❌ W0 | ⬜ pending |
| 16-01-02 | 01 | 1 | CODE-01 | unit | `npm --prefix web test -- --run lib/charting/live.test.ts lib/charting/charting.test.ts lib/charting/setup.test.ts` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 1 | CODE-02 | structural | `test $(wc -l < web/app/charting/insights/LiveAbInsightsExplorer.tsx) -lt 1000 && find web/app/charting/insights/_components web/app/charting/insights/_lib -type f \\( -name '*.ts' -o -name '*.tsx' \\) -exec sh -c 'n=$(wc -l < "$1"); [ "$n" -lt 500 ]' _ {} \\;` | ❌ W0 | ⬜ pending |
| 16-02-02 | 02 | 1 | CODE-02 | unit | `npm --prefix web test -- --run lib/charting/explorerState.test.ts lib/charting/playerComparison.test.ts lib/charting/pitcherComparison.test.ts` | ✅ | ⬜ pending |
| 16-03-01 | 03 | 2 | CODE-03 | audit | `find web/app web/lib web/tests -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \\) -print0 | xargs -0 wc -l | awk '$1 > 1000 && $2 != \"total\" { print }'` | ✅ | ⬜ pending |
| 16-03-02 | 03 | 2 | CODE-03 | targeted | `npm --prefix web test -- --run lib/charting/live.test.ts lib/charting/explorerState.test.ts lib/charting/playerComparison.test.ts lib/charting/pitcherComparison.test.ts lib/charting/playerProfile.test.ts` | ✅ | ⬜ pending |
| 16-03-03 | 03 | 2 | CODE-03 | build | `npm --prefix web run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charting editor layout and operator flow still match the established baseline | CODE-01 | No component-level UI tests currently exercise the full scorer surface | Start the app, open a charting game, confirm the top bar, zone workspace, action dock/history toggle, lineup access, and history sections still render and behave like the pre-decomposition flow |
| Explorer URL/back-forward behavior still matches the current route-local query contract | CODE-02 | Unit tests cover query helpers, not the browser navigation glue | Open `/charting/insights`, change filters/search/player/view, then use browser back/forward and confirm the selected state follows the URL correctly |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or existing infrastructure coverage
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all missing references
- [x] No watch-mode flags
- [x] Feedback latency < 15s for targeted checks
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-21
