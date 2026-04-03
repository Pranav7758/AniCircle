// client/src/services/anilist.ts

const ANILIST_API_URL = "https://graphql.anilist.co";

// Simple in-memory cache configuration
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const queryCache = new Map<string, CacheEntry<any>>();

async function doFetch<T>(query: string, variables: Record<string, any>): Promise<T> {
  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  // Rate-limited — read Retry-After header and surface it
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("Retry-After") || "10");
    throw Object.assign(new Error(`rate_limit`), { retryAfter });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AniList API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const json = await response.json();

  if (json.errors) {
    // AniList sometimes returns 200 with errors array — treat same as rate limit if it's a throttle
    const msg = json.errors[0]?.message || "Unknown error";
    if (msg.toLowerCase().includes("throttl") || msg.toLowerCase().includes("rate")) {
      throw Object.assign(new Error("rate_limit"), { retryAfter: 10 });
    }
    throw new Error(`GraphQL Error: ${msg}`);
  }

  return json.data as T;
}

export async function fetchAniList<T = any>(
  query: string,
  variables: Record<string, any> = {},
  useCache: boolean = true
): Promise<T> {
  const cacheKey = JSON.stringify({ query, variables });

  if (useCache && queryCache.has(cacheKey)) {
    const cached = queryCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data as T;
    }
  }

  // Retry up to 3 times on rate limit, with back-off
  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const data = await doFetch<T>(query, variables);

      if (useCache) {
        queryCache.set(cacheKey, { data, timestamp: Date.now() });
      }

      return data;
    } catch (err: any) {
      lastError = err;
      if (err.message === "rate_limit") {
        const wait = (err.retryAfter || 10) * 1000 + attempt * 2000;
        console.warn(`AniList rate limited — retrying in ${wait / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(res => setTimeout(res, wait));
      } else {
        // Non-rate-limit error — don't retry
        break;
      }
    }
  }

  throw lastError;
}

// Pre-defined Queries
export const SEARCH_ANIME_QUERY = `
  query ($search: String) {
    Page(page: 1, perPage: 10) {
      media(search: $search, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
        }
        episodes
        status
        coverImage {
          large
        }
        nextAiringEpisode {
          episode
          airingAt
        }
        averageScore
        description
        format
        seasonYear
      }
    }
  }
`;

export const GET_ANIME_DETAILS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title {
        romaji
        english
      }
      episodes
      status
      coverImage {
        large
      }
      nextAiringEpisode {
        episode
        airingAt
      }
      averageScore
      startDate {
        year
        month
        day
      }
      genres
      relations {
        edges {
          relationType
          node {
            id
            idMal
            title {
              romaji
              english
            }
            type
            format
            episodes
            startDate {
              year
              month
              day
            }
          }
        }
      }
      description
      format
      seasonYear
    }
  }
`;

export const GET_AIRING_SCHEDULE_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        idMal
        title {
          romaji
          english
        }
        coverImage {
          medium
          large
        }
        nextAiringEpisode {
          airingAt
          timeUntilAiring
          episode
        }
        status
        episodes
        season
        seasonYear
        airingSchedule(notYetAired: true, page: 1, perPage: 3) {
          nodes {
            episode
            airingAt
          }
        }
      }
    }
  }
`;

// Deep relation traversal query — fetches SEQUEL + SIDE_STORY + ALTERNATIVE_SETTING relations
export const GET_RELATIONS_DEEP_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        title {
          romaji
          english
        }
        relations {
          edges {
            relationType
            node {
              id
              idMal
              type
              format
              status
              episodes
              season
              seasonYear
              coverImage {
                large
                medium
              }
              title {
                romaji
                english
              }
              startDate {
                year
                month
                day
              }
              endDate {
                year
              }
              nextAiringEpisode {
                airingAt
                timeUntilAiring
                episode
              }
              averageScore
            }
          }
        }
      }
    }
  }
`;

export const GET_SEQUELS_QUERY = GET_RELATIONS_DEEP_QUERY;

export const GET_WEEKLY_SCHEDULE_QUERY = `
  query ($airingAt_greater: Int, $airingAt_lesser: Int, $page: Int) {
    Page(page: $page, perPage: 50) {
      pageInfo {
        hasNextPage
        currentPage
      }
      airingSchedules(
        airingAt_greater: $airingAt_greater
        airingAt_lesser: $airingAt_lesser
        sort: TIME
      ) {
        id
        airingAt
        episode
        media {
          id
          idMal
          title {
            romaji
            english
          }
          coverImage {
            medium
            large
          }
          format
          episodes
          averageScore
          genres
          studios(isMain: true) {
            nodes {
              name
            }
          }
        }
      }
    }
  }
`;

export const GET_TRENDING_QUERY = `
  query {
    Page(page: 1, perPage: 20) {
      media(type: ANIME, sort: TRENDING_DESC, status_not: NOT_YET_RELEASED) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        description(asHtml: false)
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_GENRE_TRENDING_QUERY = `
  query ($genre: String) {
    Page(page: 1, perPage: 16) {
      media(type: ANIME, genre: $genre, sort: TRENDING_DESC, averageScore_greater: 60) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_TOP_GENRE_QUERY = `
  query ($genre: String) {
    Page(page: 1, perPage: 50) {
      media(type: ANIME, genre: $genre, sort: SCORE_DESC, averageScore_greater: 60, format_in: [TV, MOVIE, OVA]) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_ISEKAI_TRENDING_QUERY = `
  query {
    Page(page: 1, perPage: 14) {
      media(type: ANIME, tag: "Isekai", minimumTagRank: 60, sort: TRENDING_DESC, averageScore_greater: 60) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_RECOMMENDATIONS_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      title {
        english
        romaji
      }
      recommendations(sort: RATING_DESC, page: 1, perPage: 20) {
        nodes {
          rating
          mediaRecommendation {
            id
            idMal
            title {
              english
              romaji
            }
            coverImage {
              large
              medium
            }
            averageScore
            genres
            episodes
            status
            format
            season
            seasonYear
          }
        }
      }
    }
  }
`;

export const GET_TOP_RATED_ISEKAI_QUERY = `
  query {
    Page(page: 1, perPage: 50) {
      media(type: ANIME, tag: "Isekai", minimumTagRank: 60, sort: SCORE_DESC, averageScore_greater: 60, format_in: [TV, MOVIE, OVA]) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_POPULAR_SEASON_QUERY = `
  query ($season: MediaSeason, $seasonYear: Int) {
    Page(page: 1, perPage: 16) {
      media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC, status_not: NOT_YET_RELEASED, format_in: [TV]) {
        id
        idMal
        title {
          english
          romaji
        }
        coverImage {
          large
          medium
          extraLarge
        }
        bannerImage
        averageScore
        episodes
        status
        season
        seasonYear
        format
        genres
        nextAiringEpisode {
          airingAt
          episode
        }
      }
    }
  }
`;

export const GET_ANALYTICS_QUERY = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(id_in: $ids, type: ANIME) {
        id
        idMal
        format
        duration
        episodes
        genres
        tags {
          name
          category
          rank
          isMediaSpoiler
        }
        season
        seasonYear
        averageScore
        source
        title {
          english
          romaji
        }
        studios(isMain: true) {
          nodes {
            name
          }
        }
      }
    }
  }
`;
