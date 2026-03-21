# Requirements: Pitch Tracker Market-Ready Platform

**Defined:** 2026-03-20
**Milestone:** v3.0
**Core Value:** Any D3 baseball program can deploy the platform, chart games on an iPad, and review pitcher and hitter analytics in a portal — with zero Babson-specific configuration required.

---

## v3.0 Requirements

### Completion — Finish In-Flight Work

- [ ] **DONE-01**: Phase 12.1-03 is complete — mixed-role Live AB player profile polish and final validation pass
- [ ] **DONE-02**: Charting UAT passes — codex/game-charting-structure branch is manually browser-tested and merged to main

### Ops — Reliability and Observability

- [x] **OPS-01**: Next.js middleware is actually running — proxy.ts logic is deployed as middleware.ts protecting all page routes
- [ ] **OPS-02**: Error boundaries exist on all major page surfaces — uncaught render errors show a recoverable UI instead of a blank screen
- [ ] **OPS-03**: Vercel environment variables (PT_PASSWORD, MECHANICS_PASSWORD, DATABASE_URL) are confirmed correct on the live deployment
- [ ] **OPS-04**: Structured error logging is in place — server errors are captured with enough context to diagnose production failures

### Code Health — Decompose Mega-Files

- [ ] **CODE-01**: ChartingEditor.tsx is broken into modules under 500 lines each — logic, hooks, and sub-components extracted
- [ ] **CODE-02**: LiveAbInsightsExplorer.tsx is broken into modules under 500 lines each — pitcher/hitter panels, filter logic, and synthesis helpers extracted
- [ ] **CODE-03**: No single file in web/ exceeds 1000 lines after decomposition passes

### Multi-Tenancy — Team Parameterization

- [ ] **TEAM-01**: All hardcoded "Babson" strings in the product UI are replaced with a configurable team name from environment or DB config
- [ ] **TEAM-02**: The DB schema includes a team_id concept — charting games and related records are scoped to a team
- [ ] **TEAM-03**: A new team can configure their team name, logo, and colors through an admin settings surface
- [ ] **TEAM-04**: Player identity (roster, slugs, playerIds) is team-scoped — no cross-team data leakage
- [ ] **TEAM-05**: The login/auth flow is team-aware — a team's credentials authenticate only their data

### UX — Polish and Mobile

- [ ] **UX-01**: Core pages (player list, charting hub, leaderboards, player profile) are usable on mobile screens (320-768px)
- [ ] **UX-02**: Data-loading states show skeleton placeholders instead of blank content flashes
- [ ] **UX-03**: Interactive elements (buttons, filters, dropdowns) meet minimum 44px touch target sizes
- [ ] **UX-04**: Tab navigation and keyboard accessibility work on all modal and panel surfaces

### Demo — Marketing and Sales Enablement

- [ ] **DEMO-01**: A public demo mode exists — a read-only version of the portal is accessible without credentials, seeded with realistic sample data
- [ ] **DEMO-02**: The demo is stable — it cannot be modified by visitors and resets automatically if seeded data is altered
- [ ] **DEMO-03**: A landing/marketing page exists at the root for unauthenticated visitors, explaining the product and linking to the demo

---

## v4.0 Requirements (Deferred)

### Advanced Multi-Tenancy

- **TEAM-ADV-01**: Per-user accounts within a team (role-based access — admin vs scorer vs read-only)
- **TEAM-ADV-02**: Self-serve team sign-up flow with email verification
- **TEAM-ADV-03**: Billing integration (Stripe) for SaaS subscription management

### Feature Expansion

- **FEAT-01**: Opponent lineup import from Sidearm/D3 boxscore (replace manual hitter entry)
- **FEAT-02**: Baserunner carry-forward engine (automatic baserunner state between PAs)
- **FEAT-03**: iPad app distribution via App Store (public listing, not TestFlight-only)
- **FEAT-04**: Video sync — link charted pitches to video clips from a center-field camera

### Phase 9 (TestFlight)

- **OPS-ADV-01**: TestFlight internal pilot packaging and distribution
- **OPS-ADV-02**: Pilot diagnostics, error surfacing, and retry guidance
- **OPS-ADV-03**: Operator runbook and scoring quick reference

---

## Out of Scope (v3.0)

| Feature | Reason |
|---------|--------|
| Role-based auth (admin/scorer/viewer) | Password-gate model sufficient for single-team internal use; multi-user auth is v4.0 |
| App Store distribution | TestFlight-only for current user base; App Store review overhead not worth it yet |
| Billing/subscriptions | No paying customers yet; add after first 2-3 paid teams sign on |
| Baserunner engine | Already in existing out-of-scope; adds scoring complexity |
| Real-time multi-scorer collaboration | Single scorer per game is the established constraint |
| Full player story hero block | Explicitly excluded in product-audit-followup.md |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DONE-01 | Phase 14 | Pending |
| DONE-02 | Phase 14 | Pending |
| OPS-01 | Phase 15 | Complete |
| OPS-02 | Phase 15 | Pending |
| OPS-03 | Phase 15 | Pending |
| OPS-04 | Phase 15 | Pending |
| CODE-01 | Phase 16 | Pending |
| CODE-02 | Phase 16 | Pending |
| CODE-03 | Phase 16 | Pending |
| TEAM-01 | Phase 17 | Pending |
| TEAM-02 | Phase 17 | Pending |
| TEAM-03 | Phase 18 | Pending |
| TEAM-04 | Phase 18 | Pending |
| TEAM-05 | Phase 18 | Pending |
| UX-01 | Phase 19 | Pending |
| UX-02 | Phase 19 | Pending |
| UX-03 | Phase 19 | Pending |
| UX-04 | Phase 19 | Pending |
| DEMO-01 | Phase 20 | Pending |
| DEMO-02 | Phase 20 | Pending |
| DEMO-03 | Phase 20 | Pending |

**Coverage:**
- v3.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-20*
*Last updated: 2026-03-20 — traceability confirmed after roadmap creation*
