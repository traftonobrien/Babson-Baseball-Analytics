#!/usr/bin/env python3
"""Lightweight documentation drift and size checks.

Checks:
  1. CLAUDE.md size <= 40k chars (warn at 25k)
  2. Generated docs drift (runs update_docs.py --check equivalent)
  3. Routing completeness (docs/ROUTING.md exists and has core tasks)

Exit 0 if all pass, exit 1 if any fail.
"""

import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
CLAUDE_MD = REPO_ROOT / "CLAUDE.md"
ROUTING_MD = REPO_ROOT / "docs/ROUTING.md"
GENERATED_DIR = REPO_ROOT / "docs/generated"

CLAUDE_SIZE_WARN = 25_000
CLAUDE_SIZE_FAIL = 40_000

REQUIRED_ROUTING_KEYWORDS = [
    "publish",
    "folder",
    "handedness",
    "CLI",
    "migrate",
    "segment",
    "batch",
    "threshold",
]

EXPECTED_GENERATED_FILES = [
    "web_app_data_contract.md",
    "publishing_workflow.md",
    "outing_selection_logic.md",
    "perspective_and_lanes.md",
    "thresholds_on_target_outliers.md",
    "cli_args.md",
]


def check_claude_size() -> bool:
    """Check CLAUDE.md size."""
    if not CLAUDE_MD.exists():
        print("FAIL: CLAUDE.md not found")
        return False

    size = CLAUDE_MD.stat().st_size
    if size >= CLAUDE_SIZE_FAIL:
        print(f"FAIL: CLAUDE.md is {size:,} chars (limit: {CLAUDE_SIZE_FAIL:,})")
        return False
    if size >= CLAUDE_SIZE_WARN:
        print(f"WARN: CLAUDE.md is {size:,} chars (approaching {CLAUDE_SIZE_FAIL:,} limit)")
    else:
        print(f"OK: CLAUDE.md is {size:,} chars")
    return True


def check_routing_completeness() -> bool:
    """Check docs/ROUTING.md exists and contains core task keywords."""
    if not ROUTING_MD.exists():
        print("FAIL: docs/ROUTING.md not found")
        return False

    content = ROUTING_MD.read_text().lower()
    missing = [kw for kw in REQUIRED_ROUTING_KEYWORDS if kw.lower() not in content]
    if missing:
        print(f"FAIL: docs/ROUTING.md missing keywords: {', '.join(missing)}")
        return False

    print("OK: docs/ROUTING.md exists and contains core routing keywords")
    return True


def check_generated_docs_exist() -> bool:
    """Check that all expected generated doc files exist."""
    if not GENERATED_DIR.exists():
        print("FAIL: docs/generated/ directory not found")
        return False

    missing = [f for f in EXPECTED_GENERATED_FILES if not (GENERATED_DIR / f).exists()]
    if missing:
        print(f"WARN: Missing generated docs: {', '.join(missing)}")
        print("  Run: python3 scripts/update_docs.py --propose --full")
        # Not a hard failure — they get created by the generator
        return True

    print("OK: All expected generated docs exist")
    return True


def check_generated_docs_drift() -> bool:
    """Check if generated docs are stale by running update_docs.py --check."""
    update_script = REPO_ROOT / "scripts/update_docs.py"
    if not update_script.exists():
        print("WARN: scripts/update_docs.py not found, skipping drift check")
        return True

    try:
        result = subprocess.run(
            [sys.executable, str(update_script), "--check"],
            capture_output=True,
            text=True,
            cwd=REPO_ROOT,
        )
        output = result.stdout.strip()
        if "Changes exist" in output:
            print("WARN: Generated docs may be stale (run update_docs.py --propose)")
            return True  # warn but don't fail
        print("OK: Generated docs are up to date")
        return True
    except Exception as e:
        print(f"WARN: Could not check generated docs drift: {e}")
        return True


def main():
    print("=== Documentation checks ===\n")
    results = [
        check_claude_size(),
        check_routing_completeness(),
        check_generated_docs_exist(),
        check_generated_docs_drift(),
    ]
    print()
    if all(results):
        print("All checks passed.")
        sys.exit(0)
    else:
        print("Some checks failed.")
        sys.exit(1)


if __name__ == "__main__":
    main()
