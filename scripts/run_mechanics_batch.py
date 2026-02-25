#!/usr/bin/env python3
"""
Batch-run mechanics coach-pack generation with deterministic planning and logging.
"""
from __future__ import annotations

import argparse
import json
import re
import shlex
import shutil
import subprocess
import sys
import time
import traceback
import unicodedata
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = REPO_ROOT / "output" / "mechanics"
DEFAULT_ROOT = Path("/Users/traftonobrien/Desktop/pitch-tracker/Mechanics Analysis")
TRAFTON_NOTES_PATH = (
    OUTPUT_ROOT
    / "trafton_obrien"
    / "mechanics_latest"
    / "coach_pack"
    / "notes.json"
)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".mpeg", ".mpg", ".avi"}

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
        help="Plan only. Do not execute subprocesses.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Always re-run; ignore existing notes.json.",
    )
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Include-only filter (slug or folder substring). Repeatable; comma-separated supported.",
    )
    parser.add_argument(
        "--skip",
        action="append",
        default=[],
        help="Exclude filter (slug or folder substring). Repeatable; comma-separated supported.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Cap number of executions in real-run mode; planning still includes all entries.",
    )
    parser.add_argument(
        "--print-commands",
        action="store_true",
        help="Print exact subprocess commands.",
    )
    parser.add_argument(
        "--session-slug",
        default="mechanics_latest",
        help='Single deterministic session slug for all players. Default: "mechanics_latest".',
    )
    parser.add_argument(
        "--clean-output",
        action="store_true",
        help="Delete output/mechanics/<player_slug>/<session_slug>/ before each planned run.",
    )
    parser.add_argument(
        "--publish-web",
        action="store_true",
        help="Copy coach_pack to web/public/mechanics/<player_slug>/<session_slug>/coach_pack/ after success.",
    )
    parser.add_argument(
        "--rebuild-index",
        action="store_true",
        help="Rebuild web/public/mechanics/index.json after batch run.",
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
        for piece in str(raw).split(","):
            cleaned = _compact_token(piece.strip())
            if cleaned:
                tokens.append(cleaned)
    seen: set[str] = set()
    out: list[str] = []
    for token in tokens:
        if token in seen:
            continue
        seen.add(token)
        out.append(token)
    return out


def _matches_filter(tokens: list[str], player_slug: str, player_name: str) -> bool:
    if not tokens:
        return False
    slug_token = _compact_token(player_slug)
    name_token = _compact_token(player_name)
    return any(token in slug_token or token in name_token for token in tokens)


def _resolve_root(root_arg: str) -> Path:
    candidate = Path(root_arg).expanduser()
    if candidate.exists():
        return candidate.resolve()
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
    venv_python = REPO_ROOT / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    path = shutil.which("python3")
    if path:
        return path
    return sys.executable


def _safe_git_info() -> dict[str, Any]:
    info = {"commit": None, "commit_short": None, "dirty": None}
    try:
        commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=REPO_ROOT, text=True
        ).strip()
        short = subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"], cwd=REPO_ROOT, text=True
        ).strip()
        dirty = bool(
            subprocess.check_output(["git", "status", "--porcelain"], cwd=REPO_ROOT, text=True).strip()
        )
        info.update({"commit": commit, "commit_short": short, "dirty": dirty})
    except Exception:
        pass
    return info


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
    return {
        "hand": hand,
        "view_mode": "open_side",
        "metric_set": str(notes.get("official_metric_set", defaults["metric_set"])),
        "source": str(TRAFTON_NOTES_PATH),
    }


def _extract_last_name(display_name: str) -> str:
    clean = _normalize_ascii(display_name).replace(",", " ")
    parts = [part for part in re.split(r"\s+", clean) if part]
    return parts[-1] if parts else display_name


def _video_files(player_dir: Path) -> list[Path]:
    files = [
        p for p in player_dir.iterdir()
        if p.is_file() and p.suffix.lower() in VIDEO_EXTENSIONS
    ]
    files.sort(key=lambda p: p.name.lower())
    return files


def _prefix_before_mechanics(path: Path) -> str:
    match = re.match(r"(.+?)\s*mechanics", path.stem, flags=re.IGNORECASE)
    return match.group(1).strip() if match else path.stem


