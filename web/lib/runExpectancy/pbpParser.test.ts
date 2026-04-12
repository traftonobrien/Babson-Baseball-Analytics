import { describe, expect, it } from "vitest";

import {
  deriveCountSnapshots,
  derivePlayCountContext,
  parseHalfInningState,
  parseParsedPbpGame,
  parseRawHalfInningsFromHtml,
  parseRawPbpGameFromHtml,
} from "./pbpParser";

const playByPlayFixture = `
  <section id="play-by-play">
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Roger Williams - Top of 1st</caption>
          <tbody>
            <tr><td>Luke Miele grounded out to ss (0-1 K).</td><td>0</td><td>0</td></tr>
            <tr><td>Sam Arcieri walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>0</dd>
          <dt>Hits</dt><dd>0</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Babson - Bottom of 1st</caption>
          <tbody>
            <tr><td>Ben Valente walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
            <tr><td>Ryan Grace grounded out to ss (1-1 FB); Ben Valente advanced to third.</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>0</dd>
          <dt>Hits</dt><dd>0</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Roger Williams - Top of 1st</caption>
          <tbody>
            <tr><td>Luke Miele grounded out to ss (0-1 K).</td><td>0</td><td>0</td></tr>
            <tr><td>Sam Arcieri walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>0</dd>
          <dt>Hits</dt><dd>0</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
  </section>
  <section id="composite-stats"></section>
`;

const repeatedPlayFixture = `
  <section id="play-by-play">
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Roger Williams - Top of 1st</caption>
          <tbody>
            <tr><td>Sam Arcieri walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>0</dd>
          <dt>Hits</dt><dd>0</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Roger Williams - Top of 2nd</caption>
          <tbody>
            <tr><td>Sam Arcieri walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>0</dd>
          <dt>Hits</dt><dd>0</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
  </section>
  <section id="composite-stats"></section>
`;

const stateMachineFixture = `
  <section id="play-by-play">
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Babson - Bottom of 1st</caption>
          <tbody>
            <tr><td>Ben Valente walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
            <tr><td>Ryan Grace singled to center field (1-1 BK); Ben Valente advanced to third.</td><td>0</td><td>0</td></tr>
            <tr><td>Robert Christensen flied out to cf, sacrifice fly, RBI (0-0); Ryan Grace advanced to second; Ben Valente scored, unearned.</td><td>0</td><td>1</td></tr>
            <tr><td>Brooks Saft hit by pitch (1-0 H).</td><td>0</td><td>1</td></tr>
            <tr><td>Dante D'Avanzo reached on a fielder's choice, advanced to second on a throwing error by ss, RBI (1-1 KB); Brooks Saft out at second p to ss; Ryan Grace scored.</td><td>0</td><td>2</td></tr>
            <tr><td>Gabe Cushner grounded into double play ss to 2b to 1b (1-0 B); Dante D'Avanzo out on the play.</td><td>0</td><td>2</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>2</dd>
          <dt>Hits</dt><dd>1</dd>
          <dt>Errors</dt><dd>1</dd>
          <dt>Left On Base</dt><dd>0</dd>
        </dl>
      </div>
    </div>
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Roger Williams - Top of 2nd</caption>
          <tbody>
            <tr><td>Rory Lynch hit by pitch (3-1 BBKBH).</td><td>0</td><td>2</td></tr>
            <tr><td>Luke Miele reached on a fielder's choice (1-1 BF); Rory Lynch advanced to second.</td><td>0</td><td>2</td></tr>
            <tr><td>Sam Arcieri hit by pitch (1-1 KH); Luke Miele advanced to second; Rory Lynch advanced to third.</td><td>0</td><td>2</td></tr>
            <tr><td>Jack Tubman homered to center field, 4 RBI (0-0); Sam Arcieri scored; Luke Miele scored; Rory Lynch scored.</td><td>4</td><td>2</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>4</dd>
          <dt>Hits</dt><dd>1</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>0</dd>
        </dl>
      </div>
    </div>
  </section>
  <section id="composite-stats"></section>
`;

const failedValidationFixture = `
  <section id="play-by-play">
    <div class="panel relative">
      <div class="row pad">
        <table class="sidearm-table play-by-play">
          <caption>Babson - Bottom of 3rd</caption>
          <tbody>
            <tr><td>Ben Valente walked (3-1 BBBKB).</td><td>0</td><td>0</td></tr>
            <tr><td>Ryan Grace singled to center field (1-1 BK); Ben Valente advanced to third.</td><td>0</td><td>0</td></tr>
            <tr><td>Robert Christensen flied out to cf, sacrifice fly, RBI (0-0); Ben Valente scored.</td><td>0</td><td>1</td></tr>
          </tbody>
        </table>
        <dl class="special-stats emphasize inline text-right">
          <dt>Runs</dt><dd>2</dd>
          <dt>Hits</dt><dd>1</dd>
          <dt>Errors</dt><dd>0</dd>
          <dt>Left On Base</dt><dd>1</dd>
        </dl>
      </div>
    </div>
  </section>
  <section id="composite-stats"></section>
`;

