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

const appDatabaseUrl = getRequiredUrl("DATABASE_URL");
const chartingDatabaseUrl =
  process.env.CHARTING_DATABASE_URL?.trim() ||
  process.env.SUPABASE_DATABASE_URL?.trim() ||
  appDatabaseUrl;

export const db = createDatabase(appDatabaseUrl);
export const chartingDb =
  chartingDatabaseUrl === appDatabaseUrl
    ? db
    : createDatabase(chartingDatabaseUrl);
