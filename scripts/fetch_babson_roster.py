#!/usr/bin/env python3
"""Fetch height, weight, class, and optionally profile photos from Babson Athletics baseball roster.

Scrapes https://babsonathletics.com/sports/baseball/roster and outputs
web/data/roster.json keyed by slug (last_first) for merging with players.

Usage:
    python3 scripts/fetch_babson_roster.py
    python3 scripts/fetch_babson_roster.py --out web/data/roster.json
    python3 scripts/fetch_babson_roster.py --photos
    python3 scripts/fetch_babson_roster.py --photos --photos-dir web/public/images/players
"""

import argparse
import json
import re
import sys
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROSTER_URL = "https://babsonathletics.com/sports/baseball/roster"
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "web" / "data" / "roster.json"
DEFAULT_PHOTOS_DIR = Path(__file__).resolve().parents[1] / "web" / "public" / "images" / "players"

SLUG_ALIASES = {
    "grindle_cameron": ("grindle_cam",),
    "rhodes_patrick": ("rhodes_pat",),
}


def slugify_name(name: str) -> str:
    """'James Clark' -> 'clark_james'; 'Trafton O'Brien' -> 'obrien_trafton'."""
    cleaned = re.sub(r"[^a-zA-Z\s'-]", "", name).strip()
    cleaned = re.sub(r"'", "", cleaned)
    parts = [p for p in re.split(r"\s+", cleaned) if p]
    if len(parts) == 0:
        return ""
    if len(parts) == 1:
        return parts[0].lower()
    first = parts[0].lower()
    last = parts[-1].lower()
    return f"{last}_{first}"


def _photo_url_from_li(li) -> str | None:
    """Extract the full-size photo URL from a roster <li> element.

    Sidearm embeds per-player JSON-LD inside each <li>. Falls back to the
    <img> src if JSON-LD is absent.
    """
    # JSON-LD is the most reliable source — full-resolution URL
    script = li.find("script", type="application/ld+json")
    if script and script.string:
        try:
            data = json.loads(script.string)
            img = data.get("image") or {}
            if isinstance(img, dict):
                url = img.get("url") or img.get("contentUrl") or ""
            else:
                url = str(img)
            if url:
                return url if url.startswith("http") else f"https://babsonathletics.com{url}"
        except (json.JSONDecodeError, AttributeError):
            pass

    # Fallback: <img> inside the roster card
    img_el = li.find("img")
    if img_el:
        src = img_el.get("src") or img_el.get("data-src") or ""
        if src:
            return src if src.startswith("http") else f"https://babsonathletics.com{src}"

    return None


def fetch_roster() -> list[dict]:
    """Fetch and parse roster page. Returns list of player dicts."""
    resp = requests.get(ROSTER_URL, timeout=15)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    results = []
    for li in soup.find_all("li", class_="sidearm-roster-player"):
        url = li.get("data-player-url") or ""
        if "/coaches/" in url:
            continue

        # Name from first roster link (exclude "Full Bio")
        a = li.find("a", href=re.compile(r"/roster/[^/]+/\d+$"))
        if not a:
            continue
        name = (a.get_text() or "").strip()
        if not name or name == "Full Bio":
            # Try aria-label: "James Clark - View Full Bio"
            aria = a.get("aria-label") or ""
            if " - " in aria:
                name = aria.split(" - ")[0].strip()
        if not name:
            continue

        # Height, weight, class from Sidearm structure
        height_el = li.find(class_="sidearm-roster-player-height")
        weight_el = li.find(class_="sidearm-roster-player-weight")
        class_el = li.find(class_="sidearm-roster-player-academic-year")

        height = (height_el.get_text() or "").strip() if height_el else None
        weight_raw = (weight_el.get_text() or "").strip() if weight_el else None
        class_ = (class_el.get_text() or "").strip() if class_el else None

        # Normalize weight: "175 lbs" -> "175"
        weight = None
        if weight_raw:
            m = re.search(r"(\d+)", weight_raw)
            if m:
                weight = m.group(1)

        slug = slugify_name(name)
        if not slug:
            continue

        results.append({
            "slug": slug,
            "name": name,
            "height": height or None,
            "weight": weight,
            "class": class_.strip() if class_ else None,
            "photo_url": _photo_url_from_li(li),
        })

    return results


