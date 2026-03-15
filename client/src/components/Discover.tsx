import { useState, useEffect, useRef, useMemo } from "react";
import {
  fetchAniList,
  GET_TRENDING_QUERY,
  GET_RECOMMENDATIONS_QUERY,
  GET_ANALYTICS_QUERY,
  GET_GENRE_TRENDING_QUERY,
  GET_ISEKAI_TRENDING_QUERY,
  GET_POPULAR_SEASON_QUERY,
} from "@/services/anilist";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, Plus, Star, Flame, Tv, Zap,
  ChevronLeft, ChevronRight, Check, Play,
  Clock, Sparkles, Brain, CalendarDays,
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

// Maps AniList genre → display info
const GENRE_META: Record<string, { emoji: string; label: string }> = {
  Action:       { emoji: "⚔️",  label: "Action" },
  Adventure:    { emoji: "🗺️",  label: "Adventure" },
  Comedy:       { emoji: "😂",  label: "Comedy" },
  Drama:        { emoji: "🎭",  label: "Drama" },
  Fantasy:      { emoji: "🧙",  label: "Fantasy" },
  Horror:       { emoji: "👻",  label: "Horror" },
  Mystery:      { emoji: "🔍",  label: "Mystery" },
  Psychological:{ emoji: "🧠",  label: "Psychological" },
  Romance:      { emoji: "💕",  label: "Romance" },
  "Sci-Fi":     { emoji: "🚀",  label: "Sci-Fi" },
  "Slice of Life":{ emoji: "🌸", label: "Slice of Life" },
  Sports:       { emoji: "🏆",  label: "Sports" },
  Supernatural: { emoji: "👁️",  label: "Supernatural" },
  Thriller:     { emoji: "😱",  label: "Thriller" },
  Ecchi:        { emoji: "🔞",  label: "Ecchi" },
  Mecha:        { emoji: "🤖",  label: "Mecha" },
  Music:        { emoji: "🎵",  label: "Music" },
  Hentai:       { emoji: "🔞",  label: "Hentai" },
};

