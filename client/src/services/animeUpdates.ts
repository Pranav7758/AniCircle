import { apiRequest } from "@/lib/queryClient";
import { fetchAniList, GET_ANIME_DETAILS_QUERY } from "./anilist";

interface AnimeUpdate {
  animeId: string;
  animeTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  type: 'episode_release' | 'season_release';
}

interface AnimeData {
  id: string;
  title: string;
  anilistId: number | null;
  malId: number | null;
  status: string;
  seasonNumber: number;
  totalEpisodes: number | null;
  coverImage: string | null;
}

export const checkAnimeUpdates = async (userId: string) => {
  try {
    const response = await apiRequest("GET", "/api/anime");
    const userAnime: AnimeData[] = await response.json();
    const watchingAnime = userAnime.filter(a => a.status === 'watching' && (a.anilistId !== null || a.malId !== null));

    if (!watchingAnime.length) {
      return { updates: 0, newSeasons: 0 };
    }

    const animeByTitle = watchingAnime.reduce((acc, anime) => {
      if (!acc[anime.title]) {
        acc[anime.title] = [];
      }
      acc[anime.title].push(anime);
      return acc;
    }, {} as Record<string, AnimeData[]>);

    const updates: AnimeUpdate[] = [];
    const newSeasons: Array<{
      title: string;
      anilistId: number | null;
      malId: number | null;
      seasonNumber: number;
      totalEpisodes: number | null;
      episodesWatched: number;
      status: string;
      coverImage: string | null;
      notes: string | null;
      rating: number | null;
    }> = [];

    for (const [title, seasons] of Object.entries(animeByTitle)) {
      const firstSeason = seasons[0];
      const primaryId = firstSeason.anilistId || firstSeason.malId;
      if (!primaryId) continue;

      try {
        const currentAnime = await fetchAniList(GET_ANIME_DETAILS_QUERY, { id: primaryId });

        if (!currentAnime || !currentAnime.Media) continue;
        const media = currentAnime.Media;

        // 1. Check for New Episodes directly via nextAiringEpisode
        if (media.nextAiringEpisode) {
          const latestAvailable = media.nextAiringEpisode.episode - 1;
          for (const season of seasons) {
            // Ensure we only update episode count if the latest available is higher than what we have saved
            if (season.totalEpisodes !== null && latestAvailable > season.totalEpisodes) {
              updates.push({
                animeId: season.id,
                animeTitle: title,
                seasonNumber: season.seasonNumber,
                episodeNumber: latestAvailable,
                type: 'episode_release',
              });

              await apiRequest("PATCH", `/api/anime/${season.id}`, {
                totalEpisodes: latestAvailable,
                latestEpisode: latestAvailable,
                nextAiringAt: media.nextAiringEpisode.airingAt,
              });
            }
          }
        }

        // 2. Check for New Seasons via relations
        if (media.relations && media.relations.edges) {
          const sequelRelations = media.relations.edges.filter((rel: any) =>
            rel.relationType === "SEQUEL" || rel.relationType === "ALTERNATIVE"
          );

          const existingAniListIds = new Set(seasons.map(s => s.anilistId));
          const existingMalIds = new Set(seasons.map(s => s.malId));
          const maxSeasonNumber = Math.max(...seasons.map(s => s.seasonNumber));

          for (const relation of sequelRelations) {
            const entry = relation.node;
            try {
              if (entry.format === "MOVIE" || entry.format === "OVA" || entry.format === "ONA") {
                continue;
              }

              if (existingAniListIds.has(entry.id) || (entry.idMal && existingMalIds.has(entry.idMal))) {
                continue;
              }

              // It's a valid new season, fetch its details if needed or use the node data
              // Only process sequels that are currently airing or have already finished
              const isReleased = entry.status === "RELEASING" || entry.status === "FINISHED";
              if (entry.format === "TV" && isReleased) {
                updates.push({
                  animeId: firstSeason.id,
                  animeTitle: title,
                  seasonNumber: maxSeasonNumber + 1,
                  episodeNumber: 1,
                  type: 'season_release',
                });

                newSeasons.push({
                  title: title,
                  anilistId: entry.id,
                  malId: entry.idMal || null,
                  seasonNumber: maxSeasonNumber + 1,
                  totalEpisodes: entry.episodes,
                  episodesWatched: 0,
                  status: 'watching',
                  coverImage: firstSeason.coverImage,
                  notes: null,
                  rating: null,
                });
              }

              await new Promise(resolve => setTimeout(resolve, 300));
            } catch (err) {
              console.error(`Error checking sequel ${entry.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Error checking updates for ${title}:`, err);
      }
    }

    if (updates.length > 0) {
      const notifications = updates.map(update => ({
        animeId: update.animeId,
        animeTitle: update.animeTitle,
        seasonNumber: update.seasonNumber,
        episodeNumber: update.episodeNumber,
        notificationType: update.type,
        message: update.type === 'episode_release'
          ? `${update.animeTitle} Season ${update.seasonNumber} Episode ${update.episodeNumber} has been released!`
          : `${update.animeTitle} Season ${update.seasonNumber} has been released!`,
      }));

      for (const notification of notifications) {
        await apiRequest("POST", "/api/notifications", notification);
      }
    }

    if (newSeasons.length > 0) {
      await apiRequest("POST", "/api/anime", newSeasons);
    }

    return { updates: updates.length, newSeasons: newSeasons.length };
  } catch (error) {
    console.error("Error checking anime updates:", error);
    return null;
  }
};
