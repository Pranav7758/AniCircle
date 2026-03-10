import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { db, pool } from "../server/db";
import { anime, profiles } from "../shared/schema";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OLD_USER_ID = "32b98281-8005-4f3c-80f8-53856af94c2c";
const ANILIST_API_URL = "https://graphql.anilist.co";

const MAL_TO_ANILIST_QUERY = `
  query ($malId: Int) {
    Media(idMal: $malId, type: ANIME) {
      id
      idMal
      coverImage { large }
    }
  }
`;

async function fetchAniListId(malId: number): Promise<{ anilistId: number; coverImage: string | null } | null> {
  try {
    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ query: MAL_TO_ANILIST_QUERY, variables: { malId } }),
    });
    if (!response.ok) return null;
    const json = await response.json();
    if (json.errors || !json.data?.Media) return null;
    return { anilistId: json.data.Media.id, coverImage: json.data.Media.coverImage?.large || null };
  } catch {
    return null;
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split("\n").map(l => l.replace(/\r$/, ""));
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(l => {
    const values = parseCSVLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
    return row;
  });
}

async function main() {
  const csvPath = path.resolve(__dirname, "../anime_rows.csv");
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCSV(content);

  const userRows = rows.filter(r => r.user_id === OLD_USER_ID);
  console.log(`Found ${userRows.length} rows for old user`);

  // Get current profiles in the DB
  const allProfiles = await db.select().from(profiles);
  if (allProfiles.length === 0) {
    console.error("❌ No profiles found! Please sign up / log in first.");
    await pool.end();
    return;
  }

  console.log("Profiles found:");
  allProfiles.forEach((p, i) => console.log(`  ${i+1}. ${p.email || p.username || "Unknown"} — ${p.id}`));
  const currentUserId = allProfiles[0].id;
  console.log(`\n→ Importing into: ${currentUserId}\n`);

  // Collect unique MAL IDs
  const uniqueMalIds = new Set<number>();
  userRows.forEach(r => { if (r.mal_id?.trim()) uniqueMalIds.add(parseInt(r.mal_id)); });
  console.log(`Mapping ${uniqueMalIds.size} unique MAL IDs to AniList IDs...`);

  const malToAnilist = new Map<number, { anilistId: number; coverImage: string | null }>();
  let c = 0;
  for (const malId of uniqueMalIds) {
    c++;
    process.stdout.write(`\r  [${c}/${uniqueMalIds.size}] MAL ${malId}...        `);
    const result = await fetchAniListId(malId);
    if (result) malToAnilist.set(malId, result);
    await new Promise(r => setTimeout(r, 600));
  }
  console.log(`\n✓ Mapped ${malToAnilist.size}/${uniqueMalIds.size} MAL IDs\n`);

  let inserted = 0, failed = 0;
  for (const row of userRows) {
    try {
      const malId = row.mal_id?.trim() ? parseInt(row.mal_id) : null;
      const anilistData = malId ? malToAnilist.get(malId) : null;

      await db.insert(anime).values({
        userId: currentUserId,
        title: row.title,
        episodesWatched: parseInt(row.episodes_watched) || 0,
        totalEpisodes: row.total_episodes?.trim() ? parseInt(row.total_episodes) : null,
        status: row.status || "watching",
        rating: row.rating?.trim() ? parseInt(row.rating) : null,
        notes: row.notes || null,
        coverImage: anilistData?.coverImage || row.cover_image || null,
        seasonNumber: parseInt(row.season_number) || 1,
        malId: malId,
        anilistId: anilistData?.anilistId || null,
        migrationStatus: anilistData ? "success" : (malId ? "pending" : "success"),
        ranking: row.ranking?.trim() ? parseInt(row.ranking) : null,
        isHentai: row.is_hentai === "true",
      });
      inserted++;
    } catch (err: any) {
      failed++;
      console.error(`\n❌ Failed: "${row.title}" S${row.season_number} — ${err.message}`);
    }
  }

  console.log(`\n✅ Done! Inserted: ${inserted} | Failed: ${failed} | Total: ${userRows.length}`);
  await pool.end();
}

main().catch(async err => {
  console.error("Fatal error:", err);
  await pool.end();
  process.exit(1);
});
