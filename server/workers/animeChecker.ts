import cron from "node-cron";
import { db } from "../db";
import { anime, notifications } from "../../shared/schema";
import { eq, and, gt, or } from "drizzle-orm";
import { fetchAniList, GET_ANIME_DETAILS_QUERY } from "../../client/src/services/anilist";

export function startAnimeChecker() {
    // Run every 6 hours
    cron.schedule("0 */6 * * *", async () => {
        console.log("[Worker] Starting Anime Update Check...");
        await checkAnimeUpdates();
    });
}

async function checkAnimeUpdates() {
    try {
        // 1. Fetch only "watching" anime that have an anilistId or malId
        const watchingAnime = await db
            .select({
                id: anime.id,
                userId: anime.userId,
                title: anime.title,
                anilistId: anime.anilistId,
                malId: anime.malId,
                seasonNumber: anime.seasonNumber,
                totalEpisodes: anime.totalEpisodes,
                latestEpisode: anime.latestEpisode,
                nextAiringAt: anime.nextAiringAt,
            })
            .from(anime)
            .where(eq(anime.status, "watching"));

        const animeToProcess = watchingAnime.filter(a => a.anilistId !== null || a.malId !== null);

        if (animeToProcess.length === 0) {
            console.log("[Worker] No currently watching anime to check.");
            return;
        }

        // Process them
        for (const entry of animeToProcess) {
            const primaryId = entry.anilistId || entry.malId;
            if (!primaryId) continue;

            try {
                const details = await fetchAniList(GET_ANIME_DETAILS_QUERY, { id: primaryId }, false); // Bypass cache for workers
                if (!details || !details.Media) continue;

                const media = details.Media;

                // 1. Check for New Episode
                if (media.nextAiringEpisode) {
                    const nextEpisode = media.nextAiringEpisode.episode;
                    const nextAiringAtTime = media.nextAiringEpisode.airingAt;
                    const currentTime = Math.floor(Date.now() / 1000);

                    // If the next airing episode is greater than our latest recorded AND the airing time has passed
                    if (nextAiringAtTime <= currentTime && nextEpisode > (entry.latestEpisode ?? 0)) {
                        const newlyReleasedEpisode = nextEpisode - 1; // The episode that just released

                        // Create notification
                        await db.insert(notifications).values({
                            userId: entry.userId,
                            animeId: entry.id,
                            animeTitle: entry.title,
                            seasonNumber: entry.seasonNumber,
                            episodeNumber: newlyReleasedEpisode,
                            notificationType: "episode_release",
                            message: `${entry.title} Season ${entry.seasonNumber} Episode ${newlyReleasedEpisode} has been released!`,
                        });

                        // Update anime with the latest episode + new next airing time
                        await db.update(anime)
                            .set({
                                latestEpisode: newlyReleasedEpisode,
                                nextAiringAt: nextAiringAtTime,
                            })
                            .where(eq(anime.id, entry.id));

                        console.log(`[Worker] Created notification for new episode of ${entry.title}`);
                    }
                }

                // 2. Check for New Seasons (Sequels)
                if (media.relations && media.relations.edges) {
                    const sequelRelations = media.relations.edges.filter((rel: any) =>
                        rel.relationType === "SEQUEL"
                    );

                    for (const relation of sequelRelations) {
                        const sequelNode = relation.node;
                        if (sequelNode.format !== "TV") continue; // We only want TV Seasons

                        // See if this sequel already exists in the user's anime list
                        const alreadyInListArray = await db.select().from(anime)
                            .where(and(
                                eq(anime.userId, entry.userId),
                                or(
                                    eq(anime.anilistId, sequelNode.id),
                                    eq(anime.malId, sequelNode.idMal)
                                )
                            ));

                        // Check if notification already exists
                        const sequelTitle = sequelNode.title.english || sequelNode.title.romaji;
                        const alreadyNotifiedArray = await db.select().from(notifications)
                            .where(and(
                                eq(notifications.userId, entry.userId),
                                eq(notifications.animeTitle, sequelTitle),
                                eq(notifications.notificationType, "season_release")
                            ));

                        if (alreadyInListArray.length === 0 && alreadyNotifiedArray.length === 0) {
                            const newSeasonNumber = entry.seasonNumber + 1; // Approximate

                            await db.insert(notifications).values({
                                userId: entry.userId,
                                animeId: null, // Anime not added to list yet
                                animeTitle: sequelTitle,
                                seasonNumber: newSeasonNumber,
                                notificationType: "season_release",
                                message: `New Season Detected: ${sequelTitle} has been released!`,
                            });

                            console.log(`[Worker] Created notification for new season: ${sequelTitle}`);
                        }
                    }
                }

                // Add small delay to not hit rate limits heavily and naturally pace out the requests
                await new Promise(r => setTimeout(r, 600));

            } catch (err) {
                console.error(`[Worker] Failed checking updates for anime ${primaryId}:`, err);
            }
        }

    } catch (error) {
        console.error("[Worker] Error in overall checkAnimeUpdates process:", error);
    }
}

import { eq, and, gt, or } from "drizzle-orm";
