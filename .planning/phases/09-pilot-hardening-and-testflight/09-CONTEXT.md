# Phase 9: Pilot Hardening and TestFlight - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 exists to make the current v1 charting product usable by internal staff in a real pilot. The boundary is not major new scoring scope, collaboration, or storage redesign. It is the operational layer around the now-hardened charting engine: intentional authentication, durable snapshot sync, visible diagnostics, recovery actions, TestFlight packaging readiness, and a short support runbook staff can actually follow.

</domain>

<decisions>
## Implementation Decisions

### User Priority
- The first priority remains charting logic that staff can trust during a game.
- Storage and sharing can still evolve later, but the existing sync path must be durable enough for a real pilot before TestFlight is credible.
- The product should leave this phase as a functional v1, not a demo with beta packaging on top.

### Pilot Hardening
- The current auth bypass in `RootView` must be removed so the beta uses the real operator sign-in path.
- Pilot diagnostics should live inside the app, not only in planning docs, because scorers need immediate guidance when sync fails.
- Build/version visibility and manual recovery actions belong in the Settings surface so testers can self-serve common support steps.

### Sync Reliability
- The iPad app's queued sync path needs to persist the full chart snapshot, not only top-level game metadata.
- Sync success must update local revision state so optimistic locking stays aligned with the server after each successful write.
- Sync failures should preserve enough context for a manual retry and a clean operator explanation.

### Claude's Discretion
- The exact shape of the in-app diagnostics surface as long as it stays concise and operator-readable.
- Whether the runbook lives only in docs or also has a compact in-app quick reference.
- The smallest useful validation matrix that proves pilot readiness without inventing a full QA harness.

</decisions>

<specifics>
## Specific Ideas

- `RootView.swift` currently force-authenticates on appear, which bypasses the intended login flow and hides session issues that would matter in TestFlight.
- `SettingsView` is currently too thin for pilot use: it needs app build info, session state, sync state, last success/failure timestamps, and manual recovery actions.
- `SyncQueueManager.swift` currently reports a coarse badge state but does not expose first-class attempt/success/failure diagnostics or a direct retry hook.
- The iPad sync queue currently PATCHes a full snapshot into a server route that only whitelists top-level game fields; that gap must be closed before pilot distribution.

</specifics>

<code_context>
## Existing Code Insights

### Primary Risk Area
- `ios/PitchTracker/PitchTracker/Stores/GameStore.swift` already owns app-side recovery and sync orchestration, so pilot diagnostics should concentrate there instead of scattering new state across many views.

### Known Gaps
- `ios/PitchTracker/PitchTracker/Views/RootView.swift` bypasses login entirely by setting `apiClient.isAuthenticated = true`.
- `ios/PitchTracker/PitchTracker/Views/MainTabView.swift` exposes only server URL, local cache counts, and sign out in Settings.
- `ios/PitchTracker/PitchTracker/Network/SyncQueueManager.swift` does not currently retain structured sync diagnostics or manual retry context.
- `web/app/api/charting/games/[id]/route.ts` currently accepts optimistic-lock PATCH updates but only persists top-level game metadata, not the full snapshot the iPad client sends.

### Integration Points
- `APIClient.swift`, `SyncQueueManager.swift`, and `GameStore.swift` should become the single operational path for login state, sync status, retry, and refresh actions.
- `SettingsView`, `GameDetailView`, `LiveChartingView`, and `SyncStatusIndicator.swift` should surface just enough pilot support context without overwhelming the scorer.
- Planning docs should end this phase with a TestFlight checklist and a concise operator runbook.

</code_context>

<deferred>
## Deferred Ideas

- Multi-user collaboration, deeper support portals, and longer-term storage/sharing redesign stay outside this phase.
- Expanded scoring domains such as baserunner tracking and substitutions remain v2 work.
- App Store production release work beyond internal TestFlight readiness remains later.

</deferred>

---

*Phase: 09-pilot-hardening-and-testflight*
*Context gathered: 2026-03-06*
