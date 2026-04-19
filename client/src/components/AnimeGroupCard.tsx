import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, Star, Plus, Minus } from "lucide-react";
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
  onAddSeason?: (title: string) => void;
  onQuickEpisodeUpdate?: (id: string, newEpisodes: number) => void;
  readOnly?: boolean;
}

const statusConfig: Record<string, { label: string; dotClass: string; badgeClass: string }> = {
  watching:     { label: "Watching",      dotClass: "status-dot-watching",      badgeClass: "badge-watching" },
  completed:    { label: "Completed",     dotClass: "status-dot-completed",     badgeClass: "badge-completed" },
  plan_to_watch:{ label: "Plan to Watch", dotClass: "status-dot-plan_to_watch", badgeClass: "badge-plan_to_watch" },
  dropped:      { label: "Dropped",       dotClass: "status-dot-dropped",       badgeClass: "badge-dropped" },
  on_hold:      { label: "On Hold",       dotClass: "status-dot-on_hold",       badgeClass: "badge-on_hold" },
};

const statusNeonClass: Record<string, string> = {
  watching:      "neon-watching",
  completed:     "neon-completed",
  plan_to_watch: "neon-plan_to_watch",
  dropped:       "neon-dropped",
  on_hold:       "neon-on_hold",
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`w-2.5 h-2.5 ${i <= Math.round(rating / 2) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
      />
    ))}
    <span className="text-[10px] text-muted-foreground ml-1">{rating}/10</span>
  </div>
);

const AnimeGroupCard = ({
  title,
  coverImage,
  seasons,
  onEdit,
  onDelete,
  onAddSeason,
  onQuickEpisodeUpdate,
  readOnly = false,
}: AnimeGroupCardProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalEpisodesWatched = seasons.reduce((sum, s) => sum + s.episodesWatched, 0);
  const totalEpisodes = seasons.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
  const overallProgress = totalEpisodes > 0 ? (totalEpisodesWatched / totalEpisodes) * 100 : 0;
  const avgRating = seasons.filter(s => s.rating).length > 0
    ? Math.round(seasons.reduce((sum, s) => sum + (s.rating || 0), 0) / seasons.filter(s => s.rating).length)
    : null;

  const primaryStatus = seasons.find(s => s.status === "watching")?.status ||
    seasons.find(s => s.status === "completed")?.status ||
    seasons[0]?.status || "watching";

  const cfg = statusConfig[primaryStatus] || statusConfig.watching;
  const neon = statusNeonClass[primaryStatus] || "";

  const handleEpisodeChange = async (season: Season, delta: number) => {
    if (!onQuickEpisodeUpdate) return;
    const newEps = Math.max(0, season.episodesWatched + delta);
    if (season.totalEpisodes !== null && newEps > season.totalEpisodes) return;
    setUpdatingId(season.id);
    await onQuickEpisodeUpdate(season.id, newEps);
    setUpdatingId(null);
  };

  return (
    <div className={`group relative flex flex-col rounded-none overflow-hidden border border-primary/35 bg-card transition-all duration-400 cursor-default perspective-1000 card-3d-hover deco-corners ${neon}`}>

      {/* ── Cover art ── */}
      <div className="aspect-[3/4] relative overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center gradient-hero">
            <span className="text-5xl opacity-10">📺</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 poster-overlay" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 z-10">
            <span className={`inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-none font-semibold backdrop-blur-sm border border-primary/45 ${cfg.badgeClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
            {cfg.label}
          </span>
          {seasons.length > 1 && (
            <span className="text-[9px] sm:text-[10px] px-2 py-0.5 rounded-none font-bold bg-black/60 text-white/80 backdrop-blur-sm border border-primary/45">
              {seasons.length}S
            </span>
          )}
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-2.5 sm:p-3">
          <h3 className="font-bold text-[11px] sm:text-sm text-white leading-tight line-clamp-2 drop-shadow-lg mb-1.5">
            {title}
          </h3>

          {avgRating && <StarRating rating={avgRating} />}

          {totalEpisodes > 0 && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[9px] text-white/60 mb-1">
                <span>{totalEpisodesWatched} ep watched</span>
                <span>{Math.round(overallProgress)}%</span>
              </div>
              <div className="w-full h-0.5 sm:h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${overallProgress}%`,
                    background: 'var(--gradient-primary)',
                    boxShadow: '0 0 6px hsl(var(--primary) / 0.55)',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable seasons ── */}
      <div className="bg-card/95 backdrop-blur-sm border-t border-primary/25">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center border-t border-border/30">
            <CollapsibleTrigger asChild>
              <button className="flex-1 flex items-center justify-between px-3 py-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors">
                <span className="font-medium">{isOpen ? "Hide" : "View"} {seasons.length === 1 ? "Season" : `${seasons.length} Seasons`}</span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </CollapsibleTrigger>
            {!readOnly && onAddSeason && (
              <button
                title="Add another season"
                className="flex items-center gap-0.5 text-[9px] sm:text-[10px] px-2.5 py-2 border-l border-primary/30 text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors font-semibold"
                onClick={(e) => { e.stopPropagation(); onAddSeason(title); }}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>S</span>
              </button>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-t border-border/20 divide-y divide-border/20">
              {seasons.sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => {
                const prog = season.totalEpisodes ? (season.episodesWatched / season.totalEpisodes) * 100 : 0;
                const sCfg = statusConfig[season.status] || statusConfig.watching;
                const isUpdating = updatingId === season.id;
                const canIncrement = season.totalEpisodes === null || season.episodesWatched < season.totalEpisodes;
                const canDecrement = season.episodesWatched > 0;

                return (
                  <div key={season.id} className="px-3 py-2.5 space-y-2 hover:bg-muted/20 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sCfg.dotClass}`} />
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">S{season.seasonNumber}</span>
                        <span className={`text-[9px] px-1.5 py-0 rounded-full font-medium ${sCfg.badgeClass}`}>{sCfg.label}</span>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(season.id)}
                            className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary rounded-none">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(season.id)}
                            className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive rounded-none">
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {!readOnly && onQuickEpisodeUpdate && (
                            <button
                              disabled={!canDecrement || isUpdating}
                              onClick={() => handleEpisodeChange(season, -1)}
                            className="w-4 h-4 rounded-none flex items-center justify-center hover:bg-muted/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-muted-foreground hover:text-foreground"
                              title="Remove episode"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                          )}
                          <span className={isUpdating ? "opacity-50" : ""}>
                            {season.episodesWatched}{season.totalEpisodes ? ` / ${season.totalEpisodes}` : ""} eps
                          </span>
                          {!readOnly && onQuickEpisodeUpdate && (
                            <button
                              disabled={!canIncrement || isUpdating}
                              onClick={() => handleEpisodeChange(season, 1)}
                            className="w-4 h-4 rounded-none flex items-center justify-center hover:bg-primary/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-primary/70 hover:text-primary"
                              title="Add episode"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        {season.rating && (
                          <span className="flex items-center gap-0.5 text-amber-400">
                            <Star className="w-2.5 h-2.5 fill-amber-400" /> {season.rating}/10
                          </span>
                        )}
                      </div>
                      {season.totalEpisodes && (
                        <div className="w-full h-0.5 rounded-full bg-muted/50 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300" style={{
                            width: `${prog}%`,
                            background: 'var(--gradient-primary)',
                          }} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export default AnimeGroupCard;
