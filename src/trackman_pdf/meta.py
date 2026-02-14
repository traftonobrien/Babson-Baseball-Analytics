"""Parse metadata from Trackman PDF header text.

Extracts:
    player_name, team, handedness, session_label, date_from, date_to, session_date
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class PdfMeta:
    player_name: Optional[str] = None
    player_slug: Optional[str] = None
    team: Optional[str] = None
    handedness: Optional[str] = None
    session_date: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    session_label: Optional[str] = None
    report_url: Optional[str] = None


def slugify(name: str) -> str:
    """Convert a name to a slug: lowercase, underscores, no punctuation."""
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", "", name)
    return re.sub(r"\s+", "_", cleaned.strip()).lower()


def _parse_date(raw: str) -> Optional[str]:
    """Normalize a date string to YYYY-MM-DD."""
    raw = raw.strip()
    # M/D/YYYY or MM/DD/YYYY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", raw)
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    # MM/DD/YY
    m = re.match(r"(\d{1,2})/(\d{1,2})/(\d{2})", raw)
    if m:
        year = int(m.group(3))
        year = year + 2000 if year < 50 else year + 1900
        return f"{year}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    # YYYY-MM-DD already
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", raw)
    if m:
        return raw
    return None


def parse_meta(text: str) -> PdfMeta:
    """Parse metadata from the full PDF text."""
    meta = PdfMeta()

    # Player name and handedness: "Last, First RHP/LHP Team"
    # Pattern: "Name, Name RHP/LHP TeamName"
    name_match = re.search(
        r"([A-Z][a-z]+(?:\s[A-Z][a-z]+)?,\s*[A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+(RHP|LHP)\s+(.+?)(?:\n|$)",
        text,
    )
    if name_match:
        meta.player_name = name_match.group(1).strip()
        meta.handedness = name_match.group(2).strip()
        meta.team = name_match.group(3).strip()
        meta.player_slug = slugify(meta.player_name)

    # Date range: look for date patterns near "Data from:" or standalone
    # Common format in Trackman PDFs: "1/1/2026  2/14/2026" or "01/01/2026  02/14/2026"
    date_pattern = r"(\d{1,2}/\d{1,2}/\d{2,4})"
    dates_in_text = re.findall(date_pattern, text)
    parsed_dates = []
    for d in dates_in_text:
        parsed = _parse_date(d)
        if parsed:
            parsed_dates.append(parsed)

    if len(parsed_dates) >= 2:
        sorted_dates = sorted(set(parsed_dates))
        meta.date_from = sorted_dates[0]
        meta.date_to = sorted_dates[-1]
        # Session date is typically the latest or second date
        meta.session_date = sorted_dates[-1]
    elif len(parsed_dates) == 1:
        meta.session_date = parsed_dates[0]
        meta.date_from = parsed_dates[0]
        meta.date_to = parsed_dates[0]

    # Session label: look near "Sessions:" text
    # The label is typically a short word like "Bullpen", "Live AB", etc.
    # After "Sessions:" the PDF may have dates and then other UI text.
    session_match = re.search(r"Sessions?:\s*\n?\s*(.+?)(?:\n|$)", text, re.I)
    if session_match:
        label = session_match.group(1).strip()
        # Remove date fragments
        label = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}", "", label).strip()
        # Remove chart/UI labels that leak in
        noise = [
            "Pitch Location", "Pitch Release", "Pitch Movement",
            "See Pitches", "Data from", "Reset Filters",
        ]
        for n in noise:
            label = label.replace(n, "")
        label = re.sub(r"\s+", " ", label).strip()
        if label and len(label) < 40:
            meta.session_label = label

    # Report URL
    url_match = re.search(r"(https?://teamportal\.trackmanbaseball\.com/\S+)", text)
    if url_match:
        meta.report_url = url_match.group(1).strip()

    return meta
