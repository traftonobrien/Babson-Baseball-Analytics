# Codex Workflow

## Required Execution Sequence
STEP 1: Restate goal in one sentence.  
STEP 2: Define measurable acceptance criteria.  
STEP 3: Identify only relevant files.  
STEP 4: Inspect exact functions to modify.  
STEP 5: Make minimal patch.  
STEP 6: Run targeted tests.  
STEP 7: Run full test suite.  
STEP 8: Run real pipeline if applicable.  
STEP 9: Self-audit.  
STEP 10: Stop.

## Hard Prohibitions
- Massive rewrites
- Unnecessary file scanning
- Duplicated helpers
- Shadow logic
- Silent schema changes

## Workflow Enforcement Notes
- Keep edits surgical, reversible, and scoped to the stated goal.
- Prefer existing module contracts; do not create parallel implementations.
- Verification is mandatory; unverified changes are incomplete changes.
