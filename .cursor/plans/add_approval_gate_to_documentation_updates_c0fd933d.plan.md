---
name: Add approval gate to documentation updates
overview: Add an approval gate system to the documentation update workflow so changes are proposed and reviewed before being applied, with TTY detection for interactive vs non-interactive environments.
todos: []
---

# Approval Gate for Documentation Updates - Implementation Plan

## Overview

Add an approval gate system that proposes documentation changes, shows diffs, and requires explicit user approval before applying. The system must work in both interactive (TTY) and non-interactive (CI) environments.

## Files to Modify

1. **scripts/update_docs.py** - Add new modes and proposal system
2. **.githooks/pre-commit** - Replace auto-apply with approval flow
3. **claude.md** - Add "Docs Update Workflow" subsection

## Detailed Changes

### 1. scripts/update_docs.py

#### New CLI Arguments

Add the following arguments (mutually exclusive with existing ones):

- `--propose` (default mode if no other mode specified)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Generates `claude.md.proposed` with proposed changes
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Does NOT modify `claude.md`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Prints summary of sections that would change
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Returns exit code 0 if changes exist, 1 if no changes

- `--apply`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Reads `claude.md.proposed` (or generates it if missing)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Writes changes to `claude.md`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Removes `claude.md.proposed` after successful write
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Prints summary of applied sections

