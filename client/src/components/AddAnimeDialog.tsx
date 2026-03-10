import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { fetchAniList, SEARCH_ANIME_QUERY, GET_ANIME_DETAILS_QUERY } from "../services/anilist";

interface AnimeSearchResult {
  id: number;
  idMal: number | null;
  title: {
    romaji: string;
    english: string | null;
  };
  episodes: number | null;
  status: string;
  coverImage: {
    large: string;
  };
  nextAiringEpisode: {
    episode: number;
    airingAt: number;
  } | null;
  averageScore: number | null;
  description: string | null;
  format: string | null;
  seasonYear: number | null;
}

interface AddAnimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AnimeFormData) => Promise<void>;
  initialData?: AnimeFormData & { id?: string };
  isEditing?: boolean;
}

export interface SeasonData {
  anilist_id: number;
  mal_id: number | undefined;
  seasonNumber: number;
  title: string;
  episodes: number | null;
  selected: boolean;
  episodesWatched: number;
  isHentai?: boolean;
}

export interface AnimeFormData {
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  notes: string;
  coverImage: string;
  seasonNumber: number;
  numberOfSeasons?: number; // For bulk adding
  seasons?: SeasonData[]; // Individual season data with episode counts
  anilistId?: number; // AniList ID
  malId?: number; // MyAnimeList ID mapping
  isHentai?: boolean; // Manual flag to mark anime as hentai
}