def _video_candidate_info(path: Path, last_name: str) -> dict[str, Any]:
    stem_lower = path.stem.lower()
    mechanics_score = 1 if "mechanics" in stem_lower else 0
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
    sort_key = (-mechanics_score, -last_name_score, -ext_score, path_len, path.name.lower())
    return {
        "path": str(path),
        "mechanics_score": mechanics_score,
        "last_name_score": last_name_score,
        "ext_score": ext_score,
        "path_len": path_len,
        "sort_key": list(sort_key),
    }


def _discover_video(player_dir: Path) -> tuple[Optional[Path], list[dict[str, Any]], list[dict[str, Any]]]:
    files = _video_files(player_dir)
    attempts: list[dict[str, Any]] = []
    patterns = [
        ("* Mechanics.*", lambda p: bool(re.search(r"\smechanics\.[^.]+$", p.name, flags=re.IGNORECASE))),
        ("*Mechanics*", lambda p: "mechanics" in p.name.lower()),
        ("video_extensions_only", lambda p: True),
    ]

    selected: list[Path] = []
    for label, matcher in patterns:
        matches = [p for p in files if matcher(p)]
        attempts.append(
            {
                "pattern": label,
                "match_count": len(matches),
                "matches": [str(m) for m in matches],
            }
        )
        if matches and not selected:
            selected = matches

    if not selected:
        return None, attempts, []

    last_name = _extract_last_name(player_dir.name)
    candidates = [_video_candidate_info(path=p, last_name=last_name) for p in selected]
    candidates.sort(key=lambda row: tuple(row["sort_key"]))
    chosen = Path(candidates[0]["path"])
    return chosen, attempts, candidates


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


def _expected_artifacts() -> list[str]:
    return [
        "coach_pack/notes.json",
        "coach_pack/manual_template.json",
        "coach_pack/set.png",
        "coach_pack/peak_leg_lift.png",
        "coach_pack/foot_strike.png",
        "coach_pack/release.png",
        "coach_pack/strip.png",
        "coach_pack/slowmo_review.mp4",
        "coach_pack/hold_review.mp4",
    ]


def _verify_artifacts(output_dir: Path) -> list[str]:
    missing: list[str] = []
    for rel in _expected_artifacts():
        if not (output_dir / rel).is_file():
            missing.append(rel)
    return missing


def _sync_runner_output_to_target(source_dir: Path, target_dir: Path) -> None:
    if not source_dir.exists():
        raise FileNotFoundError(f"Runner output directory missing: {source_dir}")
    if source_dir.resolve() == target_dir.resolve():
        return
    if target_dir.exists():
        shutil.rmtree(target_dir)
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, target_dir, dirs_exist_ok=True)


def _ensure_manual_template_in_coach_pack(session_dir: Path) -> None:
    root_manual = session_dir / "manual_template.json"
    pack_manual = session_dir / "coach_pack" / "manual_template.json"
    pack_manual.parent.mkdir(parents=True, exist_ok=True)
    if pack_manual.exists():
        return
    if root_manual.exists():
        shutil.copy2(root_manual, pack_manual)


def _publish_to_web(player_slug: str, session_slug: str, source_session_dir: Path) -> Path:
    """Copy coach_pack contents directly into the session root for web serving.

    Web components fetch files at /mechanics/<slug>/<session>/notes.json (no coach_pack prefix).
    """
    source_coach_pack = source_session_dir / "coach_pack"
    if not source_coach_pack.exists():
        raise FileNotFoundError(f"Coach pack missing for publish: {source_coach_pack}")
    target_session_dir = (
        REPO_ROOT
        / "web"
        / "public"
        / "mechanics"
        / player_slug
        / session_slug
    )
    if target_session_dir.exists():
        shutil.rmtree(target_session_dir)
    target_session_dir.mkdir(parents=True, exist_ok=True)
    # Copy coach_pack contents directly to session root (flat, no coach_pack/ subdir)
    shutil.copytree(source_coach_pack, target_session_dir, dirs_exist_ok=True)
    return target_session_dir


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
    session_slug: str,
    runner_python: str,
    runner_path: Path,
    defaults: dict[str, Any],
) -> list[dict[str, Any]]:
    planned: list[dict[str, Any]] = []

    for player_dir in player_dirs:
        player_name = player_dir.name
        player_slug = _slugify_name(player_name)
        output_dir = _target_output_dir(player_slug, session_slug)

        skip_reason: Optional[str] = None
        if only_tokens and not _matches_filter(only_tokens, player_slug, player_name):
            skip_reason = SKIP_USER_ONLY
        elif skip_tokens and _matches_filter(skip_tokens, player_slug, player_name):
            skip_reason = SKIP_USER_SKIP

        video_path: Optional[Path] = None
        video_glob_attempts: list[dict[str, Any]] = []
        video_candidates: list[dict[str, Any]] = []
        command: list[str] = []

        if skip_reason is None:
            video_path, video_glob_attempts, video_candidates = _discover_video(player_dir)
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
                "video_path": str(video_path) if video_path else None,
                "status": status,
                "skip_reason": skip_reason,
                "command": command,
                "output_dir": str(output_dir),
                "session_slug": session_slug,
                "artifacts_verified": False,
                "error": None,
                "missing_artifacts": [],
                "video_glob_attempts": video_glob_attempts,
                "video_candidates": video_candidates,
            }
        )
    return planned


