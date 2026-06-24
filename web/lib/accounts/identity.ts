import type { ChartingBootstrapRosterPlayer } from "../charting/types";

export type PlayerAccountRole = "player" | "coach" | "admin";
export type PlayerAccountStatus = "approved" | "pending" | "rejected";

export interface PlayerAccountIdentity {
  email: string;
  playerId: string | null;
  playerName: string | null;
  role: PlayerAccountRole;
}

// Full admin — manages data, approvals, site config
const ADMIN_EMAILS = new Set([
  "traftonobrien@gmail.com",
  "tobrien1@babson.edu",
]);

// Coaches — see all players but don't manage site/data
const COACH_EMAILS = new Set([
  "mholmes1@babson.edu",
  "mnoone@babson.edu",
]);

export function getAccountNotificationEmails(): string[] {
  return [...ADMIN_EMAILS, ...COACH_EMAILS].sort();
}

export function isCoachEmail(email: string): boolean {
  return COACH_EMAILS.has(email.trim().toLowerCase());
}

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.trim().toLowerCase());
}

export function normalizeAccountEmail(rawEmail: string): string | null {
  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    return null;
  }

  const [localPart, domain, ...rest] = email.split("@");
  if (!localPart || !domain || rest.length > 0) {
    return null;
  }

  return email;
}

export function isBabsonEmail(rawEmail: string): boolean {
  const email = normalizeAccountEmail(rawEmail);
  return email !== null && email.endsWith("@babson.edu");
}

export function getInitialAccountStatus(email: string): PlayerAccountStatus {
  const e = email.trim().toLowerCase();
  return isAdminEmail(e) || isCoachEmail(e) ? "approved" : "pending";
}

export function getInitialAccountRole(email: string): PlayerAccountRole {
  const e = email.trim().toLowerCase();
  if (isAdminEmail(e)) return "admin";
  if (isCoachEmail(e)) return "coach";
  return "player";
}

export function buildPlayerAccountIdentity({
  email,
  rosterPlayer,
  role = "player",
}: {
  email: string;
  rosterPlayer: ChartingBootstrapRosterPlayer | null;
  role?: PlayerAccountRole;
}): PlayerAccountIdentity | null {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  return {
    email: normalizedEmail,
    playerId: rosterPlayer?.playerId ?? null,
    playerName: rosterPlayer?.name ?? null,
    role,
  };
}

export function canEditPlayerAccountResource({
  account,
  resourcePlayerId,
}: {
  account: PlayerAccountIdentity;
  resourcePlayerId: string | null;
}): boolean {
  if (account.role === "coach" || account.role === "admin") {
    return true;
  }

  return Boolean(account.playerId && resourcePlayerId && account.playerId === resourcePlayerId);
}
