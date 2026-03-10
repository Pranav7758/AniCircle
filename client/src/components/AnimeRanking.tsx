import { useState, useEffect } from "react";
import { getAnimeList, updateAnime } from "@/services/supabaseData";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit2 } from "lucide-react";
import { toast } from "sonner";

interface RankedAnime {
  id: string;
  title: string;
  coverImage: string | null;
  ranking: number | null;
  status: string;
  rating: number | null;
}

interface AnimeRankingProps {
  userId: string;
  isOwnProfile?: boolean;
}

const AnimeRanking = ({ userId, isOwnProfile = true }: AnimeRankingProps) => {
  const [animeList, setAnimeList] = useState<RankedAnime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRankedAnime = async () => {
    setIsLoading(true);
    try {
      const data = await getAnimeList();

      const grouped = (data || []).reduce((acc: Record<string, RankedAnime>, anime: any) => {
        if (!acc[anime.title]) {
          acc[anime.title] = {
            id: anime.id,
            title: anime.title,
            coverImage: anime.coverImage,
            ranking: anime.ranking,
            status: anime.status,
            rating: anime.rating,
          };
        }
        return acc;
      }, {} as Record<string, RankedAnime>);

      const ranked = Object.values(grouped) as RankedAnime[];
      ranked.sort((a: RankedAnime, b: RankedAnime) => {
        if (a.ranking !== null && b.ranking !== null) {
          return a.ranking - b.ranking;
        }
        if (a.ranking !== null) return -1;
        if (b.ranking !== null) return 1;
        return 0;
      });
      
      setAnimeList(ranked);
    } catch (error) {
      console.error("Error fetching ranked anime:", error);
      toast.error("Failed to load anime rankings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRankedAnime();
  }, [userId]);

  const setRank = async (id: string, newRank: number) => {
    if (!isOwnProfile) return;

    const clickedAnime = animeList.find((item) => item.id === id);
    if (!clickedAnime) return;

    if (newRank < 1 || newRank > animeList.length) {
      toast.error(`Rank must be between 1 and ${animeList.length}`);
      return;
    }

    const rankedAnime = animeList.filter(a => a.ranking !== null && a.id !== id)
      .sort((a, b) => (a.ranking || 0) - (b.ranking || 0));
    const unrankedAnime = animeList.filter(a => a.ranking === null && a.id !== id);

    const newOrderedList: RankedAnime[] = [];
    for (let i = 0; i < newRank - 1 && i < rankedAnime.length; i++) {
      newOrderedList.push(rankedAnime[i]);
    }
    const updatedAnime = { ...clickedAnime, ranking: newRank };
    newOrderedList.push(updatedAnime);
    for (let i = newRank - 1; i < rankedAnime.length; i++) {
      newOrderedList.push(rankedAnime[i]);
    }
    newOrderedList.push(...unrankedAnime);

    const updatedList = newOrderedList.map((anime, index) => ({
      ...anime,
      ranking: anime.ranking !== null ? index + 1 : null
    }));
    
    updatedList.sort((a, b) => {
      if (a.ranking !== null && b.ranking !== null) return a.ranking - b.ranking;
      if (a.ranking !== null) return -1;
      if (b.ranking !== null) return 1;
      return 0;
    });
    
    setAnimeList(updatedList);

    try {
      for (let i = 0; i < newOrderedList.length; i++) {
        const anime = newOrderedList[i];
        const ranking = anime.ranking !== null ? i + 1 : null;
        await updateAnime(anime.id, { ranking });
      }
      toast.success(`${clickedAnime.title} is now ranked #${newRank}!`);
    } catch (error) {
      console.error("Error updating ranking:", error);
      toast.error("Failed to update ranking");
      fetchRankedAnime();
    }
  };

  const removeRanking = async (id: string) => {
    if (!isOwnProfile) return;

    const animeToUnrank = animeList.find(a => a.id === id);
    if (!animeToUnrank) return;

    const updatedList = animeList.map(anime => 
      anime.id === id ? { ...anime, ranking: null } : anime
    );
    updatedList.sort((a, b) => {
      if (a.ranking !== null && b.ranking !== null) return a.ranking - b.ranking;
      if (a.ranking !== null) return -1;
      if (b.ranking !== null) return 1;
      return 0;
    });
    
    let rankCounter = 1;
    const finalList = updatedList.map(anime => {
      if (anime.ranking !== null) {
        return { ...anime, ranking: rankCounter++ };
      }
      return anime;
    });
    
    setAnimeList(finalList);

    try {
      await updateAnime(id, { ranking: null });
      for (const anime of finalList) {
        if (anime.ranking !== null) {
          await updateAnime(anime.id, { ranking: anime.ranking });
        }
      }
      toast.success("Ranking removed");
    } catch (error) {
      console.error("Error removing ranking:", error);
      toast.error("Failed to remove ranking");
      fetchRankedAnime();
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Loading rankings...</p>
      </div>
    );
  }

  if (animeList.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No anime found. Add some anime to start ranking!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOwnProfile && (
        <div className="mb-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Click on the rank number (#) to set any anime to any rank position.
          </p>
        </div>
      )}
      {animeList.map((anime, index) => {
        const currentRank = anime.ranking || null;
        const displayRank = currentRank || index + 1;
        return (
          <AnimeRankItem
            key={anime.id}
            anime={anime}
            rank={displayRank}
            isRanked={currentRank !== null}
            isOwnProfile={isOwnProfile}
            totalAnime={animeList.length}
            onSetRank={(rank) => setRank(anime.id, rank)}
            onRemoveRanking={() => removeRanking(anime.id)}
          />
        );
      })}
    </div>
  );
};