- `--diff`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Generates proposal (if `claude.md.proposed` doesn't exist)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Prints unified diff between `claude.md` and `claude.md.proposed` to stdout
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Uses `difflib.unified_diff()` for clean output
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Exits after printing (does not apply)

- `--check`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Checks if `claude.md.proposed` exists and differs from `claude.md`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Prints "Changes exist" or "No changes"
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Always exits 0 (non-blocking)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Used by hook to detect if approval is needed

#### Modified Functions

**`update_claude_md()` function:**

- Rename to `generate_proposed_content()` or keep name but change behavior
- Add parameter: `output_path: Optional[Path] = None`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If `None`: return content as string (for comparison)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If `Path`: write to that path (for `--propose`)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - If `REPO_ROOT / "claude.md"`: write to actual file (for `--apply`)
- Return tuple: `(bool has_changes, Dict[str, str] updated_sections)`
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `has_changes`: True if any sections would be updated
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `updated_sections`: dict mapping section_id to section title

**New function: `print_summary()`:**

```python
def print_summary(updated_sections: Dict[str, str]) -> None:
    """Print concise summary of sections that would change."""
    if not updated_sections:
        print("No documentation changes needed.")
        return
    print(f"Documentation updates available for {len(updated_sections)} section(s):")
    for section_id, title in sorted(updated_sections.items()):
        print(f"  • {title}")
```

**New function: `print_diff()`:**

```python
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

**Modified `main()` function:**

- Parse new arguments: `--propose`, `--apply`, `--diff`, `--check`
- Keep existing: `--dry-run`, `--full`, `--no-build` (for backward compatibility)
- Mode priority:

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                1. If `--apply`: apply mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                2. If `--diff`: diff mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                3. If `--check`: check mode
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                4. If `--dry-run`: old dry-run behavior (deprecated, maps to propose)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                5. Default: propose mode

- **Propose mode flow:**
  ```python
  if args.propose or (not any([args.apply, args.diff, args.check, args.dry_run])):
      has_changes, updated_sections = generate_proposed_content(
          output_path=REPO_ROOT / "claude.md.proposed",
          full=args.full
      )
      print_summary(updated_sections)
      if has_changes:
          print(f"\nProposed changes written to: claude.md.proposed")
          print("Review with: python3 scripts/update_docs.py --diff")
          print("Apply with: python3 scripts/update_docs.py --apply")
          sys.exit(0)
      else:
          # Clean up empty proposal file
          (REPO_ROOT / "claude.md.proposed").unlink(missing_ok=True)
          sys.exit(1)
  ```

- **Apply mode flow:**
  ```python
  if args.apply:
      proposed_path = REPO_ROOT / "claude.md.proposed"
      if not proposed_path.exists():
          # Generate proposal first
          generate_proposed_content(output_path=proposed_path, full=args.full)
      
      # Read proposed, write to actual
      with open(proposed_path) as f:
        proposed_content = f.read()
      with open(REPO_ROOT / "claude.md", "w") as f:
        f.write(proposed_content)
      
      # Remove proposal file
      proposed_path.unlink()
      print("Applied documentation changes to claude.md")
      sys.exit(0)
  ```

- **Diff mode flow:**
  ```python
  if args.diff:
      proposed_path = REPO_ROOT / "claude.md.proposed"
      if not proposed_path.exists():
          generate_proposed_content(output_path=proposed_path, full=args.full)
      print_diff(REPO_ROOT / "claude.md", proposed_path)
      sys.exit(0)
  ```

- **Check mode flow:**
  ```python
  if args.check:
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


#### Edge Cases

1. **Proposal file already exists:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `--propose`: Regenerate (overwrite existing)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `--apply`: Use existing proposal (don't regenerate)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `--diff`: Use existing proposal if present

2. **No changes detected:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Remove `claude.md.proposed` if it exists
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Exit with code 1 in propose mode (hook can check this)

3. **Build check:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Only run build check in `--apply` mode (after changes are written)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Skip in propose/diff/check modes

4. **Backward compatibility:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `--dry-run` maps to `--propose` but prints deprecation warning
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Old behavior (auto-apply) removed from default

### 2. .githooks/pre-commit

#### New Behavior

```bash
#!/bin/bash
# Pre-commit hook to propose documentation updates

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
SCRIPT="$REPO_ROOT/scripts/update_docs.py"
PROPOSED="$REPO_ROOT/claude.md.proposed"

# Generate proposal (non-blocking)
if [ -f "$SCRIPT" ]; then
    python3 "$SCRIPT" --propose --no-build 2>/dev/null || PROPOSAL_EXIT=$?
    
    # Check if proposal file exists and differs
    if [ -f "$PROPOSED" ]; then
        if ! git diff --quiet "$REPO_ROOT/claude.md" "$PROPOSED" 2>/dev/null; then
            # Changes exist - need approval
            
            # Print summary
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "📝 Documentation updates available"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            python3 "$SCRIPT" --diff | head -50
            echo ""
            echo "Full diff: python3 scripts/update_docs.py --diff"
            echo "Proposed file: claude.md.proposed"
            echo ""
            
            # Interactive approval (only if TTY)
            if [ -t 0 ] && [ -t 1 ]; then
                echo "Apply these documentation changes? [y/N]: "
                read -r response
                case "$response" in
                    [yY][eE][sS]|[yY])
                        python3 "$SCRIPT" --apply --no-build
                        git add "$REPO_ROOT/claude.md"
                        rm -f "$PROPOSED"
                        echo "✓ Documentation changes applied and staged"
                        ;;
                    *)
                        echo "Documentation changes not applied. Review claude.md.proposed manually."
                        ;;
                esac
            else
                # Non-interactive: just inform
                echo "Non-interactive mode: Documentation changes proposed but not applied."
                echo "Review: python3 scripts/update_docs.py --diff"
                echo "Apply: python3 scripts/update_docs.py --apply"
            fi
        else
            # Proposal exists but matches current - clean up
            rm -f "$PROPOSED"
        fi
    fi
fi

exit 0
```

#### Key Features

1. **TTY Detection:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `[ -t 0 ] && [ -t 1 ]` checks for stdin and stdout TTY
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Only prompts for approval if both are TTYs

2. **Non-blocking:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Always exits 0 (commit proceeds regardless)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Never blocks the commit

3. **Cleanup:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Removes `claude.md.proposed` after successful apply
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Removes if no changes detected

4. **Error Handling:**

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - `2>/dev/null` suppresses stderr from proposal generation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                - Continues even if proposal generation fails

### 3. claude.md

#### New Subsection

Add to "Maintenance and Publishing" section (after the auto-update markers):

````markdown
### Docs Update Workflow

The documentation update system automatically proposes changes when relevant code files are modified.

#### Automatic Proposal on Commit

When you commit code changes, the pre-commit hook:

1. Detects if any files that affect documentation have changed
2. Generates a proposed update in `claude.md.proposed`
3. Shows a summary and diff of proposed changes
4. In interactive mode (terminal), prompts for approval:
   - Type `y` or `yes` to apply and stage changes
   - Type `n` or press Enter to skip (commit proceeds without changes)
5. In non-interactive mode (CI), leaves the proposal file for manual review

#### Manual Review and Application

To review proposed changes:

```bash
# View the diff
python3 scripts/update_docs.py --diff

# Apply the changes
python3 scripts/update_docs.py --apply
````

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

## Example Terminal Output

### Interactive Mode (TTY Present)

```

$ git commit -m "Update outlier threshold"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Documentation updates available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

--- claude.md

+++ claude.md.proposed

@@ -455,6 +455,8 @@

## Outlier System

-The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **20 inches**.

+The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **25 inches**.

A pitch is considered an outlier if `total_miss_inches > OUTLIER_MISS_THRESHOLD_IN`.

Full diff: python3 scripts/update_docs.py --diff

Proposed file: claude.md.proposed

Apply these documentation changes? [y/N]: y

✓ Documentation changes applied and staged

[main abc1234] Update outlier threshold

2 files changed, 15 insertions(+), 5 deletions(-)

```

### Non-Interactive Mode (No TTY)

```

$ git commit -m "Update outlier threshold"  # in CI or script

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 Documentation updates available

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

--- claude.md

+++ claude.md.proposed

[... diff ...]

Non-interactive mode: Documentation changes proposed but not applied.

Review: python3 scripts/update_docs.py --diff

Apply: python3 scripts/update_docs.py --apply

[main abc1234] Update outlier threshold

1 file changed, 10 insertions(+), 5 deletions(-)

```

### No Changes Case

```

$ git commit -m "Update unrelated file"

[main abc1234] Update unrelated file

1 file changed, 5 insertions(+), 2 deletions(-)

```

(No output - hook runs silently when no doc changes needed)

## Edge Cases and Error Handling

1. **Proposal file conflicts:**
   - If `claude.md.proposed` exists from previous run, `--propose` overwrites it
   - `--apply` uses existing proposal if present (doesn't regenerate)

2. **Git staging:**
   - Hook only stages `claude.md` if user approves
   - Proposal file (`claude.md.proposed`) should be in `.gitignore` (not staged)

3. **Build failures:**
   - Build check only runs in `--apply` mode
   - If build fails, changes are still written (user can fix and rebuild)
   - Hook uses `--no-build` to avoid blocking commits

4. **Missing proposal file:**
   - `--apply` generates proposal first if missing
   - `--diff` generates proposal first if missing

5. **Partial updates:**
   - If some sections fail to generate, others still update
   - Script continues and reports all successful updates

6. **File permissions:**
   - Script checks write permissions before writing
   - Fails gracefully with clear error message

## Testing Checklist

- [ ] Test `--propose` generates file correctly
- [ ] Test `--apply` applies and removes proposal
- [ ] Test `--diff` shows readable diff
- [ ] Test `--check` detects changes correctly
- [ ] Test hook in interactive mode (TTY)
- [ ] Test hook in non-interactive mode (no TTY)
- [ ] Test hook when no changes exist
- [ ] Test hook when proposal exists but matches current
- [ ] Test backward compatibility with `--dry-run`
- [ ] Test build check in `--apply` mode
- [ ] Verify proposal file is gitignored

## .gitignore Addition

Add to `.gitignore`:
```

# Documentation proposals

claude.md.proposed

```

This ensures proposal files are never accidentally committed.