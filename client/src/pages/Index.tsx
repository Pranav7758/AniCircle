import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getAnimeList, createAnime, updateAnime, deleteAnime, logActivity } from "@/services/supabaseData";
import { fetchAniList, GET_ANALYTICS_QUERY } from "@/services/anilist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Plus, Search, Sparkles, Trophy, Users, Settings, PieChart, Play, CheckCircle2, Clock, ArrowUpDown, Tag, Compass, Share2, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AnimeRanking from "@/components/AnimeRanking";
import Friends from "@/components/Friends";
import { toast } from "sonner";
import AnimeGroupCard from "@/components/AnimeGroupCard";
import AddAnimeDialog, { AnimeFormData } from "@/components/AddAnimeDialog";
import Notifications from "@/components/Notifications";
import NewEpisodesBanner from "@/components/NewEpisodesBanner";
import Radar from "@/components/Radar";
import AnalyticsDashboard from "@/components/AnalyticsDashboard";
import Discover from "@/components/Discover";
import Watch from "@/components/Watch";

interface Anime {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  notes: string | null;
  coverImage: string | null;
  seasonNumber: number;
  anilistId: number | null;
  malId: number | null;
  ranking: number | null;
  isHentai: boolean | null;
}

const SkeletonCard = () => (
  <div className="flex flex-col rounded-2xl overflow-hidden border border-border/40 bg-card">
    <div className="aspect-[3/4] animate-shimmer" />
    <div className="p-2.5 space-y-2">
      <div className="h-3 rounded-full animate-shimmer w-3/4" />
      <div className="h-2 rounded-full animate-shimmer w-1/2" />
    </div>
  </div>
);