const VIBES = [
  { id: "action",    emoji: "⚔️",  label: "Action",       genre: "Action",       tag: null },
  { id: "comedy",    emoji: "😂",  label: "Comedy",       genre: "Comedy",       tag: null },
  { id: "romance",   emoji: "💕",  label: "Romance",      genre: "Romance",      tag: null },
  { id: "thriller",  emoji: "😰",  label: "Thriller",     genre: "Thriller",     tag: null },
  { id: "isekai",    emoji: "🌀",  label: "Isekai",       genre: "Fantasy",      tag: "Isekai" },
  { id: "scifi",     emoji: "🚀",  label: "Sci-Fi",       genre: "Sci-Fi",       tag: null },
  { id: "horror",    emoji: "👻",  label: "Horror",       genre: "Horror",       tag: null },
  { id: "sports",    emoji: "🏆",  label: "Sports",       genre: "Sports",       tag: null },
  { id: "slicelife", emoji: "🌸",  label: "Slice of Life", genre: "Slice of Life", tag: null },
  { id: "mystery",   emoji: "🔍",  label: "Mystery",      genre: "Mystery",      tag: null },
  { id: "mecha",     emoji: "🤖",  label: "Mecha",        genre: "Mecha",        tag: null },
  { id: "fantasy",   emoji: "🧙",  label: "Fantasy",      genre: "Fantasy",      tag: null },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  RELEASING:       { label: "Airing",    color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  FINISHED:        { label: "Finished",  color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  NOT_YET_RELEASED:{ label: "Upcoming",  color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

function getCurrentSeason(): { season: string; seasonYear: number } {
  const month = new Date().getMonth() + 1;
  const year = new Date().getFullYear();
  if (month >= 4 && month <= 6)  return { season: "SPRING", seasonYear: year };
  if (month >= 7 && month <= 9)  return { season: "SUMMER", seasonYear: year };
  if (month >= 10 && month <= 12) return { season: "FALL",  seasonYear: year };
  return { season: "WINTER", seasonYear: year };
}

// ── Sub-components ──────────────────────────────────────────────────────────

function AnimeCard({ anime, isInList, onAdd, adding, rank }: {
  anime: any; isInList: boolean; onAdd: () => void; adding: boolean; rank?: number;
}) {
  const title = anime.title?.english || anime.title?.romaji;
  const score = anime.averageScore ? (anime.averageScore / 10).toFixed(1) : null;
  const st = STATUS_MAP[anime.status] || null;

  return (
    <div className="group relative flex-shrink-0 w-[130px] sm:w-[148px]" data-testid={`card-anime-${anime.id}`}>
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted/30">
        {anime.coverImage?.large || anime.coverImage?.extraLarge ? (
          <img
            src={anime.coverImage.extraLarge || anime.coverImage.large}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
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

        {/* Hover overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-black/30">
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
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 400, behavior: "smooth" });
  return (
    <div className="relative group/row">
      <button
        onClick={() => scroll(-1)}
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-all shadow-md"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <div
        ref={ref}
        className="flex gap-2.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {children}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-muted transition-all shadow-md"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle, badge }: {
  icon: React.ReactNode; title: string; subtitle?: string; badge?: string;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          {icon}
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          {badge && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="flex gap-2.5">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-[130px] sm:w-[148px] aspect-[2/3] rounded-lg bg-muted/40 animate-pulse" />
      ))}
    </div>
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
  const desc = a.description?.replace(/<[^>]*>/g, "").slice(0, 180);
  const ep = a.nextAiringEpisode?.episode;
  const bg = a.bannerImage || a.coverImage?.extraLarge || a.coverImage?.large;
  const inList = allKnownIds.has(a.id);
  const adding = addingId === a.id;
  const dots = Math.min(animes.length, 5);

  const go = (i: number) => { setIdx(i); reset(); };

  return (
    <div className="relative rounded-xl overflow-hidden border border-border/30" style={{ height: 280 }}>
      {bg && <img key={a.id} src={bg} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

      <div className="relative z-10 flex items-center gap-4 h-full px-5 sm:px-8">
        <img
          key={a.id + "c"}
          src={a.coverImage?.extraLarge || a.coverImage?.large}
          alt={title}
          className="hidden sm:block w-24 h-36 object-cover rounded-lg shadow-2xl flex-shrink-0"
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
          <div className="flex flex-wrap gap-1 mb-2.5">
            {a.genres?.slice(0, 4).map((g: string) => (
              <span key={g} className="text-[9px] text-white/60 bg-white/10 rounded-full px-1.5 py-0.5 border border-white/10">{g}</span>
            ))}
          </div>
          {desc && <p className="text-xs text-white/50 hidden sm:block line-clamp-2 max-w-md mb-3 leading-relaxed">{desc}</p>}
          <div className="flex items-center gap-2">
            {inList ? (
              <Button size="sm" disabled variant="outline" className="text-xs gap-1.5 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 h-7 px-3 rounded-full">
                <Check className="w-3 h-3" /> In Your List
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => onAdd(a)}
                disabled={adding}
                data-testid={`button-hero-add-${a.id}`}
                className="text-xs gap-1.5 h-7 px-3 rounded-full gradient-primary shadow-neon font-semibold"
              >
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

      {/* Dots */}
      <div className="absolute bottom-3 right-4 flex gap-1 z-20">
        {Array.from({ length: dots }).map((_, i) => (
          <button
            key={i}
            onClick={() => go(i)}
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

  // Personalized genre state
  const [userTopGenre, setUserTopGenre] = useState<string | null>(null);
  const [genreAnime, setGenreAnime] = useState<any[]>([]);
  const [loadingGenre, setLoadingGenre] = useState(false);

  // Vibe explorer
  const [activeVibe, setActiveVibe] = useState<string | null>(null);
  const [vibeResults, setVibeResults] = useState<any[]>([]);
  const [loadingVibe, setLoadingVibe] = useState(false);

  const [addingId, setAddingId] = useState<number | null>(null);

  const allKnownIds = useMemo(
    () => new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]),
    [animeList]
  );

  // Load trending + season on mount
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
      finally {
        setLoadingTrending(false);
        setLoadingSeasonPicks(false);
      }
    }
    load();
  }, []);

  // Recommendations from top-rated anime
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

  // Detect user's top genre from their list, then fetch more of that genre
  useEffect(() => {
    const ids = animeList
      .filter(a => a.anilistId && (a.status === "completed" || a.status === "watching"))
      .map(a => a.anilistId as number)
      .slice(0, 30);
    if (ids.length < 3) return;

    async function detectAndFetch() {
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

        // Fetch anime in that genre
        const query = top === "Fantasy"
          ? await fetchAniList(GET_ISEKAI_TRENDING_QUERY, {})
          : await fetchAniList(GET_GENRE_TRENDING_QUERY, { genre: top });
        const items = (query?.Page?.media || []).filter((m: any) => !allKnownIds.has(m.id));
        setGenreAnime(items);
      } catch { }
      finally { setLoadingGenre(false); }
    }
    detectAndFetch();
  }, [animeList.length]);

  // Vibe explore
  useEffect(() => {
    if (!activeVibe) { setVibeResults([]); return; }
    const vibe = VIBES.find(v => v.id === activeVibe);
    if (!vibe) return;
    setLoadingVibe(true);
    setVibeResults([]);
    async function load() {
      try {
        const data = vibe!.tag === "Isekai"
          ? await fetchAniList(GET_ISEKAI_TRENDING_QUERY, {}, false)
          : await fetchAniList(GET_GENRE_TRENDING_QUERY, { genre: vibe!.genre }, false);
        setVibeResults(data?.Page?.media || []);
      } catch { }
      finally { setLoadingVibe(false); }
    }
    load();
  }, [activeVibe]);

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
  const genreInfo = userTopGenre ? (GENRE_META[userTopGenre] || { emoji: "🎯", label: userTopGenre }) : null;
  const hasRatedAnime = animeList.some(a => a.status === "completed" && a.rating);

  return (
    <div className="space-y-8 pb-8">

      {/* ── Hero ── */}
      {loadingTrending ? (
        <div className="h-[280px] rounded-xl bg-muted/30 animate-pulse" />
      ) : (
        <Hero
          animes={trending.slice(0, 5)}
          allKnownIds={allKnownIds}
          onAdd={handleAdd}
          addingId={addingId}
        />
      )}

      {/* ── Personalized Genre Row ── */}
      {(genreInfo || loadingGenre) && (
        <section>
          <SectionHeader
            icon={<span className="text-base">{genreInfo?.emoji ?? "🎯"}</span>}
            title={genreInfo ? `More ${genreInfo.label} for You` : "Your Taste"}
            subtitle={genreInfo ? `Trending picks in your favourite genre` : undefined}
            badge="PERSONAL"
          />
          {loadingGenre ? (
            <SkeletonRow />
          ) : (
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
          )}
        </section>
      )}

      {/* ── Recommendations ── */}
      {(hasRatedAnime || loadingRecs) && (
        <section>
          <SectionHeader
            icon={<Brain className="w-4 h-4 text-primary" />}
            title="Handpicked for You"
            subtitle="Based on your highest-rated anime"
          />
          {loadingRecs ? (
            <SkeletonRow />
          ) : recommendations.length === 0 ? null : (
            <div className="space-y-6">
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
      <section>
        <SectionHeader
          icon={<Flame className="w-4 h-4 text-orange-400" />}
          title="Trending Now"
          subtitle="What the entire community is watching"
          badge="LIVE"
        />
        {loadingTrending ? (
          <SkeletonRow />
        ) : (
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
        )}
      </section>

      {/* ── Season Picks ── */}
      <section>
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4 text-sky-400" />}
          title={`${seasonLabel} Picks`}
          subtitle="Most popular shows airing right now"
        />
        {loadingSeasonPicks ? (
          <SkeletonRow />
        ) : (
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
        )}
      </section>

      {/* ── Explore by Vibe ── */}
      <section>
        <SectionHeader
          icon={<Zap className="w-4 h-4 text-yellow-400" />}
          title="Explore by Vibe"
          subtitle="Pick a genre and discover new anime instantly"
        />

        <div className="flex flex-wrap gap-2 mb-5">
          {VIBES.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveVibe(activeVibe === v.id ? null : v.id)}
              data-testid={`button-vibe-${v.id}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                activeVibe === v.id
                  ? "bg-primary text-primary-foreground border-primary shadow-neon"
                  : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{v.emoji}</span> {v.label}
              {activeVibe === v.id && <Check className="w-3 h-3 ml-0.5" />}
            </button>
          ))}
        </div>

        {activeVibe && (
          <>
            {loadingVibe ? (
              <SkeletonRow />
            ) : (
              <Row>
                {vibeResults.map((anime, i) => (
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
          </>
        )}
      </section>

    </div>
  );
}
