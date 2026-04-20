import { useState, useEffect, useMemo, useRef, startTransition } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getAnimeList, createAnime, updateAnime, deleteAnime, logActivity, upsertUserPresence, getFriends, getFriendsUserPresence, type AnimeData } from "@/services/supabaseData";
import { fetchAniList, GET_ANALYTICS_QUERY } from "@/services/anilist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Plus, Search, Sparkles, Trophy, Users, Settings, PieChart, Play, CheckCircle2, Clock, ArrowUpDown, Tag, Share2, Loader2, Inbox, Compass } from "lucide-react";
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
import Footer from "@/components/Footer";
import SuggestionPopup from "@/components/SuggestionPopup";
import FloatingSocialBar from "@/components/FloatingSocialBar";
import ThemePicker from "@/components/ThemePicker";
import { useTheme } from "@/hooks/use-theme";
import remSadImg from "@assets/re-zero-sad-kawaii-rem-sticker_1776671137105.webp";

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
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface RemCustomization {
  showGif: boolean;
  showEyes: boolean;
  showCharacter: boolean;
  showSnow: boolean;
  draggable: boolean;
  sizeMode: "small" | "normal";
}

const REM_CUSTOMIZE_KEY = "anicircle-rem-customization";
const DEFAULT_REM_CUSTOMIZATION: RemCustomization = {
  showGif: true,
  showEyes: true,
  showCharacter: true,
  showSnow: true,
  draggable: true,
  sizeMode: "normal",
};

