import { describe, it, expect } from "vitest";
import {
  classifyBattedBallType,
  classifyHitResult,
  classifyZone,
  totalBasesForResult,
  isHitResult,
  extractRbi,
} from "./zoneMapper";

describe("classifyBattedBallType", () => {
  it("detects ground balls", () => {
    expect(classifyBattedBallType("grounded out to ss")).toBe("ground_ball");
    expect(classifyBattedBallType("singled through the right side")).toBe("ground_ball");
    expect(classifyBattedBallType("singled up the middle")).toBe("ground_ball");
    expect(classifyBattedBallType("reached on a fielder's choice")).toBe("ground_ball");
  });

  it("detects fly balls", () => {
    expect(classifyBattedBallType("flied out to cf")).toBe("fly_ball");
    expect(classifyBattedBallType("homered to left field")).toBe("fly_ball");
    expect(classifyBattedBallType("hit a sacrifice fly")).toBe("fly_ball");
  });

  it("detects line drives", () => {
    expect(classifyBattedBallType("lined out to ss")).toBe("line_drive");
    expect(classifyBattedBallType("lined into double play 3b to 2b")).toBe("line_drive");
  });

  it("detects popups", () => {
    expect(classifyBattedBallType("popped up to ss")).toBe("popup");
    expect(classifyBattedBallType("popped out to 2b")).toBe("popup");
  });

  it("defaults hits without type context to line drive", () => {
    expect(classifyBattedBallType("singled to right field")).toBe("line_drive");
    expect(classifyBattedBallType("doubled to left center")).toBe("line_drive");
    expect(classifyBattedBallType("tripled to right center")).toBe("line_drive");
  });
});

describe("classifyHitResult", () => {
  it("identifies singles", () => {
    expect(classifyHitResult("singled to right field")).toBe("single");
  });

  it("identifies doubles", () => {
    expect(classifyHitResult("doubled to left center")).toBe("double");
  });

  it("identifies triples", () => {
    expect(classifyHitResult("tripled to right center")).toBe("triple");
  });

  it("identifies home runs", () => {
    expect(classifyHitResult("homered to left field")).toBe("home_run");
  });

  it("identifies outs", () => {
    expect(classifyHitResult("grounded out to ss")).toBe("out");
    expect(classifyHitResult("flied out to cf")).toBe("out");
    expect(classifyHitResult("lined out to 3b")).toBe("out");
    expect(classifyHitResult("lined into double play 3b to 2b")).toBe("out");
    expect(classifyHitResult("popped up to ss")).toBe("out");
  });

  it("identifies errors", () => {
    expect(classifyHitResult("reached on an error by ss")).toBe("error");
  });

  it("identifies fielders choice", () => {
    expect(classifyHitResult("reached on a fielder's choice")).toBe("fielders_choice");
  });

  it("returns null for non-BIP events", () => {
    expect(classifyHitResult("struck out swinging")).toBeNull();
    expect(classifyHitResult("walked")).toBeNull();
    expect(classifyHitResult("hit by pitch")).toBeNull();
    expect(classifyHitResult("stole second")).toBeNull();
  });
});

describe("classifyZone", () => {
  it("maps directional text to zones", () => {
    expect(classifyZone("singled to left field")).toBe("lf");
    expect(classifyZone("singled to right field")).toBe("rf");
    expect(classifyZone("flied out to cf")).toBe("cf");
    expect(classifyZone("singled to center field")).toBe("cf");
    expect(classifyZone("doubled to left center")).toBe("lcf");
    expect(classifyZone("tripled to right center")).toBe("rcf");
    expect(classifyZone("singled up the middle")).toBe("cf");
  });

  it("maps sides to gap zones", () => {
    expect(classifyZone("singled through the left side")).toBe("lcf");
    expect(classifyZone("singled through the right side")).toBe("rcf");
  });

  it("maps lines correctly", () => {
    expect(classifyZone("doubled down the left-field line")).toBe("lf");
    expect(classifyZone("doubled down the right-field line")).toBe("rf");
  });

  it("falls back to infield position when no direction text", () => {
    expect(classifyZone("grounded out to ss")).toBe("lcf");
    expect(classifyZone("grounded out to 3b")).toBe("lf");
    expect(classifyZone("grounded out to 2b")).toBe("rcf");
    expect(classifyZone("grounded out to 1b")).toBe("rf");
    expect(classifyZone("grounded out to p")).toBe("cf");
  });

  it("returns null when zone cannot be determined", () => {
    expect(classifyZone("struck out swinging")).toBeNull();
  });
});

describe("totalBasesForResult", () => {
  it("returns correct total bases", () => {
    expect(totalBasesForResult("single")).toBe(1);
    expect(totalBasesForResult("double")).toBe(2);
    expect(totalBasesForResult("triple")).toBe(3);
    expect(totalBasesForResult("home_run")).toBe(4);
    expect(totalBasesForResult("out")).toBe(0);
    expect(totalBasesForResult("error")).toBe(0);
  });
});

describe("isHitResult", () => {
  it("returns true for hits", () => {
    expect(isHitResult("single")).toBe(true);
    expect(isHitResult("double")).toBe(true);
    expect(isHitResult("triple")).toBe(true);
    expect(isHitResult("home_run")).toBe(true);
  });

  it("returns false for non-hits", () => {
    expect(isHitResult("out")).toBe(false);
    expect(isHitResult("error")).toBe(false);
    expect(isHitResult("fielders_choice")).toBe(false);
  });
});

describe("extractRbi", () => {
  it("extracts numeric RBI", () => {
    expect(extractRbi("singled through the right side, 2 RBI")).toBe(2);
  });

  it("counts scored mentions", () => {
    expect(extractRbi("Max Garner scored")).toBe(1);
    expect(extractRbi("Ryan Slack scored; Max Garner scored")).toBe(2);
  });

  it("returns 0 for no RBI", () => {
    expect(extractRbi("singled to right field")).toBe(0);
  });
});
