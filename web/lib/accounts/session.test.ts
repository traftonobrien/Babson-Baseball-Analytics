import { describe, expect, it } from "vitest";
import {
  PLAYER_ACCOUNT_SESSION_COOKIE,
  buildAccountSessionCookieValue,
  readAccountSessionEmail,
} from "./session";

function cookieReader(value: string) {
  return {
    get(name: string) {
      return name === PLAYER_ACCOUNT_SESSION_COOKIE ? { value } : undefined;
    },
  };
}

describe("account session", () => {
  it("reads a signed account session email", () => {
    const cookieValue = buildAccountSessionCookieValue(" Player.Name@BABSON.EDU ");

    expect(readAccountSessionEmail(cookieReader(cookieValue))).toBe(
      "player.name@babson.edu",
    );
  });

  it("rejects tampered account sessions", () => {
    const cookieValue = buildAccountSessionCookieValue("player.name@babson.edu");
    const [payload, signature] = cookieValue.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: "other@babson.edu", iat: 1 }),
      "utf8",
    ).toString("base64url");

    expect(readAccountSessionEmail(cookieReader(`${tamperedPayload}.${signature}`))).toBeNull();
    expect(readAccountSessionEmail(cookieReader(`${payload}.bad-signature`))).toBeNull();
  });
});
