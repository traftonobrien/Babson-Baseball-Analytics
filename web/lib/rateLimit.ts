import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { loginRateLimits } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

/**
 * Returns true if the IP is allowed to attempt login for the given gate.
 * Increments the attempt counter on each call. Resets when the window expires.
 * Fails open (returns allowed=true) if the DB is unreachable so a DB outage
 * doesn't lock everyone out.
 */
export async function checkLoginRateLimit(
  ip: string,
  gateId: string,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - WINDOW_MS);

    const [row] = await db
      .select()
      .from(loginRateLimits)
      .where(
        and(eq(loginRateLimits.ip, ip), eq(loginRateLimits.gateId, gateId)),
      );

    if (!row || row.windowStart < windowStart) {
      // No record or window expired — start a fresh window at attempt 1
      await db
        .insert(loginRateLimits)
        .values({ ip, gateId, attempts: 1, windowStart: now })
        .onConflictDoUpdate({
          target: [loginRateLimits.ip, loginRateLimits.gateId],
          set: { attempts: 1, windowStart: now },
        });
      return { allowed: true, remaining: MAX_ATTEMPTS - 1 };
    }

    if (row.attempts >= MAX_ATTEMPTS) {
      return { allowed: false, remaining: 0 };
    }

    await db
      .update(loginRateLimits)
      .set({ attempts: row.attempts + 1 })
      .where(
        and(eq(loginRateLimits.ip, ip), eq(loginRateLimits.gateId, gateId)),
      );

    return { allowed: true, remaining: MAX_ATTEMPTS - (row.attempts + 1) };
  } catch {
    // Fail open — DB unavailable should not lock users out
    console.error("[rateLimit] DB unavailable, failing open for", ip, gateId);
    return { allowed: true, remaining: MAX_ATTEMPTS };
  }
}
