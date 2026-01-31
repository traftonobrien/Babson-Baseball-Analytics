"""Sync player database from Google Sheets.

Uses service account authentication.

Sheet structure:
- Sheet "Players": player_id, name, hand, team, position, notes
- Sheet "Arsenal": player_id, pitch_type, abbreviation, avg_velo, usage_pct
"""

import argparse
import os
import re

import yaml


def connect_to_sheet(sheet_id, creds_path="data/credentials.json"):
    """Connect to Google Sheet using service account."""
    import gspread
    from google.oauth2.service_account import Credentials

    scopes = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    creds = Credentials.from_service_account_file(creds_path, scopes=scopes)
    client = gspread.authorize(creds)
    return client.open_by_key(sheet_id)


def pull_players(sheet_id, creds_path="data/credentials.json"):
    """Pull all player data from Google Sheet.

    Returns dict keyed by player_id.
    """
    sheet = connect_to_sheet(sheet_id, creds_path)

    players_ws = sheet.worksheet("Players")
    players_data = players_ws.get_all_records()

    arsenal_ws = sheet.worksheet("Arsenal")
    arsenal_data = arsenal_ws.get_all_records()

    players = {}
    for row in players_data:
        pid = str(row.get("player_id", "")).strip()
        if not pid:
            continue
        players[pid] = {
            "name": row.get("name", ""),
            "hand": row.get("hand", "R"),
            "team": row.get("team", ""),
            "position": row.get("position", ""),
            "notes": row.get("notes", ""),
            "arsenal": [],
        }

    for row in arsenal_data:
        pid = str(row.get("player_id", "")).strip()
        if pid and pid in players:
            players[pid]["arsenal"].append({
                "pitch_type": row.get("pitch_type", ""),
                "abbreviation": row.get("abbreviation", ""),
                "avg_velo": row.get("avg_velo", ""),
                "usage_pct": row.get("usage_pct", ""),
            })

    return players


def sync_to_yaml(sheet_id, creds_path="data/credentials.json",
                 output_path="data/players.yaml"):
    """Pull from Google Sheet and save to local YAML."""
    players = pull_players(sheet_id, creds_path)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        yaml.dump({"players": players}, f, default_flow_style=False, sort_keys=False)
    print(f"Synced {len(players)} players to {output_path}")
    return players


def get_player(player_id, sheet_id=None, creds_path="data/credentials.json",
               yaml_path="data/players.yaml"):
    """Get player info. Tries local YAML first, falls back to sheet.

    Returns dict with name, hand, team, position, notes, arsenal.
    Returns empty dict if not found.
    """
    if os.path.exists(yaml_path):
        with open(yaml_path) as f:
            data = yaml.safe_load(f)
        if data and "players" in data and player_id in data["players"]:
            return data["players"][player_id]

    if sheet_id:
        players = pull_players(sheet_id, creds_path)
        return players.get(player_id, {})

    return {}


def get_arsenal_abbreviations(player_id, yaml_path="data/players.yaml"):
    """Get list of pitch type abbreviations for a player.

    Returns list like ["FF", "CB", "SL", "CH"].
    """
    player = get_player(player_id, yaml_path=yaml_path)
    if not player or not player.get("arsenal"):
        return []
    return [p["abbreviation"] for p in player["arsenal"] if p.get("abbreviation")]


def set_default_sheet_id(sheet_id, config_path="config.yaml"):
    """Save the default sheet ID to config.yaml."""
    with open(config_path) as f:
        raw = f.read()

    block = (f"google_sheets:\n"
             f"  credentials_path: \"data/credentials.json\"\n"
             f"  default_sheet_id: \"{sheet_id}\"\n")

    if "google_sheets:" in raw:
        raw = re.sub(
            r"google_sheets:\n(?:  \S+:.*\n)*",
            block,
            raw,
        )
    else:
        raw = raw.rstrip() + "\n\n" + block

    with open(config_path, "w") as f:
        f.write(raw)
    print(f"Saved default sheet ID to {config_path}")


def get_default_sheet_id(config_path="config.yaml"):
    """Read default sheet ID from config.yaml."""
    if not os.path.exists(config_path):
        return None
    with open(config_path) as f:
        config = yaml.safe_load(f)
    gs = config.get("google_sheets")
    if gs:
        return gs.get("default_sheet_id")
    return None


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync player database from Google Sheets")
    parser.add_argument("--pull", action="store_true",
                        help="Pull player data from sheet and save to YAML")
    parser.add_argument("--sheet-id", type=str, default=None,
                        help="Google Sheet ID (or use default from config)")
    parser.add_argument("--set-default", type=str, default=None, metavar="SHEET_ID",
                        help="Save a default sheet ID to config.yaml")
    parser.add_argument("--creds", type=str, default="data/credentials.json",
                        help="Path to service account credentials JSON")
    parser.add_argument("--output", type=str, default="data/players.yaml",
                        help="Output YAML path (default: data/players.yaml)")
    parser.add_argument("--list", action="store_true",
                        help="List all players in local YAML")
    parser.add_argument("--player", type=str, default=None,
                        help="Show info for a specific player ID")
    args = parser.parse_args()

    if args.set_default:
        set_default_sheet_id(args.set_default)

    if args.pull:
        sheet_id = args.sheet_id or get_default_sheet_id()
        if not sheet_id:
            print("No sheet ID provided. Use --sheet-id or --set-default first.")
            exit(1)
        if not os.path.exists(args.creds):
            print(f"Credentials not found: {args.creds}")
            print("See docs/google_sheets_setup.md for setup instructions.")
            exit(1)
        sync_to_yaml(sheet_id, args.creds, args.output)

    if args.list:
        if not os.path.exists(args.output):
            print(f"No player data at {args.output}. Run --pull first.")
            exit(1)
        with open(args.output) as f:
            data = yaml.safe_load(f)
        players = data.get("players", {})
        print(f"{len(players)} players:")
        for pid, info in players.items():
            hand = info.get("hand", "?")
            name = info.get("name", "")
            arsenal = info.get("arsenal", [])
            pitches = ", ".join(p.get("abbreviation", "") for p in arsenal)
            print(f"  {pid:15s} {name:20s} ({hand}HP) {pitches}")

    if args.player:
        player = get_player(args.player, yaml_path=args.output)
        if not player:
            print(f"Player '{args.player}' not found in {args.output}")
            exit(1)
        print(f"Player: {args.player}")
        print(f"  Name: {player.get('name', '')}")
        print(f"  Hand: {player.get('hand', '')}HP")
        print(f"  Team: {player.get('team', '')}")
        print(f"  Position: {player.get('position', '')}")
        print(f"  Notes: {player.get('notes', '')}")
        arsenal = player.get("arsenal", [])
        if arsenal:
            print(f"  Arsenal ({len(arsenal)} pitches):")
            for p in arsenal:
                velo = p.get("avg_velo", "")
                usage = p.get("usage_pct", "")
                velo_str = f" {velo}mph" if velo else ""
                usage_str = f" ({usage}%)" if usage else ""
                print(f"    {p.get('abbreviation', ''):4s} {p.get('pitch_type', '')}"
                      f"{velo_str}{usage_str}")
