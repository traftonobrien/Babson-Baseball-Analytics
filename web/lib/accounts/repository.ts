import { eq, desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import { accountEmailVerifications, playerAccounts } from "@/db/schema";
import {
  getInitialAccountRole,
  getInitialAccountStatus,
  normalizeAccountEmail,
  type PlayerAccountIdentity,
  type PlayerAccountRole,
  type PlayerAccountStatus,
} from "./identity";
import {
  createAccountVerificationToken,
  hashAccountVerificationToken,
  readAccountSessionEmail,
} from "./session";

export const PLAYER_ACCOUNT_EMAIL_COOKIE = "pt_account_email";
const VERIFICATION_TTL_MS = 1000 * 60 * 20;

export interface PlayerAccountRecord extends PlayerAccountIdentity {
  id: string;
  status: PlayerAccountStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

type PlayerAccountRow = typeof playerAccounts.$inferSelect;

function toAccountRecord(row: PlayerAccountRow): PlayerAccountRecord {
  return {
    id: row.id,
    email: row.email,
    playerId: row.playerId,
    playerName: row.playerName,
    role: row.role as PlayerAccountRole,
    status: (row.status ?? "approved") as PlayerAccountStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

export async function getPlayerAccountByEmail(
  email: string,
): Promise<PlayerAccountRecord | null> {
  const [row] = await db
    .select()
    .from(playerAccounts)
    .where(eq(playerAccounts.email, email))
    .limit(1);

  return row ? toAccountRecord(row) : null;
}

export async function getPlayerAccountFromRequest(
  request: NextRequest,
): Promise<PlayerAccountRecord | null> {
  const email = readAccountSessionEmail(request.cookies);

  return email ? getPlayerAccountByEmail(email) : null;
}

export async function ensurePlayerAccountByEmail(
  email: string,
): Promise<PlayerAccountRecord> {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) {
    throw new Error("Cannot create account for invalid email");
  }

  const existing = await getPlayerAccountByEmail(normalizedEmail);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const [row] = await db
    .insert(playerAccounts)
    .values({
      id: crypto.randomUUID(),
      email: normalizedEmail,
      playerId: null,
      playerName: null,
      role: getInitialAccountRole(normalizedEmail),
      status: getInitialAccountStatus(normalizedEmail),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .returning();

  return toAccountRecord(row);
}

export async function createAccountEmailVerification(email: string): Promise<{
  email: string;
  token: string;
  expiresAt: string;
}> {
  const normalizedEmail = normalizeAccountEmail(email);
  if (!normalizedEmail) {
    throw new Error("Cannot create verification for invalid email");
  }

  const now = new Date();
  const { token, tokenHash } = createAccountVerificationToken();
  const expiresAt = new Date(now.getTime() + VERIFICATION_TTL_MS).toISOString();

  await db.insert(accountEmailVerifications).values({
    id: crypto.randomUUID(),
    email: normalizedEmail,
    tokenHash,
    expiresAt,
    consumedAt: null,
    createdAt: now.toISOString(),
  });

  return { email: normalizedEmail, token, expiresAt };
}

export async function consumeAccountEmailVerification(
  token: string,
): Promise<{ account: PlayerAccountRecord; wasCreated: boolean } | null> {
  const tokenHash = hashAccountVerificationToken(token);
  const [row] = await db
    .select()
    .from(accountEmailVerifications)
    .where(eq(accountEmailVerifications.tokenHash, tokenHash))
    .limit(1);

  if (!row || row.consumedAt || Date.parse(row.expiresAt) <= Date.now()) {
    return null;
  }

  const now = new Date().toISOString();
  await db
    .update(accountEmailVerifications)
    .set({ consumedAt: now })
    .where(eq(accountEmailVerifications.tokenHash, tokenHash));

  const existingAccount = await getPlayerAccountByEmail(row.email);
  const account = existingAccount ?? (await ensurePlayerAccountByEmail(row.email));
  await db
    .update(playerAccounts)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(playerAccounts.email, account.email));

  const refreshedAccount = await getPlayerAccountByEmail(account.email);
  return refreshedAccount
    ? { account: refreshedAccount, wasCreated: existingAccount === null }
    : null;
}

export async function setAccountRole(
  id: string,
  role: PlayerAccountRole,
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .update(playerAccounts)
    .set({ role, updatedAt: now })
    .where(eq(playerAccounts.id, id));
}

export async function listPendingAccounts(): Promise<PlayerAccountRecord[]> {
  const rows = await db
    .select()
    .from(playerAccounts)
    .where(eq(playerAccounts.status, "pending"))
    .orderBy(desc(playerAccounts.createdAt));
  return rows.map(toAccountRecord);
}

export async function listAllAccounts(): Promise<PlayerAccountRecord[]> {
  const rows = await db
    .select()
    .from(playerAccounts)
    .orderBy(desc(playerAccounts.createdAt));
  return rows.map(toAccountRecord);
}

export async function approvePlayerAccount(id: string): Promise<PlayerAccountRecord | null> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(playerAccounts)
    .set({ status: "approved", updatedAt: now })
    .where(eq(playerAccounts.id, id))
    .returning();
  return row ? toAccountRecord(row) : null;
}

export async function rejectPlayerAccount(id: string): Promise<PlayerAccountRecord | null> {
  const now = new Date().toISOString();
  const [row] = await db
    .update(playerAccounts)
    .set({ status: "rejected", updatedAt: now })
    .where(eq(playerAccounts.id, id))
    .returning();
  return row ? toAccountRecord(row) : null;
}

export async function upsertPlayerAccountIdentity(
  identity: PlayerAccountIdentity,
): Promise<PlayerAccountRecord> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();

  const [row] = await db
    .insert(playerAccounts)
    .values({
      id,
      email: identity.email,
      playerId: identity.playerId,
      playerName: identity.playerName,
      role: identity.role,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now,
    })
    .onConflictDoUpdate({
      target: playerAccounts.email,
      set: {
        playerId: identity.playerId,
        playerName: identity.playerName,
        role: identity.role,
        updatedAt: now,
        lastLoginAt: now,
      },
    })
    .returning();

  return toAccountRecord(row);
}
