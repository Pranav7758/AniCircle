import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchAniList,
  GET_TRENDING_QUERY,
  GET_RECOMMENDATIONS_QUERY,
  GET_ANALYTICS_QUERY,
  GET_TOP_GENRE_QUERY,
  GET_TOP_RATED_ISEKAI_QUERY,
  GET_POPULAR_SEASON_QUERY,
} from "@/services/anilist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Plus, Star, Flame, Tv, Sparkles,
  ChevronLeft, ChevronRight, Check, Play,
  Clock, Brain, CalendarDays,
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

const GENRES = [
  { id: "isekai",    label: "Isekai",        emoji: "🌀", isIsekaiTag: true  },
  { id: "action",    label: "Action",         emoji: "⚔️", genre: "Action"    },
  { id: "romance",   label: "Romance",        emoji: "💕", genre: "Romance"   },
  { id: "comedy",    label: "Comedy",         emoji: "😂", genre: "Comedy"    },
  { id: "thriller",  label: "Thriller",       emoji: "😰", genre: "Thriller"  },
  { id: "scifi",     label: "Sci-Fi",         emoji: "🚀", genre: "Sci-Fi"    },
  { id: "fantasy",   label: "Fantasy",        emoji: "🧙", genre: "Fantasy"   },
  { id: "horror",    label: "Horror",         emoji: "👻", genre: "Horror"    },
  { id: "mystery",   label: "Mystery",        emoji: "🔍", genre: "Mystery"   },
  { id: "slicelife", label: "Slice of Life",  emoji: "🌸", genre: "Slice of Life" },
  { id: "sports",    label: "Sports",         emoji: "🏆", genre: "Sports"    },
  { id: "mecha",     label: "Mecha",          emoji: "🤖", genre: "Mecha"     },
] as const;

