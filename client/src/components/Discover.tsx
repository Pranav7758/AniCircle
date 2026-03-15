import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchAniList,
  GET_TRENDING_QUERY,
  GET_RECOMMENDATIONS_QUERY,
  GET_ANALYTICS_QUERY,
  GET_GENRE_TRENDING_QUERY,
} from "@/services/anilist";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Sparkles, Brain, Plus, Star, Flame, Tv,
  Heart, Swords, Zap, Moon, Smile, ChevronLeft, ChevronRight,
  Check, Play, Clock, Scroll,
} from "lucide-react";
import { toast } from "sonner";

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
  {
    id: "dark", label: "Dark & Intense", emoji: "🌑", desc: "Psychological, Horror, Thriller",
    from: "from-purple-900/60", to: "to-purple-600/20", border: "border-purple-500/40", ring: "ring-purple-500",
    glow: "shadow-[0_0_20px_rgba(168,85,247,0.35)]",
    genres: ["Thriller", "Psychological", "Horror", "Drama", "Mystery", "Suspense"],
  },
  {
    id: "action", label: "Pure Action", emoji: "⚔️", desc: "Fights, Adventure, Sports",
    from: "from-red-900/60", to: "to-orange-700/20", border: "border-red-500/40", ring: "ring-red-500",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.35)]",
    genres: ["Action", "Adventure", "Sports", "Martial Arts", "Military"],
  },
  {
    id: "funny", label: "Make Me Laugh", emoji: "😂", desc: "Comedy, Parody, Gag Humor",
    from: "from-yellow-900/60", to: "to-yellow-600/20", border: "border-yellow-500/40", ring: "ring-yellow-500",
    glow: "shadow-[0_0_20px_rgba(234,179,8,0.35)]",
    genres: ["Comedy", "Slice of Life", "Parody", "Gag Humor"],
  },
  {
    id: "wholesome", label: "Feel Good", emoji: "🌸", desc: "Romance, Slice of Life, School",
    from: "from-pink-900/60", to: "to-pink-600/20", border: "border-pink-500/40", ring: "ring-pink-500",
    glow: "shadow-[0_0_20px_rgba(236,72,153,0.35)]",
    genres: ["Slice of Life", "Romance", "Comedy", "School", "Iyashikei"],
  },
  {
    id: "isekai", label: "Isekai / Fantasy", emoji: "🌀", desc: "Other Worlds, Magic, Adventure",
    from: "from-blue-900/60", to: "to-violet-700/20", border: "border-blue-500/40", ring: "ring-blue-500",
    glow: "shadow-[0_0_20px_rgba(59,130,246,0.35)]",
    genres: ["Fantasy", "Adventure", "Isekai", "Magic", "Supernatural"],
  },
  {
    id: "brainy", label: "Mind Games", emoji: "🧠", desc: "Mystery, Sci-Fi, Strategy",
    from: "from-emerald-900/60", to: "to-teal-700/20", border: "border-emerald-500/40", ring: "ring-emerald-500",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.35)]",
    genres: ["Mystery", "Sci-Fi", "Psychological", "Strategy Game", "Thriller"],
  },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  RELEASING: { label: "Airing", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  FINISHED: { label: "Finished", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  NOT_YET_RELEASED: { label: "Upcoming", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

function PremiumAnimeCard({
  anime, isInList, onAdd, adding, rank,
}: {
  anime: any; isInList: boolean; onAdd: () => void; adding: boolean; rank?: number;
}) {
  const title = anime.title?.english || anime.title?.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const st = STATUS_MAP[anime.status] || null;

  return (
    <div className="group relative flex-shrink-0 w-36 sm:w-40">
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 shadow-lg">
        {anime.coverImage?.large || anime.coverImage?.extraLarge ? (
          <img
            src={anime.coverImage.extraLarge || anime.coverImage.large}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center">
            <Tv className="w-8 h-8 opacity-20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

        {rank !== undefined && (
          <div className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/80 backdrop-blur border border-white/20 flex items-center justify-center text-[11px] font-black text-white">
            #{rank}
          </div>
        )}
        {score && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/80 backdrop-blur rounded-full px-1.5 py-0.5 text-[10px] font-bold text-amber-400 border border-amber-400/20">
            <Star className="w-2.5 h-2.5 fill-amber-400" />{score}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <p className="text-xs font-bold text-white line-clamp-2 leading-tight mb-1.5">{title}</p>
          {st && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${st.color}`}>
              {st.label}
            </span>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isInList ? (
            <div className="bg-emerald-500/80 backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-1.5 text-white text-xs font-bold">
              <Check className="w-3.5 h-3.5" /> In Your List
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              disabled={adding}
              className="bg-primary/90 hover:bg-primary backdrop-blur rounded-full px-3 py-1.5 flex items-center gap-1.5 text-white text-xs font-bold transition-colors shadow-neon"
            >
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-1 text-center">{title}</p>
    </div>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: number) => {
    if (ref.current) ref.current.scrollBy({ left: dir * 320, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <button
        onClick={() => scroll(-1)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors shadow-lg"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-background/90 border border-border/60 flex items-center justify-center hover:bg-muted transition-colors shadow-lg"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function TrendingHero({ anime, isInList, onAdd, adding }: { anime: any; isInList: boolean; onAdd: () => void; adding: boolean }) {
  const title = anime.title?.english || anime.title?.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const desc = anime.description?.replace(/<[^>]*>/g, "").slice(0, 180) + (anime.description?.length > 180 ? "…" : "");
  const ep = anime.nextAiringEpisode?.episode;
  const bg = anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl mb-2" style={{ minHeight: 280 }}>
      {bg && (
        <>
          <img src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
        </>
      )}
      {!bg && <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />}

      <div className="relative z-10 flex items-end sm:items-center gap-4 p-5 sm:p-8 h-full" style={{ minHeight: 280 }}>
        <div className="shrink-0 hidden sm:block">
          <img
            src={anime.coverImage?.large || anime.coverImage?.medium}
            alt={title}
            className="w-32 h-44 object-cover rounded-xl shadow-2xl border border-white/10"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-bold">
              <Flame className="w-2.5 h-2.5 mr-1" /> TRENDING #1
            </Badge>
            {anime.status === "RELEASING" && ep && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
                <Play className="w-2.5 h-2.5 mr-1 fill-current" /> EP {ep} Airing
              </Badge>
            )}
            {score && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                <Star className="w-2.5 h-2.5 mr-1 fill-amber-400" /> {score}/10
              </Badge>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-2 leading-tight drop-shadow-lg">{title}</h2>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {anime.genres?.slice(0, 5).map((g: string) => (
              <span key={g} className="text-[10px] font-semibold bg-white/10 backdrop-blur text-white/80 rounded-full px-2 py-0.5 border border-white/10">
                {g}
              </span>
            ))}
          </div>
          {desc && <p className="text-xs text-white/60 mb-4 leading-relaxed max-w-md hidden sm:block">{desc}</p>}
          <div className="flex items-center gap-2">
            {isInList ? (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs border-emerald-500/50 text-emerald-400 bg-emerald-500/10 rounded-xl" disabled>
                <Check className="w-3.5 h-3.5" /> In Your List
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5 text-xs gradient-primary shadow-neon rounded-xl font-bold"
                onClick={onAdd}
                disabled={adding}
              >
                {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add to List
              </Button>
            )}
            {anime.episodes && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {anime.episodes} eps
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Discover({ animeList, onAddAnime }: Props) {
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [isekai, setIsekai] = useState<any[]>([]);
  const [loadingIsekai, setLoadingIsekai] = useState(true);
  const [recommendations, setRecommendations] = useState<{ sourceTitle: string; items: any[] }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [moodGenreMap, setMoodGenreMap] = useState<Map<number, string[]>>(new Map());
  const [loadingMoodGenres, setLoadingMoodGenres] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const allKnownIds = useMemo(
    () => new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]),
    [animeList]
  );
  const planToWatch = useMemo(
    () => animeList.filter(a => a.status === "plan_to_watch" && a.anilistId),
    [animeList]
  );

  useEffect(() => {
    async function load() {
      try {
        const [trendData, isekaiData] = await Promise.all([
          fetchAniList(GET_TRENDING_QUERY, {}),
          fetchAniList(GET_GENRE_TRENDING_QUERY, { genre: "Isekai" }),
        ]);
        setTrending(trendData?.Page?.media || []);
        setIsekai(isekaiData?.Page?.media || []);
      } catch { } finally {
        setLoadingTrending(false);
        setLoadingIsekai(false);
      }
    }
    load();
  }, []);

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
            .slice(0, 8);
          if (recs.length > 0) {
            results.push({
              sourceTitle: data?.Media?.title?.english || data?.Media?.title?.romaji || anime.title,
              items: recs,
            });
          }
        } catch { }
      }
      setRecommendations(results);
      setLoadingRecs(false);
    }
    load();
  }, [animeList.length]);

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
        } catch { }
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
        coverImage: anime.coverImage?.extraLarge || anime.coverImage?.large || anime.coverImage?.medium,
        seasonNumber: 1,
        anilistId: anime.id,
        malId: anime.idMal,
        isHentai: false,
      });
      toast.success(`Added ${anime.title?.english || anime.title?.romaji} to your list!`);
    } catch { toast.error("Failed to add anime"); }
    finally { setAddingId(null); }
  };

  const hero = trending[0];
  const trendingRest = trending.slice(1);

  return (
    <div className="space-y-10 pb-6">

      {/* ── Hero Spotlight ── */}
      {loadingTrending ? (
        <div className="flex justify-center py-14"><Loader2 className="w-8 h-8 animate-spin opacity-30" /></div>
      ) : hero ? (
        <section>
          <TrendingHero
            anime={hero}
            isInList={allKnownIds.has(hero.id)}
            onAdd={() => handleAdd(hero)}
            adding={addingId === hero.id}
          />
        </section>
      ) : null}

      {/* ── Isekai Corner ── */}
      <section>
        <div className="relative rounded-2xl overflow-hidden mb-5">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-950 via-blue-950 to-indigo-950 opacity-60" />
          <div className="absolute inset-0" style={{
            backgroundImage: "radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.3) 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, rgba(59,130,246,0.2) 0%, transparent 60%)"
          }} />
          <div className="relative z-10 px-5 py-4 flex items-center gap-3">
            <div className="text-3xl select-none">🌀</div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                Isekai Corner
                <Badge className="bg-violet-500/30 text-violet-300 border-violet-500/40 text-[9px] ml-1">Your Fave</Badge>
              </h2>
              <p className="text-xs text-white/50 mt-0.5">The hottest other-world adventures — live & updated</p>
            </div>
            <div className="ml-auto flex gap-1 opacity-30">
              {["✦", "✦", "✦"].map((s, i) => (
                <span key={i} className={`text-violet-300 text-xs animate-pulse`} style={{ animationDelay: `${i * 0.3}s` }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {loadingIsekai ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin opacity-40" /></div>
        ) : (
          <HorizontalScroll>
            {isekai.map((anime, idx) => (
              <PremiumAnimeCard
                key={anime.id}
                anime={anime}
                isInList={allKnownIds.has(anime.id)}
                onAdd={() => handleAdd(anime)}
                adding={addingId === anime.id}
                rank={idx + 1}
              />
            ))}
          </HorizontalScroll>
        )}
      </section>

      {/* ── Mood Picker ── */}
      <section className="pt-2 border-t border-border/30">
        <div className="flex items-center gap-2.5 mb-1">
          <Zap className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]" />
          <h2 className="text-2xl font-black">What's Your Mood?</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-5">Pick a vibe — we'll instantly surface matching anime from your Plan to Watch.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
          {MOODS.map((mood) => {
            const active = activeMood === mood.id;
            return (
              <button
                key={mood.id}
                onClick={() => setActiveMood(active ? null : mood.id)}
                className={`
                  relative group flex flex-col items-center gap-2 p-4 rounded-2xl border text-center
                  bg-gradient-to-b ${mood.from} ${mood.to}
                  ${mood.border} transition-all duration-200
                  ${active ? `ring-2 ${mood.ring} scale-105 ${mood.glow}` : "hover:scale-[1.02] hover:brightness-110"}
                `}
              >
                <span className="text-2xl select-none">{mood.emoji}</span>
                <div>
                  <p className="text-xs font-bold text-white leading-tight">{mood.label}</p>
                  <p className="text-[9px] text-white/50 mt-0.5 leading-tight hidden sm:block">{mood.desc}</p>
                </div>
                {active && (
                  <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white/20 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {activeMood && (
          <div>
            {loadingMoodGenres ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin opacity-40" /></div>
            ) : moodResults.length === 0 ? (
              <Card className="bg-muted/10 border-dashed border-border/40">
                <CardContent className="text-center py-8 text-muted-foreground text-sm">
                  <span className="text-2xl block mb-2">🎭</span>
                  No matches in your Plan to Watch for this mood.
                  <p className="text-xs mt-1 opacity-60">Try adding more anime or switch mood.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  <span className="font-bold text-foreground">{moodResults.length}</span> anime match this mood in your Plan to Watch
                </p>
                <HorizontalScroll>
                  {moodResults.map(anime => (
                    <div key={anime.id} className="flex-shrink-0 w-36 sm:w-40 group">
                      <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10">
                        {anime.coverImage ? (
                          <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full bg-muted/40 flex items-center justify-center"><Tv className="w-6 h-6 opacity-20" /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                        <div className="absolute bottom-2 left-2 right-2">
                          <p className="text-[10px] font-bold text-white line-clamp-2 leading-tight">{anime.title}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </HorizontalScroll>
              </>
            )}
          </div>
        )}
      </section>

      {/* ── Smart Recommendations ── */}
      <section className="pt-2 border-t border-border/30">
        <div className="flex items-center gap-2.5 mb-1">
          <Brain className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
          <h2 className="text-2xl font-black">Handpicked for You</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-6">Based on your highest-rated anime — with carousels so you never miss a gem.</p>

        {loadingRecs ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin opacity-40" /></div>
        ) : recommendations.length === 0 ? (
          <Card className="bg-muted/10 border-dashed border-border/40">
            <CardContent className="text-center py-10 text-muted-foreground">
              <Brain className="w-10 h-10 mx-auto mb-2 opacity-20" />
              <p className="font-semibold">Rate some completed anime to unlock recommendations</p>
              <p className="text-xs mt-1 opacity-60">We use AniList's own recommendation engine — the more you rate, the smarter it gets.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-7">
            {recommendations.map(({ sourceTitle, items }) => (
              <div key={sourceTitle}>
                <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Because you loved{" "}
                  <span className="font-black text-foreground">{sourceTitle}</span>
                </p>
                <HorizontalScroll>
                  {items.map((anime) => (
                    <PremiumAnimeCard
                      key={anime.id}
                      anime={anime}
                      isInList={allKnownIds.has(anime.id)}
                      onAdd={() => handleAdd(anime)}
                      adding={addingId === anime.id}
                    />
                  ))}
                </HorizontalScroll>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Trending Now (rest) ── */}
      {trendingRest.length > 0 && (
        <section className="pt-2 border-t border-border/30">
          <div className="flex items-center gap-2.5 mb-1">
            <Flame className="h-5 w-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.7)]" />
            <h2 className="text-2xl font-black">Trending Now</h2>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-orange-400 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" /> LIVE
            </span>
          </div>
          <p className="text-muted-foreground text-sm mb-5">What the entire anime community is watching this moment.</p>

          <HorizontalScroll>
            {trendingRest.slice(0, 18).map((anime, idx) => (
              <PremiumAnimeCard
                key={anime.id}
                anime={anime}
                isInList={allKnownIds.has(anime.id)}
                onAdd={() => handleAdd(anime)}
                adding={addingId === anime.id}
                rank={idx + 2}
              />
            ))}
          </HorizontalScroll>
        </section>
      )}
    </div>
  );
}
