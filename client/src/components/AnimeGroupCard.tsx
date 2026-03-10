import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Season {
  id: string;
  seasonNumber: number;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  notes: string;
}

interface AnimeGroupCardProps {
  title: string;
  coverImage: string | null;
  seasons: Season[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const statusColors = {
  watching: "bg-primary text-primary-foreground",
  completed: "bg-secondary text-secondary-foreground",
  plan_to_watch: "bg-muted text-muted-foreground",
  dropped: "bg-destructive text-destructive-foreground",
  on_hold: "bg-accent text-accent-foreground",
};

const statusLabels = {
  watching: "Watching",
  completed: "Completed",
  plan_to_watch: "Plan to Watch",
  dropped: "Dropped",
  on_hold: "On Hold",
};

const AnimeGroupCard = ({
  title,
  coverImage,
  seasons,
  onEdit,
  onDelete,
}: AnimeGroupCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate overall stats
  const totalEpisodesWatched = seasons.reduce((sum, s) => sum + s.episodesWatched, 0);
  const totalEpisodes = seasons.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
  const overallProgress = totalEpisodes > 0 ? (totalEpisodesWatched / totalEpisodes) * 100 : 0;
  const avgRating = seasons.filter(s => s.rating).length > 0 
    ? Math.round(seasons.reduce((sum, s) => sum + (s.rating || 0), 0) / seasons.filter(s => s.rating).length)
    : null;

  // Get primary status (most recent or completed)
  const primaryStatus = seasons.find(s => s.status === "watching")?.status || 
                       seasons.find(s => s.status === "completed")?.status || 
                       seasons[0]?.status || "watching";

  return (
    <Card className="anime-card-hover border-border/50 gradient-card overflow-hidden group">
      <CardHeader className="p-0 relative">
        <div className="aspect-[3/4] bg-muted relative overflow-hidden">
          {coverImage ? (
            <img 
              src={coverImage} 
              alt={title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center gradient-hero">
              <span className="text-4xl sm:text-6xl opacity-20">📺</span>
            </div>
          )}
          <div className="absolute top-1 right-1 sm:top-2 sm:right-2 flex gap-1 sm:gap-2">
            <Badge className={`${statusColors[primaryStatus as keyof typeof statusColors]} text-[10px] sm:text-xs px-1 sm:px-2 py-0`}>
              {statusLabels[primaryStatus as keyof typeof statusLabels]}
            </Badge>
            <Badge variant="secondary" className="text-[10px] sm:text-xs px-1 sm:px-2 py-0">{seasons.length} S</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-3 space-y-2">
        <h3 className="font-bold text-sm sm:text-base line-clamp-2 text-foreground">{title}</h3>
        
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground text-xs sm:text-sm">
              {totalEpisodesWatched}{totalEpisodes > 0 ? `/${totalEpisodes}` : ""}
            </span>
          </div>
          {totalEpisodes > 0 && (
            <Progress value={overallProgress} className="h-1.5 sm:h-2 bg-muted" />
          )}
        </div>

        {avgRating && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm text-muted-foreground">Rating:</span>
            <div className="flex items-center gap-1">
              <span className="text-sm sm:text-base font-bold text-primary">⭐</span>
              <span className="font-semibold text-foreground text-xs sm:text-sm">{avgRating}/10</span>
            </div>
          </div>
        )}

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-xs sm:text-sm h-7 sm:h-9">
              {isOpen ? <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" /> : <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />}
              {isOpen ? "Hide" : "Show"} Seasons
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {seasons.sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => {
              const progress = season.totalEpisodes ? (season.episodesWatched / season.totalEpisodes) * 100 : 0;
              return (
                <div key={season.id} className="border border-border/50 rounded-lg p-2 sm:p-3 space-y-2 bg-card/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                      <span className="font-semibold text-foreground text-xs sm:text-base whitespace-nowrap">Season {season.seasonNumber}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(season.id)}
                        className="h-7 w-7 sm:h-7 sm:w-7 p-0 z-10 relative flex-shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(season.id)}
                        className="h-7 w-7 sm:h-7 sm:w-7 p-0 hover:bg-destructive/10 z-10 relative flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium text-foreground">
                        {season.episodesWatched}{season.totalEpisodes ? ` / ${season.totalEpisodes}` : ""} eps
                      </span>
                    </div>
                    {season.totalEpisodes && (
                      <Progress value={progress} className="h-1 bg-muted" />
                    )}
                  </div>
                  {season.rating && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-primary">⭐</span>
                      <span className="font-medium text-foreground">{season.rating}/10</span>
                    </div>
                  )}
                </div>
              );
            })}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
      <CardFooter className="p-2 sm:p-3 pt-0">
        <p className="text-[10px] sm:text-xs text-muted-foreground">Expand to edit seasons</p>
      </CardFooter>
    </Card>
  );
};

export default AnimeGroupCard;