function readRemCustomization(): RemCustomization {
  try {
    const raw = localStorage.getItem(REM_CUSTOMIZE_KEY);
    if (!raw) return DEFAULT_REM_CUSTOMIZATION;
    const parsed = JSON.parse(raw) as Partial<RemCustomization>;
    return {
      showGif: parsed.showGif ?? true,
      showEyes: parsed.showEyes ?? true,
      showCharacter: parsed.showCharacter ?? true,
      showSnow: parsed.showSnow ?? true,
      draggable: parsed.draggable ?? true,
      sizeMode: parsed.sizeMode === "small" ? "small" : "normal",
    };
  } catch {
    return DEFAULT_REM_CUSTOMIZATION;
  }
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
    {
      icon: Play, label: "Watching", value: watching,
      color: "text-violet-400", iconBg: "bg-violet-500/15 border-violet-500/30",
      glow: "shadow-[0_0_18px_hsl(268_88%_62%/0.18)]", glowStyle: {},
    },
    {
      icon: CheckCircle2, label: "Completed", value: completed,
      color: "text-emerald-400", iconBg: "bg-emerald-500/15 border-emerald-500/30",
      glow: "shadow-[0_0_18px_hsl(142_70%_50%/0.15)]", glowStyle: {},
    },
    {
      icon: Trophy, label: "Total Shows", value: uniqueTitles,
      color: "text-amber-400", iconBg: "bg-amber-500/15 border-amber-500/30",
      glow: "shadow-[0_0_18px_hsl(45_90%_56%/0.15)]", glowStyle: {},
    },
    {
      icon: Clock, label: "Episodes", value: totalEps.toLocaleString(),
      color: "text-primary", iconBg: "bg-primary/15 border-primary/30",
      glow: "", glowStyle: { boxShadow: "0 0 18px hsl(var(--primary) / 0.15)" },
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
      {stats.map(({ icon: Icon, label, value, color, iconBg, glow, glowStyle }, i) => (
        <div
          key={label}
          className={`flex items-center gap-3 px-3.5 py-3 rounded-none border border-border/30 bg-card/60 backdrop-blur-sm animate-stagger-in ${glow} transition-all duration-200 hover:-translate-y-0.5`}
          style={{ animationDelay: `${i * 80}ms`, ...glowStyle }}
        >
          <div className={`shrink-0 w-9 h-9 rounded-none border flex items-center justify-center ${iconBg}`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div className="min-w-0">
            <p className={`text-xl font-black leading-none tabular-nums ${color}`}>{value}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

const Index = () => {
  const [, setLocation] = useLocation();
  const { user, logout, updateUsername } = useAuth();
  const { theme } = useTheme();
  const isRemTheme = theme.name === "Rem";
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
  const [remCustomize, setRemCustomize] = useState<RemCustomization>(() => readRemCustomization());
  const [newUsername, setNewUsername] = useState("");
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [prefilledSearchQuery, setPrefilledSearchQuery] = useState("");
  const [editingAnime, setEditingAnime] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("watch");
  const [mountedTab, setMountedTab] = useState("watch");
  const [onlineFriendsCount, setOnlineFriendsCount] = useState(0);
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
    if (mountedTab === activeTab) return;
    const raf = requestAnimationFrame(() => {
      // Defer heavy panel mount to keep tab click INP low.
      setMountedTab(activeTab);
    });
    return () => cancelAnimationFrame(raf);
  }, [activeTab, mountedTab]);

  useEffect(() => {
    if (!user) {
      setOnlineFriendsCount(0);
      return;
    }

    let cancelled = false;
    const refreshOnlineCount = async () => {
      try {
        const friends = await getFriends();
        const friendUserIds = friends.map((f) =>
          f.userId === user.id ? f.friendId : f.userId
        );
        if (friendUserIds.length === 0) {
          if (!cancelled) setOnlineFriendsCount(0);
          return;
        }
        const onlineRows = await getFriendsUserPresence(friendUserIds);
        const now = Date.now();
        const count = onlineRows.filter((row) => {
          const ts = new Date(row.updatedAt).getTime();
          return now - ts < 2 * 60 * 1000;
        }).length;
        if (!cancelled) setOnlineFriendsCount(count);
      } catch {
        if (!cancelled) setOnlineFriendsCount(0);
      }
    };

    refreshOnlineCount();
    const iv = setInterval(refreshOnlineCount, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [user?.id]);

  // Lightweight online heartbeat for friends list "online" indicator.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const pulse = async () => {
      if (cancelled) return;
      try {
        await upsertUserPresence();
      } catch {
        // Ignore presence errors; core app should continue working.
      }
    };

    pulse();
    const iv = setInterval(pulse, 45000);
    const onFocus = () => { pulse(); };
    const onVisibility = () => {
      if (document.visibilityState === "visible") pulse();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id]);

  useEffect(() => {
    if (activeTab !== "list") return;
    filterAnimeList();
  }, [activeTab, searchQuery, statusFilter, hentaiFilter, rankingFilter, genreFilter, animeList, genreMap]);

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
    if (activeTab !== "list") return {};
    const groups = (filteredAnimeList || []).reduce((acc, anime) => {
      const title = anime.title;
      if (!acc[title]) acc[title] = [];
      acc[title].push(anime);
      return acc;
    }, {} as Record<string, Anime[]>);

    const entries = Object.entries(groups);
    const getRecentTs = (seasons: Anime[]) =>
      Math.max(
        ...seasons.map((s) => {
          const t = Date.parse(s.createdAt || s.updatedAt || "");
          return Number.isFinite(t) ? t : 0;
        }),
      );

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
        entries.sort(([, seasonsA], [, seasonsB]) => getRecentTs(seasonsB) - getRecentTs(seasonsA));
        break;
    }

    return Object.fromEntries(entries);
  }, [activeTab, filteredAnimeList, sortBy]);

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

  const handleWatchAutoProgress = ({ anime }: { action: "created" | "updated"; anime: AnimeData }) => {
    setAnimeList((prev) => {
      const existingIndex = prev.findIndex((a) => a.id === anime.id);
      const mapped: Anime = {
        id: anime.id,
        title: anime.title,
        episodesWatched: anime.episodesWatched,
        totalEpisodes: anime.totalEpisodes,
        status: anime.status,
        rating: anime.rating,
        notes: anime.notes,
        coverImage: anime.coverImage,
        seasonNumber: anime.seasonNumber,
        anilistId: anime.anilistId,
        malId: anime.malId,
        ranking: anime.ranking,
        isHentai: anime.isHentai,
      };
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = mapped;
        return next;
      }
      return [mapped, ...prev];
    });
  };

  const handleSignOut = async () => {
    await logout();
    setLocation("/auth");
  };

  const saveRemCustomize = (next: RemCustomization) => {
    setRemCustomize(next);
    localStorage.setItem(REM_CUSTOMIZE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("rem-customize-change"));
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

  const remRootClass = isRemTheme ? "rem-ui" : "";
  if (isLoading) {
    return (
      <div className={`min-h-screen flex flex-col bg-background ${remRootClass}`}>
        <header className={`sticky top-0 z-50 border-b border-border/40 glass bg-glow ${isRemTheme ? "rem-nav" : ""}`}>
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
    <div className={`min-h-screen flex flex-col bg-background ${remRootClass}`}>
      <header className={`sticky top-0 z-50 border-b border-border/40 premium-shell bg-glow ${isRemTheme ? "rem-nav" : ""}`}>
        <div className="header-accent-strip" />
        <div className="container mx-auto px-4 py-2.5">
          <div className={`flex items-center justify-between gap-2 ${isRemTheme ? "rem-nav-inner" : ""}`}>
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
            <div className={`flex items-center gap-1.5 ${isRemTheme ? "rem-top-actions" : ""}`}>
              {user && <Notifications userId={user.id} />}
              {user?.email === "borsepranav700@gmail.com" && (
                <Button
                  variant="ghost"
                  size="icon"
                  title="Feedback Inbox"
                  data-testid="button-feedback-inbox"
                  className="h-8 w-8 hover:bg-muted/50 text-muted-foreground hover:text-violet-400 rounded-xl"
                  onClick={() => window.location.href = "/admin/feedback"}
                >
                  <Inbox className="w-4 h-4" />
                </Button>
              )}
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
                onClick={() => setActiveTab("friends")}
                title="Friends Activity"
                className="relative h-8 w-8 hover:bg-primary/10 text-muted-foreground hover:text-foreground rounded-none border border-transparent hover:border-primary/40"
                data-testid="button-friends-quick"
              >
                <Users className="w-4 h-4" />
                {onlineFriendsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] leading-4 text-white font-semibold text-center border border-background">
                    {onlineFriendsCount > 9 ? "9+" : onlineFriendsCount}
                  </span>
                )}
              </Button>
              <ThemePicker />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSettingsOpen(true)}
                title="Settings"
                className="h-8 w-8 hover:bg-primary/10 text-muted-foreground hover:text-foreground rounded-none border border-transparent hover:border-primary/40"
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
        <Tabs value={activeTab} onValueChange={(next) => startTransition(() => setActiveTab(next))} className="w-full">
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <TabsList className={`h-12 premium-section p-1 gap-0.5 overflow-x-auto flex-nowrap shadow-[0_0_14px_rgba(212,175,55,0.12)] ${isRemTheme ? "rem-tabs-shell" : ""}`}>
                <TabsTrigger value="watch" data-testid="tab-watch"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <Play className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Watch</span>
                </TabsTrigger>
                <TabsTrigger value="list" data-testid="tab-list"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  My List
                </TabsTrigger>
                <TabsTrigger value="radar" data-testid="tab-radar"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Radar</span>
                </TabsTrigger>
                <TabsTrigger value="ranking" data-testid="tab-ranking"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <Trophy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rankings</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" data-testid="tab-analytics"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <PieChart className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="friends" data-testid="tab-friends"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Friends</span>
                </TabsTrigger>
                <TabsTrigger value="discover" data-testid="tab-discover"
                  className={`rounded-none text-xs sm:text-sm px-2.5 sm:px-4 border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black data-[state=active]:shadow-neon font-medium gap-1 ${isRemTheme ? "rem-tab-trigger" : ""}`}>
                  <Compass className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Discover</span>
                </TabsTrigger>
              </TabsList>

              {activeTab === "list" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={gridSize} onValueChange={(value) => {
                    setGridSize(value);
                    localStorage.setItem("animeGridSize", value);
                  }}>
                    <SelectTrigger className={`h-9 w-36 sm:w-40 text-xs rounded-xl border-border/50 bg-muted/30 ${isRemTheme ? "rem-control" : ""}`} data-testid="select-grid-size">
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
                    className={`h-9 gradient-primary hover:opacity-90 transition-smooth shadow-neon rounded-xl text-sm font-semibold px-4 ${isRemTheme ? "rem-primary-btn" : ""}`}
                    data-testid="button-add-anime"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Add Anime
                  </Button>
                </div>
              )}
            </div>
          </div>

          <TabsContent value="watch" className="pt-4 animate-tab-in">
            {activeTab === "watch" && mountedTab === "watch" && (
              <Watch
                animeList={animeList}
                onAutoProgress={handleWatchAutoProgress}
              />
            )}
          </TabsContent>

          <TabsContent value="discover" className="pt-4 animate-tab-in">
            {activeTab === "discover" && mountedTab === "discover" && (
              <Discover
                animeList={animeList}
                onAddAnime={handleAddAnime}
                showMature={hentaiFilter !== "hide"}
              />
            )}
          </TabsContent>

          <TabsContent value="list" className="space-y-4 animate-tab-in">
            {activeTab === "list" && mountedTab === "list" && (
              <>
            {user && <NewEpisodesBanner userId={user.id} />}

            {animeList.length > 0 && <StatsBar animeList={animeList} />}

            {/* ── Status legend quick-filter pills ── */}
            {animeList.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { key: "all", label: "All", count: new Set(animeList.map(a => a.title)).size, color: "#888", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.12)" },
                  { key: "watching", label: "Watching", count: statusCounts.watching || 0, color: "#a78bfa", bg: "rgba(88,28,220,0.18)", border: "rgba(124,58,237,0.45)" },
                  { key: "completed", label: "Completed", count: statusCounts.completed || 0, color: "#6ee7b7", bg: "rgba(4,120,87,0.18)", border: "rgba(16,185,129,0.45)" },
                  { key: "plan_to_watch", label: "Plan", count: statusCounts.plan_to_watch || 0, color: "#93c5fd", bg: "rgba(29,78,216,0.18)", border: "rgba(59,130,246,0.45)" },
                  { key: "on_hold", label: "On Hold", count: statusCounts.on_hold || 0, color: "#fcd34d", bg: "rgba(146,64,14,0.18)", border: "rgba(245,158,11,0.45)" },
                  { key: "dropped", label: "Dropped", count: statusCounts.dropped || 0, color: "#fca5a5", bg: "rgba(153,27,27,0.18)", border: "rgba(239,68,68,0.45)" },
                ].filter(s => s.key === "all" || s.count > 0).map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 hover:scale-105"
                    style={{
                      background: statusFilter === s.key ? s.bg : "rgba(255,255,255,0.04)",
                      border: `1px solid ${statusFilter === s.key ? s.border : "rgba(255,255,255,0.08)"}`,
                      color: statusFilter === s.key ? s.color : "rgba(255,255,255,0.4)",
                      boxShadow: statusFilter === s.key ? `0 0 12px ${s.border}` : "none",
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.color, opacity: statusFilter === s.key ? 1 : 0.4 }} />
                    {s.label}
                    <span className="font-mono text-[10px] opacity-60">{s.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div className={`mb-4 premium-section p-3 sm:p-4 ${isRemTheme ? "rem-filter-shell" : ""}`}>
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                  <Input
                    placeholder="Search your anime..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-9 h-9 rounded-none border-border/40 bg-black/30 text-sm focus:border-primary/50 text-foreground placeholder:text-muted-foreground/40 ${isRemTheme ? "rem-search" : ""}`}
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <Select value={sortBy} onValueChange={(v) => { setSortBy(v); localStorage.setItem("animeSortBy", v); }}>
                    <SelectTrigger className={`h-9 w-full sm:w-40 rounded-none border-border/40 bg-black/30 text-xs ${isRemTheme ? "rem-control" : ""}`} data-testid="select-sort">
                      <ArrowUpDown className="w-3 h-3 mr-1.5 text-muted-foreground/50" />
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
                  {allGenres.length > 0 && (
                    <Select value={genreFilter} onValueChange={setGenreFilter}>
                      <SelectTrigger className={`h-9 w-full sm:w-36 rounded-none border-border/40 bg-black/30 text-xs ${isRemTheme ? "rem-control" : ""}`} data-testid="select-genre">
                        <Tag className="w-3 h-3 mr-1.5 text-muted-foreground/50" />
                        <SelectValue placeholder="Genre" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Genres</SelectItem>
                        {allGenres.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </div>

            {filteredAnimeList.length === 0 ? (
              <div className="premium-section flex flex-col items-center justify-center py-20 gap-5 animate-fade-in overflow-hidden relative">
                {isRemTheme && !searchQuery && statusFilter === "all" && rankingFilter === "all" ? (
                  /* ── Rem special empty state ── */
                  <div className="flex flex-col items-center gap-4">
                    {/* Sad Rem sticker */}
                    <div className="relative" style={{ animation: "rem-float 4s ease-in-out infinite" }}>
                      <img
                        src={remSadImg}
                        alt="Rem is waiting..."
                        style={{
                          width: "160px",
                          height: "auto",
                          filter: "drop-shadow(0 0 20px rgba(80,140,255,0.5)) drop-shadow(0 0 40px rgba(80,140,255,0.2))",
                        }}
                      />
                    </div>

                    <div className="text-center space-y-2 max-w-xs">
                      <h2 className="text-2xl font-black tracking-wide"
                        style={{ color: "#93c5fd", textShadow: "0 0 30px rgba(147,197,253,0.5)" }}>
                        Your list is empty…
                      </h2>
                      <p className="text-sm leading-relaxed italic"
                        style={{ color: "rgba(147,197,253,0.55)" }}>
                        "Rem will keep waiting, no matter how many times the world resets…"
                      </p>
                      <p className="text-[10px] tracking-[0.22em] uppercase"
                        style={{ color: "rgba(147,197,253,0.28)" }}>
                        — Re:Zero ❄
                      </p>
                    </div>

                    <button
                      onClick={() => setIsAddDialogOpen(true)}
                      className="flex items-center gap-2 px-7 py-2.5 text-sm font-bold tracking-wider transition-all duration-200"
                      style={{
                        background: "linear-gradient(135deg, rgba(29,78,216,0.75), rgba(59,130,246,0.55))",
                        border: "1px solid rgba(100,160,255,0.5)",
                        color: "#93c5fd",
                        boxShadow: "0 0 24px rgba(80,140,255,0.3), inset 0 1px 0 rgba(147,197,253,0.15)",
                        backdropFilter: "blur(8px)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 36px rgba(80,140,255,0.5), inset 0 1px 0 rgba(147,197,253,0.2)";
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(29,78,216,0.9), rgba(59,130,246,0.7))";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = "0 0 24px rgba(80,140,255,0.3), inset 0 1px 0 rgba(147,197,253,0.15)";
                        e.currentTarget.style.background = "linear-gradient(135deg, rgba(29,78,216,0.75), rgba(59,130,246,0.55))";
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Your First Anime ❄
                    </button>
                  </div>
                ) : (
                  /* ── Default empty state ── */
                  <>
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
                  </>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] shrink-0">
                    {Object.keys(groupedAnime).length} title{Object.keys(groupedAnime).length !== 1 ? "s" : ""}
                    {filteredAnimeList.length !== animeList.length ? ` · filtered` : ""}
                  </span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>
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
              </>
            )}
          </TabsContent>

          <TabsContent value="radar" className="pt-2 animate-tab-in">
            {activeTab === "radar" && mountedTab === "radar" && user && (
              <Radar
                userId={user.id}
                animeList={animeList}
                onAddAnime={handleAddAnime}
              />
            )}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4 animate-tab-in">
            {activeTab === "ranking" && mountedTab === "ranking" && (
              <>
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-5 h-5 text-amber-400" />
                <h2 className="text-2xl font-black text-gradient">My Rankings</h2>
              </div>
              <p className="text-sm text-muted-foreground">Drag to reorder your all-time favourite anime.</p>
            </div>
            {user && <AnimeRanking userId={user.id} isOwnProfile={true} />}
              </>
            )}
          </TabsContent>

          <TabsContent value="friends" className="space-y-4 animate-tab-in">
            {activeTab === "friends" && mountedTab === "friends" && user && <Friends currentUserId={user.id} />}
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4 pt-4 animate-tab-in">
            {activeTab === "analytics" && mountedTab === "analytics" && <AnalyticsDashboard />}
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

      <Dialog open={isSettingsOpen} onOpenChange={(open) => { setIsSettingsOpen(open); if (open) { setNewUsername(user?.username || ""); setRemCustomize(readRemCustomization()); } }}>
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

            {isRemTheme && (
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Customize Rem</h4>
                <div className="p-4 rounded-xl border border-border/50 bg-background/50 holo-glass space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => saveRemCustomize(DEFAULT_REM_CUSTOMIZATION)}
                    >
                      Default
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        saveRemCustomize({
                          ...DEFAULT_REM_CUSTOMIZATION,
                          showGif: false,
                          showEyes: false,
                          sizeMode: "small",
                        })
                      }
                    >
                      Minimal
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: "showCharacter", label: "Show Rem" },
                      { key: "showGif", label: "Show GIF" },
                      { key: "showEyes", label: "Show Eyes" },
                      { key: "showSnow", label: "Show Snow" },
                      { key: "draggable", label: "Draggable" },
                    ].map((item) => (
                      <label key={item.key} className="flex items-center gap-2 text-foreground/90">
                        <input
                          type="checkbox"
                          checked={remCustomize[item.key as keyof RemCustomization] as boolean}
                          onChange={(event) =>
                            saveRemCustomize({
                              ...remCustomize,
                              [item.key]: event.target.checked,
                            } as RemCustomization)
                          }
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Select
                      value={remCustomize.sizeMode}
                      onValueChange={(value: "small" | "normal") =>
                        saveRemCustomize({ ...remCustomize, sizeMode: value })
                      }
                    >
                      <SelectTrigger className="h-8 w-36 text-xs">
                        <SelectValue placeholder="Rem size" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small widgets</SelectItem>
                        <SelectItem value="normal">Normal widgets</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        ["rem-gif", "rem-eyes", "rem-main"].forEach((k) =>
                          localStorage.removeItem(`anicircle-rem-pos-${k}`),
                        );
                        window.dispatchEvent(new Event("rem-reset-layout"));
                        window.dispatchEvent(new Event("rem-customize-change"));
                        toast.success("Rem widget layout reset");
                      }}
                    >
                      Reset Layout
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
      <SuggestionPopup />
      <FloatingSocialBar />
    </div>
  );
};

export default Index;
