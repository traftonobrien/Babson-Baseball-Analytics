# Feature Research

**Domain:** Run Expectancy Intelligence for baseball pitching analytics (v4.0 milestone)
**Researched:** 2026-04-11
**Confidence:** MEDIUM-HIGH — RE24/RE288 methodology well-documented via Tango/FanGraphs; D3-specific RE values are sparse and must be built from Babson's own PBP corpus

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the coaching staff will assume exist once RE is introduced. Missing these makes the dashboard feel incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| RE by base-out state (RE24) | Every sabermetrics-aware coach knows base-out RE; it is the foundation coaches reference first | MEDIUM | 8 base states x 3 out levels = 24 cells; calculated from Sidearm PBP corpus across all Babson games |
| RE by count (RE288 full matrix) | Extends RE24 to 12 ball-strike counts; required to answer "what is RE at 0-2?" precisely | HIGH | 12 counts x 24 base-out states = 288 cells; requires sequential PBP reconstruction to track count at each pitch |
| Delta-RE per PA outcome | Coaches ask "how many runs did giving up a walk cost vs a strikeout?"; delta-RE is the direct answer | MEDIUM | delta = RE(end state) - RE(start state) + runs scored; calculated for every logged PA outcome in charting data |
| Separate Babson-offense vs opponent-offense matrices | RE varies with run environment; Babson pitching decisions affect opponent RE, Babson batting decisions affect their own RE | MEDIUM | Two separate RE tables derived from the same PBP corpus, filtered by which team is batting |
| Script to refresh matrices as new games are played | Coaches expect RE to stay current across the season; stale matrices undermine trust | LOW-MEDIUM | Python script that re-runs PBP parse + RE compute and writes refreshed JSON; should be a one-command operation |
| 0-2 dashboard: total run value of the strategy | Direct answer to "is our 0-2 fastball approach costing us or saving us runs?"; the primary coaching question | MEDIUM | Sum of delta-RE across all logged 0-2 fastball PAs; displayed as cumulative runs saved/cost |

### Differentiators (Competitive Advantage)

Features that go beyond what any generic RE tool offers, tailored to Babson's specific coaching questions.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Counterfactual simulator on 0-2 dashboard | Answers "if 35% of those balls became strikeouts, how much run value do we recover?"; no off-the-shelf tool does this at the pitch-type level | HIGH | Slider input for hypothetical K% and ball%; computes delta-RE difference using RE288 transitions; shows net run value change |
| Count-progression RE tree (0-2 branches) | Visualizes exactly how much RE changes when 0-2 goes to K vs 1-2 vs in-play; gives coaches a tree of consequences | MEDIUM | Three leaf nodes from 0-2: strikeout (delta -0.27 runs approx), ball to 1-2 (delta ~+0.08), in-play (varies); renders as simple branch diagram |
| Custom D3 RE matrix (Babson corpus) | D3/NESCAC run environment differs meaningfully from MLB; Babson-specific RE is more actionable than MLB tables | HIGH | MLB RE at 0 outs, empty bases is ~0.461; college D3 runs higher; building from actual Sidearm PBP is the only path to an accurate local matrix |
| Per-pitcher RE summary on 0-2 report | Shows which Babson pitchers are generating the most RE risk at 0-2; helps coaches with individual feedback | LOW | Aggregate delta-RE by pitcher from existing charted PA data; extend existing ohtwo.ts aggregation |
| RE leverage index per PA (high-leverage flag) | Identifies which 0-2 situations had disproportionate run consequences; helps coaches prioritize review | MEDIUM | Compute RE difference between start of inning (0 outs, bases empty) and actual PA start state; flag PAs where base-out RE was above threshold (e.g., >0.8 expected runs) |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Win Expectancy (WE) integration | Extends RE to include score and inning; coaches may ask for "win probability" | Requires far more data and inning/score-specific models; college data is too sparse for reliable WE at D3 level; research confirms large standard deviations even in D1 (SABR Tooth Tigers study) | Stick with RE; frame analysis as "run cost" which coaches understand immediately |
| Per-pitch RE (every single pitch mapped to delta-RE) | Sounds maximally granular | Charting data logs pitches but does NOT reconstruct base-out state at each pitch; the base-out state engine would need to be built from scratch using charting PAs, not just the Sidearm PBP | Use per-PA delta-RE (which is achievable) and note the per-pitch limitation |
| Pitcher-vs-pitcher RE comparison across all teams | Would need PBP from opponent games too; coaches may ask "how does our 0-2 RE compare to opponent pitchers?" | Sidearm only gives Babson games; opponent RE on their own games is not available; multi-team comparison would require scraping opponent school box scores | Limit to Babson-offense and opponent-offense splits within Babson games only |
| Live in-game RE update | Real-time RE displayed during charting | Adds complexity to the live charting path; the ohtwo report is a post-game coaching surface, not a live tool | Keep RE as a post-game report feature; refresh after each game via script |
| MLB-calibrated RE matrix as the baseline | Tempting because MLB RE tables are published and readily available | MLB run environment (~4.5 runs/game) differs from D3 (~6-8 runs/game depending on year); using MLB numbers would systematically understate all RE values and distort the counterfactual math | Build from Babson Sidearm PBP corpus; use MLB values only as a sanity check on relative ordering |

