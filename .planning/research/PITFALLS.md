# Pitfalls Research

**Domain:** RE288 Run Expectancy — integration into existing Babson Analytics / Sidearm PBP pipeline
**Researched:** 2026-04-11
**Confidence:** HIGH — based on direct inspection of `scripts/sidearm_parser.py`, `web/lib/spraychart/scraper.ts`, `web/lib/charting/ohtwo.ts`, and the live data shape described in `.planning/PROJECT.md`

---

## Critical Pitfalls

### Pitfall 1: Narrative PBP text silently corrupts the base-state machine on ambiguous plays

**What goes wrong:**
The Sidearm PBP feed is English prose. Plays like "Smith singled to left, Jones scored, Brown advanced to third" pack three state-changing events into one string. A naive line-by-line parser treats the whole string as one atomic event and emits a base state after parsing only what it recognized. Any token it misses (a runner advancing on a wild pitch mid-text, an error that extends the play, a caught-stealing notation appended at the end of a hit line) leaves the reconstructed base state permanently wrong for every subsequent PA in that half-inning.

Because the state machine resets only at inning boundaries, one bad parse compounds: if the reconstructed state after PA 3 is wrong, PA 4 through end-of-inning all carry the wrong state, injecting garbage into every RE lookup for those PAs.

**Why it happens:**
The existing `extractPlayLines` / `isPlayDescription` logic in `scraper.ts` was built only to identify ball-in-play events for Babson batters — it does not attempt to track runner state at all. The new RE288 parser will need to parse ALL plays (both teams) and model runner movement, which is a materially harder problem than what the scraper already solves. Developers often underestimate this scope and try to extend the existing event-classification regex patterns rather than building a proper state machine.

**How to avoid:**
1. Build a dedicated `BaseStateParser` class that accepts one normalized play-text string and returns a structured `PlayEvent` with explicit fields: `type` (hit/walk/K/HBP/error/FC/SB/CS/PO/WP/PB/sac/DP/etc.), `runnersScored`, `runnersAdvanced[]`, `runnersOut[]`, and `batterResult`. The RE engine only reads structured `PlayEvent` objects, never raw text.
2. Validate reconstructed state against the box-score totals after each half-inning: sum of `runnersScored` events must equal the inning run total from the box score. This is achievable because `parse_pitching_rows` in `sidearm_parser.py` already captures per-inning `r` values. Treat a mismatch as a hard parse error, not a warning, and exclude that inning's PAs from the RE matrix rather than including corrupted data.
3. Write fixture tests against known Babson game PBP texts before building the RE matrix. The `KNOWN_2026_GAME_URLS` list in `scraper.ts` gives you 19 games with known box-score totals to validate against.

**Warning signs:**
- The reconstructed run total for an inning differs from the box score `r` column for that inning.
- More than 3 runners on base at once (impossible state — indicates a missed advancement or a reset failure).
- A half-inning ends with `outs < 3` (parse missed putout events) or `outs > 3` (double-counted).
- The matrix has cells where `RE > 2.5` for 2-out states (implausibly high, suggests base-load overcounting).

**Phase to address:**
RE-01. The state machine correctness must be verified before any matrix computation begins. Gate RE-02 on passing inning-run-total validation across at least 15 of the 19 known 2026 games.

---

### Pitfall 2: Sparse cells in the RE288 matrix produce extreme or missing values that look plausible

**What goes wrong:**
RE288 has 288 cells: 12 counts × 8 base states × 3 out levels. Babson plays ~25-30 games per season. Even assuming 30 half-innings per game and 4 PAs per half-inning, that is ~3600 PAs across the season. 3600 PAs distributed across 288 cells averages only 12.5 observations per cell. In practice, distribution is highly skewed — common cells (0-0 count, bases empty, 0 outs) will have hundreds of observations while rare cells (2-2 count, bases loaded, 2 outs) may have 2-3. A cell with 2 observations produces an RE estimate with a 95% CI of roughly ±1.5 runs — nearly useless.

More dangerously, the matrix will silently emit a point estimate for sparse cells. A 2-observation cell showing `RE = 1.8` will look identical in the dashboard to a 200-observation cell showing `RE = 1.8`. Coaches will treat both as equally reliable.

**Why it happens:**
Developers typically build the matrix correctly and then query it without propagating uncertainty. The sample-size issue only becomes visible when coaches ask "why does the counterfactual say we save 3 runs by striking out 2 more batters?" and you trace back to a cell with n=2.

