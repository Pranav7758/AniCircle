import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { getAnimeList, createAnime, updateAnime, deleteAnime } from "@/services/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Plus, Search, Trophy, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AnimeRanking from "@/components/AnimeRanking";
import Friends from "@/components/Friends";
import { toast } from "sonner";
import AnimeGroupCard from "@/components/AnimeGroupCard";
import AddAnimeDialog, { AnimeFormData } from "@/components/AddAnimeDialog";
import Notifications from "@/components/Notifications";
import Footer from "@/components/Footer";
import NewEpisodesBanner from "@/components/NewEpisodesBanner";
import { Loader2 } from "lucide-react";

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

const Index = () => {
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [animeList, setAnimeList] = useState<Anime[]>([]);
  const [filteredAnimeList, setFilteredAnimeList] = useState<Anime[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hentaiFilter, setHentaiFilter] = useState<string>("show");
  const [rankingFilter, setRankingFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingAnime, setEditingAnime] = useState<(Anime & AnimeFormData) | null>(null);
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
  }, [searchQuery, statusFilter, hentaiFilter, rankingFilter, animeList]);

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

    setFilteredAnimeList(filtered);
  };

  const groupedAnime = (filteredAnimeList || []).reduce((groups, anime) => {
    const title = anime.title;
    if (!groups[title]) {
      groups[title] = [];
    }
    groups[title].push(anime);
    return groups;
  }, {} as Record<string, Anime[]>);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading your anime collection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
              AniCircle
            </h2>
            <div className="flex items-center gap-2">
              {user && <Notifications userId={user.id} />}
              <Button
                variant="outline"
                onClick={handleSignOut}
                data-testid="button-signout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-8 pb-8 flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="mb-6 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <TabsList>
                <TabsTrigger value="list" data-testid="tab-list">My List</TabsTrigger>
                <TabsTrigger value="ranking" data-testid="tab-ranking">
                  <Trophy className="w-4 h-4 mr-2" />
                  Rankings
                </TabsTrigger>
                <TabsTrigger value="friends" data-testid="tab-friends">
                  <Users className="w-4 h-4 mr-2" />
                  Friends
                </TabsTrigger>
              </TabsList>
            </div>
            {activeTab === "list" && (
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Select value={gridSize} onValueChange={(value) => {
                  setGridSize(value);
                  localStorage.setItem("animeGridSize", value);
                }}>
                  <SelectTrigger className="w-full sm:w-40" data-testid="select-grid-size">
                    <SelectValue placeholder="View size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compact">Compact (7 per row)</SelectItem>
                    <SelectItem value="small">Small (6 per row)</SelectItem>
                    <SelectItem value="medium">Medium (5 per row)</SelectItem>
                    <SelectItem value="large">Large (4 per row)</SelectItem>
                    <SelectItem value="extra-large">Extra Large (3 per row)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="w-full sm:w-auto gradient-primary hover:opacity-90 transition-smooth shadow-glow"
                  data-testid="button-add-anime"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Add Anime
                </Button>
              </div>
            )}
          </div>

          <TabsContent value="list" className="space-y-4">
            {user && <NewEpisodesBanner userId={user.id} />}
            <div className="mb-4 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Search anime..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="watching">Watching</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                    <SelectItem value="dropped">Dropped</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={hentaiFilter} onValueChange={setHentaiFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-hentai-filter">
                    <SelectValue placeholder="Hentai filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show">Show All</SelectItem>
                    <SelectItem value="hide">Hide Hentai</SelectItem>
                    <SelectItem value="only">Hentai Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={rankingFilter} onValueChange={setRankingFilter}>
                  <SelectTrigger className="w-full md:w-48" data-testid="select-ranking-filter">
                    <SelectValue placeholder="Ranking filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Anime</SelectItem>
                    <SelectItem value="ranked">Ranked Only</SelectItem>
                    <SelectItem value="unranked">Unranked Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredAnimeList.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Loader2 className="h-16 w-16 mx-auto opacity-20" />
                <h2 className="text-2xl font-bold text-foreground">No anime found</h2>
                <p className="text-muted-foreground">
                  {searchQuery || statusFilter !== "all" || hentaiFilter !== "show" || rankingFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Start by adding your first anime!"}
                </p>
              </div>
            ) : (
              <div className={`grid gap-3 sm:gap-4 animate-fade-in ${gridSize === "compact" ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7" :
                gridSize === "small" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" :
                  gridSize === "medium" ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" :
                    gridSize === "large" ? "grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4" :
                      "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
                }`}>
                {Object.entries(groupedAnime).map(([title, seasons]) => (
                  <AnimeGroupCard
                    key={title}
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
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">My Anime Rankings</h2>
              <p className="text-muted-foreground">
                Rank your favorite anime! Use the arrows to reorder your list.
              </p>
            </div>
            {user && <AnimeRanking userId={user.id} isOwnProfile={true} />}
          </TabsContent>

          <TabsContent value="friends" className="space-y-4">
            {user && <Friends currentUserId={user.id} />}
          </TabsContent>
        </Tabs>
      </main>

      <AddAnimeDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSubmit={handleAddAnime}
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
      <Footer />
    </div>
  );
};

export default Index;
