import "dotenv/config";
import fs from "fs";
import path from "path";
import { db, pool } from "../server/db.js";
import { anime, profiles } from "../shared/schema.js";

const ANILIST_API_URL = "https://graphql.anilist.co";
const ALREADY_IMPORTED_USER_ID = "32b98281-8005-4f3c-80f8-53856af94c2c";

const MAL_TO_ANILIST_QUERY = `
  query ($malId: Int) {
    Media(idMal: $malId, type: ANIME) {
      id
      coverImage { large }
    }
  }
`;

async function fetchAniListId(malId: number): Promise<{ anilistId: number; coverImage: string | null } | null> {
    try {
        const res = await fetch(ANILIST_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ query: MAL_TO_ANILIST_QUERY, variables: { malId } }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        if (json.errors || !json.data?.Media) return null;
        return { anilistId: json.data.Media.id, coverImage: json.data.Media.coverImage?.large ?? null };
    } catch {
        return null;
    }
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQ = false;
            else cur += ch;
        } else {
            if (ch === '"') inQ = true;
            else if (ch === ',') { result.push(cur); cur = ""; }
            else cur += ch;
        }
    }
    result.push(cur);
    return result;
}

async function main() {
    const csvPath = path.join(process.cwd(), "anime_rows.csv");
    console.log(`Reading CSV from: ${csvPath}`);

    if (!fs.existsSync(csvPath)) {
        console.error(`File not found: ${csvPath}`);
        process.exit(1);
    }

    const lines = fs.readFileSync(csvPath, "utf-8").split("\n").map(l => l.replace(/\r$/, ""));
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).filter(l => l.trim()).map(l => {
        const vals = parseCSVLine(l);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = vals[i] ?? ""; });
        return row;
    });

    // Filter out the user we already imported
    const otherUsersRows = rows.filter(r => r.user_id && r.user_id !== ALREADY_IMPORTED_USER_ID);
    console.log(`Found ${otherUsersRows.length} rows for OTHER users`);

    // Ensure all these user IDs exist in profiles table
    const uniqueUserIds = [...new Set(otherUsersRows.map(r => r.user_id))];
    const existingProfiles = await db.select().from(profiles);
    const existingProfileIds = new Set(existingProfiles.map(p => p.id));

    let profilesCreated = 0;
    for (const uid of uniqueUserIds) {
        if (!existingProfileIds.has(uid)) {
            try {
                await db.insert(profiles).values({
                    id: uid, // Use exact same UUID to preserve connections
                    username: "Legacy User",
                });
                profilesCreated++;
            } catch (err: any) {
                console.error(`Failed to create missing profile ${uid}: ${err.message}`);
            }
        }
    }
    console.log(`Created ${profilesCreated} missing profiles to satisfy foreign keys.`);

    // Unique MAL IDs out of these rows
    const uniqueMalIds = [...new Set(otherUsersRows.map(r => r.mal_id?.trim()).filter(Boolean).map(Number))];
    console.log(`Fetching AniList IDs for ${uniqueMalIds.length} unique MAL IDs...`);

    const malMap = new Map<number, { anilistId: number; coverImage: string | null }>();
    for (let i = 0; i < uniqueMalIds.length; i++) {
        const malId = uniqueMalIds[i];
        process.stdout.write(`\r  [${i + 1}/${uniqueMalIds.length}] MAL ${malId}...    `);
        const result = await fetchAniListId(malId);
        if (result) malMap.set(malId, result);
        await new Promise(r => setTimeout(r, 650));
    }
    console.log(`\nMapped ${malMap.size}/${uniqueMalIds.length} MAL IDs to AniList\n`);

    let inserted = 0, failed = 0;
    for (const row of otherUsersRows) {
        try {
            const malId = row.mal_id?.trim() ? parseInt(row.mal_id) : null;
            const ali = malId ? malMap.get(malId) : null;

            await db.insert(anime).values({
                userId: row.user_id, // Keep their original user_id this time
                title: row.title,
                episodesWatched: parseInt(row.episodes_watched) || 0,
                totalEpisodes: row.total_episodes?.trim() ? parseInt(row.total_episodes) : null,
                status: row.status || "watching",
                rating: row.rating?.trim() ? parseInt(row.rating) : null,
                notes: row.notes || null,
                coverImage: ali?.coverImage ?? row.cover_image ?? null,
                seasonNumber: parseInt(row.season_number) || 1,
                malId,
                anilistId: ali?.anilistId ?? null,
                migrationStatus: ali ? "success" : (malId ? "pending" : "success"),
                ranking: row.ranking?.trim() ? parseInt(row.ranking) : null,
                isHentai: row.is_hentai === "true",
            });
            inserted++;
        } catch (err: any) {
            failed++;
            console.error(`\nFailed "${row.title}" S${row.season_number} for user ${row.user_id}: ${err.message}`);
        }
    }

    console.log(`\n✅ Done! Inserted: ${inserted} | Failed: ${failed}`);
    await pool.end();
}

main().catch(async err => { console.error(err); await pool.end(); process.exit(1); });
