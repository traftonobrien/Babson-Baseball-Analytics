#!/usr/bin/env python3
"""Auto-update claude.md documentation to match the codebase.

This script intelligently updates only the sections of claude.md that have
changed based on git diff, preserving manual sections like Known Issues.
"""

import argparse
import ast
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Section markers for auto-updateable sections
SECTION_MARKERS = {
    "web-app-contract": ("Web Application Data Contract", "web/lib/dataIndex.ts", "web/app/utils.ts", "publish_outing.sh"),
    "publishing-workflow": ("Publishing a Completed Outing", "publish_outing.sh", ".claude/skills/publish-outing.md"),
    "outing-selection": ("Outing Selection Logic", "web/app/player/[playerId]/page.tsx", "web/app/player/[playerId]/OutingSelect.tsx"),
    "perspective-lanes": ("Perspective and Lane Definitions", "web/lib/reportModel.ts"),
    "on-target": ("On Target Definition", "web/lib/reportModel.ts"),
    "outlier-system": ("Outlier System", "web/lib/reportModel.ts", "web/app/components/PitchTable.tsx", "web/app/components/StrikeZoneScatter.tsx"),
    "cli-args": ("CLI Arguments", "src/batch_process.py", "src/mark_pitches.py", "src/generate_report.py"),
    "function-tables": ("File Reference", "src/batch_process.py", "src/calibrate.py", "src/export_csv.py"),
}

REPO_ROOT = Path(__file__).parent.parent


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
    except subprocess.CalledProcessError as e:
        print(f"Warning: git command failed: {' '.join(cmd)}", file=sys.stderr)
        return ""


def get_changed_files() -> set:
    """Get set of files changed since last commit."""
    staged = run_git(["diff", "--cached", "--name-only"]).split("\n")
    unstaged = run_git(["diff", "--name-only"]).split("\n")
    return set(f for f in staged + unstaged if f)


def should_update_section(section_id: str, changed_files: set) -> bool:
    """Check if a section should be updated based on changed files."""
    if section_id not in SECTION_MARKERS:
        return False
    _, *watch_files = SECTION_MARKERS[section_id]
    # Normalize paths (remove brackets for Next.js dynamic routes)
    normalized_changed = {f.replace("[", "").replace("]", "") for f in changed_files}
    normalized_watch = {f.replace("[", "").replace("]", "") for f in watch_files}
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
                    # Find the argument name
                    if node.args and isinstance(node.args[0], ast.Constant):
                        arg_name = node.args[0].value
                        arg_info = {"name": arg_name}
                        
                        # Extract help text
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
                                    arg_info["choices"] = [el.value for el in keyword.value.elts if isinstance(el, ast.Constant)]
                            elif keyword.arg == "action":
                                if isinstance(keyword.value, ast.Constant):
                                    arg_info["action"] = keyword.value.value
                        
                        args_dict[arg_name] = arg_info
    except Exception as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
    return args_dict


def extract_ts_constants(file_path: Path) -> Dict[str, any]:
    """Extract exported constants from TypeScript file."""
    constants = {}
    try:
        with open(file_path, "r") as f:
            content = f.read()
        
        # Match: export const CONSTANT_NAME = value;
        pattern = r'export\s+const\s+(\w+)\s*=\s*([^;]+);'
        for match in re.finditer(pattern, content):
            name = match.group(1)
            value_str = match.group(2).strip()
            # Try to parse value
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
            except:
                constants[name] = value_str
    except Exception as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
    return constants


def extract_functions(file_path: Path) -> List[Dict]:
    """Extract function definitions with docstrings."""
    functions = []
    try:
        with open(file_path, "r") as f:
            content = f.read()
        tree = ast.parse(content)
        
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_info = {
                    "name": node.name,
                    "docstring": ast.get_docstring(node) or "",
                }
                functions.append(func_info)
    except Exception as e:
        print(f"Warning: Could not parse {file_path}: {e}", file=sys.stderr)
    return functions


