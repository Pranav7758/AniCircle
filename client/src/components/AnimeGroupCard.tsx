import { Button } from "@/components/ui/button";
import { Pencil, Trash2, ChevronDown, ChevronUp, Star, Plus, Minus, Play, CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";
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

const statusConfig: Record<string, {
  label: string;
  icon: typeof Play;
  solidBg: string;
  textColor: string;
  glowColor: string;
  stripColor: string;
  dotClass: string;
  badgeClass: string;
}> = {
  watching:     { label: "Watching",      icon: Play,         solidBg: "rgba(88,28,220,0.93)",  textColor: "#c4b5fd", glowColor: "rgba(124,58,237,0.55)", stripColor: "#7c3aed", dotClass: "status-dot-watching",      badgeClass: "badge-watching" },
  completed:    { label: "Completed",     icon: CheckCircle2, solidBg: "rgba(4,120,87,0.93)",   textColor: "#6ee7b7", glowColor: "rgba(16,185,129,0.55)", stripColor: "#059669", dotClass: "status-dot-completed",     badgeClass: "badge-completed" },
  plan_to_watch:{ label: "Plan to Watch", icon: Clock,        solidBg: "rgba(29,78,216,0.93)",  textColor: "#93c5fd", glowColor: "rgba(59,130,246,0.55)", stripColor: "#1d4ed8", dotClass: "status-dot-plan_to_watch", badgeClass: "badge-plan_to_watch" },
  dropped:      { label: "Dropped",       icon: XCircle,      solidBg: "rgba(153,27,27,0.93)",  textColor: "#fca5a5", glowColor: "rgba(239,68,68,0.55)",  stripColor: "#b91c1c", dotClass: "status-dot-dropped",       badgeClass: "badge-dropped" },
  on_hold:      { label: "On Hold",       icon: PauseCircle,  solidBg: "rgba(146,64,14,0.93)",  textColor: "#fcd34d", glowColor: "rgba(245,158,11,0.55)", stripColor: "#b45309", dotClass: "status-dot-on_hold",       badgeClass: "badge-on_hold" },
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        className={`w-2.5 h-2.5 ${i <= Math.round(rating / 2) ? "text-amber-400 fill-amber-400" : "text-white/20"}`}
      />
    ))}
    <span className="text-[10px] text-white/50 ml-1 font-mono">{rating}/10</span>
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
  const StatusIcon = cfg.icon;

  const handleEpisodeChange = async (season: Season, delta: number) => {
    if (!onQuickEpisodeUpdate) return;
    const newEps = Math.max(0, season.episodesWatched + delta);
    if (season.totalEpisodes !== null && newEps > season.totalEpisodes) return;
    setUpdatingId(season.id);
    await onQuickEpisodeUpdate(season.id, newEps);
    setUpdatingId(null);
  };

  return (
    <div
      className="group relative flex flex-col rounded-none overflow-hidden bg-card transition-all duration-300 cursor-default card-3d-hover"
      style={{
        borderLeft: `3px solid ${cfg.stripColor}`,
        border: `1px solid rgba(255,255,255,0.08)`,
        borderLeftColor: cfg.stripColor,
        borderLeftWidth: '3px',
        boxShadow: `0 4px 20px rgba(0,0,0,0.5), -2px 0 16px ${cfg.glowColor}`,
      }}
    >
      {/* ── Cover art ── */}
      <div className="aspect-[3/4] relative overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            <span className="text-5xl opacity-10">📺</span>
          </div>
        )}

        {/* Strong gradient overlay — always readable */}
        <div className="absolute inset-0"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.0) 0%, rgba(0,0,0,0.0) 35%, rgba(0,0,0,0.6) 62%, rgba(0,0,0,0.92) 100%)"
          }}
        />

        {/* Top-left status badge — solid, high contrast, always readable */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 z-10">
          <span
            className="inline-flex items-center gap-1.5 text-[9px] sm:text-[10px] px-2 py-1 font-bold tracking-wide rounded-none"
            style={{
              background: cfg.solidBg,
              color: cfg.textColor,
              boxShadow: `0 2px 10px ${cfg.glowColor}, inset 0 1px 0 rgba(255,255,255,0.12)`,
              backdropFilter: 'blur(6px)',
            }}
          >
            <StatusIcon className="w-2.5 h-2.5 shrink-0" />
            {cfg.label}
          </span>
          {seasons.length > 1 && (
            <span className="text-[9px] sm:text-[10px] px-2 py-1 font-bold bg-black/80 text-white/90 backdrop-blur-sm border border-white/15">
              {seasons.length}S
            </span>
          )}
        </div>

        {/* Hover overlay — edit/delete quick actions */}
        {!readOnly && (
          <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30">
            <button
              onClick={() => onEdit(seasons[0].id)}
              className="w-9 h-9 flex items-center justify-center bg-black/70 border border-white/20 text-white/80 hover:text-white hover:border-white/50 transition-all backdrop-blur-sm"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(seasons[0].id)}
              className="w-9 h-9 flex items-center justify-center bg-black/70 border border-red-500/30 text-red-400/80 hover:text-red-400 hover:border-red-500/70 transition-all backdrop-blur-sm"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-2.5 pt-4 pb-2.5">
          <h3 className="font-bold text-[11px] sm:text-sm text-white leading-tight line-clamp-2 mb-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {title}
          </h3>

          {avgRating && <StarRating rating={avgRating} />}

          {totalEpisodes > 0 && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[9px] text-white/50 mb-1">
                <span>{totalEpisodesWatched}/{totalEpisodes} ep</span>
                <span style={{ color: cfg.textColor }}>{Math.round(overallProgress)}%</span>
              </div>
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${overallProgress}%`,
                    background: `linear-gradient(90deg, ${cfg.stripColor}, ${cfg.textColor})`,
                    boxShadow: `0 0 6px ${cfg.glowColor}`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Expandable seasons section ── */}
      <div className="bg-[#0d0d0d]/95 border-t" style={{ borderColor: `${cfg.stripColor}33` }}>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center">
            <CollapsibleTrigger asChild>
              <button className="flex-1 flex items-center justify-between px-3 py-2 text-[10px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ background: isOpen ? `${cfg.stripColor}10` : undefined }}
              >
                <span className="font-semibold tracking-wide uppercase" style={{ color: cfg.textColor, opacity: 0.8 }}>
                  {seasons.length === 1 ? "Season 1" : `${seasons.length} Seasons`}
                </span>
                {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </CollapsibleTrigger>
            {!readOnly && onAddSeason && (
              <button
                title="Add another season"
                className="flex items-center gap-0.5 text-[9px] sm:text-[10px] px-2.5 py-2 text-muted-foreground hover:text-primary transition-colors font-semibold border-l"
                style={{ borderColor: `${cfg.stripColor}33` }}
                onClick={(e) => { e.stopPropagation(); onAddSeason(title); }}
              >
                <Plus className="w-2.5 h-2.5" />
                <span>S</span>
              </button>
            )}
          </div>

          <CollapsibleContent>
            <div className="border-t divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)', }}>
              {seasons.sort((a, b) => a.seasonNumber - b.seasonNumber).map((season) => {
                const prog = season.totalEpisodes ? (season.episodesWatched / season.totalEpisodes) * 100 : 0;
                const sCfg = statusConfig[season.status] || statusConfig.watching;
                const SIcon = sCfg.icon;
                const isUpdating = updatingId === season.id;
                const canIncrement = season.totalEpisodes === null || season.episodesWatched < season.totalEpisodes;
                const canDecrement = season.episodesWatched > 0;

                return (
                  <div key={season.id} className="px-3 py-2.5 space-y-2 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Season number chip */}
                        <span className="text-[9px] font-black text-muted-foreground/50 bg-white/5 px-1.5 py-0.5 tracking-wider">
                          S{season.seasonNumber}
                        </span>
                        {/* Status mini-badge */}
                        <span
                          className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 font-bold rounded-none"
                          style={{ background: sCfg.solidBg, color: sCfg.textColor }}
                        >
                          <SIcon className="w-2 h-2 shrink-0" />
                          {sCfg.label}
                        </span>
                      </div>
                      {!readOnly && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(season.id)}
                            className="h-6 w-6 p-0 hover:bg-primary/10 hover:text-primary rounded-none">
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onDelete(season.id)}
                            className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-400 rounded-none">
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
                          <span className={`font-mono text-[10px] ${isUpdating ? "opacity-50" : "text-foreground/70"}`}>
                            {season.episodesWatched}{season.totalEpisodes ? `/${season.totalEpisodes}` : ""} <span className="text-muted-foreground/40">ep</span>
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
                        <div className="w-full h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${prog}%`,
                            background: `linear-gradient(90deg, ${sCfg.stripColor}, ${sCfg.textColor})`,
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
