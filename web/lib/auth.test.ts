import { describe, expect, it } from "vitest";
import {
  AUTH_GATES,
  CHARTING_GATE_CHAIN,
  MECHANICS_GATE_CHAIN,
  SITE_GATE_CHAIN,
  buildAuthMisconfiguredMessage,
  getRequiredGatesForPath,
  hasGateCookie,
  isPublicPath,
  resolveConfiguredPassword,
} from "./auth";

describe("auth helpers", () => {
  it("trims configured passwords and rejects empty values", () => {
    expect(resolveConfiguredPassword("  secret  ")).toBe("secret");
    expect(resolveConfiguredPassword("   ")).toBeNull();
    expect(resolveConfiguredPassword(undefined)).toBeNull();
  });

  it("marks login and public player routes as public", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/charting-login")).toBe(true);
    expect(isPublicPath("/api/charting-login")).toBe(true);
    expect(isPublicPath("/mechanics-login")).toBe(true);
    expect(isPublicPath("/api/logout")).toBe(true);
    expect(isPublicPath("/players/getchell_jacob")).toBe(true);
    expect(isPublicPath("/charting")).toBe(false);
  });

  it("returns the correct gate chain for protected paths", () => {
    expect(getRequiredGatesForPath("/")).toEqual(SITE_GATE_CHAIN);
    expect(getRequiredGatesForPath("/charting")).toEqual(CHARTING_GATE_CHAIN);
    expect(getRequiredGatesForPath("/api/charting/games")).toEqual(
      CHARTING_GATE_CHAIN,
    );
    expect(getRequiredGatesForPath("/mechanics/session/john/2026-03-01")).toEqual(
      MECHANICS_GATE_CHAIN,
    );
    expect(getRequiredGatesForPath("/charting-login")).toEqual([]);
  });

  it("checks cookie values against the configured gate", () => {
    const cookies = new Map<string, string>([
      [AUTH_GATES.site.cookieName, AUTH_GATES.site.cookieValue],
      [AUTH_GATES.charting.cookieName, AUTH_GATES.charting.cookieValue],
    ]);
    const requestLike = {
      cookies: {
        get(name: string) {
          const value = cookies.get(name);
          return value ? { value } : undefined;
        },
      },
    };

    expect(hasGateCookie(requestLike, "site")).toBe(true);
    expect(hasGateCookie(requestLike, "charting")).toBe(true);
    expect(hasGateCookie(requestLike, "mechanics")).toBe(false);
  });

  it("builds clear misconfiguration messages", () => {
    expect(buildAuthMisconfiguredMessage("site")).toBe(
      "Server auth misconfigured: missing PT_PASSWORD",
    );
    expect(buildAuthMisconfiguredMessage("charting")).toBe(
      "Server auth misconfigured: missing CHARTING_PASSWORD",
    );
  });
});
