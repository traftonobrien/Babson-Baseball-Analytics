import { describe, expect, it } from "vitest";
import { parseRawPbpGameFromHtml } from "./pbpParser.ts";

const SAMPLE_HTML = `
  <section id="play-by-play">
    <table class="sidearm-table play-by-play">
      <caption>Babson College - Top of 1st</caption>
      <tbody>
        <tr><td>Christensen doubled down the lf line (1-2 BKF).</td></tr>
        <tr><td>Cushner grounded out to 2b (0-1 K).</td></tr>
      </tbody>
    </table>
    <dl class="special-stats">
      <dt>Runs</dt><dd>0</dd>
      <dt>Hits</dt><dd>1</dd>
      <dt>Errors</dt><dd>0</dd>
      <dt>Left On Base</dt><dd>1</dd>
    </dl>
    <table class="sidearm-table play-by-play">
      <caption>Babson College - Top of 1st</caption>
      <tbody>
        <tr><td>Christensen doubled down the lf line (1-2 BKF).</td></tr>
        <tr><td>Cushner grounded out to 2b (0-1 K).</td></tr>
      </tbody>
    </table>
    <dl class="special-stats">
      <dt>Runs</dt><dd>0</dd>
      <dt>Hits</dt><dd>1</dd>
      <dt>Errors</dt><dd>0</dd>
      <dt>Left On Base</dt><dd>1</dd>
    </dl>
    <table class="sidearm-table play-by-play">
      <caption>Opponent University - Bottom of 1st</caption>
      <tbody>
        <tr><td>Lead-off hitter singled to center field (2-1 BBK).</td></tr>
      </tbody>
    </table>
    <dl class="special-stats">
      <dt>Runs</dt><dd>1</dd>
      <dt>Hits</dt><dd>1</dd>
      <dt>Errors</dt><dd>0</dd>
      <dt>Left On Base</dt><dd>0</dd>
    </dl>
  <section id="composite-stats"></section>
`;

describe("parseRawPbpGameFromHtml", () => {
  it("extracts and deduplicates half-innings from Sidearm play-by-play tables", () => {
    const game = parseRawPbpGameFromHtml(
      SAMPLE_HTML,
      "https://babsonathletics.com/sports/baseball/stats/2026/example/boxscore/16011",
    );

    expect(game.gameId).toBe("16011");
    expect(game.halfInnings).toHaveLength(2);
    expect(game.halfInnings[0]?.caption).toBe("Babson College - Top of 1st");
    expect(game.halfInnings[0]?.plays).toHaveLength(2);
    expect(game.halfInnings[0]?.totals).toEqual({
      runs: 0,
      hits: 1,
      errors: 0,
      leftOnBase: 1,
    });
    expect(game.halfInnings[1]?.halfInning).toBe("bottom");
  });
});
