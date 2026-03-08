import {
  PDFDocument,
  PageSizes,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type {
  ChartingGame,
  ChartingGameSnapshot,
  ChartingPitch,
  ChartingPitcherSegment,
  ChartingPlateAppearance,
  PitchResult,
  PitchType,
} from "./types";

const PAGE_WIDTH = PageSizes.Letter[1];
const PAGE_HEIGHT = PageSizes.Letter[0];
const PAGE_MARGIN = 28;
const HEADER_HEIGHT = 92;
const SUMMARY_HEIGHT = 116;
const GRID_GAP = 12;
const CARD_COLUMNS = 3;
const CARD_ROWS = 2;
const CARDS_PER_PAGE = CARD_COLUMNS * CARD_ROWS;

const STRIKE_RESULTS = new Set<PitchResult>([
  "called_strike",
  "swinging_strike",
  "foul",
  "bunt_foul",
  "in_play",
]);

const BALL_RESULTS = new Set<PitchResult>(["ball", "hit_by_pitch"]);

type Point = { x: number; y: number };

export interface ChartingPdfPitchLine {
  sequence: number;
  countBefore: string;
  pitchTypeLabel: string;
  resultLabel: string;
  locationCell: number | null;
  zonePoint: Point | null;
}

export interface ChartingPdfPlateAppearanceCard {
  id: string;
  sequence: number;
  inningLabel: string;
  hitterLabel: string;
  pitcherName: string;
  resultCode: string;
  statusLabel: string;
  buntContext: boolean;
  footerLabel: string;
  pitches: ChartingPdfPitchLine[];
}

export interface ChartingPdfPitcherSummaryRow {
  name: string;
  innings: string;
  battersFaced: number;
  pitches: number;
  strikes: number;
  balls: number;
  runs: string;
  earnedRuns: string;
}

export interface ChartingPdfPageModel {
  number: number;
  cards: ChartingPdfPlateAppearanceCard[];
}

export interface ChartingPdfModel {
  title: string;
  metadata: Array<{ label: string; value: string }>;
  pages: ChartingPdfPageModel[];
  pitcherRows: ChartingPdfPitcherSummaryRow[];
  totals: {
    plateAppearances: number;
    pitches: number;
    strikes: number;
    balls: number;
  };
}

export function buildChartingPdfModel(
  snapshot: ChartingGameSnapshot
): ChartingPdfModel {
  const plateAppearances = [...snapshot.plateAppearances].sort(
    (left, right) => left.paOrder - right.paOrder || left.id.localeCompare(right.id)
  );
  const segmentById = new Map(snapshot.segments.map((segment) => [segment.id, segment]));
  const pitchesByPaId = new Map<string, ChartingPitch[]>();

  for (const pitch of snapshot.pitches) {
    const existing = pitchesByPaId.get(pitch.paId) ?? [];
    existing.push(pitch);
    pitchesByPaId.set(pitch.paId, existing);
  }

  const cards = plateAppearances.map((pa, index) =>
    buildPlateAppearanceCard(
      pa,
      index,
      pitchesByPaId.get(pa.id) ?? [],
      segmentById.get(pa.segmentId) ?? null
    )
  );

  const pages = chunk(cards, CARDS_PER_PAGE).map((pageCards, index) => ({
    number: index + 1,
    cards: pageCards,
  }));

  const pitcherRows = [...snapshot.segments]
    .sort((left, right) => left.segmentOrder - right.segmentOrder)
    .map((segment) => {
      const segmentPas = plateAppearances.filter((pa) => pa.segmentId === segment.id);
      const segmentPitches = segmentPas.flatMap((pa) =>
        [...(pitchesByPaId.get(pa.id) ?? [])].sort(
          (left, right) => left.pitchOrder - right.pitchOrder
        )
      );

      return {
        name: segment.displayName,
        innings: formatInningsSpan(segment),
        battersFaced: segmentPas.length,
        pitches: segmentPitches.length,
        strikes: segmentPitches.filter((pitch) =>
          STRIKE_RESULTS.has(pitch.pitchResult)
        ).length,
        balls: segmentPitches.filter((pitch) => BALL_RESULTS.has(pitch.pitchResult))
          .length,
        runs: formatNumeric(segment.runsOverride),
        earnedRuns: formatNumeric(segment.earnedRunsOverride),
      };
    });

  return {
    title: "Babson Baseball Pitching Chart",
    metadata: buildMetadata(snapshot.game),
    pages: pages.length > 0 ? pages : [{ number: 1, cards: [] }],
    pitcherRows,
    totals: {
      plateAppearances: plateAppearances.length,
      pitches: snapshot.pitches.length,
      strikes: snapshot.pitches.filter((pitch) =>
        STRIKE_RESULTS.has(pitch.pitchResult)
      ).length,
      balls: snapshot.pitches.filter((pitch) => BALL_RESULTS.has(pitch.pitchResult))
        .length,
    },
  };
}

export async function buildChartingPdf(
  snapshot: ChartingGameSnapshot
): Promise<Uint8Array> {
  const model = buildChartingPdfModel(snapshot);
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fonts = { regular, bold };

  pdfDoc.setTitle(model.title);
  pdfDoc.setAuthor("Babson Baseball");
  pdfDoc.setCreator("Pitch Tracker");
  pdfDoc.setProducer("Pitch Tracker");
  pdfDoc.setSubject(`Pitching chart vs ${snapshot.game.opponent}`);

  for (const pageModel of model.pages) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPage(page, model, pageModel, fonts);
  }

  return pdfDoc.save({ useObjectStreams: false });
}

