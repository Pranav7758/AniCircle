import { execSync } from "child_process";

process.env.DATABASE_URL = "postgresql://postgres.qakolgnkvrtbbmjfalzv:Pranav123%40gmail.com@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?options=-c%20search_path%3Dpublic";

console.log("Pushing schema...");
execSync("npx drizzle-kit push", { stdio: "inherit" });
