import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

type Provider = "supabase" | "neon" | "postgres" | "unknown";

type TargetSummary = {
  envName: string;
  provider: Provider;
  hostname: string | null;
  isConfigured: boolean;
};

type CountRow = {
  table_name: string;
  row_count: string;
};

type RecentGameRow = {
  id: string;
  opponent: string;
  game_date: string;
  revision: number;
};

type QueryFailure = {
  error: string;
};

const SHARED_TABLES = [
  "login_rate_limits",
  "stuff_plus_arsenal",
  "stuff_plus_outings",
  "charting_games",
  "charting_pitcher_segments",
  "charting_lineup_entries",
  "charting_plate_appearances",
  "charting_pitches",
] as const;

function getEnvUrl(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function detectProvider(hostname: string | null): Provider {
  if (!hostname) return "unknown";
  if (hostname.includes("supabase")) return "supabase";
  if (hostname.includes("neon.tech")) return "neon";
  return "postgres";
}

function summarizeTarget(envName: string, url: string | null): TargetSummary {
  if (!url) {
    return {
      envName,
      provider: "unknown",
      hostname: null,
      isConfigured: false,
    };
  }

  try {
    const parsed = new URL(url);
    return {
      envName,
      provider: detectProvider(parsed.hostname),
      hostname: parsed.hostname,
      isConfigured: true,
    };
  } catch {
    return {
      envName,
      provider: "unknown",
      hostname: null,
      isConfigured: true,
    };
  }
}

async function queryCounts(databaseUrl: string): Promise<CountRow[]> {
  const sql = postgres(databaseUrl);
  try {
    return await sql.unsafe<CountRow[]>(`
      select 'login_rate_limits' as table_name, count(*)::bigint as row_count from login_rate_limits
      union all
      select 'stuff_plus_arsenal', count(*)::bigint from stuff_plus_arsenal
      union all
      select 'stuff_plus_outings', count(*)::bigint from stuff_plus_outings
      union all
      select 'charting_games', count(*)::bigint from charting_games
      union all
      select 'charting_pitcher_segments', count(*)::bigint from charting_pitcher_segments
      union all
      select 'charting_lineup_entries', count(*)::bigint from charting_lineup_entries
      union all
      select 'charting_plate_appearances', count(*)::bigint from charting_plate_appearances
      union all
      select 'charting_pitches', count(*)::bigint from charting_pitches
      order by table_name
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function queryRecentGames(databaseUrl: string): Promise<RecentGameRow[]> {
  const sql = postgres(databaseUrl);
  try {
    return await sql.unsafe<RecentGameRow[]>(`
      select id, opponent, game_date, revision
      from charting_games
      order by game_date desc, revision desc
      limit 5
    `);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function main() {
  const appUrl = getEnvUrl("DATABASE_URL");
  const chartingUrl =
    getEnvUrl("CHARTING_DATABASE_URL") ??
    getEnvUrl("SUPABASE_DATABASE_URL") ??
    appUrl;

  if (!appUrl) {
    throw new Error("DATABASE_URL is required to audit the backend targets.");
  }

  const appTarget = summarizeTarget("DATABASE_URL", appUrl);
  const chartingTarget = summarizeTarget(
    getEnvUrl("CHARTING_DATABASE_URL")
      ? "CHARTING_DATABASE_URL"
      : getEnvUrl("SUPABASE_DATABASE_URL")
        ? "SUPABASE_DATABASE_URL"
        : "DATABASE_URL (fallback)",
    chartingUrl,
  );

  console.log(
    JSON.stringify(
      {
        app: appTarget,
        charting: chartingTarget,
        sharedDatabase: appUrl === chartingUrl,
        migratedTables: SHARED_TABLES,
      },
      null,
      2,
    ),
  );

  let counts: CountRow[] | QueryFailure;
  try {
    counts = await queryCounts(chartingUrl!);
  } catch (error) {
    counts = {
      error: error instanceof Error ? error.message : "Unknown query error",
    };
  }

  console.log("\nTable counts");
  if ("error" in counts) {
    console.log(`unavailable\t${counts.error}`);
  } else {
    for (const row of counts) {
      console.log(`${row.table_name}\t${row.row_count}`);
    }
  }

  let recentGames: RecentGameRow[] | QueryFailure;
  try {
    recentGames = await queryRecentGames(chartingUrl!);
  } catch (error) {
    recentGames = {
      error: error instanceof Error ? error.message : "Unknown query error",
    };
  }

  console.log("\nRecent charting games");
  if ("error" in recentGames) {
    console.log(`unavailable\t${recentGames.error}`);
  } else {
    for (const game of recentGames) {
      console.log(
        `${game.game_date}\t${game.opponent}\t${game.revision}\t${game.id}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("[db:audit:backends]", error);
  process.exit(1);
});