**How to avoid:**
1. Store `n` (observation count) alongside every matrix cell value. Emit `null` for cells with `n < 5`. At `n < 20`, tag the cell as LOW_CONFIDENCE.
2. When computing delta-RE for the ohtwo dashboard, use only cells where the specific count/state combination has `n >= 5`. For the remaining ~33 qualifying events, most will be at count-states near the 0-2 approach — check those specific cells first and flag if any are sub-threshold.
3. Consider pooling across related counts (e.g., treat all 0-2 count states as one group for RE purposes since the RE288 dimension that matters most for the ohtwo report is the base-state and outs, not the exact prior count). This trades precision for reliability.
4. Display confidence intervals on the dashboard. A ±0.8 run CI on a "we saved 1.2 runs" finding completely changes the coaching message.

**Warning signs:**
- The matrix JSON has any cell with `n == 1`.
- Delta-RE for the 0-2 fastball sample totals exactly to a round number (suggests only 1-2 cells contributed).
- The RE for "2 outs, bases loaded" is higher than "0 outs, bases loaded" (should be lower — if inverted, a sparse cell is poisoning the matrix).
- Any single-game anomaly (a 7-run inning) produces a visible spike in one cell after refresh.

**Phase to address:**
RE-02 must include minimum-n gating in the matrix builder. RE-03 must propagate which cells were used and their observation counts to the dashboard layer.

---

### Pitfall 3: Delta-RE computed from the final-count field gives the wrong pre-pitch state

**What goes wrong:**
The Sidearm PBP format stores the count at the end of the at-bat in the format `(1-2 KBFS)`. For delta-RE, you need `RE(state_before_pitch)` and `RE(state_after_PA)`. "State before pitch" is the count and base state _before_ the last pitch was thrown. If the final count is `(1-2)`, the count before the last pitch was `(1-1)` — not `(1-2)`. Using `(1-2)` as the "before" count overstates the RE by picking up the already-elevated leverage of being one pitch away from the outcome, not the leverage state entering the critical pitch.

For strikeouts at `(0-2)`, the correct delta-RE calculation is: `RE(0-2 count, current base/outs) - RE(state after K)`. If you accidentally use `(1-2)` as the starting count because the stored field is the final count, you will compute `RE(1-2) - RE(after K)` instead of `RE(0-2) - RE(after K)`. RE(1-2) > RE(0-2) because the hitter has more chances remaining, so your calculation will systematically understate the run value of 0-2 strikeouts.

**Why it happens:**
The count field `(1-2 KBFS)` is prominently visible in the PBP text and is the only count data available. Developers naturally use it as "the count" without thinking through whether it represents the state entering or exiting the pitch. For the ohtwo report, the qualifying event is specifically defined as "the first pitch thrown at an 0-2 count" — meaning count_balls=0, count_strikes=2 before the pitch. The count display `(0-2)` would only appear if the PA ended on the next pitch at 0-2, which is exactly the case for strikeouts. For a PA that went to a 1-2 count after a ball, the stored count is `(1-2)` and the 0-2 pitch was an earlier pitch in the sequence — not recoverable from just the final count.

This means the Sidearm PBP format alone cannot tell you the exact pre-pitch count for the qualifying 0-2 fastball unless the PA ended immediately on the next pitch after the 0-2 fastball. For PAs that continued, you do not know the intermediate pitch-by-pitch counts.

**How to avoid:**
1. Acknowledge the data limitation explicitly in the RE-03 design: for PAs where the qualifying 0-2 fastball ended the at-bat (strikeout, in-play out, hit on the next pitch), you can accurately compute `RE(0-2, base/outs) - RE(after_PA_result)`. For PAs that continued, you can compute only `RE(0-2, base/outs) - RE(final_PA_result)` — this is still useful but includes count-state transitions you cannot observe.
2. Use the Supabase charting PA data as the source of truth for which PAs contain a qualifying 0-2 fastball (this is already what the ohtwo report does). For those matched PAs, look up `RE(0-2, base_state, outs)` at the moment the qualifying pitch was thrown — this requires having reconstructed base state and outs from the Sidearm PBP for the corresponding game at that PA's position in the lineup order.
3. Do not attempt to reconstruct intermediate pitch counts from the Sidearm `KBFS` pitch sequence. The sequence shows pitch types but not which pitch resulted in which count increment. Count reconstruction from the sequence is brittle and adds complexity without improving RE accuracy since you already know the final count.

