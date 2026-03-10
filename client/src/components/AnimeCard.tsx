import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, CheckCircle2 } from "lucide-react";

interface AnimeCardProps {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  coverImage: string | null;
  seasonNumber: number;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
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

const AnimeCard = ({
  id,
  title,
  episodesWatched,
  totalEpisodes,
  status,
  rating,
  coverImage,
  seasonNumber,
  onEdit,
  onDelete,
  onStatusChange,
}: AnimeCardProps) => {
  const progress = totalEpisodes ? (episodesWatched / totalEpisodes) * 100 : 0;

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
              <span className="text-6xl opacity-20">📺</span>
            </div>
          )}
          <div className="absolute top-2 right-2">
            <Badge className={statusColors[status as keyof typeof statusColors]}>
              {statusLabels[status as keyof typeof statusLabels]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg line-clamp-2 text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">Season {seasonNumber}</p>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-semibold text-foreground">
              {episodesWatched}{totalEpisodes ? ` / ${totalEpisodes}` : ""} eps
            </span>
          </div>
          {totalEpisodes && (
            <Progress value={progress} className="h-2 bg-muted" />
          )}
        </div>

        {rating && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rating:</span>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-primary">⭐</span>
              <span className="font-semibold text-foreground">{rating}/10</span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="p-4 pt-0 gap-2">
        {status !== "completed" && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange(id, "completed")}
            className="flex-1 border-primary/50 hover:bg-primary hover:text-primary-foreground transition-smooth"
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Complete
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(id)}
          className="flex-1 hover:bg-accent transition-smooth"
        >
          <Pencil className="w-4 h-4 mr-1" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(id)}
          className="border-destructive/50 hover:bg-destructive hover:text-destructive-foreground transition-smooth"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AnimeCard;
