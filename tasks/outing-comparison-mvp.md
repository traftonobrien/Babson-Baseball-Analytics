# Outing Comparison Feature - Implementation Plan

## What Will Exist After MVP

After MVP implementation, users will be able to:

1. Navigate to `/player/[playerId]/compare` from the report page or directly
2. Select two outings (Side A and Side B) from dropdowns
3. See side-by-side comparison with:

• KPI summary row showing Side A, Side B, Delta (A-B), and key metrics

• Two strike zone scatter plots (one per side)

• Per-pitch-type comparison table (all types from both sides, aligned)

• Lane breakdown comparison table (Glove/Middle/Arm, with correct labels for handedness)

4. Toggle "Exclude outliers" globally (applies to both sides)
5. Share comparison via URL with query parameters
6. See proper error handling for missing data, 0 pitches, etc.

**MVP scope:** Only compares two complete outings. No filtering is applied besides the global `excludeOutliers` toggle. MVP explicitly ignores `minA`, `maxA`, `minB`, `maxB`, `typesA`, `typesB`, `lanesA`, `lanesB` query parameters (these exist in the schema but are not processed in MVP). MVP also excludes pitch tables, percent change columns (delta only), and inning-based filtering.

---

## Repo-Specific Findings

### Current Patterns

1. **Query Params:** 

• Client components use `useSearchParams()` from `next/navigation`

• Server components use async `searchParams: Promise<{ key?: string }>`

• Navigation uses `router.push()` from `useRouter()`

2. **CSV Loading:**

• `usePitchData(csvPath)` hook exists for single CSV

• `useAllPitchData(csvPaths)` exists in report page (inline, should extract)

• CSV parsing uses PapaParse with `NUM_FIELDS` set for numeric conversion

3. **Pitcher Hand:**

• Comes from `pitcher_hand` field in Pitch data (from CSV)

• Derived in `buildReport()` as: `allPitches[0]?.pitcher_hand ?? "R"`

• Stored in `ReportMeta.pitcherHand`

4. **Lane Logic:**

• `laneOf(p: Pitch)` in `reportModel.ts` returns "Glove" | "Middle" | "Arm"

• Currently private (needs export)

• `laneDisplayName(lane, pitcherHand)` exists but intentionally ignores `pitcherHand` parameter (underscore prefix). The function is static and returns "Glove side", "Arm side", or "Middle" regardless of handedness. Lane normalization is handled by `laneOf()` which uses `h_miss_signed` (already hand-normalized). This is intentional design: `laneDisplayName` provides static labels, while `laneOf` handles the handedness-aware lane assignment.

• Duplicate `laneOf` exists in `PlayerDashboard.tsx` (should use canonical one)

5. **Outlier Logic:**

• `isOutlier(p: Pitch)` in `reportModel.ts` (currently private, needs export)

• Uses `OUTLIER_MISS_THRESHOLD_IN = 20` inches

• `isOnTarget(p: Pitch)` also private (needs export)

6. **localStorage Pattern:**

• Key format: `reportExcludeOutliers:${playerId}:${scope}`

• For comparison: `compareExcludeOutliers:${playerId}`

7. **Component Patterns:**

• `OutingSelect` component exists and can be reused/adapted

• `PitchTable` and `StrikeZoneScatter` are reusable as-is

• Report page uses `ReportSection` wrapper component

8. **No Test Infrastructure:**

• No `.test.ts` files found

• Will rely on manual testing and pure function validation

---

## Final Spec Decisions

### Route

**Confirmed:** `/player/[playerId]/compare`

### Query Param Schema

```
/player/[playerId]/compare?
  outingA=<outing_id>&
  outingB=<outing_id>&
  minA=<number>&
  maxA=<number>&
  minB=<number>&
  maxB=<number>&
  typesA=<comma_separated>&
  typesB=<comma_separated>&
  lanesA=<comma_separated>&
  lanesB=<comma_separated>&
  excludeOutliers=<true|false>
```

