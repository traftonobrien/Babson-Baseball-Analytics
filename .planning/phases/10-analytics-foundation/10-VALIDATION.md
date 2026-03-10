---
phase: 10
slug: analytics-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-09
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `web/vitest.config.mts` |
| **Quick run command** | `npm --prefix web test -- --run lib/charting/analytics` |
| **Full suite command** | `npm --prefix web test -- --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix web test -- --run lib/charting/analytics`
- **After every plan wave:** Run `npm --prefix web test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 0 | SC1 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | SC1 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | SC1 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | SC3 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | SC3,SC4 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-03-01 | 03 | 2 | SC1-SC5 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | SC1-SC5 | unit | `npm --prefix web test -- --run lib/charting/analytics` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*SC = Success Criterion from ROADMAP.md Phase 10*

---

## Wave 0 Requirements

- [ ] `web/lib/charting/analytics.test.ts` — test stubs for all four public functions
- [ ] `web/lib/charting/analytics-fixtures.ts` — rich analytics fixture with all pitch result types, out-of-zone swings, and multiple closed PA outcomes (K, BB, in-play)

*Note: `web/vitest.config.mts` already exists. No framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TypeScript compiles without errors | SC5 | Build check, not a unit test | Run `npm --prefix web run build` after all plans complete |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING file references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
