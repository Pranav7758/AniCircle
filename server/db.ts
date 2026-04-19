import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../shared/schema";

const { Pool } = pg;

let databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Add search_path to the connection URL if not already present
if (!databaseUrl.includes('search_path') && !databaseUrl.includes('options=')) {
  const separator = databaseUrl.includes('?') ? '&' : '?';
  databaseUrl = `${databaseUrl}${separator}options=-c%20search_path%3Dpublic`;
}

export const pool = new Pool({ 
  connectionString: databaseUrl,
});

export const db = drizzle(pool, { schema });