**MVP Scope:** Only `outingA` and `outingB` are required and processed. `excludeOutliers` is also supported. All other params (`minA`, `maxA`, `minB`, `maxB`, `typesA`, `typesB`, `lanesA`, `lanesB`) exist in the schema but are explicitly ignored in MVP (no filtering applied). These are Phase 2.

**Defaults:**

• `outingA`: First outing if available, else null

• `outingB`: Second outing if available, else null

• `excludeOutliers`: false

• All other params: undefined (no filtering)

### MVP Scope Confirmation

**Included:**

• Two outing comparison (no filters initially)

• KPI summary with deltas (A - B)

• Per-pitch-type comparison table

• Lane breakdown comparison table

• Two strike zone scatters

• Global exclude outliers toggle

• Query param persistence

• Basic error handling

**Excluded (Phase 2):**

• Pitch number ranges (`minA`, `maxA`, `minB`, `maxB`) - params exist but are not processed

• Pitch type filters (`typesA`, `typesB`) - params exist but are not processed

• Lane filters (`lanesA`, `lanesB`) - params exist but are not processed

• Percent change columns (delta only for MVP)

• Pitch tables (optional, collapsible)

• Inning-based filtering

---

## Code Architecture Plan

### New Module: `web/lib/comparisonModel.ts`

**Exports:**

```typescript
// Types
export interface PitchSelection {
  playerId: string;
  outingId: string | null;
  pitchNumberMin?: number;
  pitchNumberMax?: number;
  pitchTypes?: string[];  // Empty = all types
  lanes?: string[];       // Empty = all lanes, values: "Glove" | "Middle" | "Arm"
  // Note: excludeOutliers is global, not per-selection
}

export interface ComparisonReport {
  reportA: Report;
  reportB: Report;
  delta: {
    avgMiss: number;
    medianMiss: number;
    onTargetPct: number;  // percentage points
    outlierCount: number;
    includedCount: number;
    totalCount: number;
  };
  pitchTypeComparison: Array<{
    pitchType: string;
    sideA: PitchTypeSummary | null;
    sideB: PitchTypeSummary | null;
    deltaAvgMiss: number | null;
  }>;
  laneComparison: Array<{
    lane: string;  // "Glove" | "Middle" | "Arm"
    sideA: LaneDetailed | null;
    sideB: LaneDetailed | null;
    deltaAvgMiss: number | null;
    deltaOnTargetPct: number | null;
  }>;
  pitcherHand: string;
  selectionA: PitchSelection;
  selectionB: PitchSelection;
}

// Functions
export function applyPitchSelection(
  pitches: Pitch[],
  selection: PitchSelection,
  excludeOutliers: boolean
): { selected: Pitch[]; outlierCount: number; totalCount: number }

export function buildComparisonReport(
  reportA: Report,
  reportB: Report,
  selectionA: PitchSelection,
  selectionB: PitchSelection
): ComparisonReport

export function parseComparisonQueryParams(
  searchParams: URLSearchParams,
  playerId: string,
  availableOutings: Outing[]
): {
  selectionA: PitchSelection;
  selectionB: PitchSelection;
  excludeOutliers: boolean;
}

export function serializeComparisonQueryParams(
  selectionA: PitchSelection,
  selectionB: PitchSelection,
  excludeOutliers: boolean
): URLSearchParams
```

### Exports Needed from `web/lib/reportModel.ts`

**Add exports (currently private):**

```typescript
export function isOutlier(p: Pitch): boolean
export function laneOf(p: Pitch): string  // Returns "Glove" | "Middle" | "Arm"
export function isOnTarget(p: Pitch): boolean
```

**Keep existing exports:**

• `buildReport()` - no changes

• `Report`, `ReportMeta`, `KPIs`, `PitchTypeSummary`, `LaneDetailed` types

