export type ComparisonZoneBucketId =
  | "chaseUpperLeft"
  | "chaseUpperRight"
  | "chaseLowerLeft"
  | "chaseLowerRight"
  | "upperLeft"
  | "upperRight"
  | "lowerLeft"
  | "lowerRight"
  | "heart";

export interface ComparisonZoneBucketConfig {
  id: ComparisonZoneBucketId;
  label: string;
  placement: "chase" | "zone";
  cellIds: number[];
}

export interface ComparisonZoneBucket<Pitch, Summary> extends ComparisonZoneBucketConfig {
  pitches: Pitch[];
  summary: Summary;
}

export const COMPARISON_ZONE_BUCKET_CONFIG: ComparisonZoneBucketConfig[] = [
  {
    id: "chaseUpperLeft",
    label: "Chase Upper Left",
    placement: "chase",
    cellIds: [11],
  },
  {
    id: "chaseUpperRight",
    label: "Chase Upper Right",
    placement: "chase",
    cellIds: [12],
  },
  {
    id: "chaseLowerLeft",
    label: "Chase Lower Left",
    placement: "chase",
    cellIds: [13],
  },
  {
    id: "chaseLowerRight",
    label: "Chase Lower Right",
    placement: "chase",
    cellIds: [14],
  },
  {
    id: "upperLeft",
    label: "Upper Left",
    placement: "zone",
    cellIds: [1, 2],
  },
  {
    id: "upperRight",
    label: "Upper Right",
    placement: "zone",
    cellIds: [3, 6],
  },
  {
    id: "lowerLeft",
    label: "Lower Left",
    placement: "zone",
    cellIds: [4, 7],
  },
  {
    id: "lowerRight",
    label: "Lower Right",
    placement: "zone",
    cellIds: [8, 9],
  },
  {
    id: "heart",
    label: "Heart",
    placement: "zone",
    cellIds: [5],
  },
];

export function zoneBucketForLocationCell(
  locationCell: number | null
): ComparisonZoneBucketId | null {
  if (locationCell === null) {
    return null;
  }

  return (
    COMPARISON_ZONE_BUCKET_CONFIG.find((bucket) => bucket.cellIds.includes(locationCell))?.id ??
    null
  );
}

export function buildComparisonZoneBuckets<Pitch, Summary>(
  pitches: Pitch[],
  options: {
    getLocationCell: (pitch: Pitch) => number | null;
    summarize: (bucketPitches: Pitch[]) => Summary;
  }
): ComparisonZoneBucket<Pitch, Summary>[] {
  return COMPARISON_ZONE_BUCKET_CONFIG.map((bucket) => {
    const bucketPitches = pitches.filter(
      (pitch) => zoneBucketForLocationCell(options.getLocationCell(pitch)) === bucket.id
    );

    return {
      ...bucket,
      pitches: bucketPitches,
      summary: options.summarize(bucketPitches),
    };
  });
}

export function hiddenComparisonZonePitchCount<Pitch>(
  pitches: Pitch[],
  getLocationCell: (pitch: Pitch) => number | null
): number {
  return pitches.filter((pitch) => zoneBucketForLocationCell(getLocationCell(pitch)) === null)
    .length;
}
