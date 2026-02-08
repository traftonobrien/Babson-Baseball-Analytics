# Approval Gate for Documentation Updates - Corrected Implementation Plan

## 1. Update scripts/update_docs.py

### New Function Signature

Replace `update_claude_md()` with:

```python
def generate_proposed_content(
    output_path: Optional[Path] = None,
    full: bool = False
) -> Tuple[bool, Dict[str, str]]:
    """
    Generate proposed documentation content.
    
    Args:
        output_path: If None, return content as string. If Path, write to that path.
        full: Force full update ignoring git diff.
    
    Returns:
        Tuple of (has_changes: bool, updated_sections: Dict[section_id, title])
        has_changes: True if any sections would be updated
        updated_sections: dict mapping section_id to section title
    """
```

### New CLI Arguments

#### `--propose` (default mode)
**Behavior:**
- If no mode flag specified, default to `--propose`
- Generates `claude.md.proposed` with proposed changes
- Does NOT modify `claude.md`
- If changes exist: writes proposal file, prints summary, exits 0
- If no changes exist: removes proposal file if it exists, prints "No documentation changes needed.", exits 0
- Can be combined with `--full` to force full update
- Can be combined with `--no-build` (build check skipped in propose mode)

**Exit code:** Always 0

**Output when changes exist:**
```
Documentation updates available for 2 section(s):
  • Outlier System
  • On Target Definition

Proposed changes written to: claude.md.proposed
Review with: python3 scripts/update_docs.py --diff
Apply with: python3 scripts/update_docs.py --apply
```

**Output when no changes:**
```
No documentation changes needed.
```

**Proposal file lifecycle:**
- If changes exist: overwrites `claude.md.proposed` (creates if missing)
- If no changes: removes `claude.md.proposed` if it exists

#### `--diff`
**Behavior:**
- If `claude.md.proposed` doesn't exist, generates it first (calls `generate_proposed_content()`)
- Prints unified diff between `claude.md` and `claude.md.proposed` to stdout
- Uses Python's `difflib.unified_diff()` for clean output
- Does NOT apply changes
- Does NOT modify any files
- Does NOT delete proposal file

**Exit code:** 0 on success, 1 on error

**Output:**
```
--- claude.md
+++ claude.md.proposed
@@ -455,6 +455,8 @@
 ## Outlier System
 
-The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **20 inches**.
+The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **25 inches**.
 
 A pitch is considered an outlier if `total_miss_inches > OUTLIER_MISS_THRESHOLD_IN`.
```

