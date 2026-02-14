import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional, Tuple

try:
    from trackman_utils import (
        decode_response_text,
        detect_pitch_response,
        extract_columns,
        iso_timestamp,
        load_har,
        load_json,
        normalize_rows,
        report_id_from_url,
        score_entry,
        update_payload_filters,
        update_url_query,
        write_json,
    )
except ImportError:  # pragma: no cover
    from scripts.trackman_utils import (  # type: ignore
        decode_response_text,
        detect_pitch_response,
        extract_columns,
        iso_timestamp,
        load_har,
        load_json,
        normalize_rows,
        report_id_from_url,
        score_entry,
        update_payload_filters,
        update_url_query,
        write_json,
    )


DEFAULT_STORAGE_STATE = ".secrets/trackman.storage.json"


def slugify_player(player: str) -> str:
    cleaned = "".join(ch if ch.isalnum() or ch == " " else " " for ch in player)
    parts = [p for p in cleaned.lower().split() if p]
    if len(parts) >= 2:
        return "_".join([parts[-1]] + parts[:-1])
    return "_".join(parts)


def select_best_rows_from_har(har_path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    har = load_har(har_path)
    best: Tuple[float, List[Dict[str, Any]], List[str]] = (0.0, [], [])
    for entry in har.get("log", {}).get("entries", []) or []:
        data = json_from_entry(entry)
        if data is None:
            continue
        is_pitch, rows, columns = detect_pitch_response(data)
        if not is_pitch or rows is None:
            continue
        column_list = extract_columns(rows, columns)
        score = score_entry(rows, column_list)
        if score > best[0]:
            best = (score, rows, column_list)
    if not best[1]:
        raise ValueError("No pitch rows found in HAR. Capture a HAR with pitch table requests.")
    return best[1], best[2]


def json_from_entry(entry: Dict[str, Any]) -> Optional[Any]:
    text = decode_response_text(entry)
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def load_offline_rows(path: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    data = load_json(path)
    if isinstance(data, dict) and "log" in data:
        return select_best_rows_from_har(path)
    if isinstance(data, dict) and "rows" in data:
        rows = data.get("rows")
        columns = data.get("columns")
        if not isinstance(rows, list):
            raise ValueError("Invalid rows in offline JSON fixture")
        column_list = extract_columns(rows, columns if isinstance(columns, list) else None)
        return rows, column_list
    if isinstance(data, list):
        rows = data
        column_list = extract_columns(rows, None)
        return rows, column_list
    if isinstance(data, dict) and "response" in data:
        response = data.get("response")
        if isinstance(response, dict):
            rows = response.get("rows") or response.get("data") or response.get("results")
            columns = response.get("columns") or response.get("headers")
            if isinstance(rows, list):
                column_list = extract_columns(rows, columns if isinstance(columns, list) else None)
                return rows, column_list
    raise ValueError("Unsupported offline fixture format. Provide HAR or response JSON with rows.")


def build_output(report_url: str, player: str, date_from: str, date_to: str, session: Optional[str], rows: List[Dict[str, Any]], columns: List[str]) -> Dict[str, Any]:
    return {
        "meta": {
            "reportUrl": report_url,
            "fetchedAt": iso_timestamp(),
            "player": player,
            "dateFrom": date_from,
            "dateTo": date_to,
            "session": session,
            "source": "trackman",
        },
        "columns": columns,
        "rows": normalize_rows(rows),
    }


def ensure_storage_state(path: str) -> None:
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Storage state not found at {path}. Run scripts/trackman_login.py first or pass --login."
        )


def load_recon_endpoints(report_id: str) -> List[Dict[str, Any]]:
    recon_path = os.path.join("output", "recon", f"{report_id}.json")
    if not os.path.exists(recon_path):
        raise FileNotFoundError(
            f"Recon output not found at {recon_path}. Run scripts/trackman_recon.py on a HAR first."
        )
    data = load_json(recon_path)
    endpoints = data.get("endpoints") if isinstance(data, dict) else None
    if not isinstance(endpoints, list) or not endpoints:
        raise ValueError("Recon output has no endpoints. Provide a HAR with pitch row requests.")
    return endpoints


def pick_endpoint(endpoints: List[Dict[str, Any]]) -> Dict[str, Any]:
    return endpoints[0]


def run_online_fetch(
    report_url: str,
    player: Optional[str],
    player_id: Optional[str],
    date_from: str,
    date_to: str,
    session: Optional[str],
    storage_state: str,
    login: bool,
    headless: bool,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    from playwright.sync_api import sync_playwright

    report_id = report_id_from_url(report_url)
    if not report_id:
        raise ValueError("Could not parse reportId from report URL")

    endpoints = load_recon_endpoints(report_id)
    endpoint = pick_endpoint(endpoints)
    url = endpoint.get("url")
    method = endpoint.get("method") or "GET"
    payload = endpoint.get("request", {}).get("payload")
    headers = endpoint.get("request", {}).get("headers") or []
    header_map = {
        item["name"]: item["value"]
        for item in headers
        if isinstance(item, dict) and item.get("value") != "***"
    }

    if not url:
        raise ValueError("Recon endpoint missing URL")

    if method.upper() == "GET":
        url = update_url_query(url, player, player_id, date_from, date_to, session)
    else:
        payload = update_payload_filters(payload, player, player_id, date_from, date_to, session)

    if payload is not None and "content-type" not in {k.lower() for k in header_map.keys()}:
        header_map["content-type"] = "application/json"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=storage_state if os.path.exists(storage_state) else None)
        page = context.new_page()

        if login or not os.path.exists(storage_state):
            from scripts.trackman_login import login_and_save

            login_and_save(page, storage_state)
            context = browser.new_context(storage_state=storage_state)
            page = context.new_page()

        page.goto(report_url, wait_until="domcontentloaded")

        try:
            local_keys = page.evaluate("() => Object.keys(localStorage)")
            session_keys = page.evaluate("() => Object.keys(sessionStorage)")
            print(f"localStorage keys: {local_keys}", file=sys.stderr)
            print(f"sessionStorage keys: {session_keys}", file=sys.stderr)
        except Exception:
            pass

        result = page.evaluate(
            """
            async ({url, method, headers, payload}) => {
                const options = { method, headers: headers || {}, credentials: 'include' };
                if (payload !== null && payload !== undefined && method.toUpperCase() !== 'GET') {
                    options.body = typeof payload === 'string' ? payload : JSON.stringify(payload);
                }
                const response = await fetch(url, options);
                const data = await response.json();
                return { status: response.status, data };
            }
            """,
            {"url": url, "method": method, "headers": header_map, "payload": payload},
        )

        browser.close()

    data = result.get("data") if isinstance(result, dict) else None
    if data is None:
        raise ValueError("Online fetch returned no data")
    is_pitch, rows, columns = detect_pitch_response(data)
    if not is_pitch or rows is None:
        raise ValueError("Online fetch did not return pitch rows. Check recon endpoint and filters.")
    column_list = extract_columns(rows, columns)
    return rows, column_list


def date_to_date_id(date_from: str) -> str:
    """Convert YYYY-MM-DD to yyyy_mm_dd."""
    return date_from.replace("-", "_")


def canonical_out_path(player_id: str, date_from: str) -> str:
    date_id = date_to_date_id(date_from)
    return os.path.join("web", "public", "data", player_id, date_id, "trackman", "pitches.json")


def default_out_path(player: str, date_from: str) -> str:
    slug = slugify_player(player)
    date_slug = date_from.replace("-", "")
    return os.path.join("web", "public", "trackman", "sessions", slug, f"{date_slug}.json")


def build_web_output(meta: Dict[str, Any], rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Build web-friendly output with 'pitches' key instead of 'rows'."""
    return {
        "meta": meta,
        "pitches": rows,
    }


SESSIONS_INDEX_PATH = os.path.join("web", "public", "stats", "trackman", "sessions.json")


def upsert_session_index(player_id: str, player_name: str, date_id: str, session_type: Optional[str], pitch_count: int, path: str) -> None:
    """Append or update an entry in sessions.json."""
    sessions: List[Dict[str, Any]] = []
    if os.path.exists(SESSIONS_INDEX_PATH):
        try:
            sessions = load_json(SESSIONS_INDEX_PATH)
            if not isinstance(sessions, list):
                sessions = []
        except Exception:
            sessions = []

    # Find existing or create new
    entry = None
    for s in sessions:
        if s.get("playerId") == player_id and s.get("date") == date_id:
            entry = s
            break

    if entry is None:
        entry = {}
        sessions.append(entry)

    entry["playerId"] = player_id
    entry["playerName"] = player_name
    entry["date"] = date_id
    entry["sessionType"] = session_type
    entry["pitchCount"] = pitch_count
    entry["path"] = path
    entry["updatedAt"] = iso_timestamp()

    os.makedirs(os.path.dirname(SESSIONS_INDEX_PATH), exist_ok=True)
    with open(SESSIONS_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(sessions, f, indent=2, ensure_ascii=True)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import Trackman session pitches")
    parser.add_argument("--har", help="HAR file or response JSON for offline mode")
    parser.add_argument("--login", action="store_true", help="Login with Playwright and refresh storageState")
    parser.add_argument("--report-url", required=True, help="Trackman report URL")
    parser.add_argument("--player", help='Player name as "Last, First"')
    parser.add_argument("--player-id", help="Player ID if available")
    parser.add_argument("--date-from", required=True, help="YYYY-MM-DD")
    parser.add_argument("--date-to", required=True, help="YYYY-MM-DD")
    parser.add_argument("--session", help="Session label")
    parser.add_argument("--out", help="Output JSON path")
    parser.add_argument("--storage-state", default=DEFAULT_STORAGE_STATE, help="Playwright storageState path")
    parser.add_argument("--headed", action="store_true", help="Run browser in headed mode")
    args = parser.parse_args()

    if not args.player and not args.player_id:
        raise SystemExit("Provide --player or --player-id")

    player_label = args.player or args.player_id or ""

    if args.har:
        rows, columns = load_offline_rows(args.har)
    else:
        if not args.login:
            ensure_storage_state(args.storage_state)
        rows, columns = run_online_fetch(
            args.report_url,
            args.player,
            args.player_id,
            args.date_from,
            args.date_to,
            args.session,
            args.storage_state,
            args.login,
            not args.headed,
        )

    output = build_output(
        args.report_url,
        player_label,
        args.date_from,
        args.date_to,
        args.session,
        rows,
        columns,
    )

    # Determine output path: --out > canonical (--player-id) > legacy slug
    if args.out:
        out_path = args.out
    elif args.player_id:
        out_path = canonical_out_path(args.player_id, args.date_from)
    else:
        out_path = default_out_path(player_label, args.date_from)

    # Write web-friendly format (pitches key) for canonical paths
    if args.player_id and not args.out:
        web_output = build_web_output(output["meta"], output["rows"])
        write_json(out_path, web_output)
    else:
        write_json(out_path, output)
    print(f"Wrote session JSON to {out_path}")

    # Update sessions index when using canonical path
    if args.player_id:
        date_id = date_to_date_id(args.date_from)
        upsert_session_index(
            player_id=args.player_id,
            player_name=player_label,
            date_id=date_id,
            session_type=args.session,
            pitch_count=len(rows),
            path=f"/data/{args.player_id}/{date_id}/trackman/pitches.json",
        )
        print(f"Updated sessions index at {SESSIONS_INDEX_PATH}")


if __name__ == "__main__":
    main()
