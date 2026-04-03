import { useState, useMemo, useRef, useEffect } from "react";
import { Search, Play, Loader2, Tv, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Film } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface Anime {
    id: string;
    title: string;
    episodesWatched: number;
    totalEpisodes: number | null;
    status: string;
    rating: number | null;
    coverImage: string | null;
    anilistId: number | null;
    malId: number | null;
}

interface WatchProps {
    animeList: Anime[];
}

function build2EmbedUrl(malId: number, episode: number): string {
    return `https://www.2embed.cc/embed/anime/${malId}/ep/${episode}`;
}

function EpisodeGrid({
    total,
    watched,
    selected,
    onSelect,
}: {
    total: number;
    watched: number;
    selected: number;
    onSelect: (ep: number) => void;
}) {
    const PER_PAGE = 50;
    const pages = Math.ceil(total / PER_PAGE);
    const currentPage = Math.ceil(selected / PER_PAGE);
    const [page, setPage] = useState(currentPage > 0 ? currentPage : 1);
    const start = (page - 1) * PER_PAGE + 1;
    const end = Math.min(page * PER_PAGE, total);

    return (
        <div className="space-y-3">
            {pages > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                p === page
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            }`}
                        >
                            {(p - 1) * PER_PAGE + 1}–{Math.min(p * PER_PAGE, total)}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 xl:grid-cols-20 gap-1.5">
                {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(ep => {
                    const isWatched = ep <= watched;
                    const isSelected = ep === selected;
                    return (
                        <button
                            key={ep}
                            onClick={() => onSelect(ep)}
                            data-testid={`button-episode-${ep}`}
                            className={`h-8 rounded-md text-xs font-semibold transition-all ${
                                isSelected
                                    ? "bg-primary text-primary-foreground shadow-neon"
                                    : isWatched
                                        ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
                                        : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/30"
                            }`}
                        >
                            {ep}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default function Watch({ animeList }: WatchProps) {
    const [search, setSearch] = useState("");
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [selectedEp, setSelectedEp] = useState(1);
    const [iframeLoading, setIframeLoading] = useState(false);
    const [iframeError, setIframeError] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const validAnime = useMemo(
        () => animeList.filter(a => a.malId),
        [animeList]
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return validAnime;
        const q = search.toLowerCase();
        return validAnime.filter(a => a.title.toLowerCase().includes(q));
    }, [search, validAnime]);

    const totalEps = selectedAnime?.totalEpisodes || 99;
    const embedUrl = selectedAnime?.malId
        ? build2EmbedUrl(selectedAnime.malId, selectedEp)
        : null;

    function selectAnime(anime: Anime) {
        setSelectedAnime(anime);
        setSelectedEp(Math.max(1, (anime.episodesWatched || 0)));
        setIframeError(false);
        setIframeLoading(true);
    }

    function handleEpSelect(ep: number) {
        setSelectedEp(ep);
        setIframeError(false);
        setIframeLoading(true);
    }

    useEffect(() => {
        if (selectedAnime) {
            setIframeLoading(true);
            setIframeError(false);
        }
    }, [embedUrl]);

    const noMalAnime = animeList.filter(a => !a.malId);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
                <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">
                    via 2embed · {validAnime.length} watchable
                </span>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Stream anime from your list. Only shows added via search (with MAL ID) are available.
            </p>

            {/* Player + Info */}
            {selectedAnime && embedUrl ? (
                <div className="space-y-4">
                    {/* Back + title */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAnime(null)}
                            className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground"
                            data-testid="button-back-to-list"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <h3 className="font-bold text-base truncate flex-1">{selectedAnime.title}</h3>
                        <Badge variant="outline" className="shrink-0 text-xs">
                            Ep {selectedEp}{selectedAnime.totalEpisodes ? ` / ${selectedAnime.totalEpisodes}` : ""}
                        </Badge>
                    </div>

                    {/* Video Player */}
                    <div className="relative rounded-xl overflow-hidden border border-border/50 bg-black aspect-video">
                        {iframeLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <p className="text-xs text-muted-foreground">Loading episode {selectedEp}…</p>
                            </div>
                        )}
                        {iframeError ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-6 text-center">
                                <AlertTriangle className="h-10 w-10 text-orange-400 opacity-70" />
                                <div>
                                    <p className="font-semibold text-foreground">Episode not available</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        This episode may not be on 2embed yet. Try a different episode or open externally.
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => window.open(embedUrl, "_blank")}
                                    className="gap-1.5"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" /> Open externally
                                </Button>
                            </div>
                        ) : (
                            <iframe
                                ref={iframeRef}
                                key={embedUrl}
                                src={embedUrl}
                                className="w-full h-full"
                                allowFullScreen
                                allow="autoplay; fullscreen; encrypted-media"
                                onLoad={() => setIframeLoading(false)}
                                onError={() => { setIframeLoading(false); setIframeError(true); }}
                                data-testid="iframe-player"
                            />
                        )}
                    </div>

                    {/* Episode Prev / Next */}
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedEp <= 1}
                            onClick={() => handleEpSelect(selectedEp - 1)}
                            className="gap-1.5"
                            data-testid="button-prev-episode"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">Episode {selectedEp}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedEp >= totalEps}
                            onClick={() => handleEpSelect(selectedEp + 1)}
                            className="gap-1.5"
                            data-testid="button-next-episode"
                        >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* Episode Grid */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episodes</p>
                        <EpisodeGrid
                            total={totalEps}
                            watched={selectedAnime.episodesWatched || 0}
                            selected={selectedEp}
                            onSelect={handleEpSelect}
                        />
                    </div>

                    {/* Note */}
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        Powered by 2embed.cc · Video streams belong to their respective sources.
                    </p>
                </div>
            ) : (
                <>
                    {/* Search */}
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search your list…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-10 rounded-xl border-border/50 bg-muted/30"
                            data-testid="input-watch-search"
                        />
                    </div>

                    {validAnime.length === 0 ? (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                                <Tv className="h-10 w-10 mb-1 opacity-20" />
                                <p className="font-medium">No watchable anime yet</p>
                                <p className="text-xs max-w-xs">
                                    Add anime via search (not manually) to get MAL IDs, which are required for streaming.
                                </p>
                            </CardContent>
                        </Card>
                    ) : filtered.length === 0 ? (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                                <Search className="h-8 w-8 mb-1 opacity-20" />
                                <p className="font-medium">No results for "{search}"</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {filtered.map(anime => {
                                const watched = anime.episodesWatched || 0;
                                const total = anime.totalEpisodes;
                                const pct = total ? Math.min(100, (watched / total) * 100) : 0;

                                return (
                                    <button
                                        key={anime.id}
                                        onClick={() => selectAnime(anime)}
                                        data-testid={`button-watch-anime-${anime.id}`}
                                        className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-primary/50 transition-all hover:shadow-neon text-left"
                                    >
                                        {/* Cover */}
                                        <div className="aspect-[3/4] overflow-hidden bg-muted/30 relative">
                                            {anime.coverImage ? (
                                                <img
                                                    src={anime.coverImage}
                                                    alt={anime.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <Tv className="w-8 h-8 opacity-20" />
                                                </div>
                                            )}
                                            {/* Play overlay */}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-neon">
                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                            {/* Status badge */}
                                            <div className="absolute top-1.5 left-1.5">
                                                <Badge className={`text-[9px] px-1.5 py-0 h-4 ${
                                                    anime.status === "watching"
                                                        ? "bg-primary/80 text-white"
                                                        : anime.status === "completed"
                                                            ? "bg-emerald-500/80 text-white"
                                                            : "bg-muted/80 text-muted-foreground"
                                                }`}>
                                                    {anime.status === "plan_to_watch" ? "PTW" : anime.status.replace("_", " ")}
                                                </Badge>
                                            </div>
                                        </div>
                                        {/* Info */}
                                        <div className="p-2 space-y-1">
                                            <p className="text-xs font-semibold line-clamp-2 leading-tight">{anime.title}</p>
                                            {total ? (
                                                <div className="space-y-0.5">
                                                    <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                                        <div
                                                            className="h-1 rounded-full bg-primary/60 transition-all"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-muted-foreground">{watched}/{total} ep</p>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground">{watched} ep watched</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Notice for anime without MAL ID */}
                    {noMalAnime.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/60 mt-2">
                            {noMalAnime.length} anime in your list {noMalAnime.length === 1 ? "was" : "were"} added manually without a MAL ID and can't be streamed.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
