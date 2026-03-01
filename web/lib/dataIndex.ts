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
  throws: "R" | "L";
  outings: Outing[];
}

export const players: Player[] = [
  {
    id: "TOBrien1",
    name: "Trafton OBrien",
    throws: "R",
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
    throws: "R",
    outings: [
      {
        id: "JFinkelstein1/2025_04_27",
        label: "Apr 27, 2025 – Finkelstein (63 pitches)",
        ...buildDataPaths("JFinkelstein1", "2025_04_27"),
      },
      {
        id: "JFinkelstein1/2025_04_14",
        label: "Apr 14, 2025 – Finkelstein (91 pitches)",
        ...buildDataPaths("JFinkelstein1", "2025_04_14"),
      },
    ],
  },
 {
  id: "JClark1",
  name: "James Clark",
  throws: "R",
  outings: [
    {
        id: "JClark1/2026_02_27",
        label: "Feb 27, 2026 – Clark (43 pitches)",
        ...buildDataPaths("JClark1", "2026_02_27"),
      },
    {
        id: "JClark1/2025_04_09",
        label: "Apr 9, 2025 – Clark (55 pitches)",
        ...buildDataPaths("JClark1", "2025_04_09"),
      },
  {
        id: "JClark1/2025_04_27",
        label: "Apr 27, 2025 – Clark (13 pitches)",
        ...buildDataPaths("JClark1", "2025_04_27"),
      },
 ],
},
  {
    id: "ZTeator1",
    name: "Zander Teator",
    throws: "R",
    outings: [
      {
        id: "ZTeator1/2025_04_27",
        label: "Apr 27, 2025 – Teator (17 pitches)",
        ...buildDataPaths("ZTeator1", "2025_04_27"),
      },
    ],
  },
  {
    id: "CDoan1",
    name: "Connor Doan",
    throws: "R",
    outings: [
      {
        id: "CDoan1/2025_04_27",
        label: "Apr 27, 2025 – Doan (10 pitches)",
        ...buildDataPaths("CDoan1", "2025_04_27"),
      },
    ],
  },
  {
    id: "DJames1",
    name: "Dillon James",
    throws: "R",
    outings: [
      {
        id: "DJames1/2025_03_26",
        label: "Mar 26, 2025 – James (54 pitches)",
        ...buildDataPaths("DJames1", "2025_03_26"),
      },
    ],
  },
  {
    id: "CBurrows1",
    name: "Chase Burrows",
    throws: "L",
    outings: [
      {
        id: "CBurrows1/2025_03_26",
        label: "Mar 26, 2025 – Burrows (25 pitches)",
        ...buildDataPaths("CBurrows1", "2025_03_26"),
      },
    ],
  },
  {
    id: "SLangan1",
    name: "Shane Langan",
    throws: "R",
    outings: [
      {
        id: "SLangan1/2026_02_27",
        label: "Feb 27, 2026 – Langan (56 pitches)",
        ...buildDataPaths("SLangan1", "2026_02_27"),
      },
    ],
  },
  {
    id: "TPearl1",
    name: "Tristan Pearl",
    throws: "L",
    outings: [
      {
        id: "TPearl1/2026_02_27",
        label: "Feb 27, 2026 – Pearl (45 pitches)",
        ...buildDataPaths("TPearl1", "2026_02_27"),
      },
    ],
  },
  {
    id: "BValente1",
    name: "Ben Valente",
    throws: "R",
    outings: [
      {
        id: "BValente1/2026_02_27",
        label: "Feb 27, 2026 – Valente (15 pitches)",
        ...buildDataPaths("BValente1", "2026_02_27"),
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

