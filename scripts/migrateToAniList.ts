import { db } from "../server/db";
import { anime } from "../shared/schema";
import { fetchAniList } from "../client/src/services/anilist";
import { eq, isNull } from "drizzle-orm";

// GraphQL query specifically for looking up by MAL ID
const GET_ANILIST_ID_BY_MAL_ID = `
query ($idMal: Int) {
  Media(idMal: $idMal, type: ANIME) {
    id
  }
}
`;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(query: string, variables: any, retries: number = 3): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const data = await fetchAniList(query, variables, false);
            return data;
        } catch (error: any) {
            console.error(`Attempt ${attempt} failed: ${error.message}`);
            if (attempt === retries) {
                console.error("Max retries reached.");
                return null;
            }
            console.log("Waiting 2 seconds before retrying...");
            await delay(2000);
        }
    }
    return null;
}

export async function runMigration() {
    console.log("Starting AniList Migration...");

    try {
        // Note: Due to SQLite/Postgres Drizzle quirks, we might not have a direct equal to 'pending' if it was fully flushed. 
        // We will just process any anime missing an anilistId.
        const pendingAnime = await db.select().from(anime).where(isNull(anime.anilistId));

        console.log(`Found ${pendingAnime.length} anime to migrate.`);

        for (let i = 0; i < pendingAnime.length; i++) {
            const item = pendingAnime[i];

            if (!item.malId) {
                console.log(`[${i + 1}/${pendingAnime.length}] Skipping ${item.title} - No MAL ID found`);
                await db.update(anime)
                    .set({ migrationStatus: "failed" })
                    .where(eq(anime.id, item.id));
                continue;
            }

            console.log(`[${i + 1}/${pendingAnime.length}] Migrating ${item.title} (MAL ID: ${item.malId})`);

            // Wait to respect rate limits
            await delay(1000);

            const data = await fetchWithRetry(GET_ANILIST_ID_BY_MAL_ID, { idMal: item.malId });

            if (data && data.Media && data.Media.id) {
                const anilistId = data.Media.id;
                console.log(`   -> Found AniList ID: ${anilistId}`);
                await db.update(anime)
                    .set({
                        anilistId: anilistId,
                        migrationStatus: "success"
                    })
                    .where(eq(anime.id, item.id));
            } else {
                console.log(`   -> Failed to map MAL ID ${item.malId} to AniList.`);
                await db.update(anime)
                    .set({ migrationStatus: "failed" })
                    .where(eq(anime.id, item.id));
            }
        }

        console.log("Migration Complete.");
    } catch (err) {
        console.error("Migration failed due to an error:", err);
    }
}

// Allow script to be run directly
if (process.argv[1].endsWith("migrateToAniList.ts")) {
    runMigration().then(() => {
        console.log("Process complete.");
        process.exit(0);
    });
}
