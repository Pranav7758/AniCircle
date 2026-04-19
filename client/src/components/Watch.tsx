import { useState, useMemo, useEffect, useCallback } from "react";
import {
    Search, Play, Loader2, Tv, ChevronLeft, ChevronRight, Film,
    RefreshCw, AlertTriangle, Wifi,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    fetchAniwatchSearch,
    fetchAniwatchEpisodes,
    fetchAniwatchMegaplay,
    type AniwatchEpisode,
    type AniwatchSearchItem,
    type MegaplayResponse,
} from "@/services/aniwatchApi";

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface SearchResult {
    id: string;
    title: string;
    url: string;
    image: string;
}

// ── Player (scraper megaplay embeds) ──────────────────────────────────────────

function WatchPlayer({
    episodes,
    selectedEpId,
    onEpIdChange,
    lang,
    watched,
    onChangeSource,
}: {
    episodes: AniwatchEpisode[];
    selectedEpId: string | null;
    onEpIdChange: (id: string) => void;
    lang: "sub" | "dub";
    watched: number;
    onChangeSource: () => void;
}) {
    const [megaplay, setMegaplay] = useState<MegaplayResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");
    const [retryTick, setRetryTick] = useState(0);

    useEffect(() => {
        if (!selectedEpId) return;
        let cancelled = false;
        setLoading(true);
        setErr("");
        setMegaplay(null);
        fetchAniwatchMegaplay(selectedEpId)
            .then((mp) => {
                if (!cancelled) setMegaplay(mp);
            })
            .catch((e: Error) => {
                if (!cancelled) setErr(e?.message || "Failed to load player");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [selectedEpId, retryTick]);

    const idx = episodes.findIndex((e) => e.ep_id === selectedEpId);
    const goPrev = () => { if (idx > 0) onEpIdChange(episodes[idx - 1].ep_id); };
    const goNext = () => { if (idx >= 0 && idx < episodes.length - 1) onEpIdChange(episodes[idx + 1].ep_id); };

    const iframeSrc = (() => {
        if (!megaplay) return null;
        if (lang === "dub") {
            return megaplay.dub || megaplay.sub || megaplay.raw || null;
        }
        return megaplay.sub || megaplay.dub || megaplay.raw || null;
    })();

    const epLabel = idx >= 0 ? episodes[idx].number : "—";
    const totalEps = episodes.length;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={idx <= 0}
                    onClick={goPrev} className="gap-1.5 h-8" data-testid="button-aniw-prev-ep">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-sm font-semibold">Episode {epLabel}</span>
                <Button variant="outline" size="sm" disabled={idx < 0 || idx >= totalEps - 1}
                    onClick={goNext} className="gap-1.5 h-8" data-testid="button-aniw-next-ep">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>

            {loading && (
                <div className="aspect-video rounded-xl border border-border/40 bg-black flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading embed…</p>
                </div>
            )}

            {!loading && err && (
                <div className="aspect-video rounded-xl border border-orange-500/20 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-400 opacity-60" />
                    <p className="text-sm text-muted-foreground">{err}</p>
                    <Button size="sm" variant="outline" onClick={() => setRetryTick((t) => t + 1)} disabled={!selectedEpId}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                    </Button>
                </div>
            )}

            {!loading && !err && iframeSrc && (
                <div className="aspect-video rounded-xl overflow-hidden border border-border/40 bg-black">
                    <iframe
                        key={`${selectedEpId}-${lang}`}
                        src={iframeSrc}
                        className="w-full h-full"
                        allowFullScreen
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                        title={`Episode ${epLabel}`}
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </div>
            )}

            {!loading && !err && megaplay && !iframeSrc && (
                <div className="aspect-video rounded-xl border border-border/40 bg-muted/20 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    No embed URL for this language. Try SUB/DUB or another episode.
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episodes</p>
                    <button
                        type="button"
                        onClick={onChangeSource}
                        className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                        data-testid="button-change-source"
                    >
                        Back to search
                    </button>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-border/30 bg-muted/10 divide-y divide-border/20">
                    {episodes.map((ep) => {
                        const num = parseInt(ep.number, 10);
                        const isWatched = Number.isFinite(num) && num > 0 && watched > 0 && num <= watched;
                        const isSel = ep.ep_id === selectedEpId;
                        return (
                            <button
                                key={ep.ep_id}
                                type="button"
                                onClick={() => onEpIdChange(ep.ep_id)}
                                data-testid={`button-aniw-ep-${ep.ep_id}`}
                                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all hover:bg-muted/40 ${
                                    isSel
                                        ? "bg-primary/15 border-l-2 border-primary text-primary font-semibold"
                                        : isWatched
                                            ? "text-muted-foreground/70"
                                            : "text-foreground"
                                }`}
                            >
                                <span className={`text-xs font-mono w-8 shrink-0 ${isSel ? "text-primary" : "text-muted-foreground/60"}`}>
                                    {ep.number}
                                </span>
                                <span className="flex-1 truncate">{ep.title || `Episode ${ep.number}`}</span>
                                {isWatched && !isSel && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Streams via Aniwatch API embeds · URL from ANIWATCH_SCRAPER_URL / VITE_ANIWATCH_API_BASE at build · Content belongs to respective rights holders.
            </p>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function Watch({ animeList }: { animeList: Anime[] }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selected, setSelected] = useState<SearchResult | null>(null);
    const [episodes, setEpisodes] = useState<AniwatchEpisode[]>([]);
    const [epLoading, setEpLoading] = useState(false);
    const [selectedEpId, setSelectedEpId] = useState<string | null>(null);
    const [lang, setLang] = useState<"sub" | "dub">("sub");

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setSearching(true);
        setSearched(false);
        try {
            const aw = await fetchAniwatchSearch(q.trim());
            const found = (aw.results || []).map((r: AniwatchSearchItem) => ({
                id: r.anime_id,
                title: r.title,
                url: "",
                image: r.image || "",
            }));
            setResults(found);
        } catch {
            setResults([]);
        }
        setSearching(false);
        setSearched(true);
    }, []);

    const selectShow = async (result: SearchResult) => {
        setSelected(result);
        setLang("sub");
        setEpisodes([]);
        setSelectedEpId(null);
        setEpLoading(true);
        try {
            const data = await fetchAniwatchEpisodes(result.id);
            const eps = data.episodes || [];
            setEpisodes(eps);
            if (eps.length > 0) setSelectedEpId(eps[0].ep_id);
        } catch { /* empty */ }
        setEpLoading(false);
    };

    const goBack = () => {
        setSelected(null);
        setEpisodes([]);
        setSelectedEpId(null);
        setLang("sub");
    };

    const listAnime = useMemo(() => {
        if (!selected) return null;
        const t = selected.title.toLowerCase();
        return animeList.find(a =>
            a.title.toLowerCase() === t ||
            t.includes(a.title.toLowerCase()) ||
            a.title.toLowerCase().includes(t)
        ) || null;
    }, [selected, animeList]);

    const epCount = episodes.length;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Search titles via the Aniwatch scraper API, then pick an episode (SUB/DUB embeds).
            </p>

            {selected ? (
                <div className="space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={goBack}
                            className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground shrink-0"
                            data-testid="button-back-to-list">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">{selected.title}</h3>
                            {epLoading && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading episodes…
                                </p>
                            )}
                            {!epLoading && epCount > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                    {epCount} episodes
                                </p>
                            )}
                            {!epLoading && epCount === 0 && (
                                <p className="text-[11px] text-muted-foreground">No episodes returned for this show.</p>
                            )}
                        </div>

                        <div className="flex items-center shrink-0 rounded-lg border border-border/50 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => { if (lang !== "sub") setLang("sub"); }}
                                data-testid="button-type-sub"
                                className={`px-3 py-1.5 text-xs font-semibold transition-all ${lang === "sub" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                                SUB
                            </button>
                            <div className="w-px h-4 bg-border/50" />
                            <button
                                type="button"
                                onClick={() => { if (lang !== "dub") setLang("dub"); }}
                                data-testid="button-type-dub"
                                className={`px-3 py-1.5 text-xs font-semibold transition-all ${lang === "dub" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                                DUB
                            </button>
                        </div>
                    </div>

                    {epCount > 0 && (
                        <WatchPlayer
                            key={`${selected.id}-${lang}-${selectedEpId ?? ""}`}
                            episodes={episodes}
                            selectedEpId={selectedEpId}
                            onEpIdChange={setSelectedEpId}
                            lang={lang}
                            watched={listAnime?.episodesWatched || 0}
                            onChangeSource={goBack}
                        />
                    )}
                </div>
            ) : (
                <>
                    <div className="flex gap-2 max-w-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search anime…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && doSearch(search)}
                                className="pl-9 h-10 rounded-xl border-border/50 bg-muted/30"
                                data-testid="input-watch-search"
                            />
                        </div>
                        <Button variant="outline" onClick={() => doSearch(search)}
                            disabled={searching || !search.trim()}
                            className="h-10 px-3 shrink-0" data-testid="button-watch-search">
                            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>

                    {!searched && !searching && (
                        <p className="text-xs text-muted-foreground/50 text-center pt-2">
                            Uses your Aniwatch scraper URL from build config (<code className="text-[10px]">ANIWATCH_SCRAPER_URL</code> on Vercel, or <code className="text-[10px]">VITE_ANIWATCH_API_BASE</code> locally).
                        </p>
                    )}
                    {searching && <p className="text-xs text-muted-foreground py-1">Searching…</p>}
                    {searched && !searching && results.length === 0 && (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                                <Search className="h-8 w-8 mb-1 opacity-20" />
                                <p className="font-medium">No results for "{search}"</p>
                                <p className="text-xs">Try another title or check that the API is reachable.</p>
                            </CardContent>
                        </Card>
                    )}
                    {results.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {results.map(r => {
                                const listEntry = animeList.find(a => a.title.toLowerCase() === r.title.toLowerCase());
                                const watchedEps = listEntry?.episodesWatched || 0;
                                return (
                                    <button key={r.id} onClick={() => selectShow(r)}
                                        data-testid={`button-watch-result-${r.id}`}
                                        className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-primary/50 transition-all hover:shadow-neon text-left">
                                        <div className="aspect-[3/4] overflow-hidden bg-muted/30 relative">
                                            {r.image
                                                ? <img src={r.image} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                : <div className="w-full h-full flex items-center justify-center"><Tv className="w-8 h-8 opacity-20" /></div>
                                            }
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-neon">
                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                            {listEntry && (
                                                <div className="absolute top-1.5 left-1.5">
                                                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/80 text-white">In List</Badge>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-xs font-semibold line-clamp-2 leading-tight">{r.title}</p>
                                            {watchedEps > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{watchedEps} ep watched</p>}
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