export function buildChartingPdfFilename(
  game: Pick<ChartingGame, "gameDate" | "opponent">
): string {
  return `charting-${game.gameDate}-${slugify(game.opponent)}.pdf`;
}

function buildPlateAppearanceCard(
  pa: ChartingPlateAppearance,
  index: number,
  pitches: ChartingPitch[],
  segment: ChartingPitcherSegment | null
): ChartingPdfPlateAppearanceCard {
  const orderedPitches = [...pitches].sort(
    (left, right) => left.pitchOrder - right.pitchOrder
  );

  return {
    id: pa.id,
    sequence: index + 1,
    inningLabel: `Top ${pa.inning}`,
    hitterLabel: `#${pa.lineupSlot} ${pa.hitterName}`,
    pitcherName: segment?.displayName ?? "Unknown Pitcher",
    resultCode: pa.resultCode ?? "OPEN",
    statusLabel: pa.resultCode ? "Closed PA" : "Open PA",
    buntContext: pa.buntContext,
    footerLabel: `${orderedPitches.length} pitch${
      orderedPitches.length === 1 ? "" : "es"
    }`,
    pitches: orderedPitches.map((pitch, pitchIndex) => ({
      sequence: pitchIndex + 1,
      countBefore: `${pitch.ballsBefore}-${pitch.strikesBefore}`,
      pitchTypeLabel: abbreviatePitchType(pitch.pitchType),
      resultLabel: abbreviatePitchResult(pitch.pitchResult),
      locationCell: pitch.locationCell,
      zonePoint:
        pitch.locationCell === null ? null : getZonePoint(pitch.locationCell),
    })),
  };
}

function buildMetadata(game: ChartingGame) {
  return [
    { label: "Date", value: game.gameDate },
    { label: "Opponent", value: game.opponent },
    { label: "Status", value: formatGameStatus(game.status) },
    { label: "Charter", value: game.charter ?? "—" },
    { label: "Weather", value: game.weather ?? "—" },
    {
      label: "Catchers",
      value: compactJoin([game.homeCatcher, game.awayCatcher], " / "),
    },
    { label: "Record", value: game.babsonRecord ?? "—" },
    { label: "Standing", value: game.standing ?? "—" },
    {
      label: "Tomorrow",
      value: compactJoin([game.tomorrowStarter, game.tomorrowOpponent], " vs "),
    },
  ];
}

function drawPage(
  page: PDFPage,
  model: ChartingPdfModel,
  pageModel: ChartingPdfPageModel,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const width = page.getWidth();
  const height = page.getHeight();
  const ink = rgb(0.12, 0.14, 0.18);
  const paper = rgb(0.985, 0.985, 0.975);

  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: paper,
  });

  drawHeader(page, model, fonts);
  drawCardGrid(page, pageModel.cards, fonts);
  drawPitcherSummary(page, model, fonts);

  page.drawText(`Page ${pageModel.number}/${model.pages.length}`, {
    x: width - PAGE_MARGIN - 58,
    y: PAGE_MARGIN - 6,
    size: 8,
    font: fonts.regular,
    color: ink,
  });
}

