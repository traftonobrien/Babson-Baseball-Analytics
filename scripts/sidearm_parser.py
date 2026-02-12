import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup

BAT_HEADER_ALIASES = {
    "name": {"player", "batters", "batting", "name"},
    "pos": {"pos", "position"},
    "ab": {"ab"},
    "r": {"r"},
    "h": {"h"},
    "rbi": {"rbi"},
    "bb": {"bb"},
    "so": {"so", "k"},
    "hr": {"hr"},
    "sb": {"sb"},
    "hbp": {"hbp"},
    "avg": {"avg", "ba"},
}

PITCH_HEADER_ALIASES = {
    "name": {"pitchers", "pitcher", "name", "player"},
    "ip": {"ip"},
    "h": {"h"},
    "r": {"r"},
    "er": {"er"},
    "bb": {"bb"},
    "so": {"so", "k"},
    "hr": {"hr"},
    "bf": {"bf"},
    "p_s": {"p-s", "pitchesstrikes", "pitchess", "ps", "np"},
    "era": {"era"},
}

BAT_MARKERS = {"ab", "r", "h", "rbi", "bb", "so"}
PITCH_MARKERS = {"ip", "er", "bf", "bb", "so", "np"}


def normalize_whitespace(text: str) -> str:
    return " ".join(text.split()).strip()


def normalize_header(text: str) -> str:
    text = normalize_whitespace(text).lower()
    return re.sub(r"[^a-z0-9-]+", "", text)


