export type ChartingLocationCellKind =
  | "square"
  | "topLeftCorner"
  | "topRightCorner"
  | "bottomLeftCorner"
  | "bottomRightCorner";

export interface ChartingLocationCellConfig {
  id: number;
  label: string;
  kind: ChartingLocationCellKind;
  className: string;
}

export const CHARTING_LOCATION_CELLS: ChartingLocationCellConfig[] = [
  { id: 11, label: "11", kind: "topLeftCorner", className: "col-[1_/_span_2] row-[1_/_span_2]" },
  { id: 12, label: "12", kind: "topRightCorner", className: "col-[4_/_span_2] row-[1_/_span_2]" },
  { id: 13, label: "13", kind: "bottomLeftCorner", className: "col-[1_/_span_2] row-[4_/_span_2]" },
  { id: 14, label: "14", kind: "bottomRightCorner", className: "col-[4_/_span_2] row-[4_/_span_2]" },
  { id: 1, label: "1", kind: "square", className: "col-start-2 row-start-2" },
  { id: 2, label: "2", kind: "square", className: "col-start-3 row-start-2" },
  { id: 3, label: "3", kind: "square", className: "col-start-4 row-start-2" },
  { id: 4, label: "4", kind: "square", className: "col-start-2 row-start-3" },
  { id: 5, label: "5", kind: "square", className: "col-start-3 row-start-3" },
  { id: 6, label: "6", kind: "square", className: "col-start-4 row-start-3" },
  { id: 7, label: "7", kind: "square", className: "col-start-2 row-start-4" },
  { id: 8, label: "8", kind: "square", className: "col-start-3 row-start-4" },
  { id: 9, label: "9", kind: "square", className: "col-start-4 row-start-4" },
];

export function clipPathForLocationCell(kind: ChartingLocationCellKind) {
  switch (kind) {
    case "topLeftCorner":
      return "polygon(0% 0%, 100% 0%, 100% 30%, 32% 30%, 32% 100%, 0% 100%)";
    case "topRightCorner":
      return "polygon(0% 0%, 100% 0%, 100% 100%, 68% 100%, 68% 30%, 0% 30%)";
    case "bottomLeftCorner":
      return "polygon(0% 0%, 32% 0%, 32% 68%, 100% 68%, 100% 100%, 0% 100%)";
    case "bottomRightCorner":
      return "polygon(68% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 68%, 68% 68%)";
    case "square":
      return "none";
  }
}

export function cornerLabelClass(kind: ChartingLocationCellKind) {
  switch (kind) {
    case "topLeftCorner":
      return "left-5 top-4";
    case "topRightCorner":
      return "right-5 top-4";
    case "bottomLeftCorner":
      return "bottom-4 left-5";
    case "bottomRightCorner":
      return "bottom-4 right-5";
    case "square":
      return "";
  }
}