describe("parseRawHalfInningsFromHtml", () => {
  it("raw extraction returns both teams' half-innings and deduplicates repeated table copies", () => {
    const halfInnings = parseRawHalfInningsFromHtml(playByPlayFixture);

    expect(halfInnings).toHaveLength(2);
    expect(halfInnings.map((entry) => entry.caption)).toEqual([
      "Roger Williams - Top of 1st",
      "Babson - Bottom of 1st",
    ]);
    expect(halfInnings.map((entry) => entry.offenseTeam)).toEqual([
      "Roger Williams",
      "Babson",
    ]);
    expect(halfInnings[0]?.playLines).toEqual([
      "Luke Miele grounded out to ss (0-1 K).",
      "Sam Arcieri walked (3-1 BBBKB).",
    ]);
    expect(halfInnings[0]?.totals).toEqual({
      runs: 0,
      hits: 0,
      errors: 0,
      leftOnBase: 1,
    });
  });

  it("dedup preserves identical play text when the inning context changes", () => {
    const halfInnings = parseRawHalfInningsFromHtml(repeatedPlayFixture);

    expect(halfInnings).toHaveLength(2);
    expect(halfInnings.map((entry) => entry.inning)).toEqual([1, 2]);
    expect(halfInnings[0]?.playLines).toEqual([
      "Sam Arcieri walked (3-1 BBBKB).",
    ]);
    expect(halfInnings[1]?.playLines).toEqual([
      "Sam Arcieri walked (3-1 BBBKB).",
    ]);
    expect(halfInnings[0]?.plays[0]?.dedupKey).not.toEqual(
      halfInnings[1]?.plays[0]?.dedupKey,
    );
  });
});

describe("parseRawPbpGameFromHtml", () => {
  it("raw extraction attaches the source game id when a boxscore URL is provided", () => {
    const game = parseRawPbpGameFromHtml(
      playByPlayFixture,
      "https://babsonathletics.com/sports/baseball/stats/2026/roger-williams/boxscore/16016",
    );

    expect(game.gameId).toBe("16016");
    expect(game.sourceUrl).toContain("/boxscore/16016");
    expect(game.halfInnings).toHaveLength(2);
  });
});

describe("count snapshots", () => {
  it("pitch sequence walking derives count states one pitch at a time", () => {
    const snapshots = deriveCountSnapshots("KFBB");

    expect(snapshots.map((snapshot) => snapshot.countAfter.label)).toEqual([
      "0-1",
      "0-2",
      "1-2",
      "2-2",
    ]);
    expect(snapshots[0]?.countBefore.label).toBe("0-0");
    expect(snapshots.at(-1)?.countAfter.label).toBe("2-2");
  });

  it("pitch sequence handling keeps foul balls at two strikes from changing the count", () => {
    const snapshots = deriveCountSnapshots("BKFF");

    expect(snapshots.map((snapshot) => snapshot.countAfter.label)).toEqual([
      "1-0",
      "1-1",
      "1-2",
      "1-2",
    ]);
  });

  it("pitch sequence context keeps the final displayed count as the pre-terminal state when contact is not encoded", () => {
    const context = derivePlayCountContext(
      "Sam Arcieri grounded out to ss (2-2 KFBB).",
    );

    expect(context.finalCount?.label).toBe("2-2");
    expect(context.terminalPitchRecorded).toBe(false);
    expect(context.countBeforeTerminalPitch?.label).toBe("2-2");
  });

  it("pitch sequence context handles HBP and IBB-like endings without over-incrementing the count", () => {
    const hbpContext = derivePlayCountContext(
      "Rory Lynch hit by pitch (3-1 BBKBH).",
    );
    const ibbContext = derivePlayCountContext(
      "Ben Valente intentional walk (3-0 IIIB).",
    );

    expect(hbpContext.finalCount?.label).toBe("3-1");
    expect(hbpContext.terminalPitchRecorded).toBe(true);
    expect(hbpContext.countBeforeTerminalPitch?.label).toBe("3-1");
    expect(ibbContext.finalCount?.label).toBe("3-0");
    expect(ibbContext.terminalPitchRecorded).toBe(true);
    expect(ibbContext.countBeforeTerminalPitch?.label).toBe("3-0");
  });
});