• `ON_TARGET_THRESHOLD_IN`, `OUTLIER_MISS_THRESHOLD_IN` constants

• `laneDisplayName()` function (intentionally static - ignores pitcherHand parameter, returns static labels)

---

## Sequenced Implementation Checklist

### Step 1: Export Required Functions from reportModel.ts

**Files to edit:**

• `web/lib/reportModel.ts`

**Changes:**

• Change `function isOutlier` to `export function isOutlier`

• Change `function laneOf` to `export function laneOf`

• Change `function isOnTarget` to `export function isOnTarget`

**Done when:**

• All three functions are exported

• No TypeScript errors

• Existing report page still works

**Manual test:**

• Navigate to report page, verify it loads and displays correctly

---

### Step 2: Extract useAllPitchData Hook

**Files to create:**

• `web/app/hooks/useAllPitchData.ts`

**Files to edit:**

• `web/app/player/[playerId]/report/page.tsx` (remove inline hook, import from new file)

**Changes:**

• Extract `useAllPitchData` function from report page

• Move `parseCsvText` helper if needed

• Update report page to import from hook file

**Done when:**

• Hook is in separate file

• Report page imports and uses it

• Report page still works

**Manual test:**

• Navigate to report page, verify data loads correctly

---

### Step 3: Create comparisonModel.ts Foundation

**Files to create:**

• `web/lib/comparisonModel.ts`

**Changes:**

• Define `PitchSelection` interface

• Define `ComparisonReport` interface

• Implement `applyPitchSelection()` function (MVP: only handles excludeOutliers, explicitly ignores pitchNumberMin/max, pitchTypes, lanes - these are Phase 2)

• Add placeholder `buildComparisonReport()` (returns empty structure)

**Done when:**

• File exists with types and basic function

• `applyPitchSelection()` filters outliers correctly

• TypeScript compiles

**Manual test:**

• Import and call `applyPitchSelection()` in browser console, verify it works

---

### Step 4: Implement buildComparisonReport()

**Files to edit:**

• `web/lib/comparisonModel.ts`

**Changes:**

• Implement `buildComparisonReport()`:

  - Validate pitcher hand: if both sides have pitches and `pitcherHand` differs, throw error. If either side has 0 pitches, allow comparison (pitcherHand may be undefined).
  - Compute delta summary (A - B for all KPIs)
  - Align pitch types (union of both sides)
  - Align lanes (always ["Glove", "Middle", "Arm"])
  - Return `ComparisonReport`

**Done when:**

• Function computes deltas correctly

• Handles missing pitch types (shows null)

• Handles 0 pitches gracefully (allows comparison)

• Validates pitcher hand correctly (only blocks if both sides have pitches and hands differ)

**Manual test:**

• Create two test reports, call `buildComparisonReport()`, verify output structure

---

### Step 5: Implement Query Param Parsing

**Files to edit:**

• `web/lib/comparisonModel.ts`

**Changes:**

• Implement `parseComparisonQueryParams()`:

  - Parse `outingA`, `outingB` from searchParams
  - Validate against available outings
  - Parse `excludeOutliers` (default: false)
  - Return `PitchSelection` objects and excludeOutliers flag
  - MVP: explicitly ignore and do not process `minA`, `maxA`, `minB`, `maxB`, `typesA`, `typesB`, `lanesA`, `lanesB` (these params may exist in URL but are not used)

• Implement `serializeComparisonQueryParams()`:

  - Convert selections to URLSearchParams
  - Only include non-default values

**Done when:**

• Parsing handles valid params

• Parsing handles missing params (uses defaults)

• Serialization creates correct URL strings

• Invalid outing IDs are handled gracefully

**Manual test:**

• Test with various URL combinations:

  - `/player/JFinkelstein1/compare?outingA=2024_04_27_Finkelstein&outingB=2024_04_14_Finkelstein`
  - `/player/JFinkelstein1/compare?outingA=2024_04_27_Finkelstein` (missing B)
  - `/player/JFinkelstein1/compare` (no params)