function drawHeader(
  page: PDFPage,
  model: ChartingPdfModel,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const topY = page.getHeight() - PAGE_MARGIN;
  const titleColor = rgb(0.08, 0.11, 0.15);

  page.drawText(model.title, {
    x: PAGE_MARGIN,
    y: topY - 18,
    size: 18,
    font: fonts.bold,
    color: titleColor,
  });

  page.drawText("Portal export aligned to the live chart snapshot", {
    x: PAGE_MARGIN,
    y: topY - 36,
    size: 9,
    font: fonts.regular,
    color: rgb(0.36, 0.39, 0.43),
  });

  const gridTop = topY - 48;
  const cellGap = 8;
  const columnCount = 3;
  const cellWidth =
    (page.getWidth() - PAGE_MARGIN * 2 - cellGap * (columnCount - 1)) /
    columnCount;
  const cellHeight = 20;

  model.metadata.forEach((item, index) => {
    const column = index % columnCount;
    const row = Math.floor(index / columnCount);
    const x = PAGE_MARGIN + column * (cellWidth + cellGap);
    const y = gridTop - row * (cellHeight + 6);
    drawMetaCell(page, x, y, cellWidth, cellHeight, item.label, item.value, fonts);
  });
}

function drawMetaCell(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(0.965, 0.967, 0.963),
    borderColor: rgb(0.82, 0.83, 0.81),
    borderWidth: 0.8,
  });

  page.drawText(label.toUpperCase(), {
    x: x + 7,
    y: y + height - 8,
    size: 6.5,
    font: fonts.bold,
    color: rgb(0.47, 0.49, 0.47),
  });

  page.drawText(value, {
    x: x + 7,
    y: y + 5,
    size: 9,
    font: fonts.regular,
    color: rgb(0.1, 0.12, 0.15),
  });
}

function drawCardGrid(
  page: PDFPage,
  cards: ChartingPdfPlateAppearanceCard[],
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const gridTop = page.getHeight() - PAGE_MARGIN - HEADER_HEIGHT;
  const gridBottom = PAGE_MARGIN + SUMMARY_HEIGHT;
  const gridHeight = gridTop - gridBottom;
  const cardWidth =
    (page.getWidth() - PAGE_MARGIN * 2 - GRID_GAP * (CARD_COLUMNS - 1)) /
    CARD_COLUMNS;
  const cardHeight = (gridHeight - GRID_GAP * (CARD_ROWS - 1)) / CARD_ROWS;

  cards.forEach((card, index) => {
    const column = index % CARD_COLUMNS;
    const row = Math.floor(index / CARD_COLUMNS);
    const x = PAGE_MARGIN + column * (cardWidth + GRID_GAP);
    const y = gridTop - (row + 1) * cardHeight - row * GRID_GAP;
    drawPlateAppearanceCard(page, x, y, cardWidth, cardHeight, card, fonts);
  });

  const emptySlots = CARD_COLUMNS * CARD_ROWS - cards.length;
  for (let index = 0; index < emptySlots; index += 1) {
    const slotIndex = cards.length + index;
    const column = slotIndex % CARD_COLUMNS;
    const row = Math.floor(slotIndex / CARD_COLUMNS);
    const x = PAGE_MARGIN + column * (cardWidth + GRID_GAP);
    const y = gridTop - (row + 1) * cardHeight - row * GRID_GAP;
    page.drawRectangle({
      x,
      y,
      width: cardWidth,
      height: cardHeight,
      borderColor: rgb(0.88, 0.89, 0.87),
      borderWidth: 0.8,
      borderDashArray: [4, 4],
    });
  }
}

