# Research Summary

**Date:** 2026-03-06
**Project:** Babson Pitching Charting App

## Stack

Use a native SwiftUI iPad app with SwiftData local persistence and `URLSession` sync against new Next.js route handlers backed by Neon/Drizzle. This matches the repo’s existing web stack while giving the iPad workflow the offline reliability and TestFlight fit it needs.

## Table Stakes

The app must make pitch entry fast, preserve count and PA flow, support pitcher changes inside one game, work offline, and produce both structured analytics data and a chart export that feels close to the current paper workflow.

## Watch Out For

The biggest risks are overbuilding scorekeeping complexity, forcing live charting into the legacy static publish model, and failing to prove offline persistence before the pilot. Keep the core model game-centric with pitcher segments and revisioned snapshot sync.

## Recommended Planning Bias

- Prefer smaller phases
- Build contracts before UI polish
- Make the app local-first
- Keep export as a renderer over stable data
- Defer anything that smells like full official scorebook scope

---
*Research synthesis for roadmap creation*
