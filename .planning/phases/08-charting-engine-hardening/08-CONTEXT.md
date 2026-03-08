# Phase 8: Charting Engine Hardening - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 exists to make the iPad charting engine trustworthy in live game use. The boundary is not broader distribution, storage redesign, or collaboration. It is the core scoring mechanics: deterministic count progression, plate-appearance closure, outs and inning rollover, batter advancement, pitcher-segment transitions, undo/reopen behavior, relaunch recovery, and the UI guardrails required to keep scorers from creating contradictory state.

</domain>

<decisions>
## Implementation Decisions

### User Priority
- The first priority is the actual mechanics of the charting engine.
- Data storage and sharing improvements can come later.
- The product should reach a fully functional v1 by making charting logic foolproof before widening pilot exposure.

### Engine Rules
- Live state should be derived from persisted pitches, plate appearances, and pitcher segments rather than partially reconstructed with mutable UI counters.
- Plate-appearance result handling needs a controlled ruleset for outs recorded and closeout eligibility.
- Undo and relaunch recovery must use the same deterministic reconstruction path as live charting, not a second ad hoc branch.

### Workflow Guardrails
- The top zone canvas and bottom operator dock layout baseline stays intact.
- Guardrails should focus on correctness and clarity rather than visual expansion.
- The scorer should always be able to tell what the next valid action is: record another pitch, close the PA, or change the pitcher.

### Claude's Discretion
- Exact shape of the pure engine helpers and whether they live inside existing model files or a dedicated engine type.
- The specific in-app affordances for surfacing "ready to close" plate appearances.
- The minimum scenario matrix required to make regression risk acceptable for v1.

</decisions>

<specifics>
## Specific Ideas

- `GameStore.recalculateChartingState()` currently treats out detection as demo-grade logic and should be replaced with a single source of truth.
- Strikeout and walk closure should be driven by the actual pitch sequence of the open PA, not by manually bumping counters and hoping the UI lines up.
- Pitcher changes should stamp segment entry/exit context cleanly enough that later export/reporting work does not need to infer the active pitcher heuristically.
- Scenario tests should prove correctness across reopened PAs, inning rollover, bunt-foul strike-three behavior, double plays, and relaunch recovery from persisted snapshots.

</specifics>

<code_context>
## Existing Code Insights

### Primary Risk Area
- `ios/PitchTracker/PitchTracker/Stores/GameStore.swift` owns both persistence and live charting state, but the current count/outs logic mixes live mutation with partial reconstruction.

### Known Gaps
- `closePlateAppearance` only advances outs for `K`, `F8`, and `6-3`, while the UI exposes additional out-like result codes such as `5-3` and `DP`.
- `recordPitch` can increment bunt fouls past two strikes instead of treating a two-strike bunt foul as a strikeout-ready terminal pitch.
- `PAResultControls` currently enables `K` off `currentStrikes >= 3`, but the store generally caps standard strikes at two, so the closeout path is not reliable.
- Test coverage is concentrated in serialization round-trips; engine behavior does not yet have scenario-heavy regression tests.

### Integration Points
- `LiveChartingView`, `PitchResultControls`, `PAResultControls`, and `PitchHistoryList` should consume the same engine state so the UI reflects real next actions.
- `GameDetailView` and pitcher-segment APIs may need light updates to keep active segment metadata aligned with live charting transitions.

</code_context>

<deferred>
## Deferred Ideas

- TestFlight packaging, pilot diagnostics, and operator runbooks move to Phase 9.
- Shared editing, deeper sync collaboration, and broader storage/sharing changes remain later-phase work.
- Full baserunner engine and broader defensive scorebook logic stay out of scope for v1.

</deferred>

---

*Phase: 08-charting-engine-hardening*
*Context gathered: 2026-03-06*
