// client/src/services/anilist.ts

const ANILIST_API_URL = "https://graphql.anilist.co";

// Simple in-memory cache configuration
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const queryCache = new Map<string, CacheEntry<any>>();

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

    const response = await fetch(ANILIST_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        body: JSON.stringify({
            query,
            variables,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`AniList API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const json = await response.json();

    if (json.errors) {
        console.error("AniList GraphQL Errors:", json.errors);
        throw new Error(`GraphQL Error: ${json.errors[0]?.message || "Unknown error"}`);
    }

    const data = json.data as T;

    if (useCache) {
        queryCache.set(cacheKey, {
            data,
            timestamp: Date.now(),
        });
    }

    return data;
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