---

### Step 6: Create Compare Page Route

**Files to create:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Create client component with `"use client"` directive at the top

• All data loading is client-side (no SSR). Use `useParams()` to get `playerId`

• Use `useSearchParams()` to get query params

• Use `getPlayer()` to load player data (client-side)

• Parse query params using `parseComparisonQueryParams()`

• Load pitches for both sides using `useAllPitchData()` (client-side CSV fetching)

• Basic layout: two columns for Side A and Side B

• Show loading states

• Show error states

**Done when:**

• Page loads at `/player/[playerId]/compare`

• Shows two outing selectors

• Loads data for selected outings

• Shows loading/error states correctly

**Manual test:**

• Navigate to `/player/JFinkelstein1/compare`

• Verify page loads

• Select outings, verify data loads

• Test with invalid playerId (should 404 or show error)

---

### Step 7: Create CompareControls Component

**Files to create:**

• `web/app/components/CompareControls.tsx`

**Changes:**

• Props: `side: "A" | "B"`, `selection: PitchSelection`, `onChange: (selection: PitchSelection) => void`, `availableOutings: Outing[]`, `playerId: string`

• Render outing selector (reuse/adapt `OutingSelect` pattern)

• MVP: Only outing selector (no filters yet)

• Style to match existing UI (zinc colors, small text)

**Done when:**

• Component renders outing dropdown

• Changing selection calls `onChange`

• Matches existing UI style

**Manual test:**

• Render component in compare page

• Change outing, verify `onChange` fires

• Verify dropdown shows correct outings

---

### Step 8: Add Global Exclude Outliers Toggle

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Add checkbox toggle for "Exclude outliers"

• Add state for `excludeOutliers` (default: false)

• Persist to localStorage: `compareExcludeOutliers:${playerId}`

• Load from localStorage on mount

• When toggled, update state and URL param

• Apply to both sides when building reports (implemented in later step)

**Done when:**

• Toggle appears in UI

• Toggle persists to localStorage

• Toggle updates URL

• Toggle state is available for report building

**Manual test:**

• Toggle exclude outliers, verify state updates

• Reload page, verify preference persists

• Share URL with excludeOutliers=true, verify it loads correctly

---

### Step 9: Wire Up Compare Page with Controls

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Add state for `selectionA` and `selectionB`

• Render two `CompareControls` components

• When selection changes, update URL using `router.push()` with serialized params

• Load pitches based on selections

• Apply `excludeOutliers` (from Step 8) when building reports

**Done when:**

• Changing outing in controls updates URL

• URL changes trigger data reload

• Both sides load independently

• Browser back/forward works

**Manual test:**

• Select different outings for A and B

• Verify URL updates

• Use browser back button, verify state restores

• Share URL, verify it loads correct comparison

---

### Step 10: Create CompareKpiRow Component

**Files to create:**

• `web/app/components/CompareKpiRow.tsx`

**Changes:**

• Props: `reportA: Report`, `reportB: Report`, `delta: ComparisonReport["delta"]`

• Display KPI tiles in row: Side A | Side B | Delta

• Metrics: Avg Miss, Median Miss, On Target %, Outlier Count, Included Count

• Format: numbers with 1 decimal, percentages as integers

• Style: match existing KPI card style from report page

**Done when:**

• Component displays all KPIs

• Deltas show correct values (A - B)

• Styling matches report page

• Handles null/undefined gracefully

**Manual test:**

• Render with two reports

• Verify all values display correctly

• Verify deltas compute correctly (manual calculation)

---

### Step 11: Build Reports and Display KPIs

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Use `useMemo` to build reports for both sides:

  - Apply `excludeOutliers` filter to pitches
  - Call `buildReport()` for each side

• Use `useMemo` to build comparison report:

  - Call `buildComparisonReport(reportA, reportB, selectionA, selectionB)`

