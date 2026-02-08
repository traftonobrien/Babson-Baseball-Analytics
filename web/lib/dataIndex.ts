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
        id: "TOBrien1/2025_10_04",
        label: "Oct 4, 2025 – O'Brien (27 pitches)",
        ...buildDataPaths("TOBrien1", "2025_10_04"),
      },
    ],
  },
  {
    id: "JFinkelstein1",
    name: "Jason Finkelstein",
    outings: [
      {
        id: "JFinkelstein1/2024_04_27",
        label: "Apr 27, 2024 – Finkelstein (63 pitches)",
        ...buildDataPaths("JFinkelstein1", "2024_04_27"),
      },
      {
        id: "JFinkelstein1/2024_04_14",
        label: "Apr 14, 2024 – Finkelstein (91 pitches)",
        ...buildDataPaths("JFinkelstein1", "2024_04_14"),
      },
    ],
  },
 {
  id: "JClark1",
  name: "James Clark",
  outings: [
    {
        id: "JClark1/2024_04_09",
        label: "Apr 9, 2024 – Clark (55 pitches)",
        ...buildDataPaths("JClark1", "2024_04_09"),
      },
  {
        id: "JClark1/2024_04_27",
        label: "Apr 27, 2024 – Clark (13 pitches)",
        ...buildDataPaths("JClark1", "2024_04_27"),
      }, 
 ],
},
  {
    id: "ZTeator1",
    name: "Zander Teator",
    outings: [
      {
        id: "ZTeator1/2024_04_27",
        label: "Apr 27, 2024 – Teator (17 pitches)",
        ...buildDataPaths("ZTeator1", "2024_04_27"),
      },
    ],
  },
  {
    id: "CDoan1",
    name: "Connor Doan",
    outings: [
      {
        id: "CDoan1/2024_04_27",
        label: "Apr 27, 2024 – Doan (10 pitches)",
        ...buildDataPaths("CDoan1", "2024_04_27"),
      },
    ],
  },
];

export function getPlayer(id: string): Player | undefined {
  return players.find((p) => p.id === id);
}

export function buildDataPaths(playerId: string, dateId: string) {
  return {
    csvPath: `/data/${playerId}/${dateId}/pitch_data_overlay_lite.csv`,
    overlayDir: `/data/${playerId}/${dateId}/results`,
    clipsDir: `/data/${playerId}/${dateId}/clips`,
  };
}

