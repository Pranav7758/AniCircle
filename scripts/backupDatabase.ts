import pg from "pg";
import { config } from "dotenv";

const dbUrl = "postgresql://postgres.qakolgnkvrtbbmjfalzv:Pranav123%40gmail.com@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const pool = new pg.Pool({
  connectionString: dbUrl + "?options=-c%20search_path%3Dpublic",
});

async function backup() {
  try {
    console.log("Starting backup of 'anime' table...");
    // Check if backup table already exists to avoid errors
    await pool.query("DROP TABLE IF EXISTS anime_backup;");
    await pool.query("CREATE TABLE anime_backup AS SELECT * FROM anime;");
    const res = await pool.query("SELECT COUNT(*) FROM anime_backup;");
    console.log(`Backup successful. ${res.rows[0].count} rows copied to anime_backup.`);
  } catch (error) {
    console.error("Backup failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

backup();