def _print_plan(entries: list[dict[str, Any]], print_commands: bool) -> None:
    print("\nPlan")
    total = len(entries)
    for idx, row in enumerate(entries, start=1):
        prefix = f"[{idx}/{total}] {row['player_name']} ({row['player_slug']})"
        if row["status"] == "planned":
            print(f"{prefix} -> planned")
            print(f"  video     : {row['video_path']}")
            print(f"  output    : {row['output_dir']}")
            if print_commands and row["command"]:
                print(f"  command   : {shlex.join(row['command'])}")
        else:
            print(f"{prefix} -> skipped ({row['skip_reason']})")
            if row["skip_reason"] == SKIP_MISSING_VIDEO:
                print("  globs     :")
                for attempt in row["video_glob_attempts"]:
                    print(f"    - {attempt['pattern']}: {attempt['match_count']} match(es)")


def _execute_plan(
    planned: list[dict[str, Any]],
    *,
    dry_run: bool,
    limit: Optional[int],
    clean_output: bool,
    publish_web: bool,
    print_commands: bool,
    session_slug: str,
) -> list[dict[str, Any]]:
    if publish_web and session_slug != "mechanics_latest":
        raise SystemExit(
            f"HARD FAIL: --publish-web requires session_slug='mechanics_latest', got '{session_slug}'"
        )

    if dry_run:
        return [dict(row) for row in planned]

    results: list[dict[str, Any]] = []
    executed = 0
    for row in planned:
        entry = dict(row)
        entry["duration_sec"] = 0.0

        if entry["status"] != "planned":
            results.append(entry)
            continue

        if limit is not None and executed >= limit:
            entry["status"] = "skipped"
            entry["skip_reason"] = SKIP_LIMIT_REACHED
            results.append(entry)
            continue

        started = time.perf_counter()
        executed += 1
        if print_commands:
            print(f"\nRun {entry['player_slug']} command: {shlex.join(entry['command'])}")
        else:
            print(f"\nRun {entry['player_slug']}")

        try:
            output_dir = Path(entry["output_dir"])
            if clean_output:
                # Remove ALL sibling session folders for this player (prevents date sprawl)
                player_dir = output_dir.parent
                if player_dir.exists():
                    for sibling in player_dir.iterdir():
                        if sibling.is_dir() and sibling.name != "batch_runs":
                            shutil.rmtree(sibling, ignore_errors=True)
                else:
                    shutil.rmtree(output_dir, ignore_errors=True)

            ok, runner_output = _run_subprocess(list(entry["command"]))
            if not ok:
                entry["status"] = "failed"
                entry["error"] = runner_output
                entry["duration_sec"] = round(time.perf_counter() - started, 3)
                results.append(entry)
                continue

            video_path = Path(entry["video_path"])
            source_dir = _runner_output_dir(entry["player_slug"], video_path)
            _sync_runner_output_to_target(source_dir=source_dir, target_dir=output_dir)
            _ensure_manual_template_in_coach_pack(output_dir)

            missing = _verify_artifacts(output_dir)
            entry["missing_artifacts"] = missing
            if missing:
                entry["status"] = "failed"
                entry["error"] = "Missing artifacts: " + ", ".join(missing)
                entry["artifacts_verified"] = False
            else:
                entry["status"] = "ran"
                entry["artifacts_verified"] = True
                if publish_web:
                    target_public = _publish_to_web(
                        player_slug=entry["player_slug"],
                        session_slug=session_slug,
                        source_session_dir=output_dir,
                    )
                    entry["published_session_dir"] = str(target_public)
                    # Post-publish verification
                    pub_notes = target_public / "notes.json"
                    if not pub_notes.exists():
                        raise FileNotFoundError(f"Post-publish check failed: {pub_notes} missing")
                    pub_data = json.loads(pub_notes.read_text())
                    pub_score = pub_data.get("efficiency_score")
                    if pub_score is None or not isinstance(pub_score, (int, float)):
                        raise ValueError(f"Post-publish check failed: efficiency_score not parseable in {pub_notes}")
                    entry["published_verified"] = True

        except Exception:
            entry["status"] = "failed"
            entry["error"] = _short_error(traceback.format_exc())

        entry["duration_sec"] = round(time.perf_counter() - started, 3)
        results.append(entry)

    return results


