/**
 * Arsenal loader — fetches /data/Arsenals.csv and provides player lookups.
 * Cached after first fetch.
 */

interface ArsenalEntry {
  abbrev: string;
  pitchName: string;
}

interface PlayerMeta {
  playerName?: string;
  pitcherHand?: string;
}

interface PlayerRecord {
  playerName?: string;
  pitcherHand?: string;
  arsenal: ArsenalEntry[];
}

let loadPromise: Promise<Map<string, PlayerRecord>> | null = null;

function load(): Promise<Map<string, PlayerRecord>> {
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const map = new Map<string, PlayerRecord>();
    try {
      const res = await fetch("/data/Arsenals.csv");
      if (!res.ok) return map;
      const text = await res.text();
      const lines = text.trim().split("\n");
      if (lines.length < 2) return map;

      const header = lines[0].split(",").map((h) => h.trim());
      const idx = {
        player_id: header.indexOf("player_id"),
        player_name: header.indexOf("player_name"),
        pitcher_hand: header.indexOf("pitcher_hand"),
        pitch_type: header.indexOf("pitch_type"),
        abbreviation: header.indexOf("abbreviation"),
      };

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim());
        const pid = cols[idx.player_id] ?? "";
        if (!pid) continue;

        if (!map.has(pid)) {
          map.set(pid, {
            playerName: cols[idx.player_name] || undefined,
            pitcherHand: cols[idx.pitcher_hand] || undefined,
            arsenal: [],
          });
        }
        const abbrev = cols[idx.abbreviation] ?? "";
        if (abbrev) {
          map.get(pid)!.arsenal.push({
            abbrev,
            pitchName: cols[idx.pitch_type] ?? "",
          });
        }
      }
    } catch {
      // Arsenals.csv missing or unparseable — degrade gracefully
    }
    return map;
  })();

  return loadPromise;
}

export async function getPlayerMeta(
  playerId: string,
): Promise<PlayerMeta> {
  const data = await load();
  const rec = data.get(playerId);
  return {
    playerName: rec?.playerName,
    pitcherHand: rec?.pitcherHand,
  };
}

export async function getPlayerArsenal(
  playerId: string,
): Promise<ArsenalEntry[]> {
  const data = await load();
  return data.get(playerId)?.arsenal ?? [];
}
