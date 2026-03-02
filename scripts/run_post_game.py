#!/usr/bin/env python3
"""Thin wrapper around post_game_update.py that adds quality checks and git actions.

Intended to be called by the post-game-stats-importer Claude Code skill.
Not a standalone CLI — the skill constructs the args list.
"""

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
WEB_DIR = REPO_ROOT / "web"
PUBLIC_ROOT = WEB_DIR / "public"
STATS_DIR = PUBLIC_ROOT / "stats"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=str(REPO_ROOT), text=True, **kwargs)


def run_check(cmd: list[str], label: str) -> bool:
    print(f"\n--- {label} ---")
    result = run(cmd, capture_output=True)
    if result.returncode != 0:
        print(f"FAILED: {label}")
        if result.stdout:
            print(result.stdout[-2000:])
        if result.stderr:
            print(result.stderr[-2000:], file=sys.stderr)
        return False
    print(f"OK: {label}")
    return True


def git_porcelain() -> list[str]:
    result = run(["git", "status", "--porcelain"], capture_output=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


# ---------------------------------------------------------------------------
# Steps
# ---------------------------------------------------------------------------

def step_import(args: argparse.Namespace) -> int:
    """Run post_game_update.py with the user-supplied arguments."""
    cmd = [
        sys.executable, str(REPO_ROOT / "scripts" / "post_game_update.py"),
        "--boxscore-url", args.url,
        "--players", *args.players,
        "--team", args.team,
    ]
    if args.outing_map:
        cmd += ["--outing-map", *args.outing_map]
    if args.fixture:
        cmd += ["--fixture", args.fixture]
    if args.dry_run:
        cmd.append("--dry-run")

    print("\n--- Import ---")
    print(f"Running: {' '.join(cmd)}")
    result = run(cmd)
    return result.returncode


def step_quality_checks() -> bool:
    """Run compileall + pytest. Return True if all pass."""
    ok = True
    if not run_check([sys.executable, "-m", "compileall", "scripts", "src"], "compileall"):
        ok = False
    if not run_check([sys.executable, "-m", "pytest", "-q"], "pytest"):
        ok = False
    return ok


def step_web_build(changed_files: list[str]) -> bool:
    """Run npm build only if web files changed."""
    web_touched = any(f.strip().split()[-1].startswith("web/") for f in changed_files if f.strip())
    if not web_touched:
        print("\n--- npm build ---")
        print("Skipped: no web/ files changed.")
        return True
    return run_check(["npm", "--prefix", "web", "run", "build"], "npm build")


def step_git_commit_push(args: argparse.Namespace, game_id: str) -> str | None:
    """Stage intended files, commit, push. Return commit hash or None."""
    # Determine files to stage
    to_stage: list[str] = []

    for line in git_porcelain():
        path = line[3:].strip().strip('"')
        # Stats outputs
        if path.startswith("web/public/stats/"):
            to_stage.append(path)
        # Outing meta
        if path.endswith("outing_meta.json") and path.startswith("web/public/data/"):
            to_stage.append(path)

    if not to_stage:
        print("\nNo files to commit.")
        return None

    print(f"\nStaging {len(to_stage)} file(s):")
    for f in to_stage:
        print(f"  {f}")

    run(["git", "add", "--"] + to_stage)

    # Build commit message
    if args.outing_map:
        outing_label = " ".join(f"{e}" for e in args.outing_map)
        msg = f"Import boxscore {game_id} and link to {outing_label}"
    else:
        msg = f"Import boxscore {game_id}"

    result = run(["git", "commit", "-m", msg], capture_output=True)
    if result.returncode != 0:
        print(f"Commit failed:\n{result.stderr}")
        return None
    print(result.stdout.strip())

    # Extract commit hash
    hash_result = run(["git", "rev-parse", "--short", "HEAD"], capture_output=True)
    commit_hash = hash_result.stdout.strip()

    result = run(["git", "push"], capture_output=True)
    if result.returncode != 0:
        print(f"Push failed:\n{result.stderr}")
        return commit_hash
    print("Pushed to origin.")
    return commit_hash


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def extract_game_id(url: str) -> str:
    """Extract gameId from Sidearm boxscore URL."""
    import re
    match = re.search(r"/boxscore/(\d+)", url)
    return match.group(1) if match else "unknown"


def main() -> int:
    parser = argparse.ArgumentParser(description="Post-game stats importer (skill wrapper).")
    parser.add_argument("--url", required=True, help="Sidearm boxscore URL")
    parser.add_argument("--players", nargs="+", required=True, help="Player display names")
    parser.add_argument("--team", default="Babson", help="Team name (default: Babson)")
    parser.add_argument("--outing-map", nargs="*", help="PlayerId=DateId pairs for outing linkage")
    parser.add_argument("--fixture", help="Path to fixture HTML (offline mode)")
    parser.add_argument("--dry-run", action="store_true", help="No writes, no git")
    args = parser.parse_args()

    game_id = extract_game_id(args.url)

    # Step 1: Import
    rc = step_import(args)
    if rc != 0:
        print(f"\nImport failed (exit {rc}).")
        return rc

    # Step 2: Quality checks
    if not step_quality_checks():
        print("\nQuality checks failed. Aborting git.")
        return 1

    # Step 3: Web build (only if web files changed)
    changed = git_porcelain()
    if not step_web_build(changed):
        print("\nWeb build failed. Aborting git.")
        return 1

    # Step 4: Git
    if args.dry_run:
        print("\n--- Dry run: planned git actions ---")
        for line in changed:
            print(f"  {line}")
        print("No commit/push in dry-run mode.")
        return 0

    commit_hash = step_git_commit_push(args, game_id)

    # Step 5: Summary
    print("\n========================================")
    print("Post-game import complete")
    print(f"  gameId:  {game_id}")
    print(f"  outing:  {', '.join(args.outing_map) if args.outing_map else 'none'}")
    print(f"  commit:  {commit_hash or 'none'}")
    print("========================================")
    return 0


if __name__ == "__main__":
    sys.exit(main())
