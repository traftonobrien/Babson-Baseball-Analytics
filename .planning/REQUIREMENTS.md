# Requirements: Run Expectancy Intelligence

**Defined:** 2026-04-11
**Milestone:** v4.0
**Core Value:** Babson coaching staff can quantify the run-value and out-probability cost of every 0-2 fastball decision using a live, self-updating run expectancy model built entirely from their own game data.

---

## v4.0 Requirements

### PBP Parser — Extended Game State Machine

- [ ] **PBP-01**: The PBP parser captures ALL plate appearances from a Sidearm box score — both teams, all PA outcomes including walks, strikeouts, HBP, and balls in play (not just Babson BIP events)
- [ ] **PBP-02**: The parser reconstructs base state (which of 8 combinations of 1B/2B/3B are occupied) sequentially across each half-inning by processing semicolon-separated sub-events within each play line (e.g., "doubled; Cushner advanced to third; Grace scored")
- [ ] **PBP-03**: The parser tracks outs per half-inning (0–2) and resets base state + outs on half-inning boundaries
- [ ] **PBP-04**: The parser walks the pitch sequence string (e.g., `BKFB`) letter by letter to derive the count state at each pitch step — enabling per-pitch (count, base_state, outs) snapshots without Supabase
- [ ] **PBP-05**: Deduplication uses `(inning, half_inning, play_text)` as the key — not plain `play_text` — so identical play descriptions in different innings are not silently dropped
- [ ] **PBP-06**: Each half-inning's parsed run total is validated against the box score `r` column; innings that fail validation are excluded from matrix computation and logged, not silently included
- [ ] **PBP-07**: A `re_game_map.json` file maps Sidearm gameIds to internal game metadata (date, opponent, home/away, doubleheader suffix) and is maintained alongside the scraper for disambiguation

### RE Matrix Builder

- [ ] **MAT-01**: A TypeScript build script (`web/scripts/build_re_matrix.ts`) scrapes all Sidearm box scores for the current season and computes both an RE24 matrix (8 base states × 3 out states = 24 cells) and an RE288 matrix (12 counts × 8 base states × 3 out states = 288 cells)
- [ ] **MAT-02**: Each matrix cell stores both the mean expected runs value AND the observation count `n`; cells with n < 5 are stored as `null` rather than a point estimate
- [ ] **MAT-03**: The matrices are written to `web/public/data/run-expectancy/re-matrix-2026.json` following the existing static JSON pipeline pattern
- [ ] **MAT-04**: A separate Out Probability matrix (same 288-cell structure) stores the probability of recording an out on any pitch in that state, derived from the same PBP corpus
- [ ] **MAT-05**: Running `npm run re:rebuild` re-scrapes all games and regenerates both matrix files; the command is defined in `web/package.json`

### Delta-RE + PA Join

- [ ] **RV-01**: For each logged 0-2 fastball PA in Supabase charting data, the system looks up the pre-pitch RE value from the RE288 matrix using `(count_before, base_state, outs)` and the post-pitch RE value using the outcome state
- [ ] **RV-02**: A `game-base-states-2026.json` index is built by the re:rebuild script, keyed by `(gameDate, opponent, inning, halfInning, paOrder)`, providing base state and outs context for each charted PA
- [ ] **RV-03**: Delta-RE per PA is computed as: `RE(post_state) - RE(pre_state) + runs_scored_on_play`; sign convention is documented with hand-verified test cases for K, ball, walk, single, and out outcomes
- [ ] **RV-04**: At least 80% of charted 0-2 fastball PAs from games with available Sidearm PBP are matched to a base-state context before the dashboard integration is considered complete

### 0-2 Dashboard Integration

- [ ] **DASH-01**: The `/charting/ohtwo` page displays the aggregate run value cost or save of the 0-2 fastball strategy — the sum of delta-RE across all qualifying pitches expressed as "X expected runs given up / saved"
- [ ] **DASH-02**: The dashboard includes a counterfactual simulator: given that Y% of the logged 0-2 balls had instead been strikeouts, the run value change is displayed (computed as: `(Y% × n_balls) × (delta_RE_K − delta_RE_ball)`)
- [ ] **DASH-03**: The dashboard displays a count-progression RE tree showing the expected runs at each branch after a 0-2 pitch: K outcome, ball (→ 1-2) outcome, and in-play outcome — using RE288 values
- [ ] **DASH-04**: Alongside run value, the dashboard shows out probability delta: how each 0-2 pitch outcome changed the probability of recording an out, derived from the Out Probability matrix
- [ ] **DASH-05**: Cells with insufficient sample (n < 5) display a "limited sample" indicator rather than a numeric value on the dashboard

---

## v4.x Requirements (deferred)

### RE Leaderboard Extension

- **EXT-01**: Per-pitcher RE summary across all charted appearances — who gives up the most run value above/below expectation?
- **EXT-02**: RE matrix visible as a standalone reference page (`/charting/run-expectancy`) for coaching review

### Automated Refresh

- **OPS-01**: GitHub Actions nightly re:rebuild after each game day (parallel to NCAA stats sync)
- **OPS-02**: Incremental scrape mode — only fetch box scores for games added since last run

### D3-Wide Baseline Comparison

- **D3-01**: Side-by-side comparison of Babson RE24 vs. D3-wide baseline once sufficient cross-team data is accessible

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Win Expectancy (WE) | D3 corpus too sparse for reliable WE curves; defer until multi-season data exists |
| Live in-game RE updates | Requires real-time base-state feed; charting system is post-game oriented |
| Opponent-specific RE matrices per team | Sample size per opponent is too small; use aggregate opponent matrix only |
| Supabase as RE matrix storage | Static JSON is faster, zero latency, consistent with all other derived data in this repo |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PBP-01 | Phase 21 | Pending |
| PBP-02 | Phase 21 | Pending |
| PBP-03 | Phase 21 | Pending |
| PBP-04 | Phase 21 | Pending |
| PBP-05 | Phase 21 | Pending |
| PBP-06 | Phase 21 | Pending |
| PBP-07 | Phase 21 | Pending |
| MAT-01 | Phase 22 | Pending |
| MAT-02 | Phase 22 | Pending |
| MAT-03 | Phase 22 | Pending |
| MAT-04 | Phase 22 | Pending |
| MAT-05 | Phase 22 | Pending |
| RV-01 | Phase 23 | Pending |
| RV-02 | Phase 23 | Pending |
| RV-03 | Phase 23 | Pending |
| RV-04 | Phase 23 | Pending |
| DASH-01 | Phase 24 | Pending |
| DASH-02 | Phase 24 | Pending |
| DASH-03 | Phase 24 | Pending |
| DASH-04 | Phase 24 | Pending |
| DASH-05 | Phase 24 | Pending |

**Coverage:**
- v4.0 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-11*
*Last updated: 2026-04-11 after initial milestone scoping*
