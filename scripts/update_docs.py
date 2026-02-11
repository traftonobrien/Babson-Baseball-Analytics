#!/usr/bin/env python3
"""Generate reference documentation under docs/generated/ from code.

This script generates ONLY these files:
  - docs/generated/web_app_data_contract.md
  - docs/generated/publishing_workflow.md
  - docs/generated/outing_selection_logic.md
  - docs/generated/perspective_and_lanes.md
  - docs/generated/thresholds_on_target_outliers.md
  - docs/generated/cli_args.md

It NEVER touches CLAUDE.md or any hand-written docs.
"""

import argparse
import ast
import difflib
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

REPO_ROOT = Path(__file__).parent.parent
GENERATED_DIR = REPO_ROOT / "docs/generated"

# Section → (output filename, watch files for change detection)
SECTIONS = {
    "web_app_data_contract": (
        "web_app_data_contract.md",
        ["web/lib/dataIndex.ts"],
    ),
    "publishing_workflow": (
        "publishing_workflow.md",
        ["docs/runbooks/publish_outing.md", ".claude/skills/trackerpublish/SKILL.md"],
    ),
    "outing_selection_logic": (
        "outing_selection_logic.md",
        ["web/app/player/[playerId]/page.tsx"],
    ),
    "perspective_and_lanes": (
        "perspective_and_lanes.md",
        ["web/lib/handedness.ts", "web/lib/reportModel.ts"],
    ),
    "thresholds_on_target_outliers": (
        "thresholds_on_target_outliers.md",
        ["web/lib/reportModel.ts", "web/app/components/PitchTable.tsx"],
    ),
    "cli_args": (
        "cli_args.md",
        ["src/batch_process.py", "src/mark_pitches.py", "src/generate_report.py", "src/segment_pitches.py"],
    ),
}


