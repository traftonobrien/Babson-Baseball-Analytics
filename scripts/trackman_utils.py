import base64
import json
import os
import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Tuple
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


PITCH_KEY_HINTS = {
    "pitch",
    "pitch_type",
    "pitchtype",
    "pitchname",
    "release_speed",
    "velocity",
    "velo",
    "speed",
    "spin_rate",
    "spinrate",
    "px",
    "pz",
    "x",
    "z",
    "call",
    "result",
    "outcome",
}

FILTER_KEY_HINTS = {
    "player": "player",
    "player_id": "player",
    "playerid": "player",
    "start": "date_from",
    "startdate": "date_from",
    "from": "date_from",
    "datefrom": "date_from",
    "end": "date_to",
    "enddate": "date_to",
    "to": "date_to",
    "dateto": "date_to",
    "session": "session",
    "sessionid": "session",
    "pitch": "pitch_type",
    "pitchtype": "pitch_type",
}


def iso_timestamp() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def snake_case(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value)
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    return value.strip("_").lower()


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=True)
        handle.write("\n")


def load_har(path: str) -> Dict[str, Any]:
    return load_json(path)


def iter_har_entries(har: Dict[str, Any]) -> Iterable[Dict[str, Any]]:
    log = har.get("log", {})
    for entry in log.get("entries", []) or []:
        if isinstance(entry, dict):
            yield entry


def decode_response_text(entry: Dict[str, Any]) -> Optional[str]:
    content = entry.get("response", {}).get("content", {})
    text = content.get("text")
    if text is None:
        return None
    encoding = content.get("encoding")
    if encoding == "base64":
        try:
            return base64.b64decode(text).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            return None
    return text


def parse_json_maybe(text: Optional[str]) -> Optional[Any]:
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def is_pitch_like_rows(rows: Any) -> bool:
    if not isinstance(rows, list) or not rows:
        return False
    first = rows[0]
    if not isinstance(first, dict):
        return False
    keys = {snake_case(str(k)) for k in first.keys()}
    return len(keys & PITCH_KEY_HINTS) >= 2 or len(keys) >= 6


def detect_pitch_response(data: Any) -> Tuple[bool, Optional[List[Dict[str, Any]]], Optional[List[str]]]:
    if isinstance(data, dict):
        rows = data.get("rows") or data.get("data") or data.get("results")
        columns = data.get("columns") or data.get("headers")
        if is_pitch_like_rows(rows):
            return True, rows, columns if isinstance(columns, list) else None
    if isinstance(data, list) and is_pitch_like_rows(data):
        return True, data, None
    return False, None, None


def extract_columns(rows: Optional[List[Dict[str, Any]]], columns: Optional[List[Any]]) -> List[str]:
    if columns:
        return [str(col) for col in columns]
    if rows:
        return [str(key) for key in rows[0].keys()]
    return []


def sample_row_keys(rows: Optional[List[Dict[str, Any]]]) -> List[str]:
    if not rows:
        return []
    return [str(key) for key in rows[0].keys()]


def extract_payload(entry: Dict[str, Any]) -> Optional[Any]:
    post = entry.get("request", {}).get("postData") or {}
    if not isinstance(post, dict):
        return None
    text = post.get("text")
    if not text:
        return None
    mime = (post.get("mimeType") or "").lower()
    if "json" in mime:
        return parse_json_maybe(text)
    return text


def schema_for_payload(payload: Any) -> Any:
    if isinstance(payload, dict):
        return {str(k): schema_for_payload(v) for k, v in payload.items()}
    if isinstance(payload, list):
        if payload:
            return [schema_for_payload(payload[0])]
        return []
    return type(payload).__name__


def detect_filter_keys(payload: Any) -> Dict[str, List[str]]:
    matches: Dict[str, List[str]] = {}

    def visit(obj: Any, prefix: str = "") -> None:
        if isinstance(obj, dict):
            for key, value in obj.items():
                key_str = str(key)
                key_norm = snake_case(key_str)
                for hint, label in FILTER_KEY_HINTS.items():
                    if hint in key_norm:
                        matches.setdefault(label, []).append(prefix + key_str)
                        break
                visit(value, prefix + key_str + ".")
        elif isinstance(obj, list):
            for idx, item in enumerate(obj[:3]):
                visit(item, prefix + f"[{idx}].")

    visit(payload)
    return {k: sorted(set(v)) for k, v in matches.items()}


def redact_headers(headers: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    redacted = []
    for header in headers or []:
        name = str(header.get("name") or "")
        value = str(header.get("value") or "")
        lowered = name.lower()
        if any(token in lowered for token in ["authorization", "cookie", "token", "secret", "key"]):
            value = "***"
        redacted.append({"name": name, "value": value})
    return redacted


def report_id_from_url(url: str) -> Optional[str]:
    match = re.search(r"/reports/([a-zA-Z0-9_-]+)", url)
    if match:
        return match.group(1)
    return None


def report_id_from_har(har: Dict[str, Any]) -> Optional[str]:
    for entry in iter_har_entries(har):
        url = entry.get("request", {}).get("url")
        if not isinstance(url, str):
            continue
        report_id = report_id_from_url(url)
        if report_id:
            return report_id
    return None


def normalize_rows(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    normalized = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        normalized.append({snake_case(str(k)): v for k, v in row.items()})
    return normalized


def normalize_columns(columns: List[str]) -> List[str]:
    return [snake_case(str(col)) for col in columns]


def update_payload_filters(payload: Any, player: Optional[str], player_id: Optional[str], date_from: Optional[str], date_to: Optional[str], session: Optional[str]) -> Any:
    if not isinstance(payload, dict):
        return payload
    updated = {}
    for key, value in payload.items():
        key_norm = snake_case(str(key))
        if player_id and "player" in key_norm and "id" in key_norm:
            updated[key] = player_id
        elif player and "player" in key_norm and "id" not in key_norm:
            updated[key] = player
        elif date_from and any(token in key_norm for token in ["start", "from", "date_from"]):
            updated[key] = date_from
        elif date_to and any(token in key_norm for token in ["end", "to", "date_to"]):
            updated[key] = date_to
        elif session and "session" in key_norm:
            updated[key] = session
        else:
            updated[key] = update_payload_filters(value, player, player_id, date_from, date_to, session)
    return updated


def update_url_query(url: str, player: Optional[str], player_id: Optional[str], date_from: Optional[str], date_to: Optional[str], session: Optional[str]) -> str:
    parsed = urlparse(url)
    query = parse_qs(parsed.query)
    for key in list(query.keys()):
        key_norm = snake_case(key)
        if player_id and "player" in key_norm and "id" in key_norm:
            query[key] = [player_id]
        elif player and "player" in key_norm and "id" not in key_norm:
            query[key] = [player]
        elif date_from and any(token in key_norm for token in ["start", "from", "date_from"]):
            query[key] = [date_from]
        elif date_to and any(token in key_norm for token in ["end", "to", "date_to"]):
            query[key] = [date_to]
        elif session and "session" in key_norm:
            query[key] = [session]
    encoded = urlencode(query, doseq=True)
    return urlunparse(parsed._replace(query=encoded))


def score_entry(rows: Optional[List[Dict[str, Any]]], columns: List[str]) -> float:
    if not rows:
        return 0.0
    score = min(len(rows), 500) / 500.0
    if columns:
        score += 0.2
    return score
