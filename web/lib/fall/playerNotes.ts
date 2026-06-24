import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { playerNotes } from "@/db/schema";

export interface PlayerNoteRecord {
  id: string;
  playerId: string;
  playerName: string;
  authorEmail: string;
  note: string;
  createdAt: string;
}

type NoteRow = typeof playerNotes.$inferSelect;

function toRecord(row: NoteRow): PlayerNoteRecord {
  return { ...row };
}

export async function getNotesForPlayer(playerId: string): Promise<PlayerNoteRecord[]> {
  const rows = await db
    .select()
    .from(playerNotes)
    .where(eq(playerNotes.playerId, playerId))
    .orderBy(desc(playerNotes.createdAt));
  return rows.map(toRecord);
}

export async function createPlayerNote({
  playerId,
  playerName,
  authorEmail,
  note,
}: {
  playerId: string;
  playerName: string;
  authorEmail: string;
  note: string;
}): Promise<PlayerNoteRecord> {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(playerNotes)
    .values({ id: crypto.randomUUID(), playerId, playerName, authorEmail, note, createdAt: now })
    .returning();
  return toRecord(row);
}

export async function listAllNotesGroupedByPlayer(): Promise<Map<string, PlayerNoteRecord[]>> {
  const rows = await db.select().from(playerNotes).orderBy(desc(playerNotes.createdAt));
  const map = new Map<string, PlayerNoteRecord[]>();
  for (const row of rows) {
    const list = map.get(row.playerId) ?? [];
    list.push(toRecord(row));
    map.set(row.playerId, list);
  }
  return map;
}