def run_git(cmd: List[str]) -> str:
    """Run a git command and return stdout."""
    try:
        result = subprocess.run(
            ["git"] + cmd,
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return ""


def get_changed_files() -> set:
    """Get set of files changed since last commit."""
    staged = run_git(["diff", "--cached", "--name-only"]).split("\n")
    unstaged = run_git(["diff", "--name-only"]).split("\n")
    return set(f for f in staged + unstaged if f)


def normalize_path(p: str) -> str:
    """Normalize path by removing brackets for Next.js dynamic routes."""
    return p.replace("[", "").replace("]", "") if p else ""


def should_update_section(section_id: str, changed_files: set) -> bool:
    """Check if a section should be updated based on changed files."""
    if section_id not in SECTIONS:
        return False
    _, watch_files = SECTIONS[section_id]
    normalized_changed = {normalize_path(f) for f in changed_files if f}
    normalized_watch = {normalize_path(f) for f in watch_files}
    return bool(normalized_changed & normalized_watch)


def extract_cli_args(file_path: Path) -> Dict[str, Dict]:
    """Extract argparse arguments from a Python file."""
    args_dict = {}
    try:
        with open(file_path, "r") as f:
            content = f.read()
        tree = ast.parse(content)

        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                if node.func.attr == "add_argument":
                    if node.args and isinstance(node.args[0], ast.Constant):
                        arg_name = node.args[0].value
                        arg_info = {"name": arg_name}

                        for keyword in node.keywords:
                            if keyword.arg == "help" and isinstance(keyword.value, ast.Constant):
                                arg_info["help"] = keyword.value.value
                            elif keyword.arg == "type":
                                if isinstance(keyword.value, ast.Name):
                                    arg_info["type"] = keyword.value.id
                            elif keyword.arg == "default":
                                if isinstance(keyword.value, ast.Constant):
                                    arg_info["default"] = keyword.value.value
                            elif keyword.arg == "choices":
                                if isinstance(keyword.value, ast.List):
                                    arg_info["choices"] = [
                                        el.value for el in keyword.value.elts
                                        if isinstance(el, ast.Constant)
                                    ]
                            elif keyword.arg == "action":
                                if isinstance(keyword.value, ast.Constant):
                                    arg_info["action"] = keyword.value.value

                        args_dict[arg_name] = arg_info
    except Exception as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
    return args_dict


def extract_ts_constants(file_path: Path) -> Dict[str, object]:
    """Extract exported constants from TypeScript file."""
    constants = {}
    try:
        with open(file_path, "r") as f:
            content = f.read()

        pattern = r'export\s+const\s+(\w+)\s*=\s*([^;]+);'
        for match in re.finditer(pattern, content):
            name = match.group(1)
            value_str = match.group(2).strip()
            try:
                if value_str.isdigit():
                    value = int(value_str)
                elif re.match(r'^\d+\.\d+$', value_str):
                    value = float(value_str)
                elif value_str in ("true", "false"):
                    value = value_str == "true"
                else:
                    value = value_str
                constants[name] = value
            except Exception:
                constants[name] = value_str
    except Exception as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
    return constants


# --- Section generators ---

def generate_web_app_data_contract() -> str:
    return """\
<!-- Generated by scripts/update_docs.py — do not hand-edit -->
## Web Application Data Contract

### Required Folder Structure

Each outing must be published to `web/public/data/<playerId>/<dateId>/` with:

```
web/public/data/<playerId>/<dateId>/
├── pitch_data_overlay_lite.csv    # Source of truth for pitch count
├── clips/
│   ├── pitch_001.mp4
│   ├── pitch_002.mp4
│   └── ...
└── results/
    ├── pitch_001_overlay.mp4
    ├── pitch_002_overlay.mp4
    └── ...
```

### File Mapping

- **Overlay videos:** `${overlayDir}/pitch_${id}_overlay.mp4`
- **Clips:** `${clipsDir}/pitch_${id}.mp4`

The CSV `pitch_number` column is used to construct filenames:
- `pitch_001.mp4` → pitch_number = 1
- `pitch_001_overlay.mp4` → pitch_number = 1

### Pitch Count Source of Truth

The CSV file (`pitch_data_overlay_lite.csv`) is the source of truth for pitch count.
The `dataIndex.ts` label must match the CSV row count (excluding header).

### Mismatch Behavior

If CSV row count doesn't match file count, or if `pitch_number` doesn't match filename:
- Wrong videos may play when clicking pitches in the table
- Video player may show 404 errors
- Report aggregations may be incorrect
"""


def generate_publishing_workflow() -> str:
    return """\
<!-- Generated by scripts/update_docs.py — do not hand-edit -->
## Publishing a Completed Outing

### Checklist

1. Verify source files exist in `outings/<playerId>/<dateId>/`:
   - `clips/pitch_*.mp4`
   - `results/pitch_*_overlay.mp4`
   - `pitch_data_overlay_lite.csv`

2. Create destination directories:
   ```bash
   mkdir -p web/public/data/<playerId>/<dateId>/clips
   mkdir -p web/public/data/<playerId>/<dateId>/results
   ```

3. Copy files:
   ```bash
   cp outings/<playerId>/<dateId>/pitch_data_overlay_lite.csv web/public/data/<playerId>/<dateId>/
   cp outings/<playerId>/<dateId>/clips/pitch_*.mp4 web/public/data/<playerId>/<dateId>/clips/
   cp outings/<playerId>/<dateId>/results/pitch_*_overlay.mp4 web/public/data/<playerId>/<dateId>/results/
   ```

4. Validate counts match:
   ```bash
   ls web/public/data/<playerId>/<dateId>/clips/pitch_*.mp4 | wc -l
   ls web/public/data/<playerId>/<dateId>/results/pitch_*_overlay.mp4 | wc -l
   tail -n +2 web/public/data/<playerId>/<dateId>/pitch_data_overlay_lite.csv | wc -l
   ```

5. Update `web/lib/dataIndex.ts`:
   - Add new player entry or append to existing player's `outings` array
   - New players must include `throws: "R" | "L"` (from `Arsenals.csv` pitcher_hand column)
   - Format: `{ id: "<playerId>/<dateId>", label: "<date> – <name> (<count> pitches)", ...buildDataPaths("<playerId>", "<dateId>") }`
   - Pitch count in label must match CSV row count

6. Build check:
   ```bash
   npm --prefix web run build
   ```

7. Git commit and push:
   ```bash
   git add web/public/data/<playerId>/<dateId> web/lib/dataIndex.ts
   git commit -m "Add <playerId>/<dateId> outing"
   git push
   ```

Vercel will redeploy automatically on push to main.
"""


def generate_outing_selection_logic() -> str:
    return """\
<!-- Generated by scripts/update_docs.py — do not hand-edit -->
## Outing Selection Logic

### Player Selection

The UI loads player data from `web/lib/dataIndex.ts` using the `playerId` from the URL path:

```typescript
const player = getPlayer(playerId);
```

### Outing Selection

Outing selection follows this priority:

1. If `outingId` query parameter is present, use that outing
2. Otherwise, use the first outing in the player's `outings` array

### Query String Propagation

The `outingId` is passed via query string (format: `<playerId>/<dateId>`):
- Player dashboard: `/player/<playerId>?outingId=<playerId>/<dateId>`
- Report page: `/player/<playerId>/report?outingId=<playerId>/<dateId>`

The `OutingSelect` component updates the URL when the dropdown changes:

```typescript
router.push(`/player/${playerId}?outingId=${event.target.value}`)
```

### Fallback Behavior

If `outingId` is missing or invalid:
- The first outing in the player's `outings` array is used
- If no outings exist, the page returns 404
"""


def generate_perspective_and_lanes() -> str:
    handedness_ts = REPO_ROOT / "web/lib/handedness.ts"
    threshold = 4  # default

    if handedness_ts.exists():
        content = handedness_ts.read_text()
        m = re.search(r'const\s+LANE_THRESHOLD\s*=\s*(\d+)', content)
        if m:
            threshold = int(m.group(1))

    return f"""\
<!-- Generated by scripts/update_docs.py — do not hand-edit -->
## Perspective and Lane Definitions

### Catcher View

All analysis uses the center-field camera perspective: viewing from behind the pitcher toward home plate.

### Lane Definitions

Lanes are classified using the arm-side-positive value (output of `toArmSideX()` from `web/lib/handedness.ts`):

- **Arm side:** `armSideX >= {threshold}` inches
- **Glove side:** `armSideX <= -{threshold}` inches
- **Middle:** `{-threshold} < armSideX < {threshold}` inches

The threshold ({threshold} inches) is defined as `LANE_THRESHOLD` in `handedness.ts`.

In `reportModel.ts`, the convenience wrapper `laneOf(pitch)` converts from raw `h_miss_signed` to arm-side-positive internally before classifying.

### Lane Labels

Lane labels adapt to pitcher hand via `laneDisplayName(lane, throwsHand)` in `handedness.ts`:

- **RHP:** Arm (1B), Glove (3B)
- **LHP:** Arm (3B), Glove (1B)
"""


def generate_thresholds_on_target_outliers() -> str:
    report_model = REPO_ROOT / "web/lib/reportModel.ts"
    on_target = 8
    outlier = 20

    if report_model.exists():
        constants = extract_ts_constants(report_model)
        on_target = constants.get("ON_TARGET_THRESHOLD_IN", on_target)
        outlier = constants.get("OUTLIER_MISS_THRESHOLD_IN", outlier)

    pitch_table = REPO_ROOT / "web/app/components/PitchTable.tsx"
    visual_lines = []
    if pitch_table.exists():
        table_content = pitch_table.read_text()
        if "opacity-50 grayscale" in table_content:
            visual_lines.append("- **PitchTable:** Outliers are greyed out (50% opacity, grayscale)")
        if "OUTLIER" in table_content:
            visual_lines.append('- **PitchTable:** Outliers show an "OUTLIER" badge with threshold value')
        visual_lines.append("- **StrikeZoneScatter:** Outliers may be filtered or visually distinct")

    visual_section = "\n".join(visual_lines) if visual_lines else "- Outliers are visually distinguished in tables and scatter plots"

    return f"""\
<!-- Generated by scripts/update_docs.py — do not hand-edit -->
## On Target Definition

The `ON_TARGET_THRESHOLD_IN` constant is set to **{on_target} inches**.

A pitch is considered "on target" if `total_miss_inches <= ON_TARGET_THRESHOLD_IN`.

This threshold is used in:
- Report generation (`buildReport()` in `reportModel.ts`)
- KPI calculations (hit spot percentage)
- Per-pitch-type and per-lane on-target percentages

## Outlier System

The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **{outlier} inches**.

A pitch is considered an outlier if `total_miss_inches > OUTLIER_MISS_THRESHOLD_IN`.

### Exclude Outliers Option

The `buildReport()` function accepts an `excludeOutliers` option:

```typescript
buildReport(pitches, playerName, outingLabel, scope, {{ excludeOutliers: true }})
```

When `excludeOutliers` is true:
- Outliers are filtered from all aggregations (KPIs, per-pitch-type, lanes)
- `meta.outlierCount` reports how many were excluded
- `meta.includedPitchCount` is the count after filtering

### Visual Behavior

Outliers are visually distinguished:

{visual_section}
"""


def generate_cli_args() -> str:
    lines = [
        "<!-- Generated by scripts/update_docs.py — do not hand-edit -->",
        "## CLI Arguments",
        "",
    ]

    scripts = {
        "batch_process.py": REPO_ROOT / "src/batch_process.py",
        "mark_pitches.py": REPO_ROOT / "src/mark_pitches.py",
        "segment_pitches.py": REPO_ROOT / "src/segment_pitches.py",
        "generate_report.py": REPO_ROOT / "src/generate_report.py",
    }

    for script_name, script_path in scripts.items():
        if script_path.exists():
            args_dict = extract_cli_args(script_path)
            if args_dict:
                lines.append(f"### `src/{script_name}`")
                lines.append("")
                for arg_name, arg_info in sorted(args_dict.items()):
                    help_text = arg_info.get("help", "")
                    default = arg_info.get("default", "")
                    choices = arg_info.get("choices", [])
                    action = arg_info.get("action", "")

                    arg_line = f"- `{arg_name}`"
                    if help_text:
                        arg_line += f": {help_text}"
                    if default and default != "None":
                        arg_line += f" (default: {default})"
                    if choices:
                        arg_line += f" (choices: {', '.join(str(c) for c in choices)})"
                    if action == "store_true":
                        arg_line += " (flag)"
                    lines.append(arg_line)
                lines.append("")

    return "\n".join(lines) + "\n"


# --- Generator dispatch ---

GENERATORS = {
    "web_app_data_contract": generate_web_app_data_contract,
    "publishing_workflow": generate_publishing_workflow,
    "outing_selection_logic": generate_outing_selection_logic,
    "perspective_and_lanes": generate_perspective_and_lanes,
    "thresholds_on_target_outliers": generate_thresholds_on_target_outliers,
    "cli_args": generate_cli_args,
}


def generate_all(full: bool = False) -> Dict[str, Tuple[str, str, bool]]:
    """Generate all sections.

    Returns dict of section_id → (filename, content, has_changes).
    """
    changed_files = get_changed_files() if not full else set()
    results = {}

    for section_id, (filename, _) in SECTIONS.items():
        if not full and not should_update_section(section_id, changed_files):
            # Still generate to check for drift, but mark as not triggered
            pass

        generator = GENERATORS.get(section_id)
        if not generator:
            continue

        new_content = generator()
        output_path = GENERATED_DIR / filename

        # Check if content changed
        if output_path.exists():
            current = output_path.read_text()
            has_changes = current != new_content
        else:
            has_changes = True

        results[section_id] = (filename, new_content, has_changes)

    return results


def main():
    parser = argparse.ArgumentParser(description="Generate docs/generated/* from code")
    parser.add_argument("--propose", action="store_true", help="Show what would change (default)")
    parser.add_argument("--apply", action="store_true", help="Write generated docs")
    parser.add_argument("--diff", action="store_true", help="Show diff for changed files")
    parser.add_argument("--check", action="store_true", help="Check if changes exist")
    parser.add_argument("--full", action="store_true", help="Force full regeneration")
    parser.add_argument("--no-build", action="store_true", help="Skip build check (with --apply)")
    # Legacy compat
    parser.add_argument("--dry-run", action="store_true", help="[DEPRECATED] Use --propose")
    args = parser.parse_args()

    if args.dry_run:
        print("Warning: --dry-run is deprecated. Use --propose instead.", file=sys.stderr)

    # Mode selection
    if args.apply:
        mode = "apply"
    elif args.diff:
        mode = "diff"
    elif args.check:
        mode = "check"
    else:
        mode = "propose"

    # Ensure output dir exists
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    # Always generate with full=True to detect drift
    results = generate_all(full=True)
    changed = {k: v for k, v in results.items() if v[2]}

    if mode == "propose":
        if not changed:
            print("No documentation changes needed.")
        else:
            print(f"Documentation updates available for {len(changed)} file(s):")
            for section_id, (filename, _, _) in sorted(changed.items()):
                print(f"  docs/generated/{filename}")
            print()
            print("Apply with: python3 scripts/update_docs.py --apply")
            print("Diff with:  python3 scripts/update_docs.py --diff")
        sys.exit(0)

    elif mode == "diff":
        for section_id, (filename, new_content, has_changes) in sorted(results.items()):
            if not has_changes:
                continue
            output_path = GENERATED_DIR / filename
            if output_path.exists():
                old_lines = output_path.read_text().splitlines(keepends=True)
            else:
                old_lines = []
            new_lines = new_content.splitlines(keepends=True)
            diff = difflib.unified_diff(
                old_lines,
                new_lines,
                fromfile=f"docs/generated/{filename}",
                tofile=f"docs/generated/{filename} (proposed)",
            )
            for line in diff:
                print(line, end="")
            print()
        if not changed:
            print("No changes.")
        sys.exit(0)

    elif mode == "apply":
        if not changed and not args.full:
            print("No documentation changes needed.")
            sys.exit(0)

        # Write all generated files (even unchanged ones for consistency)
        for section_id, (filename, content, _) in results.items():
            output_path = GENERATED_DIR / filename
            output_path.write_text(content)

        print(f"Generated {len(results)} file(s) in docs/generated/:")
        for section_id, (filename, _, has_changes) in sorted(results.items()):
            status = "updated" if has_changes else "unchanged"
            print(f"  {filename} ({status})")

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
                print("ERROR: Build check failed.", file=sys.stderr)
                sys.exit(1)

        sys.exit(0)

    elif mode == "check":
        if changed:
            print("Changes exist")
        else:
            print("No changes")
        sys.exit(0)


if __name__ == "__main__":
    sys.exit(main() or 0)
