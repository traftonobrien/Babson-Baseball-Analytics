export interface Outing {
  id: string;
  label: string;
  csvPath: string;
  overlayDir: string;
  clipsDir: string;
}

export interface Player {
  id: string;
  name: string;
  outings: Outing[];
}

export const players: Player[] = [
  {
    id: "TOBrien1",
    name: "Trafton O'Brien",
    outings: [
      {
        id: "2025_10_04_OBrien",
        label: "Oct 4, 2025 – O'Brien (27 pitches)",
        csvPath: "/data/2025_10_04_OBrien/pitch_data_overlay_lite.csv",
        overlayDir: "/data/2025_10_04_OBrien/results",
        clipsDir: "/data/2025_10_04_OBrien/clips",
      },
    ],
  },
  {
    id: "JFinkelstein1",
    name: "Jason Finkelstein",
    outings: [
      {
        id: "2024_04_27_Finkelstein",
        label: "Apr 27, 2024 – Finkelstein (63 pitches)",
        csvPath: "/data/2024_04_27_Finkelstein/pitch_data_overlay_lite.csv",
        overlayDir: "/data/2024_04_27_Finkelstein/results",
        clipsDir: "/data/2024_04_27_Finkelstein/clips",
      },
    ],
  },
];

export function getPlayer(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}
