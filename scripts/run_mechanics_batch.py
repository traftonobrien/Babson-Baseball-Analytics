#!/usr/bin/env python3
"""
Batch-run the mechanics coach-pack pipeline for player folders.
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
import time
import unicodedata
from pathlib import Path
from typing import Any, Callable, Optional

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_ROOT = REPO_ROOT / "output" / "mechanics"
TRAFTON_NOTES_PATH = (
    OUTPUT_ROOT
    / "trafton_obrien"
    / "trafton_mechanics_test"
    / "coach_pack"
    / "notes.json"
)

DEFAULT_ROOT_CANDIDATES = (
    REPO_ROOT / "web" / "public" / "Mechanical Analysis",
    REPO_ROOT / "web" / "public" / "Mechanics Analysis",
    REPO_ROOT / "Mechanical Analysis",
    REPO_ROOT / "Mechanics Analysis",
)

BLOCKING_REQUIRED_ARTIFACTS = (
    "coach_pack/notes.json",
    "coach_pack/manual_template.json",
    "coach_pack/set.png",
    "coach_pack/peak_leg_lift.png",
    "coach_pack/foot_strike.png",
    "coach_pack/release.png",
    "coach_pack/strip.png",
)

OPTIONAL_ARTIFACTS = (
    "coach_pack/slowmo_review.mp4",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run mechanics coach-pack generation for player folders."
    )
    parser.add_argument(
        "--root",
        default=None,
        help=(
            "Player-folder root. If omitted, auto-detects in this order: "
            "web/public/Mechanical Analysis, web/public/Mechanics Analysis, "
            "Mechanical Analysis, Mechanics Analysis."
        ),
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-run even if output coach_pack/notes.json already exists.",
    )
    parser.add_argument(
        "--only",
        default=None,
        help='Comma-separated player slugs to run (example: "bobby_burk,shane_langan").',
    )
    parser.add_argument(
        "--skip",
        default=None,
        help='Comma-separated player slugs to skip (example: "trafton_obrien").',
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print planned runs only; do not execute subprocesses.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Optional max number of players to run (after filters).",
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


def _resolve_root(root_arg: Optional[str]) -> Path:
    if root_arg:
        candidate = Path(root_arg).expanduser()
        if candidate.exists():
            return candidate.resolve()

        # Handle common singular/plural/spelling differences.
        alt_names = ("Mechanical Analysis", "Mechanics Analysis")
        for alt_name in alt_names:
            alt_candidate = candidate.parent / alt_name
            if alt_candidate.exists():
                print(f"[root] using alternate folder: {alt_candidate}")
                return alt_candidate.resolve()
        raise FileNotFoundError(f"Root folder not found: {candidate}")

    for candidate in DEFAULT_ROOT_CANDIDATES:
        if candidate.exists():
            print(f"[root] auto-detected: {candidate}")
            return candidate.resolve()
    candidates_str = ", ".join(str(p) for p in DEFAULT_ROOT_CANDIDATES)
    raise FileNotFoundError(f"No mechanics analysis root found. Checked: {candidates_str}")


def _parse_slug_csv(raw: Optional[str]) -> set[str]:
    if not raw:
        return set()
    return {_slugify_name(piece.strip()) for piece in raw.split(",") if piece.strip()}


def _is_trafton(display_name: str) -> bool:
    return _compact_token(display_name) == "traftonobrien"


def _extract_last_name(display_name: str) -> str:
    clean = _normalize_ascii(display_name).replace(",", " ")
    parts = [part for part in re.split(r"\s+", clean) if part]
    return parts[-1] if parts else display_name


def _matches_mechanics_video(path: Path) -> bool:
    if not path.is_file():
        return False
    return bool(re.search(r" Mechanics\.[^.]+$", path.name, flags=re.IGNORECASE))


def _prefix_before_mechanics(path: Path) -> str:
    match = re.match(r"(.+?) Mechanics$", path.stem, flags=re.IGNORECASE)
    return match.group(1).strip() if match else path.stem


def _file_size(path: Path) -> int:
    try:
        return int(path.stat().st_size)
    except Exception:
        return -1


def _pick_video_file(player_dir: Path) -> tuple[Optional[Path], Optional[str]]:
    candidates = sorted([p for p in player_dir.iterdir() if _matches_mechanics_video(p)])
    if not candidates:
        return None, f"No video matching '* Mechanics.*' in {player_dir}"

    if len(candidates) == 1:
        return candidates[0], None

    last_name = _extract_last_name(player_dir.name)
    last_name_token = _compact_token(last_name)
    exact_last_name = [
        p for p in candidates if _compact_token(_prefix_before_mechanics(p)) == last_name_token
    ]

    pool = exact_last_name if exact_last_name else candidates
    pool.sort(key=lambda p: (_file_size(p), p.name.lower()), reverse=True)
    return pool[0], None


def _extract_folder_date(folder_name: str) -> Optional[str]:
    match = re.search(r"(20\d{2})[-_](\d{2})[-_](\d{2})", folder_name)
    if not match:
        return None
    y, m, d = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    try:
        parsed = dt.date(y, m, d)
    except ValueError:
        return None
    return parsed.strftime("%Y_%m_%d")


def _derive_session_slug(player_slug: str, folder_name: str) -> str:
    date_token = _extract_folder_date(folder_name)
    if not date_token:
        date_token = dt.date.today().strftime("%Y_%m_%d")
    return f"{player_slug}_mechanics_{date_token}"


def _load_trafton_defaults() -> dict[str, str]:
    defaults = {
        "hand": "R",
        "view_mode": "open_side",
        "metric_set": "open_side_pro_v3",
        "source": "script_defaults",
    }
    if not TRAFTON_NOTES_PATH.exists():
        return defaults

    try:
        with open(TRAFTON_NOTES_PATH) as f:
            notes = json.load(f)
    except Exception:
        return defaults

    hand = str(notes.get("hand", defaults["hand"])).upper()
    view_mode = str(notes.get("view_mode", defaults["view_mode"]))
    metric_set = str(notes.get("official_metric_set", defaults["metric_set"]))

    if hand not in {"R", "L"}:
        hand = defaults["hand"]
    if view_mode not in {"open_side", "front"}:
        view_mode = defaults["view_mode"]

    return {
        "hand": hand,
        "view_mode": view_mode,
        "metric_set": metric_set,
        "source": str(TRAFTON_NOTES_PATH),
    }


def _select_runner() -> tuple[str, Path]:
    coach_pack_runner = REPO_ROOT / "scripts" / "mechanics_coach_pack.py"
    run_session_runner = REPO_ROOT / "scripts" / "run_mechanics_session.py"
    if coach_pack_runner.exists():
        return "mechanics_coach_pack", coach_pack_runner
    if run_session_runner.exists():
        raise RuntimeError(
            "scripts/mechanics_coach_pack.py is missing. "
            "scripts/run_mechanics_session.py does not produce direct single-session coach_pack outputs in "
            "output/mechanics/<player_slug>/<session_slug>/coach_pack/."
        )
    raise FileNotFoundError("No mechanics runner found in scripts/")


def _build_runner_command(
    runner_kind: str,
    runner_path: Path,
    runner_python: str,
    video_path: Path,
    hand: str,
    view_mode: str,
) -> list[str]:
    if runner_kind == "mechanics_coach_pack":
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
    raise RuntimeError(f"Unsupported runner kind: {runner_kind}")


def _select_runner_python() -> str:
    venv_python = REPO_ROOT / ".venv" / "bin" / "python"
    if venv_python.exists():
        return str(venv_python)
    return sys.executable


def _runner_output_session_dir(player_slug: str, video_path: Path) -> Path:
    return OUTPUT_ROOT / player_slug / _slugify_name(video_path.stem)


def _target_session_dir(player_slug: str, session_slug: str) -> Path:
    return OUTPUT_ROOT / player_slug / session_slug


def _has_existing_output(session_dir: Path) -> bool:
    return (session_dir / "coach_pack" / "notes.json").is_file()


def _sync_runner_output_to_session(source_dir: Path, target_dir: Path, force: bool) -> None:
    if not source_dir.exists():
        raise FileNotFoundError(f"Runner output directory missing: {source_dir}")
    if source_dir.resolve() == target_dir.resolve():
        return

    if target_dir.exists():
        if not force:
            raise FileExistsError(f"Target session already exists: {target_dir}")
        shutil.rmtree(target_dir)

    target_dir.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_dir, target_dir)


def _ensure_manual_template_in_coach_pack(session_dir: Path) -> None:
    coach_pack_dir = session_dir / "coach_pack"
    coach_pack_dir.mkdir(parents=True, exist_ok=True)
    manual_root = session_dir / "manual_template.json"
    manual_coach = coach_pack_dir / "manual_template.json"
    if manual_coach.is_file():
        return
    if manual_root.is_file():
        shutil.copy2(manual_root, manual_coach)


def _verify_artifacts(session_dir: Path) -> tuple[list[str], list[str]]:
    blocking_missing: list[str] = []
    optional_missing: list[str] = []
    for rel in BLOCKING_REQUIRED_ARTIFACTS:
        if not (session_dir / rel).is_file():
            blocking_missing.append(rel)
    for rel in OPTIONAL_ARTIFACTS:
        if not (session_dir / rel).is_file():
            optional_missing.append(rel)
    return blocking_missing, optional_missing


def _run_subprocess(cmd: list[str]) -> tuple[bool, str]:
    proc = subprocess.run(
        cmd,
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()
        if not err:
            err = f"Runner exited with code {proc.returncode}"
        return False, err
    return True, (proc.stdout or "").strip()


def _write_batch_log(payload: dict[str, Any]) -> Path:
    log_dir = OUTPUT_ROOT / "batch_runs"
    log_dir.mkdir(parents=True, exist_ok=True)
    timestamp = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    log_path = log_dir / f"mechanics_batch_{timestamp}.json"
    with open(log_path, "w") as f:
        json.dump(payload, f, indent=2)
    return log_path


def main() -> None:
    args = parse_args()
    if args.limit is not None and args.limit <= 0:
        raise SystemExit("--limit must be > 0 when provided.")

    root = _resolve_root(args.root)
    only_slugs = _parse_slug_csv(args.only)
    skip_slugs = _parse_slug_csv(args.skip)
    defaults = _load_trafton_defaults()
    runner_kind, runner_path = _select_runner()
    runner_python = _select_runner_python()

    player_dirs = sorted([p for p in root.iterdir() if p.is_dir()], key=lambda p: p.name.lower())
    total_players = len(player_dirs)
    print(f"[batch] root={root}")
    print(f"[batch] runner={runner_path}")
    print(f"[batch] runner_python={runner_python}")
    print(
        f"[batch] defaults hand={defaults['hand']} view_mode={defaults['view_mode']} "
        f"metric_set={defaults['metric_set']}"
    )
    print(f"[batch] defaults_source={defaults['source']}")
    print(f"[batch] total_players={total_players}")

    summary = {
        "total_players": total_players,
        "ran": 0,
        "skipped_existing": 0,
        "skipped_trafton": 0,
        "skipped_flagged": 0,
        "failed": 0,
    }
    player_records: list[dict[str, Any]] = []
    run_budget_used = 0

    for idx, player_dir in enumerate(player_dirs, start=1):
        started = time.perf_counter()
        display_name = player_dir.name
        player_slug = _slugify_name(display_name)
        session_slug = _derive_session_slug(player_slug, display_name)
        chosen_video: Optional[Path] = None
        output_dir: Optional[Path] = _target_session_dir(player_slug, session_slug)
        missing_artifacts: list[str] = []
        error: Optional[str] = None
        status = "failed"
        reason = "unknown"

        print(f"\n[{idx}/{total_players}] {display_name} ({player_slug})")

        if _is_trafton(display_name):
            status = "skipped_trafton"
            reason = "trafton_excluded"
            summary["skipped_trafton"] += 1
            print("  -> skipped_trafton")
        elif only_slugs and player_slug not in only_slugs:
            status = "skipped_flag"
            reason = "not_in_only"
            summary["skipped_flagged"] += 1
            print("  -> skipped_flag (not in --only)")
        elif player_slug in skip_slugs:
            status = "skipped_flag"
            reason = "in_skip"
            summary["skipped_flagged"] += 1
            print("  -> skipped_flag (in --skip)")
        elif args.limit is not None and run_budget_used >= args.limit:
            status = "skipped_flag"
            reason = "limit_reached"
            summary["skipped_flagged"] += 1
            print("  -> skipped_flag (--limit reached)")
        else:
            chosen_video, pick_error = _pick_video_file(player_dir)
            if chosen_video is None:
                status = "failed"
                reason = "video_not_found"
                error = pick_error or "No matching mechanics video found."
                summary["failed"] += 1
                print(f"  -> failed ({error})")
            else:
                output_dir = _target_session_dir(player_slug, session_slug)
                runner_output_dir = _runner_output_session_dir(player_slug, chosen_video)
                print(f"  video      : {chosen_video}")
                print(f"  session    : {session_slug}")
                print(f"  output     : {output_dir}")

                if _has_existing_output(output_dir) and not args.force:
                    status = "skipped_existing"
                    reason = "existing_output"
                    summary["skipped_existing"] += 1
                    print("  -> skipped_existing")
                else:
                    cmd = _build_runner_command(
                        runner_kind=runner_kind,
                        runner_path=runner_path,
                        runner_python=runner_python,
                        video_path=chosen_video,
                        hand=defaults["hand"],
                        view_mode=defaults["view_mode"],
                    )
                    cmd_str = shlex.join(cmd)
                    print(f"  command    : {cmd_str}")
                    run_budget_used += 1

                    if args.dry_run:
                        status = "skipped_flag"
                        reason = "dry_run"
                        summary["skipped_flagged"] += 1
                        print("  -> skipped_flag (dry-run)")
                    else:
                        summary["ran"] += 1
                        ok, run_output = _run_subprocess(cmd)
                        if not ok:
                            status = "failed"
                            reason = "runner_failed"
                            error = run_output
                            summary["failed"] += 1
                            print("  -> failed (runner)")
                        else:
                            try:
                                _sync_runner_output_to_session(
                                    source_dir=runner_output_dir,
                                    target_dir=output_dir,
                                    force=args.force,
                                )
                                _ensure_manual_template_in_coach_pack(output_dir)
                                blocking_missing, optional_missing = _verify_artifacts(output_dir)
                                missing_artifacts = blocking_missing + optional_missing
                            except Exception as exc:
                                status = "failed"
                                reason = "output_sync_failed"
                                error = str(exc)
                                summary["failed"] += 1
                                print(f"  -> failed ({error})")
                            else:
                                if blocking_missing:
                                    status = "failed"
                                    reason = "missing_artifacts"
                                    error = "Missing required artifacts: " + ", ".join(blocking_missing)
                                    summary["failed"] += 1
                                    print(f"  -> failed ({error})")
                                else:
                                    status = "success"
                                    reason = "ok"
                                    if optional_missing:
                                        print(
                                            "  -> success (optional missing: "
                                            + ", ".join(optional_missing)
                                            + ")"
                                        )
                                    else:
                                        print("  -> success")

        duration_sec = round(time.perf_counter() - started, 3)
        player_records.append(
            {
                "player_display_name": display_name,
                "player_slug": player_slug,
                "session_slug": session_slug,
                "input_video": str(chosen_video) if chosen_video else None,
                "output_dir": str(output_dir) if output_dir else None,
                "status": status,
                "reason": reason,
                "duration_sec": duration_sec,
                "error": error,
                "missing_artifacts": missing_artifacts,
            }
        )

    payload = {
        "schema_version": 1,
        "created_at": dt.datetime.now().isoformat(timespec="seconds"),
        "root": str(root),
        "runner": str(runner_path),
        "force": bool(args.force),
        "dry_run": bool(args.dry_run),
        "limit": args.limit,
        "only": sorted(list(only_slugs)),
        "skip": sorted(list(skip_slugs)),
        "defaults": defaults,
        "summary": summary,
        "players": player_records,
    }
    log_path = _write_batch_log(payload)

    print("\nSummary")
    print(f"  total_players    : {summary['total_players']}")
    print(f"  ran              : {summary['ran']}")
    print(f"  skipped_existing : {summary['skipped_existing']}")
    print(f"  skipped_trafton  : {summary['skipped_trafton']}")
    print(f"  skipped_flagged  : {summary['skipped_flagged']}")
    print(f"  failed           : {summary['failed']}")
    print(f"  batch_log        : {log_path}")


if __name__ == "__main__":
    main()