def generate_web_app_contract_section() -> str:
    """Generate Web Application Data Contract section."""
    data_index = REPO_ROOT / "web/lib/dataIndex.ts"
    utils = REPO_ROOT / "web/app/utils.ts"
    publish_script = REPO_ROOT / "publish_outing.sh"
    
    lines = [
        "## Web Application Data Contract",
        "",
        "### Required Folder Structure",
        "",
        "Each outing must be published to `web/public/data/<outing_id>/` with the following structure:",
        "",
        "```",
        "web/public/data/<outing_id>/",
        "├── pitch_data_overlay_lite.csv    # Source of truth for pitch count",
        "├── clips/",
        "│   ├── pitch_001.mp4",
        "│   ├── pitch_002.mp4",
        "│   └── ...",
        "└── results/",
        "    ├── pitch_001_overlay.mp4",
        "    ├── pitch_002_overlay.mp4",
        "    └── ...",
        "```",
        "",
        "### File Mapping",
        "",
    ]
    
    if utils.exists():
        with open(utils, "r") as f:
            utils_content = f.read()
            # Extract URL builder functions
            overlay_match = re.search(r'export function overlayUrl\([^)]+\): string \{[^}]+return `([^`]+)`', utils_content, re.DOTALL)
            clip_match = re.search(r'export function clipUrl\([^)]+\): string \{[^}]+return `([^`]+)`', utils_content, re.DOTALL)
            
            if overlay_match:
                lines.append(f"- **Overlay videos:** `{overlay_match.group(1)}`")
            if clip_match:
                lines.append(f"- **Clips:** `{clip_match.group(1)}`")
    
    lines.extend([
        "",
        "The CSV `pitch_number` column is used to construct filenames:",
        "- `pitch_001.mp4` → pitch_number = 1",
        "- `pitch_001_overlay.mp4` → pitch_number = 1",
        "",
        "### Pitch Count Source of Truth",
        "",
        "The CSV file (`pitch_data_overlay_lite.csv`) is the source of truth for pitch count.",
        "The `dataIndex.ts` label must match the CSV row count (excluding header).",
        "",
        "### Mismatch Behavior",
        "",
        "If CSV row count doesn't match file count, or if `pitch_number` doesn't match filename:",
        "- Wrong videos may play when clicking pitches in the table",
        "- Video player may show 404 errors",
        "- Report aggregations may be incorrect",
        "",
    ])
    
    return "\n".join(lines)


def generate_publishing_workflow_section() -> str:
    """Generate Publishing Workflow section."""
    publish_script = REPO_ROOT / "publish_outing.sh"
    skill_file = REPO_ROOT / ".claude/skills/publish-outing.md"
    
    lines = [
        "## Publishing a Completed Outing",
        "",
        "### Checklist",
        "",
    ]
    
    if publish_script.exists():
        with open(publish_script, "r") as f:
            script_content = f.read()
        
        # Extract steps from script
        lines.append("1. Verify source files exist in `outings/<outing_id>/`:")
        lines.append("   - `clips/pitch_*.mp4`")
        lines.append("   - `results/pitch_*_overlay.mp4`")
        lines.append("   - `pitch_data_overlay_lite.csv`")
        lines.append("")
        lines.append("2. Create destination directories:")
        lines.append("   ```bash")
        lines.append("   mkdir -p web/public/data/<outing_id>/clips")
        lines.append("   mkdir -p web/public/data/<outing_id>/results")
        lines.append("   ```")
        lines.append("")
        lines.append("3. Copy files:")
        lines.append("   ```bash")
        if "cp.*pitch_data_overlay_lite.csv" in script_content:
            lines.append("   cp outings/<outing_id>/pitch_data_overlay_lite.csv web/public/data/<outing_id>/")
        if "cp.*overlay.mp4" in script_content:
            lines.append("   cp outings/<outing_id>/results/pitch_*_overlay.mp4 web/public/data/<outing_id>/results/")
        if "cp.*clips" in script_content:
            lines.append("   cp outings/<outing_id>/clips/pitch_*.mp4 web/public/data/<outing_id>/clips/")
        lines.append("   ```")
        lines.append("")
        lines.append("4. Validate counts match:")
        lines.append("   ```bash")
        lines.append("   ls web/public/data/<outing_id>/clips/pitch_*.mp4 | wc -l")
        lines.append("   ls web/public/data/<outing_id>/results/pitch_*_overlay.mp4 | wc -l")
        lines.append("   tail -n +2 web/public/data/<outing_id>/pitch_data_overlay_lite.csv | wc -l")
        lines.append("   ```")
        lines.append("")
        lines.append("5. Update `web/lib/dataIndex.ts`:")
        lines.append("   - Add new player entry or append to existing player's `outings` array")
        lines.append("   - Format: `{ id: \"<outing_id>\", label: \"<date> – <name> (<count> pitches)\", csvPath: \"/data/<outing_id>/pitch_data_overlay_lite.csv\", overlayDir: \"/data/<outing_id>/results\", clipsDir: \"/data/<outing_id>/clips\" }`")
        lines.append("   - Pitch count in label must match CSV row count")
        lines.append("")
        lines.append("6. Build check:")
        lines.append("   ```bash")
        lines.append("   npm --prefix web run build")
        lines.append("   ```")
        lines.append("")
        lines.append("7. Git commit and push:")
        lines.append("   ```bash")
        lines.append("   git add web/public/data/<outing_id> web/lib/dataIndex.ts")
        lines.append("   git commit -m \"Add outing <outing_id>\"")
        lines.append("   git push")
        lines.append("   ```")
        lines.append("")
        lines.append("Vercel will redeploy automatically on push to main.")
        lines.append("")
    
    return "\n".join(lines)