• Render `CompareKpiRow` with reports and delta

**Done when:**

• Reports build correctly for both sides

• Comparison report builds successfully

• KPI row displays with correct values

• Exclude outliers toggle affects both sides

**Manual test:**

• Toggle exclude outliers, verify both reports update

• Verify KPI values match individual report pages

• Verify deltas are correct

---

### Step 12: Create ComparePitchTypeTable Component

**Files to create:**

• `web/app/components/ComparePitchTypeTable.tsx`

**Changes:**

• Props: `comparison: ComparisonReport["pitchTypeComparison"]`

• Display table with columns: Pitch Type | Count A | Count B | Avg Miss A | Avg Miss B | Δ Avg

• Rows: All pitch types from union of both sides

• Missing types show "—" or 0

• Sort by count (descending) or allow user sort

• Style: match existing table styles

**Done when:**

• Table displays all pitch types

• Shows correct counts and averages

• Shows deltas (A - B)

• Handles missing types gracefully

**Manual test:**

• Compare outings with different pitch types

• Verify all types appear

• Verify missing types show "—"

• Verify deltas are correct

---

### Step 13: Create CompareLaneTable Component

**Files to create:**

• `web/app/components/CompareLaneTable.tsx`

**Changes:**

• Props: `comparison: ComparisonReport["laneComparison"]`, `pitcherHand: string`

• Display table with columns: Lane | Count A | Count B | Avg Miss A | Avg Miss B | On Target % A | On Target % B | Δ Avg | Δ On Target %

• Rows: Always 3 rows (Glove, Middle, Arm) in that order

• Lane labels use `laneDisplayName(lane, pitcherHand)`. Note: `laneDisplayName` is intentionally static (ignores `pitcherHand` parameter) and returns "Glove side", "Arm side", or "Middle". Lane assignment is handled by `laneOf()` which uses hand-normalized `h_miss_signed`. This ensures consistent labels regardless of handedness.

• Style: match existing table styles

**Done when:**

• Table displays all 3 lanes

• Lane labels are correct (Glove side / Arm side / Middle)

• Shows correct counts, averages, percentages

• Shows deltas correctly

• Labels respect handedness

**Manual test:**

• Compare RHP outings, verify lane labels display correctly ("Glove side", "Arm side", "Middle")

• Compare LHP outings, verify labels are consistent (same static labels)

• Verify lane assignment is correct (pitches go to correct lanes based on `h_miss_signed`)

• Verify deltas compute correctly

---

### Step 14: Add Pitch Type and Lane Tables to Compare Page

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Render `ComparePitchTypeTable` with `comparison.pitchTypeComparison`

• Render `CompareLaneTable` with `comparison.laneComparison` and `pitcherHand`

• Add section headers matching report page style

• Layout: tables side-by-side or stacked (propose stacked for readability)

**Done when:**

• Both tables render

• Data displays correctly

• Layout is readable

**Manual test:**

• Verify tables show correct data

• Verify layout works on different screen sizes

---

### Step 15: Add Strike Zone Scatters

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Render two `StrikeZoneScatter` components side-by-side

• Pass filtered pitches (after excludeOutliers) to each component

• Props for each scatter: `pitches: Pitch[]` (filtered), `selected: Pitch | null` (can be null initially), `onSelect: (p: Pitch) => void` (optional handler, can be no-op)

• Add labels: "Side A" and "Side B"

• Ensure outliers are greyed (existing component behavior - component handles this internally)

**Done when:**

• Two scatters render

• Outliers are greyed

• Labels are clear

• Clicking pitches works (if needed)

**Manual test:**

• Verify scatters show correct pitches

• Verify outliers are greyed

• Compare with exclude outliers on/off

---

### Step 16: Add Error Handling and Empty States

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Handle missing player (show 404 or error)

• Handle missing outing (show "Select outing for Side A/B")

