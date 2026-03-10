---
phase: 11
slug: session-overview-enhancements
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-10
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `web/vitest.config.mts` |
| **Quick run command** | `npm --prefix web test -- --run lib/charting` |
| **Full suite command** | `npm --prefix web test -- --run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm --prefix web test -- --run lib/charting`
- **After every plan wave:** Run `npm --prefix web test -- --run`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | SC1 | unit | `npm --prefix web test -- --run lib/charting/sessionOverview` | ✅ | ✅ green |
| 11-01-02 | 01 | 1 | SC1,SC4 | unit | `npm --prefix web test -- --run lib/charting/sessionOverview` | ✅ | ✅ green |
| 11-02-01 | 02 | 2 | SC2,SC4 | unit | `npm --prefix web test -- --run lib/charting/sessionOverview` | ✅ | ✅ green |
| 11-03-01 | 03 | 3 | SC3 | unit | `npm --prefix web test -- --run lib/charting/sessionOverview` | ✅ | ✅ green |
| 11-03-02 | 03 | 3 | SC1-SC4 | build | `npm --prefix web run build` | ✅ | ✅ green |
| 11-03-03 | 03 | 3 | SC1,SC4 | unit | `npm --prefix web test -- --run lib/charting/sessionOverview` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `web/lib/charting/sessionOverview.test.ts` — helper coverage for pitcher outing grouping, hitter grouping, outcome buckets, and zone-map frequencies

*Note: existing Vitest infrastructure covers the rest of the phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Breakdown sections feel readable on desktop and narrow widths | SC1-SC4 | Layout quality is easier to judge visually than in unit tests | Open `/charting/games/[id]` with a seeded game and inspect both new sections |
| Zone coverage heatmap matches the live charting editor geometry | SC1 | Exact cell shape/layout parity is primarily visual | Open `/charting/games/[id]` and compare the review heatmap against `/charting/games/[id]/edit` for the same game |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-10