def strip_parentheticals(text: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", text)


def clean_name_cell(text: str) -> str:
    text = normalize_whitespace(text)
    text = strip_parentheticals(text)
    text = re.sub(r"[#*]+$", "", text)
    return normalize_whitespace(text)


def normalize_name(raw: str) -> str:
    if raw is None:
        return ""
    text = clean_name_cell(raw)
    text = re.sub(r"\s+\d+$", "", text)
    tokens = text.split()
    pos_tokens = {
        "p",
        "c",
        "1b",
        "2b",
        "3b",
        "ss",
        "lf",
        "cf",
        "rf",
        "of",
        "if",
        "dh",
        "ph",
        "pr",
    }
    tokens = [token for token in tokens if token.lower() not in pos_tokens]
    text = " ".join(tokens)
    if "," in text:
        parts = [p.strip() for p in text.split(",", 1)]
        if len(parts) == 2 and parts[1]:
            text = f"{parts[1]} {parts[0]}"
    return normalize_whitespace(text)


def normalize_player_name(text: str) -> str:
    normalized = normalize_name(text).lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", normalized)
    return normalize_whitespace(normalized)


def normalize_team_name(name: str) -> str:
    return re.sub(r"[^a-z]+", "", (name or "").lower())


def safe_int(value: str) -> Optional[int]:
    if value is None:
        return None
    text = normalize_whitespace(value)
    if not text or text in {"-", "--"}:
        return None
    try:
        return int(text)
    except ValueError:
        return None


def safe_float(value: str) -> Optional[float]:
    if value is None:
        return None
    text = normalize_whitespace(value)
    if not text or text in {"-", "--"}:
        return None
    if text.startswith("."):
        text = f"0{text}"
    try:
        return float(text)
    except ValueError:
        return None


def parse_date(value: str) -> Optional[str]:
    if not value:
        return None
    value = normalize_whitespace(value)
    formats = [
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%b %d, %Y",
        "%B %d, %Y",
    ]
    for fmt in formats:
        try:
            parsed = datetime.strptime(value, fmt)
            return parsed.date().isoformat()
        except ValueError:
            continue
    return None


def extract_date_from_text(text: str) -> Optional[str]:
    if not text:
        return None
    patterns = [
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}/\d{1,2}/\d{4}\b",
        r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            parsed = parse_date(match.group(0))
            if parsed:
                return parsed
    return None


def parse_table_headers(table) -> List[str]:
    header_row = None
    thead = table.find("thead")
    if thead:
        header_row = thead.find("tr")
    if header_row is None:
        header_row = table.find("tr")
    if header_row is None:
        return []
    return [normalize_whitespace(th.get_text(" ", strip=True)) for th in header_row.find_all(["th", "td"]) ]


def classify_table(headers: List[str]) -> Optional[str]:
    normalized = [normalize_header(h) for h in headers]
    if not normalized:
        return None
    has_name = any(
        h in BAT_HEADER_ALIASES["name"] or h in PITCH_HEADER_ALIASES["name"] for h in normalized
    )
    if not has_name:
        return None
    if "ip" in normalized or "era" in normalized or "bf" in normalized:
        return "pitching"
    bat_score = sum(1 for h in normalized if h in BAT_MARKERS)
    pitch_score = sum(1 for h in normalized if h in PITCH_MARKERS)
    if max(bat_score, pitch_score) < 2:
        return None
    return "pitching" if pitch_score > bat_score else "batting"


def clean_team_label(text: str) -> Optional[str]:
    if not text:
        return None
    cleaned = re.sub(r"(batting|pitching|statistics|stats)", "", text, flags=re.I)
    cleaned = re.sub(r"[-–|]+", " ", cleaned)
    cleaned = normalize_whitespace(cleaned)
    cleaned = re.sub(r"\s+\d+$", "", cleaned)
    return cleaned or None


def infer_team_name(table) -> Optional[str]:
    if table.caption:
        candidate = clean_team_label(table.caption.get_text(" ", strip=True))
        if candidate:
            return candidate
    for cls in ["sidearm-boxscore-team-name", "boxscore__team-name", "boxscore-team-name"]:
        tag = table.find_previous(class_=re.compile(cls))
        if tag:
            candidate = clean_team_label(tag.get_text(" ", strip=True))
            if candidate:
                return candidate
    for tag_name in ["h1", "h2", "h3", "h4", "h5", "strong"]:
        tag = table.find_previous(tag_name)
        if tag:
            candidate = clean_team_label(tag.get_text(" ", strip=True))
            if candidate:
                return candidate
    return None


def build_header_map(headers: List[str], alias_map: Dict[str, set]) -> Dict[str, int]:
    header_map: Dict[str, int] = {}
    normalized = [normalize_header(h) for h in headers]
    for idx, header in enumerate(normalized):
        for key, aliases in alias_map.items():
            if header in aliases and key not in header_map:
                header_map[key] = idx
    return header_map


def parse_batting_rows(table) -> List[Dict[str, Optional[object]]]:
    headers = parse_table_headers(table)
    header_map = build_header_map(headers, BAT_HEADER_ALIASES)
    rows: List[Dict[str, Optional[object]]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        values = [normalize_whitespace(td.get_text(" ", strip=True)) for td in cells]
        name_idx = header_map.get("name", 0)
        if name_idx >= len(values):
            continue
        name_raw = values[name_idx]
        if not name_raw:
            continue
        if "total" in name_raw.lower():
            continue
        name = normalize_name(name_raw)
        if not name:
            continue
        pos = None
        pos_idx = header_map.get("pos")
        if pos_idx is not None and pos_idx < len(values):
            pos = values[pos_idx] or None
        row = {
            "name": name,
            "pos": pos,
            "ab": safe_int(values[header_map["ab"]]) if "ab" in header_map else None,
            "r": safe_int(values[header_map["r"]]) if "r" in header_map else None,
            "h": safe_int(values[header_map["h"]]) if "h" in header_map else None,
            "rbi": safe_int(values[header_map["rbi"]]) if "rbi" in header_map else None,
            "bb": safe_int(values[header_map["bb"]]) if "bb" in header_map else None,
            "so": safe_int(values[header_map["so"]]) if "so" in header_map else None,
            "hr": safe_int(values[header_map["hr"]]) if "hr" in header_map else None,
            "sb": safe_int(values[header_map["sb"]]) if "sb" in header_map else None,
            "hbp": safe_int(values[header_map["hbp"]]) if "hbp" in header_map else None,
            "avg": safe_float(values[header_map["avg"]]) if "avg" in header_map else None,
        }
        rows.append(row)
    return rows


def parse_pitching_rows(table) -> List[Dict[str, Optional[object]]]:
    headers = parse_table_headers(table)
    header_map = build_header_map(headers, PITCH_HEADER_ALIASES)
    rows: List[Dict[str, Optional[object]]] = []
    for tr in table.find_all("tr"):
        cells = tr.find_all("td")
        if not cells:
            continue
        values = [normalize_whitespace(td.get_text(" ", strip=True)) for td in cells]
        name_idx = header_map.get("name", 0)
        if name_idx >= len(values):
            continue
        name_raw = values[name_idx]
        if not name_raw:
            continue
        if "total" in name_raw.lower():
            continue
        name = normalize_name(name_raw)
        if not name:
            continue
        pitches = None
        strikes = None
        ps_idx = header_map.get("p_s")
        if ps_idx is not None and ps_idx < len(values):
            ps_value = values[ps_idx]
            if "-" in ps_value:
                parts = [p.strip() for p in ps_value.split("-", 1)]
                pitches = safe_int(parts[0])
                strikes = safe_int(parts[1]) if len(parts) > 1 else None
            else:
                pitches = safe_int(ps_value)
        row = {
            "name": name,
            "ip": values[header_map["ip"]] if "ip" in header_map and header_map["ip"] < len(values) else None,
            "h": safe_int(values[header_map["h"]]) if "h" in header_map else None,
            "r": safe_int(values[header_map["r"]]) if "r" in header_map else None,
            "er": safe_int(values[header_map["er"]]) if "er" in header_map else None,
            "bb": safe_int(values[header_map["bb"]]) if "bb" in header_map else None,
            "so": safe_int(values[header_map["so"]]) if "so" in header_map else None,
            "hr": safe_int(values[header_map["hr"]]) if "hr" in header_map else None,
            "bf": safe_int(values[header_map["bf"]]) if "bf" in header_map else None,
            "pitches": pitches,
            "strikes": strikes,
            "era": safe_float(values[header_map["era"]]) if "era" in header_map else None,
        }
        rows.append(row)
    return rows


def parse_all_teams(html: str, debug: bool = False) -> Dict[str, Dict[str, List[Dict[str, Optional[object]]]]]:
    soup = BeautifulSoup(html, "html.parser")
    teams: Dict[str, Dict[str, List[Dict[str, Optional[object]]]]] = {}
    for idx, table in enumerate(soup.find_all("table")):
        headers = parse_table_headers(table)
        table_type = classify_table(headers)
        if not table_type:
            continue
        team_name = infer_team_name(table)
        if not team_name:
            continue
        if debug:
            print(f"[debug] table={idx} type={table_type} team={team_name} headers={headers}")
        if team_name not in teams:
            teams[team_name] = {"batting": [], "pitching": []}
        if table_type == "batting":
            teams[team_name]["batting"] = parse_batting_rows(table)
        else:
            teams[team_name]["pitching"] = parse_pitching_rows(table)
    return teams


def _strip_score_suffix(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    return re.sub(r"\s+\d+$", "", name).strip() or None


def _extract_opponent_from_title(title: str) -> Optional[str]:
    if not title:
        return None
    title = normalize_whitespace(title)
    match = re.search(r"\bvs\s+(.+?)\s+on\b", title, flags=re.I)
    if match:
        return _strip_score_suffix(clean_team_label(match.group(1)) or match.group(1))
    match = re.search(r"(.+?)\s+-vs-\s+(.+?)\b", title, flags=re.I)
    if match:
        left = clean_team_label(match.group(1)) or match.group(1)
        right = clean_team_label(match.group(2)) or match.group(2)
        if normalize_team_name(left) == "babson":
            return _strip_score_suffix(right)
        if normalize_team_name(right) == "babson":
            return _strip_score_suffix(left)
    return None


def parse_game_meta(html: str, debug: bool = False) -> Dict[str, Optional[object]]:
    soup = BeautifulSoup(html, "html.parser")
    text = soup.get_text(" ", strip=True)
    date = extract_date_from_text(text)
    teams = list(parse_all_teams(html, debug=debug).keys())
    opponent = _extract_opponent_from_title(soup.title.get_text(" ", strip=True) if soup.title else "")
    if not opponent:
        if len(teams) == 2:
            opponent = teams[1]
        elif teams:
            for name in teams:
                if normalize_team_name(name) != "babson":
                    opponent = name
                    break
    opponent = _strip_score_suffix(opponent)
    return {"opponent": opponent, "date": date, "teams": teams}


def parse_team_batting(html: str, team_name: str) -> List[Dict[str, Optional[object]]]:
    teams = parse_all_teams(html)
    return teams.get(team_name, {}).get("batting", [])


def parse_team_pitching(html: str, team_name: str) -> List[Dict[str, Optional[object]]]:
    teams = parse_all_teams(html)
    return teams.get(team_name, {}).get("pitching", [])