interface AnimeRankItemProps {
  anime: RankedAnime;
  rank: number;
  isRanked: boolean;
  isOwnProfile: boolean;
  totalAnime: number;
  onSetRank: (rank: number) => void;
  onRemoveRanking: () => void;
}

const AnimeRankItem = ({
  anime,
  rank,
  isRanked,
  isOwnProfile,
  totalAnime,
  onSetRank,
  onRemoveRanking,
}: AnimeRankItemProps) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [rankInput, setRankInput] = useState(rank.toString());

  const handleSetRank = () => {
    const newRank = parseInt(rankInput);
    if (isNaN(newRank) || newRank < 1 || newRank > totalAnime) {
      toast.error(`Please enter a number between 1 and ${totalAnime}`);
      return;
    }
    onSetRank(newRank);
    setIsEditDialogOpen(false);
  };

  return (
    <>
      <Card 
        className={`border-border/50 bg-card/50 hover:bg-card transition-colors ${isOwnProfile ? 'cursor-pointer' : ''}`}
        data-testid={`ranking-item-${anime.id}`}
      >
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-3 sm:gap-4">
            {isOwnProfile ? (
              <div 
                className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-primary flex items-center justify-center font-bold text-lg sm:text-xl text-primary-foreground shadow-glow hover:opacity-80 transition-opacity cursor-pointer"
                onClick={() => {
                  setRankInput(rank.toString());
                  setIsEditDialogOpen(true);
                }}
                title="Click to change rank"
                data-testid={`button-rank-${anime.id}`}
              >
                #{rank}
              </div>
            ) : (
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg bg-gradient-primary flex items-center justify-center font-bold text-lg sm:text-xl text-primary-foreground shadow-glow">
                #{rank}
              </div>
            )}

            {anime.coverImage ? (
              <img
                src={anime.coverImage}
                alt={anime.title}
                className="w-16 h-24 sm:w-20 sm:h-28 object-cover rounded-lg flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-2xl sm:text-3xl opacity-20">TV</span>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base sm:text-lg truncate">{anime.title}</h3>
              <div className="flex items-center gap-2 mt-1 sm:mt-2 flex-wrap">
                <Badge variant="outline" className="capitalize text-xs">
                  {anime.status.replace("_", " ")}
                </Badge>
                {anime.rating && (
                  <Badge variant="secondary" className="text-xs">{anime.rating}/10</Badge>
                )}
              </div>
            </div>

            {isOwnProfile && (
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 text-xs sm:text-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRankInput(rank.toString());
                    setIsEditDialogOpen(true);
                  }}
                  data-testid={`button-edit-rank-${anime.id}`}
                >
                  <Edit2 className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                  Edit Rank
                </Button>
                {isRanked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 sm:h-9 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRanking();
                    }}
                    data-testid={`button-unrank-${anime.id}`}
                  >
                    Unrank
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Rank for {anime.title}</DialogTitle>
            <DialogDescription>
              Enter a rank number between 1 and {totalAnime}. Other rankings will be automatically adjusted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="number"
              min="1"
              max={totalAnime}
              value={rankInput}
              onChange={(e) => setRankInput(e.target.value)}
              placeholder={`Enter rank (1-${totalAnime})`}
              className="text-center text-lg"
              data-testid="input-rank"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSetRank();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-rank">
              Cancel
            </Button>
            <Button onClick={handleSetRank} data-testid="button-confirm-rank">
              Set Rank
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnimeRanking;