#### `--apply`
**Behavior:**
- If `claude.md.proposed` exists, uses it (doesn't regenerate)
- If `claude.md.proposed` doesn't exist, generates it first
- Reads `claude.md.proposed` and writes to `claude.md`
- Removes `claude.md.proposed` after successful write
- Prints summary of applied sections
- Runs build check unless `--no-build` is specified
- If build check fails, changes are still written (user can fix)

**Exit code:** 0 on success, 1 on error

**Output:**
```
Applied documentation changes to claude.md
Updated sections:
  • Outlier System
  • On Target Definition

Running build check...
Build check passed.
```

**Proposal file lifecycle:**
- Always deletes `claude.md.proposed` after successful write to `claude.md`
- If write fails, proposal file remains

#### `--check`
**Behavior:**
- Checks if `claude.md.proposed` exists
- If exists, compares with `claude.md` using file content comparison
- Prints "Changes exist" if files differ
- Prints "No changes" if files are identical or proposal doesn't exist
- If proposal exists but matches current, removes proposal file (cleanup)
- Always exits 0 (non-blocking)

**Exit code:** Always 0

**Output:**
```
Changes exist
```
or
```
No changes
```

**Proposal file lifecycle:**
- If proposal exists and matches current: removes proposal file
- If proposal exists and differs: leaves proposal file
- If proposal doesn't exist: no action

#### `--dry-run` (deprecated)
**Behavior:**
- Prints deprecation warning: "Warning: --dry-run is deprecated. Use --propose instead."
- Maps to `--propose` mode
- Executes as `--propose`

**Exit code:** Always 0 (same as `--propose`)

#### `--full`
**Behavior:**
- Works with all modes (`--propose --full`, `--apply --full`, etc.)
- Forces full update ignoring git diff
- All sections are regenerated regardless of file changes

#### `--no-build`
**Behavior:**
- Skips build check in `--apply` mode
- Ignored in other modes (no build check needed)
- Can be combined with any mode

### Modified main() Function

```python
def main():
    parser = argparse.ArgumentParser(description="Update claude.md documentation")
    parser.add_argument("--propose", action="store_true", help="Generate proposal file (default)")
    parser.add_argument("--diff", action="store_true", help="Show diff between current and proposed")
    parser.add_argument("--apply", action="store_true", help="Apply proposed changes")
    parser.add_argument("--check", action="store_true", help="Check if changes exist")
    parser.add_argument("--dry-run", action="store_true", help="[DEPRECATED] Use --propose instead")
    parser.add_argument("--full", action="store_true", help="Force full update (ignore git diff)")
    parser.add_argument("--no-build", action="store_true", help="Skip build check")
    args = parser.parse_args()
    
    # Mode priority
    if args.apply:
        mode = "apply"
    elif args.diff:
        mode = "diff"
    elif args.check:
        mode = "check"
    elif args.dry_run:
        mode = "propose"  # with deprecation warning
    else:
        mode = "propose"  # default
    
    # Handle deprecation
    if args.dry_run:
        print("Warning: --dry-run is deprecated. Use --propose instead.", file=sys.stderr)
    
    # Execute mode
    if mode == "propose":
        proposed_path = REPO_ROOT / "claude.md.proposed"
        has_changes, updated_sections = generate_proposed_content(
            output_path=proposed_path,
            full=args.full
        )
        if has_changes:
            print_summary(updated_sections)
            print(f"\nProposed changes written to: claude.md.proposed")
            print("Review with: python3 scripts/update_docs.py --diff")
            print("Apply with: python3 scripts/update_docs.py --apply")
        else:
            # Remove proposal if no changes
            proposed_path.unlink(missing_ok=True)
            print("No documentation changes needed.")
        sys.exit(0)
    
    elif mode == "diff":
        proposed_path = REPO_ROOT / "claude.md.proposed"
        if not proposed_path.exists():
            # Generate proposal first
            generate_proposed_content(output_path=proposed_path, full=args.full)
        print_diff(REPO_ROOT / "claude.md", proposed_path)
        sys.exit(0)
    
    elif mode == "apply":
        proposed_path = REPO_ROOT / "claude.md.proposed"
        if not proposed_path.exists():
            # Generate proposal first
            generate_proposed_content(output_path=proposed_path, full=args.full)
        
        # Read proposed, write to actual
        with open(proposed_path) as f:
            proposed_content = f.read()
        with open(REPO_ROOT / "claude.md", "w") as f:
            f.write(proposed_content)
        
        # Get updated sections for summary
        _, updated_sections = generate_proposed_content(output_path=None, full=args.full)
        
        # Remove proposal file
        proposed_path.unlink()
        
        print("Applied documentation changes to claude.md")
        if updated_sections:
            print("Updated sections:")
            for section_id, title in sorted(updated_sections.items()):
                print(f"  • {title}")
        
        # Build check
        if not args.no_build:
            print("\nRunning build check...")
            try:
                subprocess.run(
                    ["npm", "--prefix", "web", "run", "build"],
                    cwd=REPO_ROOT,
                    check=True,
                )
                print("Build check passed.")
            except subprocess.CalledProcessError:
                print("ERROR: Build check failed. Fix errors before committing.", file=sys.stderr)
                sys.exit(1)
        
        sys.exit(0)
    
    elif mode == "check":
        proposed_path = REPO_ROOT / "claude.md.proposed"
        if proposed_path.exists():
            # Compare files
            with open(REPO_ROOT / "claude.md") as f:
                current = f.read()
            with open(proposed_path) as f:
                proposed = f.read()
            if current != proposed:
                print("Changes exist")
            else:
                print("No changes")
                proposed_path.unlink(missing_ok=True)
        else:
            print("No changes")
        sys.exit(0)
```

### New Helper Functions

```python
def print_summary(updated_sections: Dict[str, str]) -> None:
    """Print concise summary of sections that would change."""
    if not updated_sections:
        return
    print(f"Documentation updates available for {len(updated_sections)} section(s):")
    for section_id, title in sorted(updated_sections.items()):
        print(f"  • {title}")

def print_diff(current_path: Path, proposed_path: Path) -> None:
    """Print unified diff between current and proposed claude.md."""
    import difflib
    with open(current_path) as f:
        current_lines = f.readlines()
    with open(proposed_path) as f:
        proposed_lines = f.readlines()
    
    diff = difflib.unified_diff(
        current_lines,
        proposed_lines,
        fromfile=str(current_path),
        tofile=str(proposed_path),
        lineterm=''
    )
    for line in diff:
        print(line)
```

---

## 2. Proposal File Behavior Summary

| Mode | When Proposal Exists | When Proposal Missing | Proposal File After |
|------|---------------------|----------------------|-------------------|
| `--propose` (changes) | Overwrites | Creates | Created/overwritten |
| `--propose` (no changes) | Removes | No action | Removed/not created |
| `--diff` | Uses existing | Generates | Preserved |
| `--apply` | Uses existing | Generates | Deleted after write |
| `--check` (differs) | Compares | No action | Preserved |
| `--check` (matches) | Compares | No action | Removed |

---

## 3. Pre-Commit Hook Behavior

### File: `.githooks/pre-commit`

**Complete implementation:**

```bash
#!/bin/bash
# Pre-commit hook to propose documentation updates

# DO NOT use set -e - we want to continue on errors

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT="$REPO_ROOT/scripts/update_docs.py"
PROPOSED="$REPO_ROOT/claude.md.proposed"
CURRENT="$REPO_ROOT/claude.md"

# Step 1: Generate proposal (suppress errors, never block)
if [ -f "$SCRIPT" ]; then
    python3 "$SCRIPT" --propose --no-build 2>/dev/null || true
fi

# Step 2: Check if proposal exists and differs from current
if [ -f "$PROPOSED" ]; then
    # Use cmp -s to check if files are identical
    # cmp -s returns 0 if files are identical, 1 if different
    if ! cmp -s "$CURRENT" "$PROPOSED" 2>/dev/null; then
        # Files differ - changes exist
        
        # Print header
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "📝 Documentation updates available"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        # Print short diff preview (~60 lines)
        python3 "$SCRIPT" --diff 2>/dev/null | head -60 || true
        
        echo ""
        echo "Full diff: python3 scripts/update_docs.py --diff"
        echo "Proposed file: claude.md.proposed"
        echo ""
        
        # Step 3: Interactive vs non-interactive
        if [ -t 0 ] && [ -t 1 ]; then
            # INTERACTIVE PATH (TTY present)
            echo "Apply these documentation changes? [y/N]: "
            read -r response
            case "$response" in
                [yY][eE][sS]|[yY])
                    # User approved
                    python3 "$SCRIPT" --apply --no-build 2>/dev/null || true
                    git add "$CURRENT" 2>/dev/null || true
                    rm -f "$PROPOSED"
                    echo "✓ Documentation changes applied and staged"
                    ;;
                *)
                    # User declined or no input
                    echo "Documentation changes not applied. Review claude.md.proposed manually."
                    ;;
            esac
        else
            # NON-INTERACTIVE PATH (no TTY)
            echo "Non-interactive mode: Documentation changes proposed but not applied."
            echo "Review: python3 scripts/update_docs.py --diff"
            echo "Apply: python3 scripts/update_docs.py --apply"
            # Leave proposal file for manual review
        fi
    else
        # Proposal exists but matches current - clean up
        rm -f "$PROPOSED"
    fi
fi

# Always exit 0 - never block commit
exit 0
```

### Key Implementation Details

1. **No `set -e`**: Hook continues on errors
2. **Error suppression**: All commands use `|| true` or `2>/dev/null`
3. **Comparison method**: Uses `cmp -s` to check file differences
4. **Diff preview**: Uses `head -60` to limit output to ~60 lines
5. **TTY detection**: `[ -t 0 ] && [ -t 1 ]` checks stdin and stdout
6. **Always exits 0**: Commit never blocked

---

## 4. .gitignore Changes

### Addition Required

Add to `.gitignore` (at end of file):

```
# Documentation proposals
claude.md.proposed
```

### Location

Add after line 56 (after `*.npz`), in a new section or at the end.

---

## 5. claude.md Changes

### Location

Add new subsection in "Maintenance and Publishing" section, after the AUTO-UPDATE markers (after line 462) and before "Known Issues / Mismatches" (before line 464).

### Exact Content to Add

```markdown
### Docs Update Workflow

The documentation update system automatically proposes changes when relevant code files are modified.

#### Automatic Proposal on Commit

When you commit code changes, the pre-commit hook:

1. Detects if any files that affect documentation have changed
2. Generates a proposed update in `claude.md.proposed`
3. Shows a summary and diff preview of proposed changes
4. In interactive mode (terminal), prompts for approval:
   • Type `y` or `yes` to apply and stage changes
   • Type `n` or press Enter to skip (commit proceeds without changes)
5. In non-interactive mode (CI), leaves the proposal file for manual review

#### Manual Review and Application

To review proposed changes:

```bash
# View the diff
python3 scripts/update_docs.py --diff

# Apply the changes
python3 scripts/update_docs.py --apply
```

#### Manual Proposal Generation

To generate a proposal without committing:

```bash
# Generate proposal (default mode)
python3 scripts/update_docs.py --propose

# Force full update (ignore git diff)
python3 scripts/update_docs.py --propose --full
```

#### Checking for Changes

To check if documentation updates are available:

```bash
python3 scripts/update_docs.py --check
```

This prints "Changes exist" or "No changes" and always exits successfully.
```

### Formatting Notes

• Uses numbered steps (1-5) for the commit flow
• Uses • bullets for sub-items
• No hyphen bullets anywhere
• Code blocks use triple backticks with language specification
• Consistent with existing claude.md style

---

## 6. Acceptance Test Checklist

### Test 1: `--propose` with No Changes

**Setup:**
- Ensure no code changes that would trigger doc updates
- Remove `claude.md.proposed` if it exists

**Steps:**
1. Run: `python3 scripts/update_docs.py --propose`
2. Verify output: "No documentation changes needed."
3. Verify exit code: 0
4. Verify `claude.md.proposed` does not exist

**Expected Result:** ✓ Proposal not created, exits 0

---

### Test 2: `--propose` with Changes

**Setup:**
- Make a code change that triggers doc updates (e.g., change `OUTLIER_MISS_THRESHOLD_IN` in `reportModel.ts`)
- Remove `claude.md.proposed` if it exists

**Steps:**
1. Run: `python3 scripts/update_docs.py --propose`
2. Verify output contains: "Documentation updates available for X section(s)"
3. Verify output contains section names with • bullets
4. Verify output contains: "Proposed changes written to: claude.md.proposed"
5. Verify exit code: 0
6. Verify `claude.md.proposed` exists
7. Verify `claude.md` is unchanged

**Expected Result:** ✓ Proposal created, `claude.md` unchanged, exits 0

---

### Test 3: `--diff` Prints Correctly

**Setup:**
- Ensure `claude.md.proposed` exists (from Test 2)

**Steps:**
1. Run: `python3 scripts/update_docs.py --diff`
2. Verify output shows unified diff format
3. Verify output shows `--- claude.md` and `+++ claude.md.proposed`
4. Verify exit code: 0
5. Verify `claude.md.proposed` still exists (not deleted)

**Expected Result:** ✓ Diff printed, proposal file preserved

---

### Test 4: `--diff` Generates Proposal If Missing

**Setup:**
- Remove `claude.md.proposed`
- Ensure code changes exist that would trigger updates

**Steps:**
1. Run: `python3 scripts/update_docs.py --diff`
2. Verify proposal file is created
3. Verify diff is printed
4. Verify exit code: 0
5. Verify `claude.md.proposed` exists after command

**Expected Result:** ✓ Proposal auto-generated, diff shown, file preserved

---

### Test 5: `--apply` Works and Removes Proposal

**Setup:**
- Ensure `claude.md.proposed` exists with changes
- Note the content of `claude.md` before

**Steps:**
1. Run: `python3 scripts/update_docs.py --apply --no-build`
2. Verify output: "Applied documentation changes to claude.md"
3. Verify output shows updated sections with • bullets
4. Verify exit code: 0
5. Verify `claude.md` contains the proposed changes
6. Verify `claude.md.proposed` does not exist (removed)
7. Verify `claude.md` matches what was in proposal

**Expected Result:** ✓ Changes applied, proposal removed, `claude.md` updated

---

### Test 6: `--apply` Generates Proposal If Missing

**Setup:**
- Remove `claude.md.proposed`
- Ensure code changes exist that would trigger updates

**Steps:**
1. Run: `python3 scripts/update_docs.py --apply --no-build`
2. Verify proposal is generated first
3. Verify changes are applied to `claude.md`
4. Verify `claude.md.proposed` is removed after apply
5. Verify exit code: 0

**Expected Result:** ✓ Proposal auto-generated, changes applied, file removed

---

### Test 7: Hook Interactive - Approve

**Setup:**
- Make code change that triggers doc updates
- Ensure hook is installed: `./scripts/install_hooks.sh`
- Ensure TTY is present (running in terminal)

**Steps:**
1. Stage code changes: `git add <changed_file>`
2. Run: `git commit -m "Test commit"`
3. Verify hook shows diff preview (~60 lines)
4. Verify prompt: "Apply these documentation changes? [y/N]: "
5. Type `y` and press Enter
6. Verify output: "✓ Documentation changes applied and staged"
7. Verify commit succeeds
8. Verify `claude.md` is staged: `git status` shows `claude.md` staged
9. Verify `claude.md.proposed` does not exist

**Expected Result:** ✓ Changes applied, staged, proposal removed, commit succeeds

---

### Test 8: Hook Interactive - Decline

**Setup:**
- Make code change that triggers doc updates
- Ensure hook is installed
- Ensure TTY is present

**Steps:**
1. Stage code changes: `git add <changed_file>`
2. Run: `git commit -m "Test commit"`
3. Verify hook shows diff preview
4. Verify prompt appears
5. Type `n` and press Enter (or just press Enter)
6. Verify output: "Documentation changes not applied. Review claude.md.proposed manually."
7. Verify commit succeeds
8. Verify `claude.md` is NOT staged: `git status` does not show `claude.md` staged
9. Verify `claude.md.proposed` exists (left for review)
10. Verify `claude.md` is unchanged

**Expected Result:** ✓ Changes not applied, proposal preserved, commit succeeds

---

### Test 9: Hook Non-Interactive

**Setup:**
- Make code change that triggers doc updates
- Ensure hook is installed
- Simulate non-interactive: redirect stdin from `/dev/null` or use `git commit` in script

**Steps:**
1. Stage code changes: `git add <changed_file>`
2. Run: `git commit -m "Test commit" < /dev/null` (or in CI script)
3. Verify hook shows diff preview
4. Verify output: "Non-interactive mode: Documentation changes proposed but not applied."
5. Verify instructions are printed
6. Verify commit succeeds
7. Verify `claude.md` is NOT staged
8. Verify `claude.md.proposed` exists

**Expected Result:** ✓ Changes not applied, proposal preserved, instructions shown, commit succeeds

---

### Test 10: Hook - No Changes

**Setup:**
- Make code change that does NOT trigger doc updates (e.g., unrelated file)
- Ensure hook is installed

**Steps:**
1. Stage code changes: `git add <unrelated_file>`
2. Run: `git commit -m "Test commit"`
3. Verify no hook output (runs silently)
4. Verify commit succeeds
5. Verify `claude.md.proposed` does not exist

**Expected Result:** ✓ Hook runs silently, no proposal, commit succeeds

---

### Test 11: `--check` Detects Changes

**Setup:**
- Ensure `claude.md.proposed` exists and differs from `claude.md`

**Steps:**
1. Run: `python3 scripts/update_docs.py --check`
2. Verify output: "Changes exist"
3. Verify exit code: 0
4. Verify `claude.md.proposed` still exists (not deleted)

**Expected Result:** ✓ Changes detected, file preserved, exits 0

---

### Test 12: `--check` Detects No Changes (Matches Current)

**Setup:**
- Manually copy `claude.md` to `claude.md.proposed` (they match)

**Steps:**
1. Run: `python3 scripts/update_docs.py --check`
2. Verify output: "No changes"
3. Verify exit code: 0
4. Verify `claude.md.proposed` is removed (cleanup)

**Expected Result:** ✓ No changes detected, file removed, exits 0

---

### Test 13: `--check` When Proposal Missing

**Setup:**
- Remove `claude.md.proposed`

**Steps:**
1. Run: `python3 scripts/update_docs.py --check`
2. Verify output: "No changes"
3. Verify exit code: 0

**Expected Result:** ✓ No changes reported, exits 0

---

### Test 14: Proposal Matches Current - Cleanup in Hook

**Setup:**
- Manually copy `claude.md` to `claude.md.proposed` (they match)
- Make a code change that would trigger updates

**Steps:**
1. Stage code changes: `git add <changed_file>`
2. Run: `git commit -m "Test commit"`
3. Verify hook runs `--propose` which regenerates proposal
4. Verify hook detects proposal differs from current (after regeneration)
5. Verify hook shows diff and prompts (or leaves proposal in non-interactive)
6. Verify commit succeeds

**Expected Result:** ✓ Proposal regenerated, hook processes normally

---

### Test 15: `--dry-run` Deprecation Warning

**Setup:**
- Any state

**Steps:**
1. Run: `python3 scripts/update_docs.py --dry-run`
2. Verify stderr contains: "Warning: --dry-run is deprecated. Use --propose instead."
3. Verify behavior matches `--propose` mode
4. Verify exit code: 0

**Expected Result:** ✓ Warning shown, behaves as `--propose`, exits 0

---

### Test 16: Hook Never Blocks Commit (Error Handling)

**Setup:**
- Temporarily break `update_docs.py` (e.g., syntax error)

**Steps:**
1. Make code change and stage: `git add <file>`
2. Run: `git commit -m "Test commit"`
3. Verify commit succeeds (does not fail)
4. Verify no error output shown to user

**Expected Result:** ✓ Commit succeeds even if script fails

---

## Summary

This plan implements an approval gate where:
• Documentation updates are proposed in `claude.md.proposed`
• Users see diffs and explicitly approve before changes are staged
• Non-interactive environments never auto-apply
• Commits are never blocked (hook always exits 0)
• Proposal file lifecycle is clearly defined
• All edge cases are handled gracefully
• Backward compatibility maintained via `--dry-run` mapping