def generate_outing_selection_section() -> str:
    """Generate Outing Selection Logic section."""
    page_file = REPO_ROOT / "web/app/player/[playerId]/page.tsx"
    select_file = REPO_ROOT / "web/app/player/[playerId]/OutingSelect.tsx"
    
    lines = [
        "## Outing Selection Logic",
        "",
        "### Player Selection",
        "",
        "The UI loads player data from `web/lib/dataIndex.ts` using the `playerId` from the URL path:",
        "",
        "```typescript",
        "const player = getPlayer(playerId);",
        "```",
        "",
        "### Outing Selection",
        "",
        "Outing selection follows this priority:",
        "",
        "1. If `outingId` query parameter is present, use that outing",
        "2. Otherwise, use the first outing in the player's `outings` array",
        "",
        "### Query String Propagation",
        "",
        "The `outingId` is passed via query string:",
        "- Player dashboard: `/player/<playerId>?outingId=<outing_id>`",
        "- Report page: `/player/<playerId>/report?outingId=<outing_id>`",
        "",
        "The `OutingSelect` component updates the URL when the dropdown changes:",
        "",
        "```typescript",
        "router.push(`/player/${playerId}?outingId=${event.target.value}`)",
        "```",
        "",
        "### Fallback Behavior",
        "",
        "If `outingId` is missing or invalid:",
        "- The first outing in the player's `outings` array is used",
        "- If no outings exist, the page returns 404",
        "",
    ]
    
    return "\n".join(lines)


def generate_perspective_lanes_section() -> str:
    """Generate Perspective and Lane Definitions section."""
    report_model = REPO_ROOT / "web/lib/reportModel.ts"
    
    lines = [
        "## Perspective and Lane Definitions",
        "",
        "### Catcher View",
        "",
        "All analysis uses the center-field camera perspective: viewing from behind the pitcher toward home plate.",
        "",
        "### Lane Definitions",
        "",
    ]
    
    if report_model.exists():
        with open(report_model, "r") as f:
            content = f.read()
        
        # Extract lane logic
        lane_match = re.search(r'function laneOf\([^)]+\): string \{[^}]+return "([^"]+)"', content, re.DOTALL)
        if "h <= -4" in content:
            lines.append("Lanes are determined by `h_miss_signed` (horizontal miss, signed):")
            lines.append("")
            lines.append("- **Arm side:** `h_miss_signed <= -4` inches")
            lines.append("- **Glove side:** `h_miss_signed >= 4` inches")
            lines.append("- **Middle:** `-4 < h_miss_signed < 4` inches")
            lines.append("")
        
        # Extract lane display name function
        display_match = re.search(r'export function laneDisplayName\([^}]+\): string \{[^}]+return "([^"]+)"', content, re.DOTALL)
        if display_match or "Glove side" in content:
            lines.append("### Lane Labels")
            lines.append("")
            lines.append("Lane labels adapt to pitcher hand:")
            lines.append("")
            lines.append("- **RHP:** Arm side = first base side (right in image), Glove side = third base side (left in image)")
            lines.append("- **LHP:** Arm side = third base side (left in image), Glove side = first base side (right in image)")
            lines.append("")
            lines.append("The `laneDisplayName()` function in `reportModel.ts` handles label formatting.")
            lines.append("")
    
    return "\n".join(lines)


