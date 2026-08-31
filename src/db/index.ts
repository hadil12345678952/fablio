import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

// Les hébergeurs managés (Neon, Supabase, Render…) exigent SSL, souvent
// indiqué par `sslmode=require` dans l'URL — que node-postgres ne déduit pas
// tout seul : on active donc SSL explicitement.
const sslRequis =
  /sslmode=require|sslmode=verify/i.test(databaseUrl) ||
  /neon\.tech|supabase\.|render\.com|aivencloud\.com/i.test(databaseUrl) ||
  process.env.PGSSL === "1";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslRequis ? { rejectUnauthorized: false } : undefined,
  // Petit pool : derrière le « pooler » Neon (PgBouncer) et en serverless
  // Vercel, on limite les connexions sortantes par fonction.
  max: Number(process.env.PG_POOL_MAX ?? 5),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 15_000,
});

// Mise en cache globale : réutilise le pool entre invocations « chaudes »
// (serverless) et évite les fuites avec le rechargement à chaud en dev.
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool$ = globalForDb.__arenaNextJsPostgresqlPool ?? pool;
globalForDb.__arenaNextJsPostgresqlPool = pool$;

export const db = drizzle(pool$);