function drawPlateAppearanceCard(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  card: ChartingPdfPlateAppearanceCard,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.78, 0.79, 0.77),
    borderWidth: 1,
  });

  page.drawRectangle({
    x,
    y: y + height - 20,
    width,
    height: 20,
    color: rgb(0.94, 0.945, 0.938),
  });

  page.drawText(`PA ${String(card.sequence).padStart(2, "0")}`, {
    x: x + 10,
    y: y + height - 13,
    size: 8,
    font: fonts.bold,
    color: rgb(0.15, 0.17, 0.2),
  });

  page.drawText(card.inningLabel, {
    x: x + 58,
    y: y + height - 13,
    size: 8,
    font: fonts.regular,
    color: rgb(0.34, 0.36, 0.39),
  });

  const pitcherWidth = fonts.regular.widthOfTextAtSize(card.pitcherName, 8);
  page.drawText(card.pitcherName, {
    x: x + width - pitcherWidth - 10,
    y: y + height - 13,
    size: 8,
    font: fonts.regular,
    color: rgb(0.34, 0.36, 0.39),
  });

  page.drawText(card.hitterLabel, {
    x: x + 10,
    y: y + height - 36,
    size: 11,
    font: fonts.bold,
    color: rgb(0.12, 0.14, 0.18),
  });

  page.drawText(card.statusLabel, {
    x: x + 10,
    y: y + height - 50,
    size: 7.5,
    font: fonts.regular,
    color: rgb(0.47, 0.49, 0.52),
  });

  if (card.buntContext) {
    const tagWidth = fonts.bold.widthOfTextAtSize("BUNT", 7) + 10;
    const tagX = x + width - tagWidth - 10;
    page.drawRectangle({
      x: tagX,
      y: y + height - 48,
      width: tagWidth,
      height: 14,
      color: rgb(0.96, 0.92, 0.82),
      borderColor: rgb(0.87, 0.77, 0.54),
      borderWidth: 0.8,
    });
    page.drawText("BUNT", {
      x: tagX + 5,
      y: y + height - 44,
      size: 7,
      font: fonts.bold,
      color: rgb(0.53, 0.39, 0.12),
    });
  }

  const zoneSize = 84;
  const zoneX = x + 12;
  const zoneY = y + 40;
  drawZone(page, zoneX, zoneY, zoneSize);

  for (const pitch of card.pitches) {
    if (!pitch.zonePoint) {
      continue;
    }

    const markerX = zoneX + pitch.zonePoint.x * zoneSize;
    const markerY = zoneY + pitch.zonePoint.y * zoneSize;
    const markerColor = colorForPitchResult(pitch.resultLabel);

    page.drawCircle({
      x: markerX,
      y: markerY,
      size: 7,
      color: markerColor.fill,
      borderColor: markerColor.stroke,
      borderWidth: 1,
    });

    const numberText = String(pitch.sequence);
    const numberWidth = fonts.bold.widthOfTextAtSize(numberText, 6);
    page.drawText(numberText, {
      x: markerX - numberWidth / 2,
      y: markerY - 2.1,
      size: 6,
      font: fonts.bold,
      color: markerColor.text,
    });
  }

  const listX = zoneX + zoneSize + 14;
  const listWidth = x + width - listX - 10;
  const listTop = y + height - 62;

  page.drawText("Pitch Trail", {
    x: listX,
    y: listTop + 10,
    size: 7.5,
    font: fonts.bold,
    color: rgb(0.29, 0.31, 0.34),
  });

  const visiblePitches = card.pitches.slice(0, 6);
  visiblePitches.forEach((pitch, index) => {
    const rowY = listTop - index * 14;
    page.drawText(`${pitch.sequence}.`, {
      x: listX,
      y: rowY,
      size: 7,
      font: fonts.bold,
      color: rgb(0.12, 0.14, 0.18),
    });
    page.drawText(pitch.countBefore, {
      x: listX + 14,
      y: rowY,
      size: 7,
      font: fonts.regular,
      color: rgb(0.36, 0.39, 0.43),
    });
    page.drawText(pitch.pitchTypeLabel, {
      x: listX + 42,
      y: rowY,
      size: 7,
      font: fonts.bold,
      color: rgb(0.12, 0.14, 0.18),
    });
    page.drawText(pitch.resultLabel, {
      x: listX + Math.max(listWidth - 18, 96),
      y: rowY,
      size: 7,
      font: fonts.bold,
      color: rgb(0.18, 0.24, 0.29),
    });
  });

  if (card.pitches.length > visiblePitches.length) {
    page.drawText(`+${card.pitches.length - visiblePitches.length} more`, {
      x: listX,
      y: listTop - visiblePitches.length * 14,
      size: 7,
      font: fonts.regular,
      color: rgb(0.45, 0.47, 0.5),
    });
  }

  page.drawText(card.resultCode, {
    x: x + 12,
    y: y + 12,
    size: 20,
    font: fonts.bold,
    color: rgb(0.11, 0.13, 0.16),
  });

  const footerWidth = fonts.regular.widthOfTextAtSize(card.footerLabel, 8);
  page.drawText(card.footerLabel, {
    x: x + width - footerWidth - 10,
    y: y + 16,
    size: 8,
    font: fonts.regular,
    color: rgb(0.39, 0.41, 0.45),
  });
}