const StatsBar = ({ animeList }: { animeList: Anime[] }) => {
  const watching = animeList.filter(a => a.status === "watching").length;
  const completed = animeList.filter(a => a.status === "completed").length;
  const totalEps = animeList.reduce((sum, a) => sum + a.episodesWatched, 0);
  const uniqueTitles = new Set(animeList.map(a => a.title)).size;

  const stats = [
    { icon: Play, label: "Watching", value: watching, color: "text-primary" },
    { icon: CheckCircle2, label: "Completed", value: completed, color: "text-emerald-400" },
    { icon: Trophy, label: "Total Shows", value: uniqueTitles, color: "text-amber-400" },
    { icon: Clock, label: "Episodes", value: totalEps.toLocaleString(), color: "text-blue-400" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {stats.map(({ icon: Icon, label, value, color }, i) => (
        <div
          key={label}
          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-muted/30 border border-border/40 holo-glass animate-stagger-in"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <Icon className={`w-4 h-4 shrink-0 ${color}`} />
          <div className="min-w-0">
            <p className={`text-base font-black leading-none ${color} animate-stagger-in`} style={{ animationDelay: `${i * 80 + 100}ms` }}>{value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const Index = () => {
  const [, setLocation] = useLocation();
  const { user, logout, updateUsername } = useAuth();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [filteredAnimeList, setFilteredAnimeList] = useState<Anime[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hentaiFilter, setHentaiFilter] = useState<string>("hide");
  const [rankingFilter, setRankingFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>(() => localStorage.getItem("animeSortBy") || "default");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [genreMap, setGenreMap] = useState<Map<number, string[]>>(new Map());
  const genreFetchRef = useRef<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [prefilledSearchQuery, setPrefilledSearchQuery] = useState("");
  const [editingAnime, setEditingAnime] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("list");
  const [gridSize, setGridSize] = useState<string>(() => {
    const saved = localStorage.getItem("animeGridSize");
    return saved || "medium";
  });

  useEffect(() => {
    if (user) {
      fetchAnimeList();
    } else {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && activeTab === "list") {
      fetchAnimeList();
    }
  }, [user, activeTab]);

  useEffect(() => {
    filterAnimeList();
  }, [searchQuery, statusFilter, hentaiFilter, rankingFilter, genreFilter, animeList, genreMap]);

  // Fetch genres from AniList for all anime that have anilistIds
  useEffect(() => {
    const anilistIds = animeList.map(a => a.anilistId).filter(Boolean) as number[];
    if (anilistIds.length === 0) return;
    const key = anilistIds.sort().join(",");
    if (genreFetchRef.current === key) return;
    genreFetchRef.current = key;

    async function fetchGenres() {
      const newMap = new Map<number, string[]>();
      for (let i = 0; i < anilistIds.length; i += 50) {
        try {
          const data = await fetchAniList(GET_ANALYTICS_QUERY, { ids: anilistIds.slice(i, i + 50) });
          const ALLOWED_TAG_CATEGORIES = new Set(["Theme", "Setting", "Demographic"]);
          for (const media of data?.Page?.media || []) {
            const genres: string[] = [...(media.genres || [])];
            // Only add well-known theme/setting/demographic tags ranked 75+
            if (media.tags) {
              for (const tag of media.tags) {
                if (
                  !tag.isMediaSpoiler &&
                  tag.rank >= 75 &&
                  ALLOWED_TAG_CATEGORIES.has(tag.category)
                ) {
                  genres.push(tag.name);
                }
              }
            }
            if (genres.length) newMap.set(media.id, genres);
          }
        } catch { /* silent — genres are a nice-to-have */ }
      }
      setGenreMap(newMap);
    }
    fetchGenres();
  }, [animeList]);

  const fetchAnimeList = async () => {
    if (!user) return;
    try {
      const data = await getAnimeList();
      setAnimeList(data || []);
    } catch (error) {
      console.error("Error fetching anime:", error);
      toast.error("Failed to load anime list");
    } finally {
      setIsLoading(false);
    }
  };

  const filterAnimeList = () => {
    let filtered = animeList;

    if (searchQuery) {
      filtered = filtered.filter((anime) =>
        anime.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((anime) => anime.status === statusFilter);
    }

    if (hentaiFilter === "hide") {
      filtered = filtered.filter((anime) => !anime.isHentai);
    } else if (hentaiFilter === "only") {
      filtered = filtered.filter((anime) => anime.isHentai === true);
    }

    if (rankingFilter === "ranked") {
      filtered = filtered.filter((anime) => anime.ranking !== null);
    } else if (rankingFilter === "unranked") {
      filtered = filtered.filter((anime) => anime.ranking === null);
    }

    if (genreFilter !== "all") {
      filtered = filtered.filter((anime) => {
        if (!anime.anilistId) return false;
        const genres = genreMap.get(anime.anilistId) || [];
        return genres.includes(genreFilter);
      });
    }

    setFilteredAnimeList(filtered);
  };

  const allGenres = useMemo(() => {
    const genreSet = new Set<string>();
    for (const anime of animeList) {
      if (!anime.anilistId) continue;
      const genres = genreMap.get(anime.anilistId) || [];
      for (const g of genres) genreSet.add(g);
    }
    return [...genreSet].sort();
  }, [animeList, genreMap]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of animeList) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  }, [animeList]);

  const groupedAnime = useMemo(() => {
    const groups = (filteredAnimeList || []).reduce((acc, anime) => {
      const title = anime.title;
      if (!acc[title]) acc[title] = [];
      acc[title].push(anime);
      return acc;
    }, {} as Record<string, Anime[]>);

    const entries = Object.entries(groups);

    switch (sortBy) {
      case "title-asc":
        entries.sort(([a], [b]) => a.localeCompare(b));
        break;
      case "title-desc":
        entries.sort(([a], [b]) => b.localeCompare(a));
        break;
      case "rating-desc": {
        entries.sort(([, seasonsA], [, seasonsB]) => {
          const avgA = seasonsA.filter(s => s.rating).length
            ? seasonsA.reduce((sum, s) => sum + (s.rating || 0), 0) / seasonsA.filter(s => s.rating).length
            : 0;
          const avgB = seasonsB.filter(s => s.rating).length
            ? seasonsB.reduce((sum, s) => sum + (s.rating || 0), 0) / seasonsB.filter(s => s.rating).length
            : 0;
          return avgB - avgA;
        });
        break;
      }
      case "progress-desc": {
        entries.sort(([, seasonsA], [, seasonsB]) => {
          const progressA = seasonsA.reduce((sum, s) => sum + s.episodesWatched, 0);
          const progressB = seasonsB.reduce((sum, s) => sum + s.episodesWatched, 0);
          return progressB - progressA;
        });
        break;
      }
      default:
        break;
    }

    return Object.fromEntries(entries);
  }, [filteredAnimeList, sortBy]);

  const handleAddAnime = async (data: AnimeFormData) => {
    if (data.seasons && data.seasons.length > 0) {
      const selectedSeasons = data.seasons.filter(s => s.selected);

      if (selectedSeasons.length === 0) {
        toast.error("Please select at least one season to add");
        return;
      }

      const seasonsToAdd = selectedSeasons.map((season) => ({
        title: data.title,
        episodesWatched: season.episodesWatched || 0,
        totalEpisodes: season.episodes,
        status: data.status,
        rating: data.rating,
        notes: data.notes,
        coverImage: data.coverImage || null,
        seasonNumber: season.seasonNumber,
        anilistId: season.anilist_id || null,
        malId: season.mal_id || null,
        isHentai: data.isHentai || false,
      }));

      try {
        await createAnime(seasonsToAdd);
        toast.success(`${selectedSeasons.length} season${selectedSeasons.length !== 1 ? 's' : ''} added successfully!`);
        logActivity("added", data.title, data.coverImage || null, seasonsToAdd[0]?.seasonNumber);
        fetchAnimeList();
      } catch (error: any) {
        console.error("Error adding anime:", error);
        toast.error(`Failed to add anime: ${error.message || "Unknown error"}`);
        throw error;
      }
      return;
    }

    const numberOfSeasons = data.numberOfSeasons || 1;
    const seasonsToAdd2 = Array.from({ length: numberOfSeasons }, (_, i) => ({
      title: data.title,
      episodesWatched: data.episodesWatched,
      totalEpisodes: data.totalEpisodes,
      status: data.status,
      rating: data.rating,
      notes: data.notes,
      coverImage: data.coverImage || null,
      seasonNumber: i + 1,
      anilistId: data.anilistId || null,
      malId: data.malId || null,
      isHentai: data.isHentai || false,
    }));

    try {
      await createAnime(seasonsToAdd2);
      toast.success(`${numberOfSeasons} season${numberOfSeasons !== 1 ? 's' : ''} added successfully!`);
      logActivity("added", data.title, data.coverImage || null, 1);
      fetchAnimeList();
    } catch (error: any) {
      toast.error("Failed to add anime");
      throw error;
    }
  };

  const handleEditAnime = async (data: AnimeFormData) => {
    if (!editingAnime) return;

    try {
      await updateAnime(editingAnime.id, {
        title: data.title,
        episodesWatched: data.episodesWatched,
        totalEpisodes: data.totalEpisodes,
        status: data.status,
        rating: data.rating,
        notes: data.notes,
        coverImage: data.coverImage || null,
        seasonNumber: data.seasonNumber,
      });

      const prevStatus = editingAnime.status;
      if (data.status === "completed" && prevStatus !== "completed") {
        logActivity("completed", data.title, data.coverImage || null, data.seasonNumber, data.rating || null);
      } else if (data.rating && data.rating !== editingAnime.rating) {
        logActivity("rated", data.title, data.coverImage || null, data.seasonNumber, data.rating);
      }

      toast.success("Anime updated successfully!");
      setEditingAnime(null);
      fetchAnimeList();
    } catch (error: any) {
      toast.error("Failed to update anime");
      throw error;
    }
  };

  const handleDeleteAnime = async (id: string) => {
    try {
      await deleteAnime(id);
      toast.success("Anime deleted successfully!");
      fetchAnimeList();
    } catch (error) {
      toast.error("Failed to delete anime");
    }
  };

  const handleQuickEpisodeUpdate = async (id: string, newEpisodes: number) => {
    try {
      await updateAnime(id, { episodesWatched: newEpisodes });
      setAnimeList(prev => prev.map(a => a.id === id ? { ...a, episodesWatched: newEpisodes } : a));
    } catch (error) {
      toast.error("Failed to update episode count");
    }
  };

  const handleSignOut = async () => {
    await logout();
    setLocation("/auth");
  };

  const openEditDialog = (id: string) => {
    const anime = animeList.find((a) => a.id === id);
    if (!anime) return;

    setEditingAnime({
      ...anime,
      title: anime.title,
      episodesWatched: anime.episodesWatched,
      totalEpisodes: anime.totalEpisodes,
      status: anime.status,
      rating: anime.rating,
      notes: anime.notes || "",
      coverImage: anime.coverImage || "",
      seasonNumber: anime.seasonNumber,
      anilistId: anime.anilistId || undefined,
      malId: anime.malId || undefined,
    });
  };

  const gridClass = gridSize === "compact"
    ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"
    : gridSize === "small"
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
    : gridSize === "medium"
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
    : gridSize === "large"
    ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4"
    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3";

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-50 border-b border-border/40 glass bg-glow">
          <div className="header-accent-strip" />
          <div className="container mx-auto px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/25 blur-md animate-glow-pulse" />
                <img src="/logo.png" alt="AniCircle" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-neon" />
              </div>
              <h2 className="text-lg sm:text-xl font-black text-gradient">AniCircle</h2>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-4 pt-8 pb-8 flex-1">
          <div className="mb-6 h-10 w-80 rounded-xl animate-shimmer" />
          <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl animate-shimmer" />)}
          </div>
          <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
            {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 border-b border-border/40 glass bg-glow">
        <div className="header-accent-strip" />
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/25 blur-md animate-glow-pulse" />
                <img src="/logo.png" alt="AniCircle" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full shadow-neon" />
              </div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-lg sm:text-xl font-black text-gradient">AniCircle</h2>
                {user?.email && (
                  <span className="hidden md:inline text-[10px] text-muted-foreground/50 font-normal">
                    {user.email.split("@")[0]}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {user && <Notifications userId={user.id} />}
              {user?.shortId && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Share My Profile"
                  className="h-8 w-8 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl"
                  onClick={() => {
                    const url = `${window.location.origin}/u/${(user.shortId ?? "").toUpperCase()}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Profile link copied to clipboard!");
                  }}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings"
                className="h-8 w-8 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl"
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden h-8 w-8 hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl"
                onClick={handleSignOut}
                data-testid="button-signout"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                className="hidden sm:flex h-8 px-3 text-sm hover:bg-muted/50 text-muted-foreground hover:text-foreground rounded-xl gap-1.5"
                onClick={handleSignOut}
                data-testid="button-signout"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 pb-8 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <TabsList className="h-10 bg-muted/40 border border-border/40 rounded-xl p-1 gap-0.5 overflow-x-auto flex-nowrap">
                <TabsTrigger value="list" data-testid="tab-list"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium">
                  My List
                </TabsTrigger>
                <TabsTrigger value="radar" data-testid="tab-radar"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Radar</span>
                </TabsTrigger>
                <TabsTrigger value="ranking" data-testid="tab-ranking"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rankings</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <PieChart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="friends" data-testid="tab-friends"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Friends</span>
                </TabsTrigger>
                <TabsTrigger value="discover" data-testid="tab-discover"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <Compass className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discover</span>
                </TabsTrigger>
                <TabsTrigger value="watch" data-testid="tab-watch"
                  className="rounded-lg text-xs sm:text-sm px-2.5 sm:px-4 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-neon font-medium gap-1">
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Watch</span>
                </TabsTrigger>
              </TabsList>

              {activeTab === "list" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={gridSize} onValueChange={(value) => {
                    setGridSize(value);
                    localStorage.setItem("animeGridSize", value);
                  }}>
                    <SelectTrigger className="h-9 w-36 sm:w-40 text-xs rounded-xl border-border/50 bg-muted/30" data-testid="select-grid-size">
                      <SelectValue placeholder="View size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact">Compact (7/row)</SelectItem>
                      <SelectItem value="small">Small (6/row)</SelectItem>
                      <SelectItem value="medium">Medium (5/row)</SelectItem>
                      <SelectItem value="large">Large (4/row)</SelectItem>
                      <SelectItem value="extra-large">Extra Large (3/row)</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => setIsAddDialogOpen(true)}
                    className="h-9 gradient-primary hover:opacity-90 transition-smooth shadow-neon rounded-xl text-sm font-semibold px-4"
                    data-testid="button-add-anime"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Anime
                  </Button>
                </div>
              )}
            </div>
          </div>

          <TabsContent value="list" className="space-y-4 animate-tab-in">
            {user && <NewEpisodesBanner userId={user.id} />}

            {animeList.length > 0 && <StatsBar animeList={animeList} />}

            <div className="mb-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Search your anime..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl border-border/50 bg-muted/30 text-sm focus:border-primary/40"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full md:w-48 rounded-xl border-border/50 bg-muted/30 text-sm" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status ({animeList.length})</SelectItem>
                    <SelectItem value="watching">Watching ({statusCounts.watching || 0})</SelectItem>
                    <SelectItem value="completed">Completed ({statusCounts.completed || 0})</SelectItem>
                    <SelectItem value="plan_to_watch">Plan to Watch ({statusCounts.plan_to_watch || 0})</SelectItem>
                    <SelectItem value="on_hold">On Hold ({statusCounts.on_hold || 0})</SelectItem>
                    <SelectItem value="dropped">Dropped ({statusCounts.dropped || 0})</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => { setSortBy(v); localStorage.setItem("animeSortBy", v); }}>
                  <SelectTrigger className="h-10 w-full md:w-44 rounded-xl border-border/50 bg-muted/30 text-sm" data-testid="select-sort">
                    <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/60" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Recently Added</SelectItem>
                    <SelectItem value="title-asc">Title A → Z</SelectItem>
                    <SelectItem value="title-desc">Title Z → A</SelectItem>
                    <SelectItem value="rating-desc">Highest Rated</SelectItem>
                    <SelectItem value="progress-desc">Most Watched</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={genreFilter} onValueChange={setGenreFilter}>
                  <SelectTrigger className="h-10 w-full md:w-44 rounded-xl border-border/50 bg-muted/30 text-sm" data-testid="select-genre">
                    <Tag className="w-3.5 h-3.5 mr-1.5 text-muted-foreground/60" />
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genres</SelectItem>
                    {allGenres.map(g => (
                      <SelectItem key={g} value={g}>{g}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredAnimeList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-5 animate-fade-in">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-4xl opacity-60">📺</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                </div>
                <div className="text-center space-y-2 max-w-xs">
                  <h2 className="text-xl font-bold text-foreground">
                    {searchQuery || statusFilter !== "all" || rankingFilter !== "all" ? "No results found" : "Your list is empty"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {searchQuery || statusFilter !== "all" || rankingFilter !== "all"
                      ? "Try adjusting your search or filters"
                      : "Start building your anime collection — add your first title!"}
                  </p>
                </div>
                {!searchQuery && statusFilter === "all" && rankingFilter === "all" && (
                  <Button onClick={() => setIsAddDialogOpen(true)}
                    className="gradient-primary shadow-neon rounded-xl text-sm font-semibold px-6">
                    <Plus className="w-4 h-4 mr-2" /> Add Your First Anime
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-1">
                  {Object.keys(groupedAnime).length} title{Object.keys(groupedAnime).length !== 1 ? "s" : ""}
                  {filteredAnimeList.length !== animeList.length ? ` (filtered from ${new Set(animeList.map(a => a.title)).size})` : ""}
                </p>
                <div className={`grid gap-3 sm:gap-4 ${gridClass}`}>
                  {Object.entries(groupedAnime).map(([title, seasons], cardIndex) => (
                    <div key={title} className="animate-stagger-in" style={{ animationDelay: `${Math.min(cardIndex * 40, 600)}ms` }}>
                    <AnimeGroupCard
                      title={title}
                      coverImage={seasons[0].coverImage}
                      seasons={seasons.map(s => ({
                        id: s.id,
                        seasonNumber: s.seasonNumber,
                        episodesWatched: s.episodesWatched,
                        totalEpisodes: s.totalEpisodes,
                        status: s.status,
                        rating: s.rating,
                        notes: s.notes || "",
                      }))}
                      onEdit={openEditDialog}
                      onDelete={handleDeleteAnime}
                      onAddSeason={(title) => {
                        setPrefilledSearchQuery(title);
                        setIsAddDialogOpen(true);
                      }}
                      onQuickEpisodeUpdate={handleQuickEpisodeUpdate}
                    />
                    </div>
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="radar" className="pt-2 animate-tab-in">
            {user && (
              <Radar
                userId={user.id}
                animeList={animeList}
                onAddAnime={handleAddAnime}
              />
            )}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4 animate-tab-in">
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-2xl font-black text-gradient">My Rankings</h2>
              </div>
              <p className="text-sm text-muted-foreground">Drag to reorder your all-time favourite anime.</p>
            </div>
            {user && <AnimeRanking userId={user.id} isOwnProfile={true} />}
          </TabsContent>

          <TabsContent value="friends" className="space-y-4 animate-tab-in">
            {user && <Friends currentUserId={user.id} />}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 pt-4 animate-tab-in">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="discover" className="pt-4">
            <Discover animeList={animeList} onAddAnime={handleAddAnime} showMature={hentaiFilter !== "hide"} />
          </TabsContent>

          <TabsContent value="watch" className="pt-4 animate-tab-in">
            <Watch animeList={animeList} />
          </TabsContent>
        </Tabs>
      </main>

      <AddAnimeDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setPrefilledSearchQuery("");
        }}
        onSubmit={handleAddAnime}
        initialSearchQuery={prefilledSearchQuery}
      />

      {editingAnime && (
        <AddAnimeDialog
          open={!!editingAnime}
          onOpenChange={(open) => !open && setEditingAnime(null)}
          onSubmit={handleEditAnime}
          initialData={editingAnime}
          isEditing
        />
      )}

      <Dialog open={isSettingsOpen} onOpenChange={(open) => { setIsSettingsOpen(open); if (open) setNewUsername(user?.username || ""); }}>
        <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50 shadow-neon">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Settings & Preferences
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4 animate-fade-in">
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Profile</h4>
              <div className="p-4 rounded-xl border border-border/50 bg-background/50 holo-glass space-y-3">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-foreground block">Username</span>
                  <span className="text-xs text-muted-foreground block leading-relaxed">Your name visible to friends in activity feeds and friend lists</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder={user?.username || "Enter username"}
                    maxLength={30}
                    className="flex-1 h-9 text-sm"
                    data-testid="input-new-username"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        (async () => {
                          const trimmed = newUsername.trim();
                          if (!trimmed || trimmed === user?.username) return;
                          if (trimmed.length < 2) { toast.error("Username must be at least 2 characters"); return; }
                          setIsSavingUsername(true);
                          try {
                            await updateUsername(trimmed);
                            toast.success("Username updated!");
                          } catch (err: any) {
                            toast.error(err.message || "Failed to update username");
                          } finally {
                            setIsSavingUsername(false);
                          }
                        })();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={isSavingUsername || !newUsername.trim() || newUsername.trim() === user?.username}
                    onClick={async () => {
                      const trimmed = newUsername.trim();
                      if (trimmed.length < 2) { toast.error("Username must be at least 2 characters"); return; }
                      setIsSavingUsername(true);
                      try {
                        await updateUsername(trimmed);
                        toast.success("Username updated!");
                      } catch (err: any) {
                        toast.error(err.message || "Failed to update username");
                      } finally {
                        setIsSavingUsername(false);
                      }
                    }}
                    data-testid="button-save-username"
                    className="shrink-0"
                  >
                    {isSavingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Content Filters</h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-background/50 holo-glass">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-foreground block">Mature Content</span>
                  <span className="text-xs text-muted-foreground block leading-relaxed">Toggle visibility of adult/18+ anime in your dashboard lists</span>
                </div>
                <Select value={hentaiFilter} onValueChange={setHentaiFilter}>
                  <SelectTrigger className="w-[140px] shrink-0" data-testid="select-hentai-filter">
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hide">Hide (Default)</SelectItem>
                    <SelectItem value="show">Show All</SelectItem>
                    <SelectItem value="only">Only Mature</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Display</h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-background/50 holo-glass">
                <div className="space-y-1">
                  <span className="text-sm font-semibold text-foreground block">Card Grid Size</span>
                  <span className="text-xs text-muted-foreground block leading-relaxed">Customize how dense your anime library list appears</span>
                </div>
                <Select value={gridSize} onValueChange={(value) => {
                  setGridSize(value);
                  localStorage.setItem("animeGridSize", value);
                }}>
                  <SelectTrigger className="w-[140px] shrink-0" data-testid="select-grid-size-settings">
                    <SelectValue placeholder="View size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                    <SelectItem value="extra-large">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