describe("parseHalfInningState", () => {
  it("semicolon state machine updates base state and outs sequentially", () => {
    const rawGame = parseRawPbpGameFromHtml(stateMachineFixture);
    const firstHalf = rawGame.halfInnings[0];
    expect(firstHalf).toBeDefined();

    const parsed = parseHalfInningState(firstHalf!);

    expect(parsed.validation.passed).toBe(true);
    expect(parsed.parsedRuns).toBe(2);
    expect(parsed.plays[0]?.baseStateAfter).toEqual({
      first: true,
      second: false,
      third: false,
    });
    expect(parsed.plays[1]?.baseStateAfter).toEqual({
      first: true,
      second: false,
      third: true,
    });
    expect(parsed.plays[1]?.countSnapshots.map((snapshot) => snapshot.countAfter.label)).toEqual(
      ["1-0", "1-1"],
    );
    expect(parsed.plays[2]?.outsAfter).toBe(1);
    expect(parsed.plays[2]?.runsScored).toBe(1);
    expect(parsed.plays[4]?.baseStateAfter).toEqual({
      first: false,
      second: true,
      third: false,
    });
    expect(parsed.plays[5]?.outsAfter).toBe(3);
    expect(parsed.plays[5]?.baseStateAfter).toEqual({
      first: false,
      second: false,
      third: false,
    });
  });

  it("outs reset cleanly between half-innings when parsing a full game", () => {
    const rawGame = parseRawPbpGameFromHtml(stateMachineFixture);
    const parsedGame = parseParsedPbpGame(rawGame);

    expect(parsedGame.halfInnings).toHaveLength(2);
    expect(parsedGame.halfInnings[0]?.plays.at(-1)?.outsAfter).toBe(3);
    expect(parsedGame.halfInnings[1]?.plays[0]?.outsBefore).toBe(0);
    expect(parsedGame.halfInnings[1]?.parsedRuns).toBe(4);
    expect(parsedGame.halfInnings[1]?.validation.passed).toBe(true);
    expect(parsedGame.metadata).toBeNull();
  });

  it("run-total validation excludes failing innings from usable output", () => {
    const rawGame = parseRawPbpGameFromHtml(failedValidationFixture);
    const parsedGame = parseParsedPbpGame(rawGame);

    expect(parsedGame.halfInnings).toHaveLength(1);
    expect(parsedGame.halfInnings[0]?.validation.passed).toBe(false);
    expect(parsedGame.halfInnings[0]?.usableForMatrix).toBe(false);
    expect(parsedGame.halfInnings[0]?.validation.parsedRuns).toBe(1);
    expect(parsedGame.halfInnings[0]?.validation.expectedRuns).toBe(2);
    expect(parsedGame.usableHalfInnings).toHaveLength(0);
    expect(parsedGame.failedHalfInnings).toHaveLength(1);
  });

  it("0-2 contact plays keep the count-before-terminal snapshot available for later RE joins", () => {
    const rawHalfInning = {
      key: "1:top:test",
      caption: "Babson - Top of 1st",
      inning: 1,
      halfInning: "top" as const,
      offenseTeam: "Babson",
      playLines: ["Luke Miele grounded out to ss (2-2 KFBB)."],
      plays: [
        {
          inning: 1,
          halfInning: "top" as const,
          playIndex: 0,
          playText: "Luke Miele grounded out to ss (2-2 KFBB).",
          dedupKey: "1:top:0:Luke Miele grounded out to ss (2-2 KFBB).",
        },
      ],
      totals: {
        runs: 0,
        hits: 0,
        errors: 0,
        leftOnBase: 0,
      },
    };

    const parsed = parseHalfInningState(rawHalfInning);

    expect(parsed.plays[0]?.countBeforeTerminalPitch?.label).toBe("2-2");
    expect(parsed.plays[0]?.terminalPitchRecorded).toBe(false);
  });

  it("game map metadata attaches by game id and preserves doubleheader suffixes", () => {
    const rawGame = parseRawPbpGameFromHtml(
      playByPlayFixture,
      "https://babsonathletics.com/sports/baseball/stats/2026/coast-guard/boxscore/16017",
    );
    const parsedGame = parseParsedPbpGame(rawGame);

    expect(parsedGame.metadata).toEqual({
      gameId: "16017",
      date: "2026-03-29",
      opponent: "Coast Guard",
      homeAway: "away",
      suffix: "G1",
      url: "https://babsonathletics.com/sports/baseball/stats/2026/coast-guard/boxscore/16017",
    });
  });
});
