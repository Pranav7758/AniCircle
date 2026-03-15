import { useState, useEffect, useMemo } from "react";
import { fetchAniList, GET_TRENDING_QUERY, GET_RECOMMENDATIONS_QUERY, GET_ANALYTICS_QUERY } from "@/services/anilist";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Sparkles, Brain, Plus, Star, Flame, Tv, Heart, Swords, Zap, Moon, Smile, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AnimeItem {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  coverImage: string | null;
  anilistId: number | null;
  isHentai: boolean | null;
}

interface Props {
  animeList: AnimeItem[];
  onAddAnime: (data: any) => Promise<void>;
}

const MOODS = [
  { id: "dark", label: "Dark & Intense", icon: Moon, color: "text-purple-400 border-purple-400/40 bg-purple-400/10 hover:bg-purple-400/20", genres: ["Thriller", "Psychological", "Horror", "Drama", "Mystery", "Suspense"] },
  { id: "action", label: "Pure Action", icon: Swords, color: "text-red-400 border-red-400/40 bg-red-400/10 hover:bg-red-400/20", genres: ["Action", "Adventure", "Sports", "Martial Arts", "Military"] },
  { id: "funny", label: "Make Me Laugh", icon: Smile, color: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10 hover:bg-yellow-400/20", genres: ["Comedy", "Slice of Life", "Parody", "Gag Humor"] },
  { id: "wholesome", label: "Feel Good", icon: Heart, color: "text-pink-400 border-pink-400/40 bg-pink-400/10 hover:bg-pink-400/20", genres: ["Slice of Life", "Romance", "Comedy", "School", "Iyashikei"] },
  { id: "fantasy", label: "Fantasy & Isekai", icon: Sparkles, color: "text-blue-400 border-blue-400/40 bg-blue-400/10 hover:bg-blue-400/20", genres: ["Fantasy", "Adventure", "Isekai", "Magic", "Supernatural"] },
  { id: "brainy", label: "Mind Games", icon: Brain, color: "text-emerald-400 border-emerald-400/40 bg-emerald-400/10 hover:bg-emerald-400/20", genres: ["Mystery", "Sci-Fi", "Psychological", "Strategy Game", "Thriller"] },
];

function AnimeCard({ anime, isInList, onAdd, adding }: { anime: any; isInList: boolean; onAdd: () => void; adding: boolean }) {
  const title = anime.title?.english || anime.title?.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;

  return (
    <Card className="card-3d-hover border-border/40 holo-glass overflow-hidden group flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden">
        {anime.coverImage?.large || anime.coverImage?.medium ? (
          <img
            src={anime.coverImage.large || anime.coverImage.medium}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <Tv className="w-8 h-8 opacity-20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        {score && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
            <Star className="w-2.5 h-2.5 fill-amber-400" />{score}
          </div>
        )}
        {isInList && (
          <div className="absolute top-2 left-2 bg-primary/80 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white">
            In List
          </div>
        )}
        <div className="absolute bottom-2 left-2 right-2">
          <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{title}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {anime.genres?.slice(0, 2).map((g: string) => (
              <span key={g} className="text-[9px] bg-white/10 text-white/80 rounded px-1">{g}</span>
            ))}
          </div>
        </div>
      </div>
      {!isInList && (
        <div className="p-2">
          <Button
            size="sm"
            className="w-full h-7 text-xs gap-1"
            disabled={adding}
            onClick={onAdd}
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Add to List
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Discover({ animeList, onAddAnime }: Props) {
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [recommendations, setRecommendations] = useState<{ sourceTitle: string; items: any[] }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [moodGenreMap, setMoodGenreMap] = useState<Map<number, string[]>>(new Map());
  const [loadingMoodGenres, setLoadingMoodGenres] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const allKnownIds = useMemo(() => new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]), [animeList]);
  const planToWatch = useMemo(() => animeList.filter(a => a.status === "plan_to_watch" && a.anilistId), [animeList]);

  // Trending
  useEffect(() => {
    async function load() {
      try {
        const data = await fetchAniList(GET_TRENDING_QUERY, {});
        setTrending(data?.Page?.media || []);
      } catch { /* silent */ } finally {
        setLoadingTrending(false);
      }
    }
    load();
  }, []);

  // Recommendations: based on top 5 rated completed anime
  useEffect(() => {
    async function load() {
      const topRated = animeList
        .filter(a => a.status === "completed" && a.rating && a.anilistId)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);

      if (topRated.length === 0) { setLoadingRecs(false); return; }

      const results: { sourceTitle: string; items: any[] }[] = [];

      for (const anime of topRated) {
        try {
          const data = await fetchAniList(GET_RECOMMENDATIONS_QUERY, { id: anime.anilistId });
          const recs = (data?.Media?.recommendations?.nodes || [])
            .filter((n: any) => n.mediaRecommendation && !allKnownIds.has(n.mediaRecommendation.id) && n.mediaRecommendation.averageScore >= 65)
            .map((n: any) => n.mediaRecommendation)
            .slice(0, 5);

          if (recs.length > 0) {
            results.push({
              sourceTitle: data?.Media?.title?.english || data?.Media?.title?.romaji || anime.title,
              items: recs,
            });
          }
        } catch { /* skip */ }
      }

      setRecommendations(results);
      setLoadingRecs(false);
    }
    load();
  }, [animeList.length]);

  // Load genres for Plan to Watch anime (for mood picker)
  useEffect(() => {
    const ids = planToWatch.map(a => a.anilistId as number);
    if (ids.length === 0) return;
    async function load() {
      setLoadingMoodGenres(true);
      const newMap = new Map<number, string[]>();
      for (let i = 0; i < ids.length; i += 50) {
        try {
          const data = await fetchAniList(GET_ANALYTICS_QUERY, { ids: ids.slice(i, i + 50) });
          for (const media of data?.Page?.media || []) {
            const genres = [...(media.genres || [])];
            if (media.tags) {
              for (const tag of media.tags) {
                if (!tag.isMediaSpoiler && tag.rank >= 70) genres.push(tag.name);
              }
            }
            if (genres.length) newMap.set(media.id, genres);
          }
        } catch { /* silent */ }
      }
      setMoodGenreMap(newMap);
      setLoadingMoodGenres(false);
    }
    load();
  }, [planToWatch.length]);

  const moodResults = useMemo(() => {
    if (!activeMood) return [];
    const mood = MOODS.find(m => m.id === activeMood);
    if (!mood) return [];
    return planToWatch.filter(a => {
      const genres = moodGenreMap.get(a.anilistId as number) || [];
      return mood.genres.some(mg => genres.some(g => g.toLowerCase().includes(mg.toLowerCase())));
    });
  }, [activeMood, planToWatch, moodGenreMap]);

  const handleAdd = async (anime: any) => {
    setAddingId(anime.id);
    try {
      await onAddAnime({
        title: anime.title?.english || anime.title?.romaji,
        episodesWatched: 0,
        totalEpisodes: anime.episodes,
        status: "plan_to_watch",
        rating: null,
        notes: "",
        coverImage: anime.coverImage?.large || anime.coverImage?.medium,
        seasonNumber: 1,
        anilistId: anime.id,
        malId: anime.idMal,
        isHentai: false,
      });
      toast.success(`Added ${anime.title?.english || anime.title?.romaji} to your list!`);
    } catch { toast.error("Failed to add anime"); }
    finally { setAddingId(null); }
  };

  return (
    <div className="space-y-10">

      {/* ── Mood Picker ── */}
      <section>
        <div className="flex items-center gap-2.5 mb-1">
          <Zap className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]" />
          <h2 className="text-2xl font-bold">What's Your Mood?</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">Pick a vibe — we'll pull matching anime from your Plan to Watch list.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
          {MOODS.map((mood) => {
            const Icon = mood.icon;
            return (
              <button
                key={mood.id}
                onClick={() => setActiveMood(activeMood === mood.id ? null : mood.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all duration-200 ${mood.color} ${activeMood === mood.id ? "ring-2 ring-current scale-105 shadow-lg" : ""}`}
              >
                <Icon className="w-5 h-5" />
                {mood.label}
              </button>
            );
          })}
        </div>

        {activeMood && (
          <div className="animate-fade-in">
            {loadingMoodGenres ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin opacity-40" /></div>
            ) : moodResults.length === 0 ? (
              <Card className="bg-muted/20 border-dashed">
                <CardContent className="text-center py-8 text-muted-foreground text-sm">
                  No matching anime in your Plan to Watch for this mood.<br />
                  <span className="text-xs opacity-70">Try adding more anime or pick a different mood.</span>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3 font-medium">
                  {moodResults.length} anime from your Plan to Watch match this mood
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {moodResults.map(anime => {
                    const cover = anime.coverImage;
                    const title = anime.title;
                    return (
                      <Card key={anime.id} className="card-3d-hover border-border/40 holo-glass overflow-hidden group">
                        <div className="relative aspect-[3/4] overflow-hidden">
                          {cover ? (
                            <img src={cover} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-muted/40 flex items-center justify-center"><Tv className="w-6 h-6 opacity-20" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
                          <div className="absolute bottom-2 left-2 right-2">
                            <p className="text-xs font-semibold text-white line-clamp-2 leading-tight">{title}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Smart Recommendations ── */}
      <section className="pt-2 border-t border-border/40">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
          <h2 className="text-2xl font-bold">Recommended for You</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Personalized picks based on your highest rated anime.</p>

        {loadingRecs ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin opacity-40" /></div>
        ) : recommendations.length === 0 ? (
          <Card className="bg-muted/20 border-dashed">
            <CardContent className="text-center py-10 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-medium">Rate some completed anime to get recommendations</p>
              <p className="text-xs mt-1 opacity-70">We use your highest-rated shows to find similar ones you'll love.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {recommendations.map(({ sourceTitle, items }) => (
              <div key={sourceTitle}>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Because you loved <span className="text-foreground">{sourceTitle}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {items.map((anime) => (
                    <AnimeCard
                      key={anime.id}
                      anime={anime}
                      isInList={allKnownIds.has(anime.id)}
                      onAdd={() => handleAdd(anime)}
                      adding={addingId === anime.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Trending Spotlight ── */}
      <section className="pt-2 border-t border-border/40">
        <div className="flex items-center gap-2.5 mb-1">
          <Flame className="h-5 w-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.7)]" />
          <h2 className="text-2xl font-bold">Trending Now</h2>
          <Badge variant="outline" className="ml-auto text-[10px] border-orange-400/30 text-orange-400">Live</Badge>
        </div>
        <p className="text-muted-foreground text-sm mb-6">What the entire anime community is watching right now.</p>

        {loadingTrending ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 animate-spin opacity-40" /></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {trending.slice(0, 15).map((anime, idx) => (
              <div key={anime.id} className="relative">
                <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-[10px] font-black text-white">
                  #{idx + 1}
                </div>
                <AnimeCard
                  anime={anime}
                  isInList={allKnownIds.has(anime.id)}
                  onAdd={() => handleAdd(anime)}
                  adding={addingId === anime.id}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