const AddAnimeDialog = ({ open, onOpenChange, onSubmit, initialData, isEditing = false }: AddAnimeDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<AnimeSearchResult[]>([]);
  const [showSearch, setShowSearch] = useState(!isEditing);
  const [isFetchingSeasons, setIsFetchingSeasons] = useState(false);
  const [formData, setFormData] = useState<AnimeFormData>(
    initialData || {
      title: "",
      episodesWatched: 0,
      totalEpisodes: null,
      status: "watching",
      rating: null,
      notes: "",
      coverImage: "",
      seasonNumber: 1,
      numberOfSeasons: 1,
      seasons: [],
    }
  );

  // Reset form when dialog closes or opens
  useEffect(() => {
    if (!open) {
      // Reset all form state when dialog closes
      setFormData({
        title: "",
        episodesWatched: 0,
        totalEpisodes: null,
        status: "watching",
        rating: null,
        notes: "",
        coverImage: "",
        seasonNumber: 1,
        numberOfSeasons: 1,
        seasons: [],
        isHentai: false,
      });
      setSearchQuery("");
      setSearchResults([]);
      setShowSearch(!isEditing);
      setIsFetchingSeasons(false);
    } else if (open) {
      // When dialog opens, set initial data if provided (for editing), otherwise use defaults
      if (initialData) {
        setFormData(initialData);
        setShowSearch(false);
      } else {
        setFormData({
          title: "",
          episodesWatched: 0,
          totalEpisodes: null,
          status: "watching",
          rating: null,
          notes: "",
          coverImage: "",
          seasonNumber: 1,
          numberOfSeasons: 1,
          seasons: [],
          isHentai: false,
        });
        setShowSearch(true);
      }
      setSearchQuery("");
      setSearchResults([]);
      setIsFetchingSeasons(false);
    }
  }, [open, initialData, isEditing]);

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim() || isEditing || !showSearch) return;

    const timeoutId = setTimeout(() => {
      handleSearch();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const data = await fetchAniList(SEARCH_ANIME_QUERY, { search: searchQuery });
      setSearchResults(data.Page.media || []);
    } catch (error) {
      toast.error("Failed to search anime");
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectAnime = async (anime: AnimeSearchResult) => {
    setIsSearching(true);
    setIsFetchingSeasons(true);
    try {
      // Helper function to fetch anime details
      const fetchAnimeDetails = async (id: number) => {
        try {
          const data = await fetchAniList(GET_ANIME_DETAILS_QUERY, { id });
          return data.Media;
        } catch (err) {
          console.error(`Failed to fetch anime ${id}:`, err);
          return null;
        }
      };

      // Helper function to check if a title represents a new season vs a part/cour
      const isNewSeason = (title: string, baseTitle: string): boolean => {
        const lowerTitle = title.toLowerCase();
        const lowerBase = baseTitle.toLowerCase();

        // Check if it's a part or cour (continuation of same season)
        if (lowerTitle.includes('part 2') || lowerTitle.includes('part 3') ||
          lowerTitle.includes('part 4') || lowerTitle.includes('cour 2') ||
          lowerTitle.includes('cour 3') || lowerTitle.includes('2nd cour') ||
          lowerTitle.includes('second cour') || lowerTitle.includes('second part')) {
          return false; // This is a part/cour, not a new season
        }

        // Check if it's explicitly a new season
        if (lowerTitle.includes('season 2') || lowerTitle.includes('season 3') ||
          lowerTitle.includes('season 4') || lowerTitle.includes('2nd season') ||
          lowerTitle.includes('3rd season') || lowerTitle.includes('4th season') ||
          lowerTitle.includes('second season') || lowerTitle.includes('third season')) {
          return true; // This is a new season
        }

        // If the base title is significantly different, it might be a new season
        // But if it's very similar with just "Part 2" etc, it's not
        const titleDiff = lowerTitle.replace(lowerBase, '').trim();
        if (titleDiff && !titleDiff.match(/^(part|cour|season)\s*\d+$/i)) {
          // If there's a meaningful difference beyond part/cour, might be new season
          return true;
        }

        return false; // Default to not a new season if uncertain
      };

      // Helper function to extract season number and part from title
      const extractSeasonInfo = (title: string): { season: number | null; part: number | null; isPart: boolean } => {
        const lowerTitle = title.toLowerCase();

        // Match patterns like "Season 2", "2nd Season", "Season 3 Part 2", etc.
        const seasonMatch = lowerTitle.match(/season\s*(\d+)/i) ||
          lowerTitle.match(/(\d+)(?:st|nd|rd|th)\s*season/i);

        let seasonNumber = seasonMatch ? parseInt(seasonMatch[1]) : null;

        // Check if it's a part (Part 2, Part 3, etc.)
        const partMatch = lowerTitle.match(/part\s*(\d+)/i) ||
          lowerTitle.match(/cour\s*(\d+)/i) ||
          lowerTitle.match(/(\d+)(?:nd|rd|th)\s*(?:cour|part)/i);

        const partNumber = partMatch ? parseInt(partMatch[1]) : null;
        const isPart = partNumber !== null;

        return { season: seasonNumber, part: partNumber, isPart };
      };

      // Helper function to get the base anime title (remove season/part identifiers)
      const getBaseTitle = (title: string, defaultBase: string): string => {
        // Just use the base anime title for all seasons
        // The season number is already shown separately
        return defaultBase;
      };

      // Helper function to get related anime IDs from relations
      const getRelatedAnimeIds = (relations: any) => {
        const relatedIds = new Set<number>();

        if (!relations || !relations.edges) return relatedIds;

        relations.edges.forEach((rel: any) => {
          // Include ALL Sequel, Prequel, and Season relations
          if (rel.relationType === "SEQUEL" || rel.relationType === "PREQUEL" || rel.relationType === "ALTERNATIVE") {
            if (rel.node && rel.node.format === "TV") {
              relatedIds.add(rel.node.id);
            }
          }
        });

        return relatedIds;
      };

      // Start by fetching the selected anime's full details
      const currentAnimeDetails = await fetchAnimeDetails(anime.id);
      if (!currentAnimeDetails) {
        throw new Error("Failed to fetch anime details");
      }

      // Collect all related anime IDs by following the chain, and cache fetched data
      const allRelatedIds = new Set<number>();
      const toProcess = new Set<number>([anime.id]);
      const processed = new Set<number>();
      const animeCache = new Map<number, any>();

      // Follow the chain of relations to find all seasons
      while (toProcess.size > 0) {
        const currentId = Array.from(toProcess)[0];
        toProcess.delete(currentId);

        if (processed.has(currentId)) continue;
        processed.add(currentId);
        allRelatedIds.add(currentId);

        const details = await fetchAnimeDetails(currentId);
        if (details) {
          // Cache the details
          animeCache.set(currentId, details);

          if (details.relations) {
            const relatedIds = getRelatedAnimeIds(details.relations);
            relatedIds.forEach(id => {
              if (!processed.has(id)) {
                toProcess.add(id);
              }
            });
          }
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Build season list from cached data
      const allAnimeData: Array<{
        id: number;
        idMal: number | undefined;
        title: string;
        title_english: string | null;
        episodes: number | null;
        aired: { from: string | null } | null;
        type: string | null;
        status: string | null;
        rating: string | null;
        genres: Array<{ name: string }> | null;
      }> = [];

      for (const id of allRelatedIds) {
        const details = animeCache.get(id);
        if (details) {
          allAnimeData.push({
            id: details.id,
            idMal: details.idMal,
            title: details.title.romaji,
            title_english: details.title.english,
            episodes: details.episodes,
            aired: details.startDate ? {
              from: `${details.startDate.year || 2000}-${String(details.startDate.month || 1).padStart(2, '0')}-${String(details.startDate.day || 1).padStart(2, '0')}`
            } : null,
            type: details.type || null,
            status: details.status || null,
            rating: details.averageScore ? (details.averageScore / 10).toString() : null,
            genres: details.genres || null,
          });
        }
      }

      // Sort by airing date to get correct season order
      allAnimeData.sort((a, b) => {
        const dateA = a.aired?.from ? new Date(a.aired.from).getTime() : 0;
        const dateB = b.aired?.from ? new Date(b.aired.from).getTime() : 0;
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        // If dates are same or missing, sort by title
        return (a.title_english || a.title).localeCompare(b.title_english || b.title);
      });

      // Get base title (the main anime name)
      const baseTitle = anime.title.english || anime.title.romaji;

      // Build season list with intelligent season number assignment
      const seasons: SeasonData[] = [];
      const seasonMap = new Map<number, number>(); // Maps extracted season number to assigned season number
      let currentSeasonNumber = 1;

      for (const animeData of allAnimeData) {
        const fullTitle = animeData.title_english || animeData.title;
        const seasonInfo = extractSeasonInfo(fullTitle);

        // Skip movies, specials, and NOT_YET_RELEASED anime
        if (animeData.type === "MOVIE" || (animeData.episodes === 1 && !seasonInfo.season)) {
          continue;
        }
        // Skip anime that haven't aired yet (announced/upcoming seasons)
        if (animeData.status === "NOT_YET_RELEASED") {
          continue;
        }

        // Use base title for all seasons (season number is shown separately)
        const displayTitle = getBaseTitle(fullTitle, baseTitle);

        let assignedSeasonNumber: number;

        if (seasonInfo.season !== null) {
          // If we've seen this season number before, use the same assigned number
          // (e.g., "Season 2" and "Season 2 Part 2" both get season number 2)
          if (seasonMap.has(seasonInfo.season)) {
            assignedSeasonNumber = seasonMap.get(seasonInfo.season)!;
          } else {
            // New season number - assign it
            assignedSeasonNumber = currentSeasonNumber;
            seasonMap.set(seasonInfo.season, assignedSeasonNumber);
            currentSeasonNumber++;
          }
        } else {
          // No season number found in title - assign sequentially
          assignedSeasonNumber = currentSeasonNumber;
          currentSeasonNumber++;
        }

        seasons.push({
          anilist_id: animeData.id,
          mal_id: animeData.idMal,
          seasonNumber: assignedSeasonNumber,
          title: displayTitle + (seasonInfo.isPart ? ` (Part ${seasonInfo.part || 2})` : ""),
          episodes: animeData.episodes,
          selected: true, // Default to selected
          episodesWatched: animeData.episodes || 0, // Default to all episodes watched (completed)
        });
      }

      setFormData({
        ...formData,
        title: anime.title.english || anime.title.romaji,
        totalEpisodes: anime.episodes,
        coverImage: anime.coverImage.large,
        rating: anime.averageScore ? Math.round(anime.averageScore / 10) : null,
        numberOfSeasons: seasons.length,
        seasons: seasons,
        anilistId: anime.id,
        malId: anime.idMal || undefined,
      });

      toast.success(`Found ${seasons.length} season${seasons.length !== 1 ? 's' : ''} for ${anime.title.english || anime.title.romaji}`);
    } catch (error) {
      console.error(error);
      // Fallback to basic data if relations fetch fails
      setFormData({
        ...formData,
        title: anime.title.english || anime.title.romaji,
        totalEpisodes: anime.episodes,
        coverImage: anime.coverImage.large,
        rating: anime.averageScore ? Math.round(anime.averageScore / 10) : null,
        anilistId: anime.id,
        malId: anime.idMal || undefined,
        seasons: [{
          anilist_id: anime.id,
          mal_id: anime.idMal || undefined,
          seasonNumber: 1,
          title: anime.title.english || anime.title.romaji,
          episodes: anime.episodes,
          selected: true,
          episodesWatched: anime.episodes || 0, // Default to all episodes watched (completed)
          isHentai: false, // Default to false in fallback case
        }],
      });
    } finally {
      setIsSearching(false);
      setIsFetchingSeasons(false);
      setShowSearch(false);
      setSearchResults([]);
      setSearchQuery("");
    }
  };

  const handleToggleSeason = (index: number) => {
    if (!formData.seasons) return;
    const updatedSeasons = [...formData.seasons];
    updatedSeasons[index].selected = !updatedSeasons[index].selected;
    setFormData({ ...formData, seasons: updatedSeasons });
  };

  const handleSelectAllSeasons = (selectAll: boolean) => {
    if (!formData.seasons) return;
    const updatedSeasons = formData.seasons.map(season => ({
      ...season,
      selected: selectAll,
    }));
    setFormData({ ...formData, seasons: updatedSeasons });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate cover image is required
    if (!formData.coverImage || formData.coverImage.trim() === "") {
      toast.error("Cover image is required. Please select an anime from search or provide an image URL.");
      return;
    }

    // If we have season data, ensure at least one is selected
    if (formData.seasons && formData.seasons.length > 0) {
      const selectedSeasons = formData.seasons.filter(s => s.selected);
      if (selectedSeasons.length === 0) {
        toast.error("Please select at least one season to add");
        return;
      }
    }

    setIsLoading(true);
    try {
      await onSubmit(formData);
      if (!isEditing) {
        setFormData({
          title: "",
          episodesWatched: 0,
          totalEpisodes: null,
          status: "watching",
          rating: null,
          notes: "",
          coverImage: "",
          seasonNumber: 1,
          numberOfSeasons: 1,
          seasons: [],
        });
        setShowSearch(true);
        setSearchResults([]);
        setSearchQuery("");
      }
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto gradient-card border-border/50">
        <DialogHeader>
          <DialogTitle className="text-2xl bg-gradient-primary bg-clip-text text-transparent">
            {isEditing ? "Edit Anime" : "Add New Anime"}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Update your anime details" : showSearch ? "Search for an anime or add manually" : "Update your anime details"}
          </DialogDescription>
        </DialogHeader>

        {showSearch && !isEditing && (
          <div className="space-y-4 pb-4 border-b border-border/50">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search anime (e.g., Naruto, One Piece...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="gradient-primary"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <ScrollArea className="h-[300px] rounded-md border border-border/50 p-2">
                <div className="space-y-2">
                  {searchResults.map((anime) => (
                    <button
                      key={anime.id}
                      type="button"
                      onClick={() => handleSelectAnime(anime)}
                      className="w-full flex gap-3 p-3 rounded-lg hover:bg-accent/50 transition-smooth text-left"
                    >
                      <img
                        src={anime.coverImage.large}
                        alt={anime.title.romaji}
                        className="w-16 h-20 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{anime.title.english || anime.title.romaji}</h4>
                        <p className="text-sm text-muted-foreground">
                          {anime.episodes ? `${anime.episodes} episodes` : "Unknown episodes"}
                          {anime.averageScore && ` • ${(anime.averageScore / 10).toFixed(1)}/10`}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {anime.description?.replace(/<[^>]*>?/gm, '') || "No description available"}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSearch(false)}
              className="w-full"
            >
              Or Add Manually
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Death Note"
              required
              disabled={isLoading}
            />
          </div>

          {!isEditing && formData.seasons && formData.seasons.length > 0 && (
            <div className="space-y-3 p-4 border border-border/50 rounded-lg bg-card/50">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Select Seasons to Add</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="selectAll"
                    checked={formData.seasons.every(s => s.selected)}
                    onCheckedChange={(checked) => handleSelectAllSeasons(checked === true)}
                    disabled={isLoading || isFetchingSeasons}
                  />
                  <Label htmlFor="selectAll" className="text-sm cursor-pointer">
                    Select All ({formData.seasons.filter(s => s.selected).length}/{formData.seasons.length})
                  </Label>
                </div>
              </div>
              {isFetchingSeasons ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fetching season details...
                </div>
              ) : (
                <ScrollArea className="h-[300px] rounded-md border border-border/50 p-2">
                  <div className="space-y-3">
                    {formData.seasons.map((season, index) => (
                      <div
                        key={season.anilist_id}
                        className="p-3 rounded-lg border border-border/50 bg-card/30 space-y-2"
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`season-${season.anilist_id}`}
                            checked={season.selected}
                            onCheckedChange={() => handleToggleSeason(index)}
                            disabled={isLoading}
                          />
                          <Label
                            htmlFor={`season-${season.anilist_id}`}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                Season {season.seasonNumber}: {season.title}
                              </span>
                              <span className="text-sm text-muted-foreground ml-2">
                                {season.episodes ? `${season.episodes} episodes` : "Unknown episodes"}
                              </span>
                            </div>
                          </Label>
                        </div>
                        {season.selected && (
                          <div className="ml-7 space-y-1">
                            <Label htmlFor={`episodes-${season.anilist_id}`} className="text-xs text-muted-foreground">
                              Episodes Watched
                            </Label>
                            <Input
                              id={`episodes-${season.anilist_id}`}
                              type="number"
                              min="0"
                              max={season.episodes || undefined}
                              value={season.episodesWatched}
                              onChange={(e) => {
                                const updatedSeasons = [...formData.seasons!];
                                updatedSeasons[index].episodesWatched = parseInt(e.target.value) || 0;
                                setFormData({ ...formData, seasons: updatedSeasons });
                              }}
                              disabled={isLoading}
                              className="h-8"
                              placeholder="0"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {!isEditing && (!formData.seasons || formData.seasons.length === 0) && (
            <div className="space-y-2">
              <Label htmlFor="numberOfSeasons">Number of Seasons to Add *</Label>
              <Input
                id="numberOfSeasons"
                type="number"
                min="1"
                max="50"
                value={formData.numberOfSeasons}
                onChange={(e) => setFormData({ ...formData, numberOfSeasons: parseInt(e.target.value) || 1 })}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">This will create {formData.numberOfSeasons} season{formData.numberOfSeasons !== 1 ? 's' : ''} at once</p>
            </div>
          )}

          <div className={`grid gap-4 ${isEditing ? 'grid-cols-3' : formData.seasons && formData.seasons.length > 0 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {isEditing && (
              <div className="space-y-2">
                <Label htmlFor="seasonNumber">Season *</Label>
                <Input
                  id="seasonNumber"
                  type="number"
                  min="1"
                  value={formData.seasonNumber}
                  onChange={(e) => setFormData({ ...formData, seasonNumber: parseInt(e.target.value) || 1 })}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {(!formData.seasons || formData.seasons.length === 0) && (
              <div className="space-y-2">
                <Label htmlFor="episodesWatched">Episodes Watched *</Label>
                <Input
                  id="episodesWatched"
                  type="number"
                  min="0"
                  value={formData.episodesWatched}
                  onChange={(e) => setFormData({ ...formData, episodesWatched: parseInt(e.target.value) || 0 })}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {(!formData.seasons || formData.seasons.length === 0) && (
              <div className="space-y-2">
                <Label htmlFor="totalEpisodes">Total Episodes (per season)</Label>
                <Input
                  id="totalEpisodes"
                  type="number"
                  min="0"
                  value={formData.totalEpisodes || ""}
                  onChange={(e) => setFormData({ ...formData, totalEpisodes: e.target.value ? parseInt(e.target.value) : null })}
                  placeholder="24"
                  disabled={isLoading}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isLoading}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="watching">Watching</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="dropped">Dropped</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rating">Rating (1-10)</Label>
              <Input
                id="rating"
                type="number"
                min="1"
                max="10"
                value={formData.rating || ""}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="8"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverImage">Cover Image URL *</Label>
            <Input
              id="coverImage"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              placeholder="https://example.com/image.jpg"
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isHentai"
              checked={formData.isHentai || false}
              onCheckedChange={(checked) => setFormData({ ...formData, isHentai: checked as boolean })}
              disabled={isLoading}
            />
            <Label htmlFor="isHentai" className="cursor-pointer">
              Mark as Hentai
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Your thoughts about this anime..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="gradient-primary hover:opacity-90 transition-smooth"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? "Updating..." : "Adding..."}
                </>
              ) : (
                isEditing ? "Update Anime" : "Add Anime"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddAnimeDialog;
