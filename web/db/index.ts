import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function getRequiredUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

// Supabase session pooler (port 5432) holds a server-side session per
// connection. On Vercel serverless each invocation may create its own pool,
// quickly exhausting the ~20-connection free-tier limit.
//
// Switch to the Supabase transaction pooler (port 6543) on Vercel: it
// allocates a backend connection only for the duration of a single
// transaction, then releases it, supporting far more concurrent invocations.
// `prepare: false` is required because the transaction pooler does not
// persist prepared statements across transactions.
function resolveUrl(url: string): string {
  if (process.env.VERCEL && url.includes(".pooler.supabase.com:5432/")) {
    return url.replace(".pooler.supabase.com:5432/", ".pooler.supabase.com:6543/");
  }
  return url;
}

function createDatabase(url: string) {
  return drizzle(
    postgres(resolveUrl(url), {
      max: process.env.VERCEL ? 3 : 10,
      idle_timeout: process.env.VERCEL ? 20 : undefined,
      prepare: false,
    }),
  );
}

// Use a global singleton in dev mode to survive Next.js HMR reloads.
// Without this, each hot-reload creates a new postgres.js connection pool while
// old pools linger, eventually exhausting the Supabase session pooler limit.
type DbInstance = ReturnType<typeof createDatabase>;
const globalForDb = globalThis as unknown as {
  __pitchTrackerDb?: DbInstance;
  __pitchTrackerChartingDb?: DbInstance;
};

const appDatabaseUrl = getRequiredUrl("DATABASE_URL");
const chartingDatabaseUrl =
  process.env.CHARTING_DATABASE_URL?.trim() ||
  process.env.SUPABASE_DATABASE_URL?.trim() ||
  appDatabaseUrl;

function getOrCreate(key: keyof typeof globalForDb, url: string): DbInstance {
  if (!globalForDb[key]) {
    globalForDb[key] = createDatabase(url);
  }
  return globalForDb[key]!;
}

export const db =
  process.env.NODE_ENV === "production"
    ? createDatabase(appDatabaseUrl)
    : getOrCreate("__pitchTrackerDb", appDatabaseUrl);

export const chartingDb =
  chartingDatabaseUrl === appDatabaseUrl
    ? db
    : process.env.NODE_ENV === "production"
      ? createDatabase(chartingDatabaseUrl)
      : getOrCreate("__pitchTrackerChartingDb", chartingDatabaseUrl);
