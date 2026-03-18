# Arm Action Profile — Continuation Doc
_Created 2026-03-18. Pick up from here in next session._

## What Was Built (Commits on `main`)

| Commit | Description |
|--------|-------------|
| `c38b8dd` | feat: arm action profile classification (initial build) |
| `357ffaf` | feat: methodology guide modal (? button) |
| `5819954` | feat: remove alreadyThrows, add blend detection |
| `5f6bd2e` | feat: overhaul recommendations with research-backed cues |

## Current System Summary

**File**: `web/lib/trackman/armAction.ts`
**UI**: `web/app/trackman/player/[slug]/ArmActionPanel.tsx`
**Guide**: `web/app/trackman/player/[slug]/ArmActionGuideModal.tsx`
**Tests**: `web/lib/trackman/armAction.test.ts` (19 passing)

### Classification Logic
- 6 weighted signals: fastball HB direction (3×), sinker presence (2×), slider/sweeper (1.5×), changeup (1×), cutter HB (1×), spin axis (1×)
- Pronator: weighted score > 0.2 | Supinator: < −0.2 | Neutral: in between
- Arm slot from `computeArmAngleDeg(relHeight, relSide)` → 6 tiers (Submarine → Over-the-top)
- Blend detection: Euclidean distance ≤ 5.5" (IVB/HB space) vs MLB avg suppresses duplicate suggestions

### Current Recommendation Matrix (as of `5f6bd2e`)

**Pronator Primary**: Sinker, Changeup, Slider (Gyro)
**Pronator Secondary**: Cutter, Curveball (gated: not sidearm/submarine), Splitter
**Supinator Primary**: Slider, Sweeper, Curveball (gated: not sidearm/submarine), Splitter (kick-change)
**Supinator Secondary**: Cutter

---

## Remaining Work / Next Steps

### 1. Pitch-Specific Rationale for Arm Slot Context (High Value)
The current code has arm slot gates (e.g., no Curveball for sidearm/submarine) but the rationale strings don't always acknowledge WHY based on slot. For example:
- Sidearm pronator: their sinker has more **lateral** movement (screwball shape) vs. vertical sink for over-the-top — rationale should reflect this
- Low arm slot supinator: their slider gets more horizontal movement, less depth — rationale should say "your arm slot amplifies the horizontal sweep"
- Submarine: unique armside movement (their fastball/sinker moves like a screwball) — special note

**Implementation hint**: Add slot-aware string interpolation in each `suggest()` call, similar to how `sswNote` already does this for the Sinker.

### 2. "Neutral" Profile Improvements
Currently Neutral shows a generic "import more data" message with a `—` pitch type. Should instead:
- Show what arm action CAN be determined (e.g., arm slot even if arm action unclear)
- Offer tentative suggestions if score is marginally neutral but leaning one way
- Remove the ugly `—` placeholder pitch type

### 3. Guide Modal Updates Needed
`ArmActionGuideModal.tsx` still documents the OLD recommendation tiers (Current Arsenal / Primary Add / Secondary Option). Now that "Current Arsenal" is gone, the guide needs updating:
- Remove "Current Arsenal — Good Fit" from the Pitch Recommendations section
- Update the three-tier description to just Primary Add + Secondary Option
- Add explanation of Blend Detection (new feature not documented)
- Update the Classification Signals section — weights show 1× for Slider/Sweeper but code has 1.5×

### 4. Test Coverage Gaps
Current tests don't cover:
- Gyro Slider suggestion for pronators (new feature from `5f6bd2e`)
- Splitter suggestion for supinators (elevated to Primary)
- Blend detection suppressing Curveball when curveball movement is already covered
- Neutral classification edge case (score exactly at boundary)
- Arm slot gating for Curveball (supinator sidearm → no curveball)

Add these to `armAction.test.ts`.

### 5. Movement Chart Integration (Stretch Goal)
The ArmActionPanel currently shows text recommendations only. A movement scatter plot would let players visually see:
- Their existing arsenal plotted in IVB/HB space
- MLB avg zones for suggested pitches
- Why a suggestion was suppressed (blend zone visible)

This would reuse the existing `MLBCompsPanel` scatter logic or the `release_viz` chart components.

---

## Key Files to Read First in New Session

```
web/lib/trackman/armAction.ts          # Classification + recommendation engine
web/lib/trackman/armAction.test.ts     # Test file (add tests here)
web/app/trackman/player/[slug]/ArmActionPanel.tsx     # UI panel
web/app/trackman/player/[slug]/ArmActionGuideModal.tsx # ? guide modal (needs update)
web/lib/mlbPitchAverages.ts            # getMlbAvg() used for blend detection
```

## Research Sources Used (for additional context)

- **Baseball Prospectus — Pronator's Triangle**: Luis Castillo 4-seam + changeup + gyro slider
- **FanGraphs — Kick Change**: Supinators' only viable changeup; spiked middle finger = saucer spin
- **Samuel Midgette Substack**: Pronators = arm-side pitches + firm cutters. Supinators = multiple breaking balls, struggle with traditional changeup
- **NextGen Pitching**: Supinators → riding 4-seam, 12-6 curve, depth changeup. Pronators → sinker, cutter, slider
- **Baseball Prospectus — Six Degrees of Supination**: Curveball = most supination; slider = moderate; cutter = least
- **Pitcher List — Spin Doctors**: Pronator's triangle confirmed; supinators struggle with active spin on fastball
- **Lookout Landing (2025) — Kick Change**: Brian Bannister innovation; solves supinator off-speed problem
- **Biomechanics (PMC)**: Curveball has 32° more supination than fastball (17°); changeup = 18° (same as fastball)
- **Arm slot research**: Sidearm curveball impossible (can't get over ball); sidearm fastball has screwball shape