• Handle 0 pitches after filtering (show "No pitches available" or "Missing pitcher metadata" if pitcher_hand is missing)

• Handle CSV load errors (show error per side)

• Handle pitcher hand validation:

  - If either side has 0 pitches: do not block comparison, show "Missing pitcher metadata" message
  - If both sides have pitches and `pitcher_hand` differs: block comparison with warning "Cannot compare: Different pitcher handedness detected"
  - Do not prevent comparison of different pitchers with the same hand (this is allowed)

**Done when:**

• All error cases handled

• Error messages are clear

• UI doesn't break on errors

**Manual test:**

• Test with invalid playerId

• Test with missing outingId

• Test with pitcher hand mismatch (if possible) - should show warning and block comparison

• Test with 0 pitches on one side - should show "Missing pitcher metadata" but not block

• Test with 0 pitches (filter all out)

---

### Step 17: Add "Compare" Link from Report Page

**Files to edit:**

• `web/app/player/[playerId]/report/page.tsx`

**Changes:**

• Add "Compare" button/link near report header

• Link to `/player/${playerId}/compare?outingA=${currentOutingId}`

• Style to match existing UI

**Done when:**

• Link appears on report page

• Clicking navigates to compare page with current outing pre-selected

• Link is visible and accessible

**Manual test:**

• Navigate to report page

• Click "Compare" link

• Verify compare page loads with Side A pre-selected

---

### Step 18: Add Loading States and Polish

**Files to edit:**

• `web/app/player/[playerId]/compare/page.tsx`

**Changes:**

• Show loading skeletons/spinners while data loads

• Show per-side loading states

• Add smooth transitions

• Ensure layout doesn't shift during load

**Done when:**

• Loading states are clear

• No layout shift

• Transitions are smooth

**Manual test:**

• Navigate to compare page

• Verify loading states appear

• Verify smooth transition to loaded state

---

## Edge Cases and Safety

### Side A Missing Outing

**Behavior:**

• Show placeholder: "Select outing for Side A"

• Disable comparison until both sides have outings

• Show empty state with instructions

**Implementation:**

• Check `selectionA.outingId === null`

• Show placeholder UI

• Don't load data or build reports

### Side B Missing Outing

**Behavior:**

• Same as Side A

• Independent state management

### Filters Result in 0 Pitches

**Behavior:**

• Show "No pitches match filters" message

• Show filter summary (what was selected)

• Still show the other side's data if it has pitches

• Delta columns show "—" or "N/A"

**Implementation:**

• Check `selectedPitches.length === 0` after filtering

• Show message with filter breakdown

• Build report with empty array (should handle gracefully)

### Pitcher Hand Validation

**Behavior:**

• If either side has 0 pitches: do not block comparison, show "Missing pitcher metadata" message

• If both sides have pitches and `pitcher_hand` differs: block comparison with warning "Cannot compare: Different pitcher handedness detected"

• Do not prevent comparison of different pitchers with the same hand (this is allowed and valid)

**Implementation:**

• In `buildComparisonReport()`, check:

  ```typescript
  // Only validate if both sides have pitches
  if (reportA.meta.pitcherHand && reportB.meta.pitcherHand) {
    if (reportA.meta.pitcherHand !== reportB.meta.pitcherHand) {
      throw new Error("Pitcher hand mismatch");
    }
  }
  // If one side has 0 pitches, pitcherHand may be undefined/null - this is OK
  ```

• Catch error in UI, show warning message and disable comparison

• If one side has 0 pitches, show informational message but allow comparison to proceed

### Missing Required Columns in CSV

**Behavior:**

• Validate required fields: `pitch_number`, `total_miss_inches`, `h_miss_signed`, `pitcher_hand`

• Skip pitches with missing required fields

• Show warning: "Skipped X pitches with missing data"

**Implementation:**