---

## Feature Dependencies

```
[RE-01: Extended PBP Parser]
    └──required by──> [RE-02: RE288 Matrix Builder]
                          └──required by──> [RE-03: Delta-RE per logged PA]
                                                └──required by──> [RE-04: Total Run Value Cost on 0-2 Dashboard]
                                                └──required by──> [RE-05: Counterfactual Simulator]
                                                └──required by──> [RE-06: Count-Progression RE Tree]

[RE-02: RE288 Matrix Builder]
    └──required by──> [RE-07: Refresh Script]

[Existing ohtwo.ts aggregation] ──enhances──> [RE-03: Delta-RE per logged PA]
[Existing Sidearm sidearm_parser.py] ──partial foundation for──> [RE-01: Extended PBP Parser]
```

### Dependency Notes

- **RE-01 is the critical path gate.** The current `sidearm_parser.py` extracts box-score batting/pitching rows but does NOT parse play-by-play text. RE-01 must add sequential PA event parsing — reading play description text to extract outcome, runners advanced, runs scored, and outs recorded — before any RE cell can be computed.
- **RE-02 requires sequential base-state reconstruction.** Each PA event from RE-01 must carry: (a) base-out state before the PA, (b) count at which the PA ended, and (c) runs scored during the PA. Without (a), the RE cell assignment is impossible. This is the hardest part of the milestone.
- **RE-03 through RE-06 are straightforward once RE-02 exists.** Given a populated RE288 JSON and the existing charted PA data in Supabase, delta-RE calculation is a lookup + arithmetic pass. The ohtwo.ts loader already has the PA event structure; it just needs to join RE values.
- **RE-07 (refresh script) is low-risk** but must be idempotent — safe to re-run after each game without duplicating records.

---

## MVP Definition

### Launch With (v4.0)

Minimum to answer the coaching questions stated in the milestone.

- [ ] RE-01: Extended PBP parser reconstructs base state and outs for every PA in Babson game history — required to build any RE matrix
- [ ] RE-02: RE288 matrix computed and stored as JSON (separate Babson-offense and opponent-offense matrices) — required for all downstream features
- [ ] RE-03: Delta-RE calculated for each charted 0-2 fastball PA — connects the RE matrix to the existing charting data
- [ ] RE-04: 0-2 dashboard shows total run value cost/save of the strategy — direct answer to the primary coaching question
- [ ] RE-05: Counterfactual simulator ("if X% of balls became Ks, run value changes by Y") — the differentiating coaching insight
- [ ] RE-07: Refresh script as a one-command operation — required for coaches to trust the data stays current

### Add After Validation (v4.x)

Add once RE-01 through RE-07 are working and coaches have reviewed the output.

- [ ] RE-06: Count-progression RE tree — useful visualization but not required to answer the primary questions; add after coaches confirm the base dashboard is correct
- [ ] Per-pitcher RE summary on ohtwo report — extend existing aggregation; add once delta-RE per PA is confirmed accurate
- [ ] RE leverage index per PA (high-leverage flag) — useful for prioritizing review; add as a filter on the ohtwo event feed

### Future Consideration (v5+)

Defer until the RE foundation is proven and stable.

- [ ] RE integration into the main charting leaderboard — extend pitcher stat cards with season-level RE; requires enough charted games for statistical significance
- [ ] Opponent scouting RE — "what RE environment does the next opponent create?" requires scraping opponent-school Sidearm pages, which raises dependency on external site structures changing
- [ ] Win expectancy overlays — needs much more data and inning/score-specific model; SABR research confirms D1 data is marginally sufficient, D3 is not yet

---

## Feature Prioritization Matrix

| Feature | Coach Value | Implementation Cost | Priority |
|---------|-------------|---------------------|----------|
| RE-01: Extended PBP parser | HIGH (unblocks everything) | HIGH | P1 |
| RE-02: RE288 matrix builder | HIGH (unblocks everything) | HIGH | P1 |
| RE-03: Delta-RE per 0-2 FA | HIGH (direct answer) | LOW once RE-02 exists | P1 |
| RE-04: Total run value display | HIGH (clearest coaching signal) | LOW | P1 |
| RE-07: Refresh script | HIGH (trust/maintenance) | LOW-MEDIUM | P1 |
| RE-05: Counterfactual simulator | HIGH (strategy insight) | MEDIUM | P2 |
| RE-06: Count-progression RE tree | MEDIUM (visualization) | MEDIUM | P2 |
| Per-pitcher RE summary | MEDIUM (individual feedback) | LOW | P2 |
| RE leverage index flag | MEDIUM (prioritizes review) | MEDIUM | P3 |
| Leaderboard RE integration | LOW (nice to have) | HIGH | P3 |

---

## RE288 Methodology Summary

### What RE24 is