**Warning signs:**
- Delta-RE values for strikeouts at 0-2 are negative (implies the 0-2 state had lower RE than the post-K state — impossible for a K that ends the PA).
- The computed starting-count RE values cluster around RE(1-2) instead of RE(0-2) — suggests the wrong pre-pitch count is being used.
- PAs that produced walks after a 0-2 fastball show a large positive delta-RE (correct — the walk increased run expectancy from the pitcher's 0-2 position) but are being counted as "run value saves" (indicates sign inversion in the delta-RE formula).

**Phase to address:**
RE-03. The delta-RE calculation formula must be explicitly documented before implementation with test cases covering: 0-2 K (PA ends next pitch), 0-2 ball then K, 0-2 ball then walk, 0-2 ball then hit. Each case should produce a manually verified expected RE delta before the automated matrix lookup is wired.

---

### Pitfall 4: Sidearm PBP deduplication interacts badly with half-inning boundary detection

**What goes wrong:**
The existing `extractPlayLines` in `scraper.ts` deduplicates plays using `[...new Set(plays)]`. This works for spray chart purposes because duplicate BIP events for the same batter with the same text are genuinely redundant. For base-state reconstruction, duplicate detection must happen at a different level: the deduplication must preserve the inning/half-inning prefix (e.g., "2nd inning - Smith singled...") as part of the identity key, not just the play text alone.

Two different plays in different innings can have identical text: "Jones grounded out to short" in the top of the 3rd and "Jones grounded out to short" in the top of the 5th are different state transitions but produce the same string. The current `Set(plays)` deduplication removes one of them, corrupting the out count for one of those innings.

Additionally, the current scraper tracks `currentInning` from inning-header lines but does not track top vs. bottom half. For RE288, you must know which team is batting (top = visitor bats, bottom = home bats) because the matrix is built separately for Babson-as-offense and opponent-as-offense. Losing half-inning identity means you cannot correctly attribute state transitions to the right matrix.

**Why it happens:**
The spray chart scraper was designed to extract Babson-batter BIP events only, so (a) it filtered to plays matching the Babson roster, making same-text collisions from different teams impossible, and (b) it did not need to distinguish top vs. bottom half since Babson always batted in one half. The RE288 extension changes both assumptions: it processes plays from both teams, and inning half matters for matrix attribution.

**How to avoid:**
1. Replace the `Set(plays)` deduplication with a keyed deduplication that uses `(inning, half, play_text)` as the key. Parse inning headers separately and carry the inning/half context through the deduplication step.
2. Add explicit half-inning detection. Sidearm PBP typically marks half-inning boundaries with lines like "Top of 2nd" or "Bottom of 3rd" or just uses the inning-header pattern the scraper already detects. Verify against the actual 2026 PBP HTML for the specific boundary text format before building the state machine.
3. Validate that the number of distinct half-innings in the parsed output matches the expected inning count from the box score (a 9-inning game should produce 18 half-inning boundaries, or fewer if the home team does not bat in the 9th).

**Warning signs:**
- Total plays parsed is less than the sum of both teams' PA counts from the box score.
- A parsed half-inning has 0 plays but the box score shows runs scored in that inning.
- The RE matrix shows a Babson-as-offense cell that was populated by an opponent PA (detectable by spot-checking: an opponent K should not appear in the Babson-offense matrix).
- Two identical sequential plays appear in the same half-inning with no other plays between them (genuine duplicates are adjacent in the raw HTML).

**Phase to address:**
RE-01. The deduplication fix must happen inside the extended PBP parser, before the state machine runs. The existing `scraper.ts` approach is a reference only — the RE-01 parser should be a new module (`scripts/re_pbp_parser.py` or `web/scripts/build_re_matrix.ts`) that does not inherit the spray chart deduplication approach.

---

### Pitfall 5: Charting PA-to-PBP play matching fails on lineup slot vs. name-based lookup

**What goes wrong:**
The ohtwo report identifies qualifying PAs from Supabase charting data. Those PAs have `pitcherName`, `hitterName`, `inning`, and PA ordering within the segment. To attach base-state and outs from the Sidearm PBP, you need to match each charting PA to the correct PBP play record for the same at-bat.

The match key you would naturally use is `(hitterName, inning, PA_order_within_inning)`. But PBP play texts use the display name format from babsonathletics.com (e.g., "Zander Teator"), while charting PAs use manually entered names from the iPad app (e.g., "Z. Teator", "Teator", "Zander", or whatever the charter typed). The same normalization fragility that already exists in the roster-canonicalization work applies here: any mismatch means the PA gets no base-state context and falls back to a null delta-RE.

Additionally, charting PAs do not store which game they correspond to in the Sidearm system. You know the game date and opponent, but not the Sidearm gameId. Two games on the same date (doubleheaders) are handled with the `(G1)/(G2)` suffix in the charting system (as shown in the recent `b776bde` commit), but the Sidearm URL uses a different gameId per game. A doubleheader lookup that matches the wrong gameId puts the PA in the wrong base-state context entirely.

**How to avoid:**
1. Build the PA-to-PBP match on `(game_date, opponent, inning, lineup_slot_order)` rather than player name. Lineup slot order is more stable than name normalization across the two systems.
2. Maintain a mapping file `web/data/re_game_map.json` that links charting gameIds to Sidearm boxscore URLs (including per-game disambiguation for doubleheaders). Populate this manually when importing games — it is a 2-minute step that prevents a class of runtime ambiguity.
3. Tolerate null base-state gracefully: if a charting PA cannot be matched to a PBP record, compute the delta-RE as null for that PA and exclude it from the aggregate, rather than using a fallback average that would silently pollute the result.

**Warning signs:**
- The coverage rate (charting PAs successfully matched to a PBP play) is below 60% for a single game.
- A charting PA with inning=3, lineup_slot=4 matches a PBP play from inning=5 (name-based matching confused by a recycled batting order).
- The same Sidearm PBP play is matched by two different charting PAs (indicates a lineup slot vs. PA order mismatch — one PA got the right match, one got a collision).

**Phase to address:**
RE-03. The game-map file approach should be established in RE-01 so that by RE-03 there is a reliable index to query.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip minimum-n gating on RE cells | Simpler matrix builder | Coaches see extreme RE values from 1-2 obs cells and distrust the entire system | Never — add n alongside every cell from day one |
| Use the final count field as the pre-pitch count | Avoids building a pitch-by-pitch count state machine | Delta-RE for continued PAs is wrong; ohtwo report gives misleading strategic guidance | Never for delta-RE starting state; acceptable for labeling the PA overall count |
| Inherit `Set(plays)` dedup from spray chart scraper | Faster to reuse existing code | Same-text plays in different innings silently dropped; base-state machine produces wrong outs counts | Never for full-game state reconstruction |
| Build one combined RE matrix (both teams) | Simpler, fewer cells to populate | Cannot separate Babson-as-offense vs opponent-as-offense insight; the coaching question is specifically about Babson pitching, which requires opponent-as-batter RE | Never for the ohtwo use case |
| Store RE matrix as flat JSON without inning-run validation checksum | Faster build script | Silently stale or corrupted matrix if a game was partially parsed | Acceptable for prototype; add validation before RE-07 |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Sidearm PBP → base state | Parse each play line in isolation | Parse with full half-inning context; carry runners-on-base and outs as mutable state across lines within a half-inning |
| Sidearm PBP → Supabase charting PAs | Match on hitter display name | Match on `(game_date, opponent, inning, lineup_slot_index)` and maintain a `re_game_map.json` for Sidearm gameId disambiguation |
| RE matrix builder → ohtwo dashboard | Query cell by `(count_balls, count_strikes, base_state, outs)` and use whatever value is stored | Check `n` before using a cell value; surface null/LOW_CONFIDENCE to the UI rather than a point estimate |
| `normalizeOpponentTeamName` (existing) → Sidearm URL slug | The existing normalizer strips `(G1)/(G2)` suffixes for roster lookup but Sidearm uses different slugs per game | Use the `re_game_map.json` manual mapping for URL resolution instead of programmatic normalization |
| Sidearm inning-run totals → state machine validation | Validate total runs per game only | Validate per half-inning using the pitching rows' inning-by-inning `r` data which `sidearm_parser.py` already captures |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Re-fetching all Sidearm HTML on every RE matrix refresh | Matrix rebuild takes 10+ minutes, blocks CI | Cache raw HTML to `web/public/data/re/raw-html/` by gameId; only fetch new games | After ~10 games in the season; already a problem at 25+ games |
| Loading the full RE JSON matrix into memory on every ohtwo page request | Slow TTFB on the coaching dashboard | Store the matrix as a static file in `web/public/data/re/` and serve it as a static asset, not a database query | At season scale (~25 games) the JSON is small enough not to matter, but the pattern matters for future seasons |
| Running the state machine in the Next.js runtime on page load | Unacceptable page latency for a coaching dashboard | Pre-compute the matrix offline as a build step; the dashboard reads the pre-built JSON only | Immediately — state machine belongs in the build pipeline, not the request path |

---

## "Looks Done But Isn't" Checklist

- [ ] **RE matrix built:** Verify that each cell also stores `n` (observation count) — a matrix with only point estimates is not done.
- [ ] **Delta-RE calculation:** Verify the sign convention is documented and tested. RE(before) - RE(after) should be positive when the pitcher benefits (K reduces RE) and negative when the hitter benefits (walk increases RE).
- [ ] **Inning-run validation:** Verify that parsed inning run totals match box-score `r` values for at least 15 of the 19 known 2026 games before building the matrix.
- [ ] **Half-inning attribution:** Verify that the Babson-as-offense matrix was populated only from half-innings when Babson batted (bottom in home games, top in away games).
- [ ] **Doubleheader handling:** Verify that the MIT doubleheader games (`(G1)/(G2)`) map to distinct Sidearm gameIds in `re_game_map.json`.
- [ ] **Sparse cell gating:** Verify that the ohtwo dashboard shows `null` (not 0.00) for any delta-RE that relies on a cell with `n < 5`.
- [ ] **Counterfactual formula:** Verify the "if X% became strikeouts" calculation uses the RE of the post-K state, not the pre-pitch RE.
- [ ] **Matrix refresh script:** Verify that `re_game_map.json` is updated as part of the refresh workflow, not just the matrix JSON.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Base-state corruption discovered after matrix is built | MEDIUM | Identify which half-innings failed inning-run validation, exclude those games from the matrix, rebuild; data is not lost since raw HTML is cached |
| Sparse cell producing extreme delta-RE in dashboard | LOW | Add `n >= 5` gate to matrix query; regenerate; no data loss |
| Wrong pre-pitch count used for delta-RE | MEDIUM | Document correct formula, rebuild delta-RE computation only (matrix itself is correct); ohtwo report shows updated values on next deploy |
| Name-based PA matching missed 40% of PAs | MEDIUM | Switch to lineup-slot matching; rebuild the match index; historical PAs that were excluded get null delta-RE until matched |
| Deduplication dropped plays in half-innings | HIGH | Rebuild the PBP parser with keyed deduplication; re-validate all inning-run totals; requires re-fetching cached HTML (fast) and re-running the state machine |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Narrative text corrupts state machine | RE-01 | Inning-run-total validation passes for ≥15/19 known 2026 games |
| Sparse cells produce extreme RE values | RE-02 | All matrix cells include `n`; cells with n<5 are null in the output JSON |
| Wrong pre-pitch count for delta-RE | RE-03 | Manual test cases for K/ball/walk/hit outcomes produce expected signs and magnitudes |
| Deduplication drops same-text plays from different innings | RE-01 | Half-inning play counts match sum of both-team PA totals from box score |
| Charting PA to PBP play matching fails | RE-03 (setup in RE-01) | Coverage rate ≥80% for games where both charting data and Sidearm PBP exist; `re_game_map.json` covers all charted games |

---

## Sources

- Direct inspection: `scripts/sidearm_parser.py` — existing PBP parser, no base-state tracking today
- Direct inspection: `web/lib/spraychart/scraper.ts` — existing `Set(plays)` deduplication; half-inning tracking gap confirmed
- Direct inspection: `web/lib/charting/ohtwo.ts` — `hitter_hand = null` on all 33 qualifying events, `count_balls`/`count_strikes` stored but not base_state or outs
- Direct inspection: `.planning/PROJECT.md` — RE288 milestone specification, 25-30 games per season stated
- Session memory: commit `b776bde` — doubleheader suffix stripping confirms `(G1)/(G2)` naming is live in production data

---
*Pitfalls research for: RE288 Run Expectancy Integration — Babson Analytics*
*Researched: 2026-04-11*
