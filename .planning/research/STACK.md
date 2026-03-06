# Research: Stack

**Date:** 2026-03-06
**Project:** Babson Pitching Charting App

## Recommended Stack

### Client App
- **SwiftUI on iPadOS 17+**
  - Best fit for native iPad workflows, TestFlight distribution, and touch-first data entry
  - Pairs naturally with Apple’s current app lifecycle and navigation APIs
- **SwiftData for local persistence**
  - Good fit for offline-first local game state, autosave, and app relaunch recovery
  - Simpler than standing up a custom local database layer for v1
- **URLSession for sync**
  - Sufficient for queued snapshot uploads and bootstrap fetches
- **Keychain-backed auth token/session**
  - Better than storing auth state only in user defaults

### Backend / Portal
- **Next.js route handlers in the existing `web/` app**
  - Keeps charting in the same deployment surface as the existing portal
- **Neon Postgres + Drizzle**
  - Already present in the repo
  - Better fit than committed static JSON for mutable game sessions
- **Snapshot + projection model**
  - Store full chart snapshot revisions
  - Rebuild normalized read models for portal analytics and export

### Export / Reporting
- **Server-side PDF generation**
  - Recommended so exported charts are deterministic and not dependent on iPad rendering quirks
- **CSV export from normalized game projections**
  - Keeps downstream reporting clean and structured

## Why This Stack

- Apple-native tools reduce risk for TestFlight, background lifecycle, and touch latency
- Neon/Drizzle avoids inventing a second backend stack
- Snapshot sync is safer for a one-scorer offline workflow than trying to stream each pitch as an isolated write
- The repo already supports Next.js + Neon, so charting can extend current infrastructure instead of adding Firebase/Supabase/another backend

## What Not To Use

- **Do not use the existing static `web/public` publish model for live charting**
  - It works for deterministic published data, not mutable offline game sessions
- **Do not build v1 as a web PWA**
  - Native iPad UX, offline persistence, and TestFlight rollout matter more than faster cross-platform delivery here
- **Do not overreach into full official scoring engine territory in v1**
  - That complexity delays the core charting workflow

## Confidence

- **High**: SwiftUI + SwiftData + URLSession for iPad-first offline entry
- **High**: Neon/Drizzle for backend persistence because it already exists in repo
- **Medium**: exact PDF renderer choice; use whatever server-side library integrates cleanly with the final web runtime

## Sources Checked

- Apple TestFlight overview and tester docs
- Apple SwiftData documentation family
- 6-4-3 Charts product pages
- Existing repo architecture and DB setup

---
*Research note: stack recommendation for v1 delivery*