RE24 (the standard base-out matrix) maps each of 24 states (8 runner configurations x 3 out levels) to the average runs scored from that point to end of inning. Example MLB values: bases empty 0 outs = 0.461 runs; bases loaded 0 outs = 2.282 runs. D3 college values are higher across the board due to greater run scoring.

### What RE288 adds

RE288 extends RE24 by crossing each of the 24 base-out states with 12 ball-strike counts (0-0 through 3-2), yielding 288 cells. Each cell is the average runs to end of inning from that combined game state. The count dimension is critical for pitching analysis because a 0-2 count and a 2-0 count in the same base-out situation have dramatically different RE values.

### Delta-RE (run value) per outcome

delta_RE = RE(end_state) - RE(start_state) + runs_scored_on_play

For a strikeout at 0-2, bases empty, 0 outs: the PA ends the count state, moving from RE288(0-2, empty, 0 outs) to RE24(empty, 1 out). The difference is approximately -0.21 to -0.27 runs (pitcher benefit) depending on run environment.

For a ball at 0-2 moving to 1-2: RE288(1-2, empty, 0 outs) - RE288(0-2, empty, 0 outs) is approximately +0.06 to +0.10 runs (offense benefit, pitcher cost).

### Key magnitudes (MLB baseline; D3 will scale up proportionally)

- Strikeout at 0-2: approximately -0.27 runs for the offense (pitcher benefit)
- Ball at 0-2 (to 1-2): approximately +0.08 runs for the offense (pitcher cost)
- Value swing from 0-2 ball vs K: approximately 0.35 runs per pitch decision
- At 3-2 full count, the ball/strike swing is 0.528 runs — the largest in any count

### Counterfactual formula

If the actual observed K rate at 0-2 fastball is K_actual and the hypothetical rate is K_hyp:

net_run_value_change = (K_hyp - K_actual) * (delta_RE_strikeout - delta_RE_ball) * n_pitches

This is linear in the rate change and scales by the per-pitch value swing, which is derivable from the RE288 matrix. Implementation is a slider input feeding this formula in the TypeScript dashboard layer.

### D3/college RE data availability

No published D3-specific RE288 table exists. The Babson Sidearm PBP corpus is the only viable source for a custom matrix. D1 research (SABR Tooth Tigers, 2022-2025 data across 10k games) found run expectancy values "significantly higher than MLB" with standard deviations large relative to cell differences, especially for less-common base-out states. At D3 level with a much smaller corpus (Babson only, ~30-60 games per season), many RE288 cells will be sparsely populated. Mitigation: use RE24 (base-out only) as the primary coaching number and reserve RE288 for the count-specific dashboard where only the most common count transitions (0-2 → K, ball, in-play) actually need to be reliable.

---

## Competitor Feature Analysis

| Feature | Synergy (D1 analytics) | Yakkertech/TrackMan tools | Babson v4.0 Approach |
|---------|------------------------|---------------------------|----------------------|
| RE matrix | MLB-calibrated, not college-specific | Not typically exposed to coaches | Custom-built from own PBP corpus — more accurate for local environment |
| Counterfactual simulator | Not standard | Not standard | First-class feature in ohtwo dashboard |
| Pitch-level run value | TrackMan Stuff+ proxies this | Available in high-end systems | Approximated via PA-level delta-RE from charting data (not pitch-level, but actionable) |
| Count-progression tree | Not typically shown to coaches | Not standard | Simple visual in the existing ohtwo dashboard; new branch for RE values |

---

## Sources

- [Tangotiger RE288 Blog Post](https://tangotiger.com/index.php/site/comments/re288-run-expectancy-by-the-24-base-out-states-x-12-plate-count-states-recu) — original RE288 methodology and structure (MEDIUM confidence — values in images, not tables)
- [FanGraphs RE24 Library](https://library.fangraphs.com/misc/re24/) — canonical delta-RE formula and MLB example values (HIGH confidence)
- [Analyzing Baseball Data with R — Chapter 6](https://beanumber.github.io/abdwr3e/06-pitchcount.html) — step-by-step RE count-state calculation methodology including code (HIGH confidence)
- [The Hardball Times — Dynamic Run Value of a Strike vs Ball](https://tht.fangraphs.com/dynamic-run-value-of-throwing-a-strike-instead-of-a-ball/) — specific run value magnitudes by count (2014 MLB data) (MEDIUM confidence — slightly dated but methodologically sound)
- [SABR Tooth Tigers — Run Expectancy in D1 College Baseball](https://medium.com/sabr-tooth-tigers/run-expectancy-and-win-probability-in-division-1-college-baseball-fb04b3f4c3ce) — D1 RE vs MLB comparison, data limitations at college level (MEDIUM confidence — D1 not D3, but most relevant study found)
- [Bayesball RE Blog](https://bayesball.github.io/BLOG/Runs_Expectancy.html) — general RE matrix derivation walkthrough (MEDIUM confidence)

---

*Feature research for: Run Expectancy Intelligence milestone (v4.0)*
*Researched: 2026-04-11*
