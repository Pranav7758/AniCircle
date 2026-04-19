import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Pencil, Trash2, CheckCircle2, Star } from "lucide-react";

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

const statusConfig = {
  watching: {
    label: "Watching",
    dot: "status-dot-watching",
    border: "neon-watching",
    badge: "badge-watching",
  },
  completed: {
    label: "Completed",
    dot: "status-dot-completed",
    border: "neon-completed",
    badge: "badge-completed",
  },
  plan_to_watch: {
    label: "Plan to Watch",
    dot: "status-dot-plan_to_watch",
    border: "neon-plan_to_watch",
    badge: "badge-plan_to_watch",
  },
  dropped: {
    label: "Dropped",
    dot: "status-dot-dropped",
    border: "neon-dropped",
    badge: "badge-dropped",
  },
  on_hold: {
    label: "On Hold",
    dot: "status-dot-on_hold",
    border: "neon-on_hold",
    badge: "badge-on_hold",
  },
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
  const [isHovered, setIsHovered] = useState(false);
  const progress = totalEpisodes ? (episodesWatched / totalEpisodes) * 100 : 0;
  const cfg = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.plan_to_watch;

  return (
    <div
      data-testid={`card-anime-${id}`}
      className={`relative flex flex-col rounded-none overflow-hidden border bg-card cursor-pointer select-none
        transition-all duration-300 group
        ${isHovered ? `${cfg.border} -translate-y-1 scale-[1.02] z-10` : "border-border/40"}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── Poster image ── */}
      <div className="aspect-[3/4] relative overflow-hidden bg-muted">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-500 ${isHovered ? "scale-110" : "scale-100"}`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-card">
            <span className="text-5xl opacity-20">📺</span>
          </div>
        )}

        {/* Gradient overlay — always visible at bottom */}
        <div className="poster-overlay absolute inset-0" />

        {/* Status badge — top left */}
        <div className="absolute top-2 left-2 z-10">
          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-none ${cfg.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
            {cfg.label}
          </span>
        </div>

        {/* Rating — top right */}
        {rating && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 bg-black/60 backdrop-blur-sm border border-primary/30 rounded-none px-1.5 py-0.5">
            <Star className="w-2.5 h-2.5 text-primary fill-primary" />
            <span className="text-[10px] font-bold text-primary">{rating}</span>
          </div>
        )}

        {/* Action buttons — reveal on hover */}
        <div className={`absolute inset-0 z-20 flex items-center justify-center gap-2 transition-opacity duration-200 bg-black/50 backdrop-blur-[2px] ${isHovered ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
          {status !== "completed" && (
            <button
              data-testid={`button-complete-${id}`}
              onClick={(e) => { e.stopPropagation(); onStatusChange(id, "completed"); }}
              title="Mark completed"
              className="w-9 h-9 rounded-none bg-emerald-500/90 hover:bg-emerald-400 border border-emerald-400/60 flex items-center justify-center transition-colors"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
            </button>
          )}
          <button
            data-testid={`button-edit-${id}`}
            onClick={(e) => { e.stopPropagation(); onEdit(id); }}
            title="Edit"
            className="w-9 h-9 rounded-none bg-primary/90 hover:bg-primary border border-primary/60 flex items-center justify-center transition-colors"
          >
            <Pencil className="w-4 h-4 text-black" />
          </button>
          <button
            data-testid={`button-delete-${id}`}
            onClick={(e) => { e.stopPropagation(); onDelete(id); }}
            title="Delete"
            className="w-9 h-9 rounded-none bg-destructive/90 hover:bg-destructive border border-destructive/60 flex items-center justify-center transition-colors"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pb-2.5 pt-6">
          <h3 className="text-[12px] font-bold leading-tight line-clamp-2 text-white drop-shadow-lg mb-1.5">{title}</h3>

          {/* Progress bar */}
          <div className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-white/60 uppercase tracking-wider">
                {seasonNumber > 1 ? `S${seasonNumber} · ` : ""}{episodesWatched}{totalEpisodes ? `/${totalEpisodes}` : ""} eps
              </span>
              {totalEpisodes && (
                <span className="text-[9px] text-white/60">{Math.round(progress)}%</span>
              )}
            </div>
            {totalEpisodes ? (
              <div className="h-0.5 w-full bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: status === "completed"
                      ? "hsl(142 70% 50%)"
                      : status === "watching"
                      ? "hsl(268 88% 62%)"
                      : "hsl(var(--primary))",
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimeCard;
