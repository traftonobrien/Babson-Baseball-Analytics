# Research: Pitfalls

**Date:** 2026-03-06
**Project:** Babson Pitching Charting App

## Pitfalls

### Building too much scorekeeping logic too early
- Warning signs: baserunners, substitutions, defensive alignments, and official scoring edge cases start dominating the backlog
- Prevention: lock v1 to pitch entry, PA result codes, and manual R/ER overrides
- Best phase to address: guard from Phase 1 onward

### Assuming internet is always available
- Warning signs: API-first UI, no offline banner, no relaunch recovery tests
- Prevention: local-first writes, visible sync queue, replay tests before pilot
- Best phase to address: Phases 3 and 5

### Treating a game as a single-pitcher outing
- Warning signs: data model ties every game directly to one pitcher
- Prevention: model pitcher segments explicitly from day one
- Best phase to address: Phase 1

### Letting export design drive the data model
- Warning signs: schema names and structures mimic paper boxes instead of baseball entities
- Prevention: keep export as a renderer over a clean chart snapshot + projections
- Best phase to address: Phases 1 and 7

### Under-specifying result codes
- Warning signs: free-text result entry or inconsistent codes across scorers
- Prevention: controlled result-code vocab with structured categories behind it
- Best phase to address: Phase 4

### Weak auth for a staff-facing workflow
- Warning signs: hardcoded passwords and no operator identity carried through charting records
- Prevention: at minimum, issue internal app auth tokens and record operator identity on each game
- Best phase to address: Phase 2

### No pilot diagnostics
- Warning signs: when sync fails, the scorer has no idea what is pending or safe to retry
- Prevention: expose pending/failed sync state and capture operational logs for internal testing
- Best phase to address: Phase 8

---
*Research note: pitfalls to avoid during v1 planning and execution*
