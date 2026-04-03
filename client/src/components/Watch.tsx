import { useState, useMemo, useRef, useCallback } from "react";
import { Search, Play, Loader2, Tv, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Film, RefreshCw, Subtitles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

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

interface Source {
    url: string;
    sourceName: string;
    priority: number;
}

interface WatchProps {
    animeList: Anime[];
}

// Friendly display names for sources
const SOURCE_LABELS: Record<string, string> = {
    "Vid-mp4": "VidStream",
    "Ss-Hls": "StreamSB",
    "Ok": "OK.ru",
    "Mp4": "MP4Upload",
    "Default": "Primary",
    "Ak": "Secondary",
    "S-mp4": "Backup",
    "Luf-Mp4": "LufMP4",
};

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
    const PER_PAGE = 60;
    const pages = Math.ceil(total / PER_PAGE);
    const initPage = Math.ceil(selected / PER_PAGE) || 1;
    const [page, setPage] = useState(initPage);
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
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                            }`}
                        >
                            {(p - 1) * PER_PAGE + 1}–{Math.min(p * PER_PAGE, total)}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 xl:grid-cols-20 gap-1.5">
                {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(ep => {
                    const isWatched = ep <= watched;
                    const isSelected = ep === selected;
                    return (
                        <button
                            key={ep}
                            onClick={() => onSelect(ep)}
                            data-testid={`button-episode-${ep}`}
                            title={`Episode ${ep}${isWatched ? " (watched)" : ""}`}
                            className={`h-8 rounded-md text-xs font-semibold transition-all ${
                                isSelected
                                    ? "bg-primary text-primary-foreground shadow-neon ring-2 ring-primary/30"
                                    : isWatched
                                        ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
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

function VideoPlayer({
    anime,
    episode,
    langType,
}: {
    anime: Anime;
    episode: number;
    langType: "sub" | "dub";
}) {
    const [sourceIndex, setSourceIndex] = useState(0);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const { data, isLoading, error, refetch } = useQuery<{ sources: Source[]; showName: string }>({
        queryKey: ["/api/watch/sources", anime.malId, anime.title, episode, langType],
        queryFn: async () => {
            const params = new URLSearchParams({
                title: anime.title,
                episode: String(episode),
                type: langType,
                ...(anime.malId ? { malId: String(anime.malId) } : {}),
            });
            const res = await fetch(`/api/watch/sources?${params}`);
            if (!res.ok) throw new Error("Failed to fetch sources");
            return res.json();
        },
        staleTime: 10 * 60 * 1000,
        retry: 1,
    });

    // Reset source index when episode/type changes
    const sources = data?.sources || [];
    const currentSource = sources[sourceIndex];

    if (isLoading) {
        return (
            <div className="aspect-video rounded-xl border border-border/50 bg-black flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Finding episode sources…</p>
            </div>
        );
    }

    if (error || sources.length === 0) {
        return (
            <div className="aspect-video rounded-xl border border-orange-500/20 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-orange-400 opacity-70" />
                <div>
                    <p className="font-semibold text-foreground">No sources found</p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        {langType === "dub" ? "Dub may not be available — try Sub instead." : "This episode might not be available on AllAnime yet."}
                    </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Player */}
            <div className="relative rounded-xl overflow-hidden border border-border/50 bg-black aspect-video">
                <iframe
                    ref={iframeRef}
                    key={currentSource.url}
                    src={currentSource.url}
                    className="w-full h-full"
                    allowFullScreen
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    data-testid="iframe-player"
                />
            </div>

            {/* Source switcher */}
            {sources.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-muted-foreground font-medium shrink-0">Sources:</span>
                    {sources.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setSourceIndex(i)}
                            data-testid={`button-source-${i}`}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                                i === sourceIndex
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 border border-border/30"
                            }`}
                        >
                            {SOURCE_LABELS[s.sourceName] || s.sourceName}
                        </button>
                    ))}
                    <a
                        href={currentSource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto text-[11px] text-muted-foreground/60 hover:text-muted-foreground flex items-center gap-1"
                    >
                        <ExternalLink className="w-3 h-3" /> Open tab
                    </a>
                </div>
            )}

            {data?.showName && data.showName !== anime.title && (
                <p className="text-[11px] text-muted-foreground/60">
                    Matched as: <span className="text-muted-foreground">{data.showName}</span> on AllAnime
                </p>
            )}
        </div>
    );
}

export default function Watch({ animeList }: WatchProps) {
    const [search, setSearch] = useState("");
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [selectedEp, setSelectedEp] = useState(1);
    const [langType, setLangType] = useState<"sub" | "dub">("sub");

    // All anime are searchable (even without malId — we search by title on AllAnime)
    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return animeList;
        return animeList.filter(a => a.title.toLowerCase().includes(q));
    }, [search, animeList]);

    const selectAnime = useCallback((anime: Anime) => {
        setSelectedAnime(anime);
        const startEp = Math.max(1, anime.episodesWatched || 0);
        setSelectedEp(startEp > (anime.totalEpisodes || 9999) ? 1 : startEp);
        setLangType("sub");
    }, []);

    const totalEps = selectedAnime?.totalEpisodes || 999;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
                <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">
                    via AllAnime · {animeList.length} titles
                </span>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Stream anime from your list directly in the browser.
            </p>

            {selectedAnime ? (
                <div className="space-y-4">
                    {/* Back + title bar */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAnime(null)}
                            className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground shrink-0"
                            data-testid="button-back-to-list"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <h3 className="font-bold text-base truncate flex-1 min-w-0">{selectedAnime.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <button
                                onClick={() => setLangType("sub")}
                                data-testid="button-type-sub"
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    langType === "sub" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                                }`}
                            >
                                SUB
                            </button>
                            <button
                                onClick={() => setLangType("dub")}
                                data-testid="button-type-dub"
                                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                                    langType === "dub" ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"
                                }`}
                            >
                                DUB
                            </button>
                        </div>
                    </div>

                    {/* Video Player */}
                    <VideoPlayer anime={selectedAnime} episode={selectedEp} langType={langType} />

                    {/* Prev / Next */}
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedEp <= 1}
                            onClick={() => setSelectedEp(e => e - 1)}
                            className="gap-1.5"
                            data-testid="button-prev-episode"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </Button>
                        <span className="text-sm text-muted-foreground font-medium">Episode {selectedEp}</span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={selectedEp >= totalEps}
                            onClick={() => setSelectedEp(e => e + 1)}
                            className="gap-1.5"
                            data-testid="button-next-episode"
                        >
                            Next <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                    </div>

                    {/* Episode grid */}
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episodes</p>
                        <EpisodeGrid
                            total={totalEps}
                            watched={selectedAnime.episodesWatched || 0}
                            selected={selectedEp}
                            onSelect={setSelectedEp}
                        />
                    </div>

                    <p className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
                        <Subtitles className="w-3 h-3" />
                        Powered by AllAnime · Content belongs to respective rights holders.
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

                    {animeList.length === 0 ? (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                                <Tv className="h-10 w-10 mb-1 opacity-20" />
                                <p className="font-medium">No anime in your list yet</p>
                                <p className="text-xs">Add some anime first, then come back here to watch.</p>
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
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-neon">
                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
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
                                        <div className="p-2 space-y-1">
                                            <p className="text-xs font-semibold line-clamp-2 leading-tight">{anime.title}</p>
                                            {total ? (
                                                <div className="space-y-0.5">
                                                    <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                                                        <div className="h-1 rounded-full bg-primary/60 transition-all" style={{ width: `${pct}%` }} />
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
                </>
            )}
        </div>
    );
}
