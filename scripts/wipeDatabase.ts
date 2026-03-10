import pg from "pg";

const dbUrl = "postgresql://postgres.qakolgnkvrtbbmjfalzv:Pranav123%40gmail.com@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres";

const pool = new pg.Pool({
    connectionString: dbUrl + "?options=-c%20search_path%3Dpublic",
});

async function wipeDatabase() {
    try {
        console.log("Wiping database tables...");
        await pool.query("TRUNCATE TABLE anime CASCADE;");
        await pool.query("TRUNCATE TABLE profiles CASCADE;");
        await pool.query("TRUNCATE TABLE notifications CASCADE;");
        await pool.query("TRUNCATE TABLE friends CASCADE;");
        console.log("Database wiped successfully.");
    } catch (error) {
        console.error("Wipe failed:", error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

wipeDatabase();