function drawZone(page: PDFPage, x: number, y: number, size: number) {
  const zoneInset = 16;
  const zoneX = x + zoneInset;
  const zoneY = y + zoneInset;
  const zoneSize = size - zoneInset * 2;
  const step = zoneSize / 3;
  const stroke = rgb(0.4, 0.42, 0.46);

  page.drawRectangle({
    x: zoneX,
    y: zoneY,
    width: zoneSize,
    height: zoneSize,
    borderColor: stroke,
    borderWidth: 1.2,
  });

  for (const offset of [1, 2]) {
    page.drawLine({
      start: { x: zoneX + step * offset, y: zoneY },
      end: { x: zoneX + step * offset, y: zoneY + zoneSize },
      thickness: 0.7,
      color: stroke,
    });
    page.drawLine({
      start: { x: zoneX, y: zoneY + step * offset },
      end: { x: zoneX + zoneSize, y: zoneY + step * offset },
      thickness: 0.7,
      color: stroke,
    });
  }

  const bracket = 10;
  drawBracket(page, zoneX, zoneY + zoneSize, -bracket, 0, 0, bracket);
  drawBracket(page, zoneX + zoneSize, zoneY + zoneSize, bracket, 0, 0, bracket);
  drawBracket(page, zoneX, zoneY, -bracket, 0, 0, -bracket);
  drawBracket(page, zoneX + zoneSize, zoneY, bracket, 0, 0, -bracket);
}

function drawBracket(
  page: PDFPage,
  x: number,
  y: number,
  horizontal: number,
  horizontalOffset: number,
  verticalOffset: number,
  vertical: number
) {
  const color = rgb(0.52, 0.54, 0.58);
  page.drawLine({
    start: { x, y },
    end: { x: x + horizontal + horizontalOffset, y },
    thickness: 0.9,
    color,
  });
  page.drawLine({
    start: { x, y },
    end: { x, y: y + vertical + verticalOffset },
    thickness: 0.9,
    color,
  });
}

function drawPitcherSummary(
  page: PDFPage,
  model: ChartingPdfModel,
  fonts: { regular: PDFFont; bold: PDFFont }
) {
  const x = PAGE_MARGIN;
  const y = PAGE_MARGIN + 6;
  const width = page.getWidth() - PAGE_MARGIN * 2;
  const headerHeight = 18;
  const rowHeight = 16;
  const columns = [
    { label: "Pitcher", width: 184, align: "left" as const },
    { label: "IP Span", width: 70, align: "center" as const },
    { label: "BF", width: 48, align: "center" as const },
    { label: "P", width: 56, align: "center" as const },
    { label: "Str", width: 56, align: "center" as const },
    { label: "Ball", width: 56, align: "center" as const },
    { label: "R", width: 48, align: "center" as const },
    { label: "ER", width: 48, align: "center" as const },
  ];

  page.drawText("Pitcher Totals", {
    x,
    y: y + SUMMARY_HEIGHT - 18,
    size: 11,
    font: fonts.bold,
    color: rgb(0.12, 0.14, 0.18),
  });

  page.drawText(
    `${model.totals.plateAppearances} PA • ${model.totals.pitches} pitches`,
    {
      x: x + 100,
      y: y + SUMMARY_HEIGHT - 17,
      size: 8,
      font: fonts.regular,
      color: rgb(0.39, 0.41, 0.45),
    }
  );

  const tableTop = y + SUMMARY_HEIGHT - 40;
  page.drawRectangle({
    x,
    y: tableTop - headerHeight,
    width,
    height: headerHeight,
    color: rgb(0.94, 0.945, 0.938),
    borderColor: rgb(0.79, 0.8, 0.78),
    borderWidth: 0.8,
  });

  let cursorX = x;
  for (const column of columns) {
    page.drawText(column.label, {
      x: cursorX + 6,
      y: tableTop - 12,
      size: 7.5,
      font: fonts.bold,
      color: rgb(0.29, 0.31, 0.34),
    });
    cursorX += column.width;
  }

  const rows = [
    ...model.pitcherRows.map((row) => [
      row.name,
      row.innings,
      String(row.battersFaced),
      String(row.pitches),
      String(row.strikes),
      String(row.balls),
      row.runs,
      row.earnedRuns,
    ]),
    [
      "GAME",
      "—",
      String(model.totals.plateAppearances),
      String(model.totals.pitches),
      String(model.totals.strikes),
      String(model.totals.balls),
      "—",
      "—",
    ],
  ];

  rows.forEach((row, rowIndex) => {
    const rowY = tableTop - headerHeight - rowHeight * (rowIndex + 1);
    page.drawRectangle({
      x,
      y: rowY,
      width,
      height: rowHeight,
      color:
        rowIndex === rows.length - 1 ? rgb(0.975, 0.978, 0.972) : rgb(1, 1, 1),
      borderColor: rgb(0.84, 0.85, 0.83),
      borderWidth: 0.6,
    });

    let rowCursorX = x;
    row.forEach((value, columnIndex) => {
      const column = columns[columnIndex];
      const font = rowIndex === rows.length - 1 ? fonts.bold : fonts.regular;
      const fontSize = rowIndex === rows.length - 1 ? 7.5 : 7;
      const textWidth = font.widthOfTextAtSize(value, fontSize);
      const textX =
        column.align === "left"
          ? rowCursorX + 6
          : rowCursorX + (column.width - textWidth) / 2;

      page.drawText(value, {
        x: textX,
        y: rowY + 5,
        size: fontSize,
        font,
        color: rgb(0.12, 0.14, 0.18),
      });

      rowCursorX += column.width;
    });
  });
}