PASS_THRESHOLD = 6.0
LOW_CONFIDENCE_THRESHOLD = 0.5


def _session_stats_from_notes(notes: dict[str, Any]) -> dict[str, Any]:
    """Extract session-level stats from a notes.json for HubSessionEntry shape."""
    metrics = notes.get("metrics", {})
    if not isinstance(metrics, dict):
        metrics = {}

    pass_count = 0
    fail_count = 0
    confs: list[float] = []
    low_conf_count = 0

    for metric in metrics.values():
        if not isinstance(metric, dict):
            continue
        score = metric.get("score")
        if isinstance(score, (int, float)):
            if score >= PASS_THRESHOLD:
                pass_count += 1
            else:
                fail_count += 1
        conf = metric.get("confidence")
        if isinstance(conf, (int, float)):
            confs.append(float(conf))
            if conf < LOW_CONFIDENCE_THRESHOLD:
                low_conf_count += 1

    avg_confidence = round(sum(confs) / len(confs), 2) if confs else None
    eff_score = notes.get("efficiency_score")
    eff_low_conf = notes.get("efficiency_low_confidence", False)

    return {
        "efficiency_score": eff_score,
        "efficiency_low_confidence": bool(eff_low_conf),
        "hand": str(notes.get("hand", "R")).upper(),
        "view_mode": str(notes.get("view_mode", "open_side")),
        "pass_count": pass_count,
        "fail_count": fail_count,
        "avg_confidence": avg_confidence,
        "low_confidence_count": low_conf_count,
    }


def _player_name_from_slug(slug: str) -> str:
    """Convert 'first_last' slug to 'First Last' display name."""
    return " ".join(part.capitalize() for part in slug.split("_"))


def _player_id_from_slug(slug: str) -> str:
    """Convert 'first_last' slug to 'FLast1' player_id format."""
    parts = slug.split("_")
    if len(parts) < 2:
        return slug.capitalize() + "1"
    first_initial = parts[0][0].upper()
    last = parts[-1].capitalize()
    return f"{first_initial}{last}1"


def _profile_slug_from_slug(slug: str) -> str:
    """Convert 'first_last' mechanics slug to 'last_first' profile slug."""
    parts = slug.split("_")
    if len(parts) < 2:
        return slug
    return f"{'_'.join(parts[1:])}_{parts[0]}"


def _load_player_registry() -> dict[str, dict[str, str]]:
    """Load players.json to get authoritative names and profile slugs."""
    players_json_path = REPO_ROOT / "web" / "data" / "players.json"
    if not players_json_path.exists():
        return {}
    try:
        with open(players_json_path) as f:
            data = json.load(f)
    except Exception:
        return {}
    registry: dict[str, dict[str, str]] = {}
    for entry in data:
        slug = entry.get("slug") or entry.get("player_slug", "")
        name = entry.get("name") or entry.get("full_name", "")
        if slug and name:
            registry[slug] = {"name": name, "profile_slug": slug}
    return registry


