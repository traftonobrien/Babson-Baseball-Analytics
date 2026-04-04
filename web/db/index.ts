import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

function getRequiredUrl(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function createDatabase(url: string) {
  return drizzle(postgres(url));
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