function colorForPitchResult(resultLabel: string) {
  switch (resultLabel) {
    case "CS":
    case "Sw":
      return {
        fill: rgb(0.12, 0.43, 0.77),
        stroke: rgb(0.08, 0.29, 0.55),
        text: rgb(1, 1, 1),
      };
    case "B":
      return {
        fill: rgb(0.92, 0.69, 0.32),
        stroke: rgb(0.75, 0.51, 0.14),
        text: rgb(0.18, 0.14, 0.07),
      };
    case "IP":
      return {
        fill: rgb(0.4, 0.67, 0.53),
        stroke: rgb(0.24, 0.47, 0.35),
        text: rgb(1, 1, 1),
      };
    case "HBP":
      return {
        fill: rgb(0.72, 0.41, 0.47),
        stroke: rgb(0.55, 0.27, 0.33),
        text: rgb(1, 1, 1),
      };
    default:
      return {
        fill: rgb(0.55, 0.57, 0.61),
        stroke: rgb(0.34, 0.36, 0.4),
        text: rgb(1, 1, 1),
      };
  }
}

function abbreviatePitchType(pitchType: PitchType): string {
  switch (pitchType) {
    case "Fastball":
      return "FB";
    case "Curveball":
      return "CB";
    case "Slider":
      return "SL";
    case "Changeup":
      return "CH";
    case "Split/Cut":
      return "SC";
    case "Other":
      return "OT";
  }
}

function abbreviatePitchResult(result: PitchResult): string {
  switch (result) {
    case "ball":
      return "B";
    case "called_strike":
      return "CS";
    case "swinging_strike":
      return "Sw";
    case "foul":
      return "F";
    case "bunt_foul":
      return "BF";
    case "in_play":
      return "IP";
    case "hit_by_pitch":
      return "HBP";
  }
}

function formatGameStatus(status: ChartingGame["status"]) {
  switch (status) {
    case "active":
      return "Live";
    case "final":
      return "Final";
    case "draft":
      return "Draft";
  }
}

function formatInningsSpan(segment: ChartingPitcherSegment) {
  if (segment.enteredInning && segment.exitedInning) {
    return segment.enteredInning === segment.exitedInning
      ? String(segment.enteredInning)
      : `${segment.enteredInning}-${segment.exitedInning}`;
  }

  if (segment.enteredInning) {
    return `${segment.enteredInning}+`;
  }

  return "—";
}

function formatNumeric(value: number | null) {
  return value === null ? "—" : String(value);
}

function compactJoin(values: Array<string | null>, separator: string) {
  const filtered = values.filter((value): value is string => Boolean(value?.trim()));
  return filtered.length > 0 ? filtered.join(separator) : "—";
}

function getZonePoint(locationCell: number): Point | null {
  const points: Record<number, Point> = {
    1: { x: 0.2, y: 0.8 },
    2: { x: 0.5, y: 0.8 },
    3: { x: 0.8, y: 0.8 },
    4: { x: 0.2, y: 0.5 },
    5: { x: 0.5, y: 0.5 },
    6: { x: 0.8, y: 0.5 },
    7: { x: 0.2, y: 0.2 },
    8: { x: 0.5, y: 0.2 },
    9: { x: 0.8, y: 0.2 },
    10: { x: 0.5, y: -0.08 },
    11: { x: 0.05, y: 0.95 },
    12: { x: 0.95, y: 0.95 },
    13: { x: 0.05, y: 0.05 },
    14: { x: 0.95, y: 0.05 },
    15: { x: 0.5, y: 1.08 },
    16: { x: -0.08, y: 0.5 },
    17: { x: 1.08, y: 0.5 },
  };

  return points[locationCell] ?? null;
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "game";
}