def download_photos(roster: list[dict], photos_dir: Path, force: bool = False) -> None:
    """Download player headshots to photos_dir/{slug}.jpg.

    Skips players without a photo_url and files that already exist (unless --force).
    """
    photos_dir.mkdir(parents=True, exist_ok=True)
    skipped = downloaded = errors = 0

    for player in roster:
        photo_url = player.get("photo_url")
        if not photo_url:
            print(f"  [skip]     {player['slug']} — no photo URL")
            skipped += 1
            continue

        # Determine extension from URL (default jpg)
        ext = Path(photo_url.split("?")[0]).suffix.lower() or ".jpg"
        dest = photos_dir / f"{player['slug']}{ext}"

        if dest.exists() and not force:
            print(f"  [exists]   {dest.name}")
            skipped += 1
            continue

        try:
            r = requests.get(photo_url, timeout=15)
            r.raise_for_status()
            # Use actual content-type to determine extension (server may return
            # WebP even when the URL ends in .jpg)
            ct = r.headers.get("Content-Type", "").split(";")[0].strip().lower()
            actual_ext = {
                "image/webp": ".webp",
                "image/jpeg": ".jpg",
                "image/png": ".png",
            }.get(ct, ext)
            if actual_ext != ext:
                dest = photos_dir / f"{player['slug']}{actual_ext}"
            dest.write_bytes(r.content)
            print(f"  [saved]    {dest.name}  ({len(r.content) // 1024} KB)")
            downloaded += 1
        except requests.RequestException as e:
            print(f"  [error]    {player['slug']}: {e}", file=sys.stderr)
            errors += 1

    print(f"\nPhotos: {downloaded} downloaded, {skipped} skipped, {errors} errors")


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch Babson baseball roster")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help="Output JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Print to stdout instead of writing")
    parser.add_argument("--photos", action="store_true", help="Download player headshots")
    parser.add_argument(
        "--photos-dir",
        default=str(DEFAULT_PHOTOS_DIR),
        help="Directory to save headshots (default: web/public/images/players)",
    )
    parser.add_argument("--force", action="store_true", help="Re-download photos that already exist")
    args = parser.parse_args()

    try:
        roster = fetch_roster()
    except requests.RequestException as e:
        print(f"Error fetching roster: {e}", file=sys.stderr)
        sys.exit(1)

    # Download photos if requested
    if args.photos:
        print(f"Downloading photos to {args.photos_dir} ...")
        download_photos(roster, Path(args.photos_dir), force=args.force)

    # Output roster JSON as slug -> {height, weight, class, photo} for easy merge
    photos_dir = Path(args.photos_dir)
    by_slug = {}
    for r in roster:
        photo_url = r.get("photo_url")
        photo_path = None
        if photo_url:
            # Prefer the actual file on disk (may differ from URL extension, e.g. WebP vs .jpg)
            slug = r["slug"]
            for candidate_ext in (".webp", ".jpg", ".png"):
                candidate = photos_dir / f"{slug}{candidate_ext}"
                if candidate.exists():
                    photo_path = f"/images/players/{slug}{candidate_ext}"
                    break
            # Fall back to URL-derived extension if nothing on disk yet
            if photo_path is None:
                ext = Path(photo_url.split("?")[0]).suffix.lower() or ".jpg"
                photo_path = f"/images/players/{r['slug']}{ext}"
        data = {
            "height": r["height"],
            "weight": r["weight"],
            "class": r["class"],
            "photo": photo_path,
        }
        by_slug[r["slug"]] = data
        for alias in SLUG_ALIASES.get(r["slug"], ()):
            by_slug[alias] = data

    if args.dry_run:
        json.dump(by_slug, sys.stdout, indent=2)
        print()
        return

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(by_slug, f, indent=2)
        f.write("\n")
    print(f"Wrote {len(by_slug)} players to {out_path}")


if __name__ == "__main__":
    main()
