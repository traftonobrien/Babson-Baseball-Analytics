# Stack Research

**Domain:** Run Expectancy Intelligence (RE288 matrix + delta-RE dashboard integration)
**Milestone:** v4.0 — adding to existing Next.js 16 + Supabase baseball analytics app
**Researched:** 2026-04-11
**Confidence:** HIGH

---

## Executive Finding

No new npm dependencies are required for this milestone. Every capability needed — PBP parsing, base-state accumulation, RE matrix arithmetic, JSON storage, dashboard rendering, and script execution — is either already in the repo or is pure TypeScript logic that should be written in-house. The risk of adding third-party dependencies (versioning, bundle size, incompatible types) outweighs any benefit when the domain logic is this small and well-defined.

---

## Existing Stack — What Already Handles This

| Capability | Existing Asset | Notes |
|------------|----------------|-------|
| PBP HTML fetch + parse | `web/lib/spraychart/scraper.ts` | Already fetches Sidearm box scores and extracts play lines |
| Play text pattern matching | `web/lib/spraychart/zoneMapper.ts` | Already classifies hit results, RBI, count/sequence from play text |
| Script runner | `npx tsx web/scripts/` | Already used for `scrape_spray_charts.ts`, `load_stuff_plus.ts`, `audit_database_backends.ts` |
| Static JSON output pipeline | `web/public/data/*.json` → Next.js pages | Already used for spray charts; RE matrix follows the same pattern |
| TypeScript types + interfaces | throughout `web/lib/` | All new RE types should live in `web/lib/runExpectancy/types.ts` |
| Unit testing | vitest (already in devDependencies) | RE parser and matrix builder should have tests alongside implementation |
| Dashboard page | `web/app/charting/ohtwo/page.tsx` | Existing server component; delta-RE panels slot in as new sections |
| Data loading in pages | existing `ohtwo.ts` loader pattern | RE matrix loaded from JSON file at build/request time via `fs.readFileSync` |

---

## New Capabilities — Implementation Approach

### 1. Extended PBP Parser (base-state reconstruction)

**Approach:** Extend `web/lib/spraychart/scraper.ts` or add `web/lib/runExpectancy/pbpParser.ts` alongside it.

The existing scraper already extracts play lines. What is new is:
- Parsing plays for BOTH teams (currently Babson-only; remove the `isBabsonPlayer` filter for RE matrix building)
- Tracking baserunner state across sequential plays within a half-inning
- Tracking outs within a half-inning
- Extracting count at PA start (already partially present via `extractCountAndSequence`)

**Implementation:** A sequential reducer over the play-line array. Each play line updates a mutable `{ bases: [boolean, boolean, boolean], outs: 0|1|2, runsScored: number }` struct. No state machine library needed — this is a plain `for` loop with a switch on play type. The branching complexity (scored, advanced, caught stealing, pickoff, etc.) is well within what a 200-line parser handles cleanly.

### 2. RE288 Matrix Builder

**Approach:** A `web/scripts/build_re_matrix.ts` script following the exact pattern of `web/scripts/scrape_spray_charts.ts`.

The script:
1. Calls the extended PBP parser across all game URLs
2. Accumulates observed run outcomes keyed by `(count, baseState, outs)` → `{totalRunsScored, paCount}`
3. Computes `expectedRuns = totalRunsScored / paCount` per cell
4. Writes output to `web/public/data/re-matrix.json`

No matrix math library is needed. The computation is: group rows, sum, divide. Plain `Map` and object aggregation in TypeScript.

### 3. delta-RE Calculation

**Approach:** Add to `web/lib/runExpectancy/deltaRE.ts`.

delta-RE = `reAfter - reBefore + runsScored`. All inputs come from the RE matrix JSON (looked up by state key) and the parsed PA event. No external library required.

### 4. RE Matrix JSON Storage Format

No published standard exists for RE matrix JSON. The natural TypeScript-native shape is a flat lookup object:

```typescript
type BaseState = "000" | "100" | "010" | "001" | "110" | "101" | "011" | "111"; // 1=occupied
type CountKey = "0-0" | "0-1" | "0-2" | "1-0" | "1-1" | "1-2" | "2-0" | "2-1" | "2-2" | "3-0" | "3-1" | "3-2";
type OutsKey = 0 | 1 | 2;

interface RECell {
  expectedRuns: number;
  sampleSize: number;
}

// Lookup: re[count][baseState][outs]
type REMatrix = Record<CountKey, Record<BaseState, Record<OutsKey, RECell>>>;

interface REMatrixFile {
  builtAt: string;
  season: number;
  gamesProcessed: number;
  babsonOffense: REMatrix;
  opponentOffense: REMatrix;
}
```

This flat nested-object shape is:
- Directly serializable to/from JSON with no transformation
- Trivially typed in TypeScript
- O(1) lookup in the dashboard via `matrix[count][baseState][outs]`
- Human-readable in the JSON file for debugging