const GENRE_META: Record<string, { emoji: string }> = {
  Action: { emoji: "⚔️" }, Adventure: { emoji: "🗺️" }, Comedy: { emoji: "😂" },
  Drama: { emoji: "🎭" }, Fantasy: { emoji: "🧙" }, Horror: { emoji: "👻" },
  Mystery: { emoji: "🔍" }, Psychological: { emoji: "🧠" }, Romance: { emoji: "💕" },
  "Sci-Fi": { emoji: "🚀" }, "Slice of Life": { emoji: "🌸" }, Sports: { emoji: "🏆" },
  Supernatural: { emoji: "👁️" }, Thriller: { emoji: "😰" }, Mecha: { emoji: "🤖" },
};

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  RELEASING:        { label: "Airing",    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  FINISHED:         { label: "Finished",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  NOT_YET_RELEASED: { label: "Upcoming",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

function getCurrentSeason(): { season: string; seasonYear: number } {
  const m = new Date().getMonth() + 1;
  const y = new Date().getFullYear();
  if (m >= 4 && m <= 6)   return { season: "SPRING", seasonYear: y };
  if (m >= 7 && m <= 9)   return { season: "SUMMER", seasonYear: y };
  if (m >= 10 && m <= 12) return { season: "FALL",   seasonYear: y };
  return { season: "WINTER", seasonYear: y };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AnimeCard({ anime, isInList, onAdd, adding, rank }: {
  anime: any; isInList: boolean; onAdd: () => void; adding: boolean; rank?: number;
}) {
  const title = anime.title?.english || anime.title?.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const st = STATUS_MAP[anime.status] || null;

  return (
    <div className="group relative flex-shrink-0 w-[130px] sm:w-[144px]" data-testid={`card-anime-${anime.id}`}>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted/30">
        {anime.coverImage?.large || anime.coverImage?.extraLarge ? (
          <img
            src={anime.coverImage.extraLarge || anime.coverImage.large}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tv className="w-8 h-8 opacity-20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />

        {rank !== undefined && (
          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-black/70 backdrop-blur-sm flex items-center justify-center text-[10px] font-black text-white">
            {rank}
          </div>
        )}
        {score && (
          <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-full px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
            <Star className="w-2.5 h-2.5 fill-amber-400" />{score}
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-[11px] font-semibold text-white line-clamp-2 leading-tight mb-1">{title}</p>
          {st && (
            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${st.color}`}>
              {st.label}
            </span>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/25">
          {isInList ? (
            <div className="bg-emerald-500 rounded-full px-3 py-1.5 flex items-center gap-1 text-white text-xs font-bold shadow-lg">
              <Check className="w-3 h-3" /> In List
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              disabled={adding}
              data-testid={`button-add-${anime.id}`}
              className="bg-white text-black rounded-full px-3 py-1.5 flex items-center gap-1 text-xs font-bold hover:bg-white/90 transition-colors shadow-lg"
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => ref.current?.scrollBy({ left: d * 400, behavior: "smooth" });
  return (
    <div className="relative group/row">
      <button onClick={() => scroll(-1)} className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-all shadow-md">
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div ref={ref} className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        {children}
      </div>
      <button onClick={() => scroll(1)} className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-all shadow-md">
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SectionRow({ icon, title, subtitle, badge, children, loading }: {
  icon: React.ReactNode; title: string; subtitle?: string; badge?: string;
  children: React.ReactNode; loading?: boolean;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm font-bold text-foreground">{title}</span>
        {badge && <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full ml-0.5">{badge}</span>}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {loading ? (
        <div className="flex gap-2.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[130px] sm:w-[144px] aspect-[2/3] rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : children}
    </section>
  );
}

function Hero({ animes, allKnownIds, onAdd, addingId }: {
  animes: any[]; allKnownIds: Set<number>; onAdd: (a: any) => void; addingId: number | null;
}) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setIdx(i => (i + 1) % Math.min(animes.length, 5)), 7000);
  };

  useEffect(() => {
    if (!animes.length) return;
    reset();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [animes.length]);

  if (!animes.length) return null;
  const a = animes[idx] || animes[0];
  const title = a.title?.english || a.title?.romaji;
  const score = a.averageScore ? (a.averageScore / 10).toFixed(1) : null;
  const desc = a.description?.replace(/<[^>]*>/g, "").slice(0, 160);
  const ep = a.nextAiringEpisode?.episode;
  const bg = a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large;
  const inList = allKnownIds.has(a.id);
  const adding = addingId === a.id;
  const dots = Math.min(animes.length, 5);
  const go = (i: number) => { setIdx(i); reset(); };

  return (
    <div className="relative rounded-xl overflow-hidden border border-border/30" style={{ height: 260 }}>
      {bg && <img key={a.id} src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

      <div className="relative z-10 flex items-center gap-4 h-full px-5 sm:px-8">
        <img
          key={a.id + "c"}
          src={a.coverImage?.extraLarge || a.coverImage?.large}
          alt={title}
          className="hidden sm:block w-22 h-32 object-cover rounded-lg shadow-2xl flex-shrink-0"
          style={{ width: 88, height: 128 }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[9px] font-bold px-2 py-0.5">
              <Flame className="w-2 h-2 mr-1" />#{idx + 1} TRENDING
            </Badge>
            {a.status === "RELEASING" && ep && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] px-2 py-0.5">
                <Play className="w-2 h-2 mr-1 fill-current" />EP {ep}
              </Badge>
            )}
            {score && (
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[9px] px-2 py-0.5">
                <Star className="w-2 h-2 mr-1 fill-amber-400" />{score}
              </Badge>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white leading-tight mb-2 drop-shadow">{title}</h1>
          <div className="flex flex-wrap gap-1 mb-2">
            {a.genres?.slice(0, 4).map((g: string) => (
              <span key={g} className="text-[9px] text-white/55 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/10">{g}</span>
            ))}
          </div>
          {desc && <p className="text-xs text-white/45 hidden sm:block line-clamp-2 max-w-md mb-3 leading-relaxed">{desc}</p>}
          <div className="flex items-center gap-2">
            {inList ? (
              <Button size="sm" disabled variant="outline" className="text-xs gap-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 h-7 px-3 rounded-full">
                <Check className="w-3 h-3" /> In Your List
              </Button>
            ) : (
              <Button size="sm" onClick={() => onAdd(a)} disabled={adding} data-testid={`button-hero-add-${a.id}`}
                className="text-xs gap-1.5 h-7 px-3 rounded-full gradient-primary shadow-neon font-semibold">
                {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Add to List
              </Button>
            )}
            {a.episodes && (
              <span className="text-[10px] text-white/30 flex items-center gap-1">
                <Clock className="w-3 h-3" />{a.episodes} eps
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="absolute bottom-3 right-4 flex gap-1 z-20">
        {Array.from({ length: dots }).map((_, i) => (
          <button key={i} onClick={() => go(i)}
            className={`h-1 rounded-full transition-all duration-300 ${i === idx ? "w-4 bg-white" : "w-1 bg-white/30 hover:bg-white/50"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Discover({ animeList, onAddAnime }: Props) {
  const [trending, setTrending] = useState<any[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [seasonPicks, setSeasonPicks] = useState<any[]>([]);
  const [loadingSeasonPicks, setLoadingSeasonPicks] = useState(true);
  const [recommendations, setRecommendations] = useState<{ sourceTitle: string; items: any[] }[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);

  // Personalized genre
  const [userTopGenre, setUserTopGenre] = useState<string | null>(null);
  const [genreAnime, setGenreAnime] = useState<any[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);

  // Genre browser
  const [selectedGenre, setSelectedGenre] = useState<string>("isekai");
  const [genreResults, setGenreResults] = useState<any[]>([]);
  const [loadingGenreResults, setLoadingGenreResults] = useState(false);

  const [addingId, setAddingId] = useState<number | null>(null);

  const allKnownIds = useMemo(
    () => new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]),
    [animeList]
  );

  // Load trending + season
  useEffect(() => {
    const { season, seasonYear } = getCurrentSeason();
    async function load() {
      try {
        const [trendData, seasonData] = await Promise.all([
          fetchAniList(GET_TRENDING_QUERY, {}),
          fetchAniList(GET_POPULAR_SEASON_QUERY, { season, seasonYear }),
        ]);
        setTrending(trendData?.Page?.media || []);
        setSeasonPicks(seasonData?.Page?.media || []);
      } catch { }
      finally { setLoadingTrending(false); setLoadingSeasonPicks(false); }
    }
    load();
  }, []);

  // Recommendations from rated completed anime
  useEffect(() => {
    async function load() {
      const topRated = animeList
        .filter(a => a.status === "completed" && a.rating && a.anilistId)
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 4);
      if (!topRated.length) { setLoadingRecs(false); return; }
      const results: { sourceTitle: string; items: any[] }[] = [];
      for (const anime of topRated) {
        try {
          const data = await fetchAniList(GET_RECOMMENDATIONS_QUERY, { id: anime.anilistId });
          const recs = (data?.Media?.recommendations?.nodes || [])
            .filter((n: any) => n.mediaRecommendation && !allKnownIds.has(n.mediaRecommendation.id) && n.mediaRecommendation.averageScore >= 65)
            .map((n: any) => n.mediaRecommendation)
            .slice(0, 10);
          if (recs.length) results.push({
            sourceTitle: data?.Media?.title?.english || data?.Media?.title?.romaji || anime.title,
            items: recs,
          });
        } catch { }
      }
      setRecommendations(results);
      setLoadingRecs(false);
    }
    load();
  }, [animeList.length]);

  // Detect user's top genre from their watch history
  useEffect(() => {
    const ids = animeList
      .filter(a => a.anilistId && (a.status === "completed" || a.status === "watching"))
      .map(a => a.anilistId as number)
      .slice(0, 30);
    if (ids.length < 3) return;

    async function detect() {
      setLoadingGenre(true);
      try {
        const data = await fetchAniList(GET_ANALYTICS_QUERY, { ids });
        const tally: Record<string, number> = {};
        for (const media of data?.Page?.media || []) {
          for (const g of media.genres || []) {
            if (g === "Hentai") continue;
            tally[g] = (tally[g] || 0) + 1;
          }
        }
        const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        if (!sorted.length) return;
        const top = sorted[0][0];
        setUserTopGenre(top);
        const res = await fetchAniList(GET_TOP_GENRE_QUERY, { genre: top });
        const items = (res?.Page?.media || []).filter((m: any) => !allKnownIds.has(m.id));
        setGenreAnime(items);
      } catch { }
      finally { setLoadingGenre(false); }
    }
    detect();
  }, [animeList.length]);

  // Fetch genre browser results — top-rated, exclude watched
  useEffect(() => {
    if (!selectedGenre) return;
    const g = GENRES.find(x => x.id === selectedGenre);
    if (!g) return;
    setLoadingGenreResults(true);
    setGenreResults([]);
    async function load() {
      try {
        let data: any;
        if (g!.isIsekaiTag) {
          data = await fetchAniList(GET_TOP_RATED_ISEKAI_QUERY, {}, false);
        } else {
          data = await fetchAniList(GET_TOP_GENRE_QUERY, { genre: (g as any).genre }, false);
        }
        // Filter out anime already in user's list
        const items = (data?.Page?.media || []).filter((m: any) => !allKnownIds.has(m.id));
        setGenreResults(items);
      } catch { }
      finally { setLoadingGenreResults(false); }
    }
    load();
  }, [selectedGenre]);

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
      toast.success(`Added "${anime.title?.english || anime.title?.romaji}" to your list!`);
    } catch { toast.error("Failed to add anime"); }
    finally { setAddingId(null); }
  };

  const { season, seasonYear } = getCurrentSeason();
  const seasonLabel = season.charAt(0) + season.slice(1).toLowerCase() + " " + seasonYear;
  const selectedGenreInfo = GENRES.find(g => g.id === selectedGenre);
  const genreInfo = userTopGenre ? (GENRE_META[userTopGenre] || { emoji: "🎯" }) : null;
  const hasRatedAnime = animeList.some(a => a.status === "completed" && a.rating);

  return (
    <div className="space-y-8 pb-8">

      {/* ── Hero ── */}
      {loadingTrending ? (
        <div className="rounded-xl bg-muted/30 animate-pulse" style={{ height: 260 }} />
      ) : (
        <Hero animes={trending.slice(0, 5)} allKnownIds={allKnownIds} onAdd={handleAdd} addingId={addingId} />
      )}

      {/* ── Genre Browser — main interactive section ── */}
      <section>
        <div className="mb-3">
          <span className="text-sm font-bold text-foreground">Browse Genres</span>
          <p className="text-xs text-muted-foreground mt-0.5">Pick a genre to see the best anime — ones you haven't watched yet</p>
        </div>

        {/* Genre pills */}
        <div className="flex flex-wrap gap-2 mb-5">
          {GENRES.map(g => (
            <button
              key={g.id}
              onClick={() => setSelectedGenre(g.id)}
              data-testid={`button-genre-${g.id}`}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                selectedGenre === g.id
                  ? "bg-primary text-primary-foreground border-primary shadow-neon"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground hover:border-border"
              }`}
            >
              <span className="text-sm leading-none">{g.emoji}</span>
              {g.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {loadingGenreResults ? (
          <div className="flex gap-2.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[130px] sm:w-[144px] aspect-[2/3] rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : genreResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No new anime to show — you've seen them all! 🎉
          </div>
        ) : (
          <Row>
            {genreResults.map((anime, i) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                isInList={allKnownIds.has(anime.id)}
                onAdd={() => handleAdd(anime)}
                adding={addingId === anime.id}
                rank={i + 1}
              />
            ))}
          </Row>
        )}
      </section>

      {/* ── Personalized Row (user's top genre) ── */}
      {(genreInfo || loadingGenre) && (
        <SectionRow
          icon={<span className="text-sm">{genreInfo?.emoji ?? "🎯"}</span>}
          title={userTopGenre ? `More ${userTopGenre} for You` : "Your Taste"}
          subtitle="Trending in your most-watched genre — nothing you've seen"
          badge="PERSONAL"
          loading={loadingGenre}
        >
          <Row>
            {genreAnime.map((anime, i) => (
              <AnimeCard
                key={anime.id}
                anime={anime}
                isInList={allKnownIds.has(anime.id)}
                onAdd={() => handleAdd(anime)}
                adding={addingId === anime.id}
                rank={i + 1}
              />
            ))}
          </Row>
        </SectionRow>
      )}

      {/* ── Recommendations ── */}
      {(hasRatedAnime || loadingRecs) && (
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-foreground">Handpicked for You</span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Based on your highest-rated anime</p>
          {loadingRecs ? (
            <div className="flex gap-2.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[130px] sm:w-[144px] aspect-[2/3] rounded-lg bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {recommendations.map(({ sourceTitle, items }) => (
                <div key={sourceTitle}>
                  <p className="text-[11px] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-primary/70" />
                    Because you loved <span className="font-semibold text-foreground">{sourceTitle}</span>
                  </p>
                  <Row>
                    {items.map(anime => (
                      <AnimeCard
                        key={anime.id}
                        anime={anime}
                        isInList={allKnownIds.has(anime.id)}
                        onAdd={() => handleAdd(anime)}
                        adding={addingId === anime.id}
                      />
                    ))}
                  </Row>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Trending Now ── */}
      <SectionRow
        icon={<Flame className="w-4 h-4 text-orange-400" />}
        title="Trending Now"
        subtitle="What everyone is watching right now"
        badge="LIVE"
        loading={loadingTrending}
      >
        <Row>
          {trending.map((anime, i) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              isInList={allKnownIds.has(anime.id)}
              onAdd={() => handleAdd(anime)}
              adding={addingId === anime.id}
              rank={i + 1}
            />
          ))}
        </Row>
      </SectionRow>

      {/* ── Season Picks ── */}
      <SectionRow
        icon={<CalendarDays className="w-4 h-4 text-sky-400" />}
        title={`${seasonLabel} Picks`}
        subtitle="Most popular shows airing this season"
        loading={loadingSeasonPicks}
      >
        <Row>
          {seasonPicks.map(anime => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              isInList={allKnownIds.has(anime.id)}
              onAdd={() => handleAdd(anime)}
              adding={addingId === anime.id}
            />
          ))}
        </Row>
      </SectionRow>

    </div>
  );
}