• Filter pitches before processing:

  ```typescript
  const validPitches = pitches.filter(p => 
    p.pitch_number != null &&
    p.total_miss_inches != null &&
    p.h_miss_signed != null &&
    p.pitcher_hand != null
  );
  ```

### Large Pitch Counts Performance

**Optimization:**

• Use `useMemo` for expensive computations (already planned)

• Filter pitches early (before building reports)

• Consider virtualizing tables if > 100 pitches (Phase 2)

• Lazy load pitch tables (collapsed by default, Phase 2)

**Implementation:**

• All `useMemo` dependencies are correct

• Filtering happens before report building

• No unnecessary re-renders

---

## Tests Plan

### No Test Infrastructure Exists

**Approach:** Manual testing + pure function validation

### Pure Function Validation

**Create validation script:** `web/scripts/validate-comparison.ts` (optional, not required for MVP)

**Test cases:**

1. `applyPitchSelection()` with various filters
2. `buildComparisonReport()` with matching pitcher hands
3. `buildComparisonReport()` with mismatched pitcher hands (should error)
4. `parseComparisonQueryParams()` with various URL combinations
5. Delta computations (manual verification)

### Manual Test Matrix

**Test Scenarios:**

1. **Basic Comparison:**

• Navigate to `/player/JFinkelstein1/compare?outingA=2024_04_27_Finkelstein&outingB=2024_04_14_Finkelstein`

• Verify both sides load

• Verify KPIs display

• Verify tables display

• Verify scatters display

2. **Missing Outing:**

• Navigate with only `outingA`

• Verify Side B shows placeholder

• Select outing for Side B

• Verify comparison builds

3. **Exclude Outliers:**

• Toggle exclude outliers

• Verify both reports update

• Verify outlier counts change

• Verify percentages update

4. **URL Sharing:**

• Create comparison

• Copy URL

• Open in new tab

• Verify comparison loads correctly

5. **Lane Labels:**

• Compare RHP outings, verify lane labels display correctly ("Glove side", "Arm side", "Middle")

• Compare LHP outings (if available), verify labels are consistent (same static labels)

• Verify lane assignment is correct (pitches go to correct lanes based on `h_miss_signed`)

• Note: `laneDisplayName` is intentionally static, so labels don't change with handedness

6. **Pitcher Hand Validation:**

• Test with 0 pitches on one side - should show "Missing pitcher metadata" but not block comparison

• Test with different pitcher handedness (if possible) - should show warning "Cannot compare: Different pitcher handedness detected" and block comparison

• Test with different pitchers but same hand - should allow comparison (this is valid)

7. **Empty States:**

• Navigate with no params

• Verify placeholders appear

• Select outings, verify data loads

---

## Phase 2 Enhancements

1. **Pitch Number Ranges:**

• Add `minA`, `maxA`, `minB`, `maxB` inputs to `CompareControls`

• Update `applyPitchSelection()` to filter by range

• Update query param parsing/serialization

2. **Pitch Type Filters:**

• Add multi-select checkboxes for pitch types

• Update `applyPitchSelection()` to filter by types

• Update query param handling

3. **Lane Filters:**

• Add multi-select checkboxes for lanes (with proper labels)

• Update `applyPitchSelection()` to filter by lanes

• Update query param handling

4. **Percent Change Columns:**

• Add percent change to KPI row

• Add percent change to pitch type table

• Add percent change to lane table

• Handle null cases (division by zero)

5. **Pitch Tables:**

• Add two `PitchTable` components (collapsible)

• Collapsed by default

• Show outliers greyed

6. **Enhanced Visualizations:**

• Overlay scatter plot (both sides on one plot)

• Animated transitions

• Export as image/PDF

7. **Inning-Based Filtering:**

• Load `pitch_log.json` to determine inning boundaries

• Add inning selector

• Filter by inning number

8. **Performance:**

• Virtual scrolling for large tables

• Lazy loading

• Web Workers for heavy computations