def _rebuild_web_index(session_slug: str) -> tuple[Path, int]:
    if session_slug != "mechanics_latest":
        raise SystemExit(
            f"HARD FAIL: rebuild_web_index requires session_slug='mechanics_latest', got '{session_slug}'"
        )

    player_registry = _load_player_registry()
    today = datetime.now().strftime("%Y-%m-%d")

    players: list[dict[str, Any]] = []
    for player_dir in sorted(OUTPUT_ROOT.iterdir(), key=lambda p: p.name.lower()):
        if not player_dir.is_dir() or player_dir.name == "batch_runs":
            continue
        player_slug = player_dir.name
        coach_pack_dir = player_dir / session_slug / "coach_pack"
        notes_path = coach_pack_dir / "notes.json"
        if not notes_path.exists():
            continue
        try:
            with open(notes_path) as f:
                notes = json.load(f)
        except Exception:
            continue

        # Resolve display name and profile_slug from players.json
        profile_slug = _profile_slug_from_slug(player_slug)
        reg_entry = player_registry.get(profile_slug, {})
        display_name = reg_entry.get("name") or _player_name_from_slug(player_slug)
        player_id = _player_id_from_slug(player_slug)

        session_stats = _session_stats_from_notes(notes)
        session_entry = {
            "slug": session_slug,
            "date": today,
            "label": "Mechanics Latest",
            **session_stats,
        }

        player_entry = {
            "slug": player_slug,
            "player_id": player_id,
            "name": display_name,
            "profile_slug": profile_slug,
            "sessions": [session_entry],
        }
        players.append(player_entry)

    players.sort(key=lambda row: row["slug"])
    payload = {"players": players}
    index_path = REPO_ROOT / "web" / "public" / "mechanics" / "index.json"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    with open(index_path, "w") as f:
        json.dump(payload, f, indent=2)
    return index_path, len(players)


def _build_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts = Counter(row["status"] for row in results)
    skip_reason_counts = Counter(
        row["skip_reason"] for row in results if row["status"] == "skipped" and row["skip_reason"]
    )
    return {
        "total_players": len(results),
        "ran": int(status_counts.get("ran", 0)),
        "skipped": int(status_counts.get("skipped", 0)),
        "failed": int(status_counts.get("failed", 0)),
        "planned": int(status_counts.get("planned", 0)),
        "status_counts": dict(status_counts),
        "skip_reason_counts": dict(skip_reason_counts),
    }


def _write_batch_log(payload: dict[str, Any]) -> Path:
    log_dir = OUTPUT_ROOT / "batch_runs"
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"mechanics_batch_{timestamp}.json"
    with open(log_path, "w") as f:
        json.dump(payload, f, indent=2)
    return log_path


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
    print(f"[batch] session_slug={args.session_slug}")
    print(f"[batch] player_folders={len(player_dirs)}")

    planned_entries = _build_plan_entries(
        player_dirs=player_dirs,
        only_tokens=only_tokens,
        skip_tokens=skip_tokens,
        force=bool(args.force),
        session_slug=args.session_slug,
        runner_python=runner_python,
        runner_path=runner_path,
        defaults=defaults,
    )
    _print_plan(planned_entries, print_commands=bool(args.print_commands))

    results = _execute_plan(
        planned=planned_entries,
        dry_run=bool(args.dry_run),
        limit=args.limit,
        clean_output=bool(args.clean_output),
        publish_web=bool(args.publish_web),
        print_commands=bool(args.print_commands),
        session_slug=args.session_slug,
    )
    summary = _build_summary(results)

    rebuilt_index_path: Optional[str] = None
    rebuilt_index_players: Optional[int] = None
    if args.rebuild_index and not args.dry_run:
        index_path, count = _rebuild_web_index(args.session_slug)
        rebuilt_index_path = str(index_path)
        rebuilt_index_players = count

    payload = {
        "schema_version": 3,
        "run_metadata": {
            "timestamp": datetime.now().isoformat(timespec="seconds"),
            "git": git_info,
            "args": vars(args),
            "cwd": str(Path.cwd()),
            "python": sys.executable,
            "runner_python": runner_python,
            "runner_path": str(runner_path),
            "defaults": defaults,
        },
        "root": str(root),
        "planned_entries": planned_entries,
        "results": results,
        "summary": summary,
        "rebuild_index": {
            "requested": bool(args.rebuild_index),
            "index_path": rebuilt_index_path,
            "players_written": rebuilt_index_players,
        },
    }
    log_path = _write_batch_log(payload)

    print("\nSummary")
    print(f"  total_players : {summary['total_players']}")
    print(f"  planned       : {summary['planned']}")
    print(f"  ran           : {summary['ran']}")
    print(f"  skipped       : {summary['skipped']}")
    print(f"  failed        : {summary['failed']}")
    print("  skip_reasons  :")
    if summary["skip_reason_counts"]:
        for reason, count in sorted(summary["skip_reason_counts"].items()):
            print(f"    - {reason}: {count}")
    else:
        print("    - (none)")
    if rebuilt_index_path:
        print(f"  rebuilt_index : {rebuilt_index_path} (players={rebuilt_index_players})")
    print(f"  batch_log     : {log_path}")


if __name__ == "__main__":
    main()