### 5. Dashboard Integration (ohtwo page)

**Approach:** New server-side sections in the existing `web/app/charting/ohtwo/page.tsx`. The RE matrix JSON is loaded once at request time using `fs.readFileSync` + `JSON.parse`, same as other static data files in this codebase. The counterfactual simulator is pure arithmetic rendered as a React Server Component — no client-side interactivity required for v1.

---

## What NOT to Add

| Do Not Add | Why | What to Do Instead |
|------------|-----|--------------------|
| `xstate` or any FSM library | Base-state reconstruction is a sequential loop with ~8 play-type branches, not a statechart. FSM libraries add conceptual overhead and bundle weight for what is 50 lines of reducer logic. | Plain TypeScript `for` loop with a state struct and switch statement |
| Any `baseball-*` npm package | No credible, maintained npm package exists for RE288 or RE24 calculation in TypeScript. The GitHub project `re288-matrix` is Python/R-based, not a published npm package. | Write bespoke logic; it is small and the domain constraints (Sidearm PBP format, D3 college context) are specific enough that a generic library would not fit anyway |
| `ts-matrix` or other matrix math libraries | RE matrix is a lookup table, not matrix algebra. No dot products, inversions, or linear algebra operations are involved. | Use plain TypeScript `Record<>` types and object literal lookup |
| A new database table | RE matrix updates infrequently (once per game day). A JSON file in `web/public/data/` matches the existing pattern for derived data and avoids schema migrations. | `web/public/data/re-matrix.json` written by the build script |
| A new runtime dependency for JSON schema validation | The RE matrix is writer-controlled (our own build script). Schema drift is not a real risk. | TypeScript types at write time in the build script are sufficient |

---

## Additions That ARE Needed (Zero Dependencies)

| What | Where | Why |
|------|-------|-----|
| `web/lib/runExpectancy/types.ts` | New file | Shared TypeScript types for base state, RE matrix shape, delta-RE result |
| `web/lib/runExpectancy/pbpParser.ts` | New file | Extended PBP parser: both teams, sequential base-state + outs reconstruction, count at PA start |
| `web/lib/runExpectancy/matrixBuilder.ts` | New file | Accumulate observed run outcomes → compute expected runs per (count, baseState, outs) cell |
| `web/lib/runExpectancy/deltaRE.ts` | New file | delta-RE calculation per PA: lookup before/after states, subtract, add runs scored |
| `web/scripts/build_re_matrix.ts` | New script | CLI runner: scrape all games, build matrix, write `web/public/data/re-matrix.json` |
| `web/public/data/re-matrix.json` | New static file | The stored RE288 matrices (Babson offense + opponent offense) |
| `npm run build:re-matrix` entry in `package.json` | New script entry | `"npx tsx scripts/build_re_matrix.ts"` — matches existing script conventions |
| Tests in `web/lib/runExpectancy/*.test.ts` | New test files | Cover parser state transitions, matrix builder accumulation, delta-RE arithmetic |

---

## Version Compatibility

No new packages means no new compatibility surface. The existing stack versions are sufficient:

| Existing Dependency | Version | RE Milestone Usage |
|--------------------|---------|-------------------|
| `next` | 16.1.6 | Unchanged; ohtwo page is already dynamic |
| `typescript` | ^5 | Types for RE matrix shape; no new APIs needed |
| `vitest` | ^4.0.18 | Tests for new `runExpectancy/` modules |
| Node.js `fs` (built-in) | — | `readFileSync` + `writeFileSync` for JSON I/O in scripts and page loader |

---

## Sources

- `web/lib/spraychart/scraper.ts` — confirmed existing PBP fetch/parse capabilities and Sidearm HTML format
- `web/lib/spraychart/zoneMapper.ts` — confirmed count/sequence extraction already exists
- `web/scripts/scrape_spray_charts.ts` — confirmed `npx tsx scripts/` is the established script runner convention
- `web/package.json` — confirmed exact versions; `tsx` available via `npx`, no install needed
- npm search for `baseball` packages — no credible RE/run-expectancy TypeScript package found
- [FanGraphs RE24 Library](https://library.fangraphs.com/misc/re24/) — confirmed standard RE calculation formula (delta = reAfter - reBefore + runs scored); no JSON standard exists
- [logananthony/re288-matrix on GitHub](https://github.com/logananthony/re288-matrix) — Python/R project, not an npm package; confirms RE288 is always built from first principles against local PBP data
- [XState npm](https://www.npmjs.com/package/xstate) — evaluated and rejected; overkill for sequential base-state accumulation
- [DEV: You don't need a library for state machines](https://dev.to/davidkpiano/you-don-t-need-a-library-for-state-machines-k7h) — confirms plain TypeScript is appropriate for simple state transitions

---

*Stack research for: v4.0 Run Expectancy Intelligence milestone*
*Researched: 2026-04-11*
