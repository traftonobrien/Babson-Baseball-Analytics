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
      {
        id: "2024_04_14_Finkelstein",
        label: "Apr 14, 2024 – Finkelstein (91 pitches)",
        csvPath: "/data/2024_04_14_Finkelstein/pitch_data_overlay_lite.csv",
        overlayDir: "/data/2024_04_14_Finkelstein/results",
        clipsDir: "/data/2024_04_14_Finkelstein/clips",
      },
    ],
  },
 {
  id: "JClark1",
  name: "James Clark",
  outings: [
    {
      id: "2024_04_09_Clark",
      label: "Apr 9, 2024 – Clark (55 pitches)",
      csvPath: "/data/2024_04_09_Clark/pitch_data_overlay_lite.csv",
      overlayDir: "/data/2024_04_09_Clark/results",
      clipsDir: "/data/2024_04_09_Clark/clips",
    },
  {
  id: "2024_04_27_Clark",
  label: "Apr 27, 2024 – Clark (13 pitches)",
  csvPath: "/data/2024_04_27_Clark/pitch_data_overlay_lite.csv",
  overlayDir: "/data/2024_04_27_Clark/results",
  clipsDir: "/data/2024_04_27_Clark/clips",
}, 
 ],
},

];

export function getPlayer(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}
