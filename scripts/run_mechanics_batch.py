#!/usr/bin/env python3
"""
Batch-run mechanics coach-pack generation with deterministic planning and logging.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import shlex
import shutil
import subprocess
import sys
import traceback
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Any, Callable, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = REPO_ROOT / "output" / "mechanics"
DEFAULT_ROOT = Path("/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis")
ROOT_FALLBACKS = (
    REPO_ROOT / "Mechanical Analysis",
    REPO_ROOT / "Mechanics Analysis",
    REPO_ROOT / "web" / "public" / "Mechanical Analysis",
    REPO_ROOT / "web" / "public" / "Mechanics Analysis",
)
TRAFTON_NOTES_PATH = (
    OUTPUT_ROOT
    / "trafton_obrien"
    / "trafton_mechanics_test"
    / "coach_pack"
    / "notes.json"
)

DATE_PATTERNS = (
    r"(?P<y>20\d{2})[-_](?P<m>\d{2})[-_](?P<d>\d{2})",
    r"(?P<y>20\d{2})(?P<m>\d{2})(?P<d>\d{2})",
)
VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".mpeg", ".mpg", ".avi"}

SKIP_TRAFTON = "trafton_default_excluded"
SKIP_USER_ONLY = "user_excluded_only"
SKIP_USER_SKIP = "user_excluded_skip"
SKIP_MISSING_VIDEO = "missing_video"
SKIP_EXISTING_NOTES = "existing_notes"
SKIP_LIMIT_REACHED = "limit_reached"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run mechanics coach-pack generation for every player folder."
    )
    parser.add_argument(
        "--root",
        default=str(DEFAULT_ROOT),
        help=f"Player folder root. Default: {DEFAULT_ROOT}",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Plan only. Do not execute mechanics subprocesses.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run even if output coach_pack/notes.json exists.",
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Run only matching players (slug or folder substring). Repeatable; comma-separated supported.",
    )
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        help="Skip matching players (slug or folder substring). Repeatable; comma-separated supported.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Cap number of executions in real-run mode. Planning still includes all entries.",
    )
    parser.add_argument(
        "--print-commands",
        action="store_true",
        help="Print exact subprocess command argv for planned entries.",
    )
    parser.add_argument(
        "--no-trafton-skip",
        action="store_true",
        help="Include Trafton in planning and execution (default behavior is to skip).",
    )
    return parser.parse_args()


def _normalize_ascii(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    normalized = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return normalized.replace("’", "'")


def _compact_token(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", _normalize_ascii(text).lower())


def _fallback_slugify(text: str) -> str:
    value = Path(text).stem.lower()
    value = value.replace("’", "").replace("'", "")
    value = re.sub(r"\s+", "_", value)
    value = re.sub(r"[^a-z0-9_]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    return value or "unknown"


def _load_project_slugify() -> Optional[Callable[[str], str]]:
    try:
        if str(REPO_ROOT) not in sys.path:
            sys.path.insert(0, str(REPO_ROOT))
        from src.mechanics.utils import slugify as project_slugify

        return project_slugify
    except Exception:
        return None


PROJECT_SLUGIFY = _load_project_slugify()


def _slugify_name(text: str) -> str:
    if PROJECT_SLUGIFY is None:
        return _fallback_slugify(text)
    try:
        value = PROJECT_SLUGIFY(text)
        if value:
            return value
    except Exception:
        pass
    return _fallback_slugify(text)


def _parse_filter_tokens(raw_values: list[str]) -> list[str]:
    tokens: list[str] = []
    for raw in raw_values:
        for part in str(raw).split(","):
            cleaned = _compact_token(part.strip())
            if cleaned:
                tokens.append(cleaned)
    # Stable de-duplication.
    seen: set[str] = set()
    unique: list[str] = []
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        unique.append(token)
    return unique


def _matches_filter(
    tokens: list[str],
    player_slug: str,
    player_name: str,
) -> bool:
    if not tokens:
        return False
    slug_token = _compact_token(player_slug)
    name_token = _compact_token(player_name)
    for token in tokens:
        if token in slug_token or token in name_token:
            return True
    return False


def _resolve_root(root_arg: str) -> Path:
    candidate = Path(root_arg).expanduser()
    if candidate.exists():
        return candidate.resolve()

    # If default absolute path is stale, auto-detect from fallbacks.
    if candidate == DEFAULT_ROOT:
        for fallback in ROOT_FALLBACKS:
            if fallback.exists():
                print(f"[root] default missing, using fallback: {fallback}")
                return fallback.resolve()
        raise FileNotFoundError(f"Root not found: {candidate}")

    # Support Mechanical/Mechanics typo swaps.
    alt_names = ("Mechanical Analysis", "Mechanics Analysis")
    for alt_name in alt_names:
        alt = candidate.parent / alt_name
        if alt.exists():
            print(f"[root] using alternate folder: {alt}")
            return alt.resolve()
    raise FileNotFoundError(f"Root not found: {candidate}")


def _select_runner() -> Path:
    runner = REPO_ROOT / "scripts" / "mechanics_coach_pack.py"
    if not runner.exists():
        raise FileNotFoundError(f"Runner not found: {runner}")
    return runner


def _select_runner_python() -> str:
    # Prefer project venv for dependency consistency.
    venv_python = REPO_ROOT / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    py3 = shutil.which("python3")
    if py3:
        return py3
    return sys.executable


def _safe_git_info() -> dict[str, Any]:
    info = {"commit": None, "commit_short": None, "dirty": None}
    try:
        commit = (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True)
            .strip()
        )
        short = (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, text=True)
            .strip()
        )
        dirty = bool(
            subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO_ROOT, text=True).strip()
        )
        info.update({"commit": commit, "commit_short": short, "dirty": dirty})
    except Exception:
        pass
    return info


def _extract_last_name(display_name: str) -> str:
    clean = _normalize_ascii(display_name).replace(",", " ")
    parts = [part for part in re.split(r"\s+", clean) if part]
    return parts[-1] if parts else display_name


def _extract_date_token(text: str) -> Optional[str]:
    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text)
        if not match:
            continue
        try:
            parsed = dt.date(
                int(match.group("y")),
                int(match.group("m")),
                int(match.group("d")),
            )
        except Exception:
            continue
        return parsed.strftime("%Y_%m_%d")
    return None


def _find_date_for_player_dir(player_dir: Path) -> Optional[str]:
    direct_tokens = [player_dir.name]
    child_dir_names = sorted([p.name for p in player_dir.iterdir() if p.is_dir()])
    for token_source in direct_tokens + child_dir_names:
        token = _extract_date_token(token_source)
        if token:
            return token
    return None


def _derive_session_slug(player_slug: str, player_dir: Path) -> str:
    date_token = _find_date_for_player_dir(player_dir)
    if date_token:
        return f"{player_slug}_mechanics_{date_token}"
    today_token = dt.date.today().strftime("%Y_%m_%d")
    return f"{player_slug}_mechanics_{today_token}_mechanics_batch"


def _video_files(player_dir: Path) -> list[Path]:
    files = [p for p in player_dir.iterdir() if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS]
    files.sort(key=lambda p: p.name.lower())
    return files


def _prefix_before_mechanics(path: Path) -> str:
    match = re.match(r"(.+?)\s*mechanics", path.stem, flags=re.IGNORECASE)
    return match.group(1).strip() if match else path.stem


def _video_candidate_info(path: Path, last_name: str) -> dict[str, Any]:
    stem_lower = path.stem.lower()
    mechanics_token = 1 if "mechanics" in stem_lower else 0
    last_token = _compact_token(last_name)
    prefix_token = _compact_token(_prefix_before_mechanics(path))
    stem_token = _compact_token(path.stem)
    if last_token and prefix_token == last_token:
        last_name_score = 2
    elif last_token and last_token in stem_token:
        last_name_score = 1
    else:
        last_name_score = 0
    ext_score = 2 if path.suffix.lower() == ".mp4" else (1 if path.suffix.lower() == ".mov" else 0)
    path_len = len(str(path))
    sort_key = (-mechanics_token, -last_name_score, -ext_score, path_len, path.name.lower())
    return {
        "path": str(path),
        "mechanics_token": mechanics_token,
        "last_name_score": last_name_score,
        "ext_score": ext_score,
        "path_len": path_len,
        "sort_key": list(sort_key),
    }


def _discover_video(player_dir: Path) -> tuple[Optional[Path], list[dict[str, Any]], list[dict[str, Any]]]:
    files = _video_files(player_dir)
    attempts: list[dict[str, Any]] = []
    attempt_definitions = [
        ("* Mechanics.*", lambda p: bool(re.search(r"\smechanics\.", p.name, flags=re.IGNORECASE))),
        ("*Mechanics*", lambda p: "mechanics" in p.name.lower()),
        ("video_extensions_only", lambda p: True),
    ]

    selected_candidates: list[Path] = []
    for pattern, matcher in attempt_definitions:
        matches = [p for p in files if matcher(p)]
        attempts.append(
            {
                "pattern": pattern,
                "match_count": len(matches),
                "matches": [str(p) for p in matches],
            }
        )
        if matches and not selected_candidates:
            selected_candidates = matches

    if not selected_candidates:
        return None, attempts, []

    last_name = _extract_last_name(player_dir.name)
    candidate_info = [_video_candidate_info(p, last_name=last_name) for p in selected_candidates]
    candidate_info.sort(key=lambda row: tuple(row["sort_key"]))
    chosen = Path(candidate_info[0]["path"])
    return chosen, attempts, candidate_info


def _load_defaults_from_trafton() -> dict[str, Any]:
    defaults = {
        "hand": "R",
        "view_mode": "open_side",
        "metric_set": "open_side_pro_v3",
        "source": "fallback_defaults",
    }
    if not TRAFTON_NOTES_PATH.exists():
        return defaults
    try:
        with open(TRAFTON_NOTES_PATH) as f:
            notes = json.load(f)
    except Exception:
        return defaults

    hand = str(notes.get("hand", defaults["hand"])).upper()
    if hand not in {"R", "L"}:
        hand = "R"
    # Batch orchestration is locked to open_side.
    view_mode = "open_side"
    metric_set = str(notes.get("official_metric_set", defaults["metric_set"]))
    return {
        "hand": hand,
        "view_mode": view_mode,
        "metric_set": metric_set,
        "source": str(TRAFTON_NOTES_PATH),
    }


def _build_command(
    runner_python: str,
    runner_path: Path,
    video_path: Path,
    hand: str,
    view_mode: str,
) -> list[str]:
    return [
        runner_python,
        str(runner_path),
        "--video",
        str(video_path),
        "--hand",
        hand,
        "--view",
        view_mode,
        "--slowmo",
        "--hold-review",
    ]


def _runner_output_dir(player_slug: str, video_path: Path) -> Path:
    return OUTPUT_ROOT / player_slug / _slugify_name(video_path.stem)


def _target_output_dir(player_slug: str, session_slug: str) -> Path:
    return OUTPUT_ROOT / player_slug / session_slug


def _existing_notes_path(output_dir: Path) -> Path:
    return output_dir / "coach_pack" / "notes.json"


def _sync_session_outputs(source_dir: Path, target_dir: Path) -> None:
    if not source_dir.exists():
        raise FileNotFoundError(f"Runner output directory missing: {source_dir}")
    if source_dir.resolve() == target_dir.resolve():
        return
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, target_dir)


def _ensure_manual_template_in_coach_pack(session_dir: Path) -> None:
    root_manual = session_dir / "manual_template.json"
    pack_manual = session_dir / "coach_pack" / "manual_template.json"
    pack_manual.parent.mkdir(parents=True, exist_ok=True)
    if pack_manual.exists():
        return
    if root_manual.exists():
        shutil.copy2(root_manual, pack_manual)


def _expected_artifacts(include_slowmo: bool, include_hold_review: bool) -> list[str]:
    artifacts = [
        "coach_pack/notes.json",
        "coach_pack/manual_template.json",
        "coach_pack/set.png",
        "coach_pack/peak_leg_lift.png",
        "coach_pack/foot_strike.png",
        "coach_pack/release.png",
        "coach_pack/strip.png",
    ]
    if include_slowmo:
        artifacts.append("coach_pack/slowmo_review.mp4")
    if include_hold_review:
        artifacts.append("coach_pack/hold_review.mp4")
    return artifacts


def _verify_artifacts(output_dir: Path, expected_artifacts: list[str]) -> list[str]:
    missing: list[str] = []
    for rel in expected_artifacts:
        if not (output_dir / rel).is_file():
            missing.append(rel)
    return missing


def _short_error(text: str, max_lines: int = 20) -> str:
    lines = str(text).strip().splitlines()
    if len(lines) <= max_lines:
        return "\n".join(lines)
    return "\n".join(lines[:max_lines]) + "\n... (truncated)"


def _run_subprocess(command: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(
        command,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        message = proc.stderr.strip() or proc.stdout.strip() or f"exit_code={proc.returncode}"
        return False, _short_error(message)
    return True, proc.stdout.strip()


def _build_plan_entries(
    player_dirs: list[Path],
    only_tokens: list[str],
    skip_tokens: list[str],
    force: bool,
    no_trafton_skip: bool,
    runner_python: str,
    runner_path: Path,
    defaults: dict[str, Any],
) -> list[dict[str, Any]]:
    planned: list[dict[str, Any]] = []
    for player_dir in player_dirs:
        player_name = player_dir.name
        player_slug = _slugify_name(player_name)
        session_slug = _derive_session_slug(player_slug, player_dir)
        output_dir = _target_output_dir(player_slug, session_slug)

        skip_reason: Optional[str] = None
        if not no_trafton_skip and _compact_token(player_name) == "traftonobrien":
            skip_reason = SKIP_TRAFTON
        elif only_tokens and not _matches_filter(only_tokens, player_slug, player_name):
            skip_reason = SKIP_USER_ONLY
        elif skip_tokens and _matches_filter(skip_tokens, player_slug, player_name):
            skip_reason = SKIP_USER_SKIP

        video_path: Optional[Path] = None
        glob_attempts: list[dict[str, Any]] = []
        video_candidates: list[dict[str, Any]] = []
        command: list[str] = []

        if skip_reason is None:
            video_path, glob_attempts, video_candidates = _discover_video(player_dir)
            if video_path is None:
                skip_reason = SKIP_MISSING_VIDEO
            else:
                command = _build_command(
                    runner_python=runner_python,
                    runner_path=runner_path,
                    video_path=video_path,
                    hand=defaults["hand"],
                    view_mode=defaults["view_mode"],
                )
                if _existing_notes_path(output_dir).exists() and not force:
                    skip_reason = SKIP_EXISTING_NOTES

        status = "planned" if skip_reason is None else "skipped"
        planned.append(
            {
                "player_slug": player_slug,
                "player_name": player_name,
                "player_dir": str(player_dir),
                "session_slug": session_slug,
                "video_path": str(video_path) if video_path else None,
                "output_dir": str(output_dir),
                "status": status,
                "skip_reason": skip_reason,
                "command": command,
                "artifacts_verified": False,
                "error": None,
                "video_glob_attempts": glob_attempts,
                "video_candidates": video_candidates,
            }
        )
    return planned


def _print_plan(planned: list[dict[str, Any]], print_commands: bool) -> None:
    print("\nPlan")
    for idx, entry in enumerate(planned, start=1):
        prefix = f"[{idx}/{len(planned)}] {entry['player_name']} ({entry['player_slug']})"
        if entry["status"] == "planned":
            print(f"{prefix} -> planned")
            print(f"  video     : {entry['video_path']}")
            print(f"  output    : {entry['output_dir']}")
            if print_commands and entry["command"]:
                print(f"  command   : {shlex.join(entry['command'])}")
        else:
            print(f"{prefix} -> skipped ({entry['skip_reason']})")
            if entry["skip_reason"] == SKIP_MISSING_VIDEO:
                print("  globs     :")
                for attempt in entry["video_glob_attempts"]:
                    print(
                        f"    - {attempt['pattern']}: {attempt['match_count']} match(es)"
                    )
            elif print_commands and entry["command"]:
                print(f"  command   : {shlex.join(entry['command'])}")


def _execute_plan(
    planned: list[dict[str, Any]],
    dry_run: bool,
    limit: Optional[int],
    print_commands: bool,
) -> list[dict[str, Any]]:
    if dry_run:
        return [dict(entry) for entry in planned]

    results: list[dict[str, Any]] = []
    executed = 0
    for entry in planned:
        row = dict(entry)
        if row["status"] != "planned":
            results.append(row)
            continue

        if limit is not None and executed >= limit:
            row["status"] = "skipped"
            row["skip_reason"] = SKIP_LIMIT_REACHED
            results.append(row)
            continue

        command = list(row["command"])
        if print_commands:
            print(f"\nRun {row['player_slug']} command: {shlex.join(command)}")
        else:
            print(f"\nRun {row['player_slug']}")
        executed += 1

        try:
            ok, output = _run_subprocess(command)
            if not ok:
                row["status"] = "failed"
                row["error"] = output
                results.append(row)
                continue

            output_dir = Path(row["output_dir"])
            video_path = Path(row["video_path"])
            source_dir = _runner_output_dir(row["player_slug"], video_path)
            _sync_session_outputs(source_dir=source_dir, target_dir=output_dir)
            _ensure_manual_template_in_coach_pack(output_dir)

            expected = _expected_artifacts(include_slowmo=True, include_hold_review=True)
            missing = _verify_artifacts(output_dir, expected_artifacts=expected)
            row["missing_artifacts"] = missing
            if missing:
                row["status"] = "failed"
                row["error"] = "Missing artifacts: " + ", ".join(missing)
                row["artifacts_verified"] = False
            else:
                row["status"] = "ran"
                row["artifacts_verified"] = True
        except Exception:
            row["status"] = "failed"
            row["error"] = _short_error(traceback.format_exc())

        results.append(row)

    return results


def _build_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts = Counter(row["status"] for row in results)
    skip_reason_counts = Counter(
        row["skip_reason"] for row in results if row["status"] == "skipped" and row["skip_reason"]
    )
    return {
        "total_players": len(results),
        "status_counts": dict(status_counts),
        "skip_reason_counts": dict(skip_reason_counts),
        "planned_count": int(status_counts.get("planned", 0)),
        "ran_count": int(status_counts.get("ran", 0)),
        "skipped_count": int(status_counts.get("skipped", 0)),
        "failed_count": int(status_counts.get("failed", 0)),
    }


def _write_log(payload: dict[str, Any]) -> Path:
    log_dir = OUTPUT_ROOT / "batch_runs"
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    path = log_dir / f"mechanics_batch_{timestamp}.json"
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    return path


def main() -> None:
    args = parse_args()
    if args.limit is not None and args.limit <= 0:
        raise SystemExit("--limit must be a positive integer.")

    root = _resolve_root(args.root)
    runner_path = _select_runner()
    runner_python = _select_runner_python()
    defaults = _load_defaults_from_trafton()
    git_info = _safe_git_info()
    only_tokens = _parse_filter_tokens(args.only)
    skip_tokens = _parse_filter_tokens(args.skip)

    player_dirs = sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.name.lower())

    print(f"[batch] root={root}")
    print(f"[batch] runner={runner_path}")
    print(f"[batch] runner_python={runner_python}")
    print(
        f"[batch] defaults hand={defaults['hand']} view_mode={defaults['view_mode']} "
        f"metric_set={defaults['metric_set']}"
    )
    print(f"[batch] defaults_source={defaults['source']}")
    print(f"[batch] player_folders={len(player_dirs)}")

    planned_entries = _build_plan_entries(
        player_dirs=player_dirs,
        only_tokens=only_tokens,
        skip_tokens=skip_tokens,
        force=bool(args.force),
        no_trafton_skip=bool(args.no_trafton_skip),
        runner_python=runner_python,
        runner_path=runner_path,
        defaults=defaults,
    )
    _print_plan(planned_entries, print_commands=bool(args.print_commands))

    results = _execute_plan(
        planned=planned_entries,
        dry_run=bool(args.dry_run),
        limit=args.limit,
        print_commands=bool(args.print_commands),
    )
    summary = _build_summary(results)

    payload = {
        "schema_version": 2,
        "run_metadata": {
            "timestamp": dt.datetime.now().isoformat(timespec="seconds"),
            "git": git_info,
            "args": vars(args),
            "cwd": str(Path.cwd()),
            "python": sys.executable,
            "runner_python": runner_python,
            "defaults": defaults,
        },
        "root": str(root),
        "planned_entries": planned_entries,
        "results": results,
        "summary": summary,
    }
    log_path = _write_log(payload)

    print("\nSummary")
    print(f"  total_players : {summary['total_players']}")
    print(f"  planned       : {summary['planned_count']}")
    print(f"  ran           : {summary['ran_count']}")
    print(f"  skipped       : {summary['skipped_count']}")
    print(f"  failed        : {summary['failed_count']}")
    print("  skip_reasons  :")
    if summary["skip_reason_counts"]:
        for reason, count in sorted(summary["skip_reason_counts"].items()):
            print(f"    - {reason}: {count}")
    else:
        print("    - (none)")
    print(f"  batch_log     : {log_path}")


if __name__ == "__main__":
    main()