def generate_on_target_section() -> str:
    """Generate On Target Definition section."""
    report_model = REPO_ROOT / "web/lib/reportModel.ts"
    
    lines = [
        "## On Target Definition",
        "",
    ]
    
    if report_model.exists():
        constants = extract_ts_constants(report_model)
        if "ON_TARGET_THRESHOLD_IN" in constants:
            threshold = constants["ON_TARGET_THRESHOLD_IN"]
            lines.append(f"The `ON_TARGET_THRESHOLD_IN` constant is set to **{threshold} inches**.")
            lines.append("")
            lines.append("A pitch is considered \"on target\" if `total_miss_inches <= ON_TARGET_THRESHOLD_IN`.")
            lines.append("")
            lines.append("This threshold is used in:")
            lines.append("- Report generation (`buildReport()` in `reportModel.ts`)")
            lines.append("- KPI calculations (hit spot percentage)")
            lines.append("- Per-pitch-type and per-lane on-target percentages")
            lines.append("")
    
    return "\n".join(lines)


def generate_outlier_section() -> str:
    """Generate Outlier System section."""
    report_model = REPO_ROOT / "web/lib/reportModel.ts"
    pitch_table = REPO_ROOT / "web/app/components/PitchTable.tsx"
    
    lines = [
        "## Outlier System",
        "",
    ]
    
    if report_model.exists():
        constants = extract_ts_constants(report_model)
        if "OUTLIER_MISS_THRESHOLD_IN" in constants:
            threshold = constants["OUTLIER_MISS_THRESHOLD_IN"]
            lines.append(f"The `OUTLIER_MISS_THRESHOLD_IN` constant is set to **{threshold} inches**.")
            lines.append("")
            lines.append("A pitch is considered an outlier if `total_miss_inches > OUTLIER_MISS_THRESHOLD_IN`.")
            lines.append("")
            lines.append("### Exclude Outliers Option")
            lines.append("")
            lines.append("The `buildReport()` function accepts an `excludeOutliers` option:")
            lines.append("")
            lines.append("```typescript")
            lines.append("buildReport(pitches, playerName, outingLabel, scope, { excludeOutliers: true })")
            lines.append("```")
            lines.append("")
            lines.append("When `excludeOutliers` is true:")
            lines.append("- Outliers are filtered from all aggregations (KPIs, per-pitch-type, lanes)")
            lines.append("- `meta.outlierCount` reports how many were excluded")
            lines.append("- `meta.includedPitchCount` is the count after filtering")
            lines.append("")
            lines.append("### Visual Behavior")
            lines.append("")
            lines.append("Outliers are visually distinguished:")
            lines.append("")
            if pitch_table.exists():
                with open(pitch_table, "r") as f:
                    table_content = f.read()
                if "opacity-50 grayscale" in table_content:
                    lines.append("- **PitchTable:** Outliers are greyed out (50% opacity, grayscale)")
                if "OUTLIER" in table_content:
                    lines.append("- **PitchTable:** Outliers show an \"OUTLIER\" badge with threshold value")
                if "excludeOutliers" in table_content or "StrikeZoneScatter" in str(REPO_ROOT / "web/app/components/StrikeZoneScatter.tsx"):
                    lines.append("- **StrikeZoneScatter:** Outliers may be filtered or visually distinct")
            lines.append("")
    
    return "\n".join(lines)


def generate_cli_args_section() -> str:
    """Generate CLI Arguments section."""
    lines = [
        "## CLI Arguments",
        "",
    ]
    
    # Extract from main scripts
    scripts = {
        "batch_process.py": REPO_ROOT / "src/batch_process.py",
        "mark_pitches.py": REPO_ROOT / "src/mark_pitches.py",
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
                        arg_line += f" (choices: {', '.join(choices)})"
                    if action == "store_true":
                        arg_line += " (flag)"
                    lines.append(arg_line)
                lines.append("")
    
    return "\n".join(lines)


def parse_claude_md() -> Tuple[str, Dict[str, Tuple[int, int]]]:
    """Parse claude.md and return content and section positions."""
    claude_path = REPO_ROOT / "claude.md"
    with open(claude_path, "r") as f:
        content = f.read()
    
    sections = {}
    for section_id, (title, *_) in SECTION_MARKERS.items():
        # Look for section markers or headings
        start_marker = f"<!-- AUTO-UPDATE-START: {section_id} -->"
        end_marker = "<!-- AUTO-UPDATE-END -->"
        
        start_pos = content.find(start_marker)
        if start_pos == -1:
            # Try finding by heading
            heading_pattern = f"## {re.escape(title)}"
            match = re.search(heading_pattern, content)
            if match:
                start_pos = match.start()
        else:
            start_pos += len(start_marker)
        
        end_pos = content.find(end_marker, start_pos)
        if end_pos == -1:
            # Find next ## heading or end of file
            next_heading = re.search(r'\n## ', content[start_pos:])
            if next_heading:
                end_pos = start_pos + next_heading.start()
            else:
                end_pos = len(content)
        
        if start_pos != -1:
            sections[section_id] = (start_pos, end_pos)
    
    return content, sections


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
    changed_files = get_changed_files() if not full else set()
    content, sections = parse_claude_md()
    
    updates = {}
    for section_id, (title, *_) in SECTION_MARKERS.items():
        if full or should_update_section(section_id, changed_files):
            if section_id == "web-app-contract":
                updates[section_id] = generate_web_app_contract_section()
            elif section_id == "publishing-workflow":
                updates[section_id] = generate_publishing_workflow_section()
            elif section_id == "outing-selection":
                updates[section_id] = generate_outing_selection_section()
            elif section_id == "perspective-lanes":
                updates[section_id] = generate_perspective_lanes_section()
            elif section_id == "on-target":
                updates[section_id] = generate_on_target_section()
            elif section_id == "outlier-system":
                updates[section_id] = generate_outlier_section()
            elif section_id == "cli-args":
                updates[section_id] = generate_cli_args_section()
    
    if not updates:
        return False, {}
    
    # Build updated sections dict for return
    updated_sections = {section_id: SECTION_MARKERS[section_id][0] for section_id in updates}
    
    # Apply updates (reverse order to preserve positions)
    new_content = content
    for section_id, new_text in sorted(updates.items(), key=lambda x: sections.get(x[0], (0, 0))[0], reverse=True):
        if section_id in sections:
            start, end = sections[section_id]
            # Find the actual section start (heading)
            before = new_content[:start]
            after = new_content[end:]
            
            # Insert markers if not present
            if "<!-- AUTO-UPDATE-START" not in before[-200:]:
                # Find the heading
                heading_match = re.search(r'\n## [^\n]+\n', before[-200:])
                if heading_match:
                    heading_start = len(before) - 200 + heading_match.start()
                    before = new_content[:heading_start] + heading_match.group(0) + f"<!-- AUTO-UPDATE-START: {section_id} -->\n"
                    start = len(before)
            
            new_content = before + new_text.rstrip() + "\n\n<!-- AUTO-UPDATE-END -->\n" + after
    
    # Write or return content
    if output_path is not None:
        with open(output_path, "w") as f:
            f.write(new_content)
    
    return True, updated_sections


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
        
        # Remove proposal file
        proposed_path.unlink()
        
        print("Applied documentation changes to claude.md")
        
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
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
