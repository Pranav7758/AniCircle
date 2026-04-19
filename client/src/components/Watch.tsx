import { useState, useMemo, useEffect, useCallback } from "react";
import {
    Search, Play, Loader2, Tv, ChevronLeft, ChevronRight, Film,
    RefreshCw, AlertTriangle, Wifi, Clapperboard, Library, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    fetchAniwatchSearch,
    fetchAniwatchAnimeDetails,
    fetchAniwatchEpisodes,
    fetchAniwatchMegaplay,
    type AniwatchAnimeDetails,
    type AniwatchEpisode,
    type AniwatchSeason,
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

function metaChips(details: Record<string, string> | undefined): { label: string; value: string }[] {
    if (!details) return [];
    const order = ["status", "aired", "premiered", "duration", "genres", "studios", "mal score"];
    const seen = new Set<string>();
    const out: { label: string; value: string }[] = [];
    for (const k of order) {
        const v = details[k];
        if (v && String(v).trim()) {
            out.push({ label: k.replace(/\b\w/g, (c) => c.toUpperCase()), value: String(v).trim() });
            seen.add(k);
        }
    }
    for (const [k, v] of Object.entries(details)) {
        if (seen.has(k) || !v || !String(v).trim()) continue;
        if (out.length >= 6) break;
        out.push({ label: k.replace(/\b\w/g, (c) => c.toUpperCase()), value: String(v).trim() });
    }
    return out.slice(0, 6);
}

// ── Player ───────────────────────────────────────────────────────────────────

function WatchPlayer({
    episodes,
    selectedEpId,
    onEpIdChange,
    lang,
    watched,
    onBackToSeasons,
}: {
    episodes: AniwatchEpisode[];
    selectedEpId: string | null;
    onEpIdChange: (id: string) => void;
    lang: "sub" | "dub";
    watched: number;
    onBackToSeasons: () => void;
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
        <div className="space-y-5">
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={idx <= 0}
                    onClick={goPrev} className="gap-1.5 h-9 rounded-lg border-border/60" data-testid="button-aniw-prev-ep">
                    <ChevronLeft className="w-4 h-4" /> Prev
                </Button>
                <span className="text-sm font-bold tabular-nums text-foreground/90">Episode {epLabel}</span>
                <Button variant="outline" size="sm" disabled={idx < 0 || idx >= totalEps - 1}
                    onClick={goNext} className="gap-1.5 h-9 rounded-lg border-border/60" data-testid="button-aniw-next-ep">
                    Next <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            {loading && (
                <div className="aspect-video rounded-2xl border border-primary/20 bg-gradient-to-br from-black via-zinc-950 to-violet-950/40 flex flex-col items-center justify-center gap-4 shadow-[0_0_40px_-10px_rgba(139,92,246,0.5)]">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Loading player…</p>
                </div>
            )}

            {!loading && err && (
                <div className="aspect-video rounded-2xl border border-orange-500/25 bg-black/80 flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-400/80" />
                    <p className="text-sm text-muted-foreground">{err}</p>
                    <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setRetryTick((t) => t + 1)} disabled={!selectedEpId}>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Retry
                    </Button>
                </div>
            )}

            {!loading && !err && iframeSrc && (
                <div className="relative aspect-video rounded-2xl overflow-hidden border border-primary/25 shadow-[0_0_50px_-12px_rgba(139,92,246,0.45)] ring-1 ring-white/5">
                    <iframe
                        key={`${selectedEpId}-${lang}`}
                        src={iframeSrc}
                        className="w-full h-full"
                        allowFullScreen
                        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                        sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                        title={`Episode ${epLabel}`}
                        referrerPolicy="strict-origin-when-cross-origin"
                    />
                </div>
            )}

            {!loading && !err && megaplay && !iframeSrc && (
                <div className="aspect-video rounded-2xl border border-border/50 bg-muted/20 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
                    No embed for this language — try SUB / DUB or another episode.
                </div>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80 flex items-center gap-2">
                        <Clapperboard className="w-3.5 h-3.5 text-primary/70" />
                        Episodes
                    </p>
                    <button
                        type="button"
                        onClick={onBackToSeasons}
                        className="text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
                        data-testid="button-back-seasons"
                    >
                        ← Change season
                    </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-2xl border border-border/40 bg-gradient-to-b from-muted/20 to-muted/5 p-1.5 space-y-0.5">
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
                                className={cn(
                                    "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                                    isSel
                                        ? "bg-primary/20 text-primary font-semibold shadow-sm ring-1 ring-primary/30"
                                        : "hover:bg-muted/50 text-foreground/90",
                                    isWatched && !isSel && "text-muted-foreground",
                                )}
                            >
                                <span className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-mono font-bold",
                                    isSel ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground",
                                )}>
                                    {ep.number}
                                </span>
                                <span className="flex-1 truncate">{ep.title || `Episode ${ep.number}`}</span>
                                {isWatched && !isSel && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500/70" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1.5">
                <Wifi className="w-3 h-3 shrink-0" />
                Third-party embed · rights belong to respective holders.
            </p>
        </div>
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

type Flow = "browse" | "series" | "watch";

export default function Watch({ animeList }: { animeList: Anime[] }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);

    const [flow, setFlow] = useState<Flow>("browse");
    const [hubShow, setHubShow] = useState<SearchResult | null>(null);
    const [details, setDetails] = useState<AniwatchAnimeDetails | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [seasonPick, setSeasonPick] = useState<AniwatchSeason | null>(null);
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

    const resetToBrowse = () => {
        setFlow("browse");
        setHubShow(null);
        setDetails(null);
        setSeasonPick(null);
        setEpisodes([]);
        setSelectedEpId(null);
        setLang("sub");
    };

    const openShowFromSearch = async (result: SearchResult) => {
        setHubShow(result);
        setDetails(null);
        setSeasonPick(null);
        setEpisodes([]);
        setSelectedEpId(null);
        setLang("sub");
        setFlow("series");
        setDetailLoading(true);
        try {
            const d = await fetchAniwatchAnimeDetails(result.id);
            setDetails(d);
        } catch {
            setDetails(null);
        }
        setDetailLoading(false);
    };

    const seasonsForUi: AniwatchSeason[] = useMemo(() => {
        if (!hubShow) return [];
        const raw = details?.seasons;
        if (raw && raw.length > 0) return raw;
        return [{ title: "All episodes", anime_id: hubShow.id }];
    }, [details, hubShow]);

    const pickSeason = async (season: AniwatchSeason) => {
        setSeasonPick(season);
        setEpisodes([]);
        setSelectedEpId(null);
        setFlow("watch");
        setEpLoading(true);
        try {
            const data = await fetchAniwatchEpisodes(season.anime_id);
            const eps = data.episodes || [];
            setEpisodes(eps);
            if (eps.length > 0) setSelectedEpId(eps[0].ep_id);
        } catch { /* empty */ }
        setEpLoading(false);
    };

    const backFromWatchToSeries = () => {
        setSeasonPick(null);
        setEpisodes([]);
        setSelectedEpId(null);
        setFlow("series");
    };

    const listAnime = useMemo(() => {
        const ref = hubShow;
        if (!ref) return null;
        const t = ref.title.toLowerCase();
        return animeList.find(a =>
            a.title.toLowerCase() === t ||
            t.includes(a.title.toLowerCase()) ||
            a.title.toLowerCase().includes(t)
        ) || null;
    }, [hubShow, animeList]);

    const poster = details?.image || hubShow?.image || "";
    const displayTitle = details?.title || hubShow?.title || "";
    const description = (details?.description || "").trim();
    const chips = metaChips(details?.details);

    const epCount = episodes.length;

    return (
        <div className="space-y-8 pb-4">
            {/* Header — browse only full title; series/watch slimmer */}
            {flow === "browse" && (
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/20 ring-1 ring-primary/25 shadow-neon">
                            <Film className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-transparent">
                                Watch
                            </h2>
                            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-0.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400/90 shrink-0" />
                                Search like HiAnime — pick a show, then a season, then an episode.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {flow === "browse" && (
                <>
                    <div className="flex flex-col sm:flex-row gap-3 max-w-2xl">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            <Input
                                placeholder="Search anime (e.g. Re:Zero)…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && doSearch(search)}
                                className="pl-11 h-12 rounded-2xl border-border/50 bg-muted/25 text-base shadow-inner focus-visible:ring-primary/40"
                                data-testid="input-watch-search"
                            />
                        </div>
                        <Button
                            onClick={() => doSearch(search)}
                            disabled={searching || !search.trim()}
                            className="h-12 px-6 rounded-2xl font-semibold bg-gradient-to-r from-primary to-violet-600 hover:opacity-95 shadow-lg shadow-primary/25 shrink-0"
                            data-testid="button-watch-search"
                        >
                            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4 mr-2" /> Search</>}
                        </Button>
                    </div>

                    {!searched && !searching && (
                        <p className="text-xs text-muted-foreground/60 text-center sm:text-left max-w-xl leading-relaxed">
                            Results come from your scraper (<code className="text-[10px] rounded bg-muted/50 px-1 py-0.5">ANIWATCH_SCRAPER_URL</code>).
                        </p>
                    )}
                    {searching && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Searching catalog…
                        </div>
                    )}
                    {searched && !searching && results.length === 0 && (
                        <Card className="border-dashed border-border/60 bg-muted/15 overflow-hidden">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                                <Search className="h-10 w-10 opacity-25" />
                                <p className="font-semibold text-foreground/80">No results for &ldquo;{search}&rdquo;</p>
                                <p className="text-xs max-w-sm">Try another spelling or shorter query.</p>
                            </CardContent>
                        </Card>
                    )}
                    {results.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {results.map(r => {
                                const listEntry = animeList.find(a => a.title.toLowerCase() === r.title.toLowerCase());
                                const watchedEps = listEntry?.episodesWatched || 0;
                                return (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => openShowFromSearch(r)}
                                        data-testid={`button-watch-result-${r.id}`}
                                        className="group text-left rounded-2xl overflow-hidden border border-border/50 bg-card/80 backdrop-blur-sm hover:border-primary/45 hover:shadow-[0_0_32px_-8px_rgba(139,92,246,0.35)] transition-all duration-300 hover:-translate-y-0.5"
                                    >
                                        <div className="aspect-[3/4] overflow-hidden bg-muted/40 relative">
                                            {r.image ? (
                                                <img src={r.image} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center"><Tv className="w-10 h-10 opacity-20" /></div>
                                            )}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center shadow-xl ring-4 ring-black/30">
                                                    <Play className="h-6 w-6 text-primary-foreground fill-primary-foreground ml-1" />
                                                </div>
                                            </div>
                                            {listEntry && (
                                                <Badge className="absolute top-2 left-2 text-[10px] px-2 py-0.5 bg-primary/90 border-0 shadow-md">In your list</Badge>
                                            )}
                                        </div>
                                        <div className="p-3 pt-2.5">
                                            <p className="text-xs font-bold leading-snug line-clamp-2 group-hover:text-primary transition-colors">{r.title}</p>
                                            {watchedEps > 0 && (
                                                <p className="text-[10px] text-muted-foreground mt-1">{watchedEps} ep in list</p>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {(flow === "series" || flow === "watch") && hubShow && (
                <div className="space-y-6 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={resetToBrowse}
                            className="gap-1.5 -ml-2 h-9 text-muted-foreground hover:text-foreground rounded-xl"
                            data-testid="button-back-to-list">
                            <ChevronLeft className="w-4 h-4" /> Browse
                        </Button>
                        {flow === "watch" && (
                            <>
                                <span className="text-muted-foreground/40 text-sm">/</span>
                                <Button variant="ghost" size="sm" onClick={backFromWatchToSeries}
                                    className="h-9 text-muted-foreground hover:text-foreground rounded-xl -ml-1">
                                    Seasons
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Hero — series hub (always show when not browse); watch keeps context */}
                    <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-xl">
                        <div className="absolute inset-0 pointer-events-none">
                            {poster ? (
                                <img src={poster} alt="" className="h-full w-full object-cover blur-3xl scale-125 opacity-35" />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-violet-950/20" />
                        </div>
                        <div className="relative flex flex-col md:flex-row gap-6 md:gap-8 p-6 md:p-10">
                            <div className="shrink-0 mx-auto md:mx-0 w-36 sm:w-44 md:w-52 aspect-[2/3] rounded-2xl overflow-hidden shadow-2xl ring-2 ring-white/10 bg-muted/30">
                                {poster ? (
                                    <img src={poster} alt="" className="h-full w-full object-cover" />
                                ) : (
                                    <div className="h-full flex items-center justify-center"><Tv className="w-12 h-12 opacity-25" /></div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 text-center md:text-left space-y-3">
                                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight text-balance">
                                    {displayTitle}
                                </h2>
                                {flow === "watch" && seasonPick && (
                                    <Badge variant="secondary" className="rounded-lg px-3 py-1 text-xs font-semibold bg-primary/15 text-primary border-primary/20">
                                        {seasonPick.title}
                                    </Badge>
                                )}
                                {chips.length > 0 && (
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2">
                                        {chips.map((c) => (
                                            <span
                                                key={c.label}
                                                className="inline-flex items-center rounded-full border border-border/50 bg-background/60 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur-sm"
                                            >
                                                <span className="font-semibold text-foreground/70 mr-1.5">{c.label}:</span>
                                                <span className="line-clamp-1 max-w-[180px]">{c.value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}
                                {description && flow === "series" && (
                                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 md:line-clamp-5 text-pretty max-w-2xl mx-auto md:mx-0">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {flow === "series" && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                    <Library className="w-4 h-4 text-primary shrink-0" />
                                    Seasons
                                </h3>
                                {detailLoading && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-2">
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x snap-mandatory scrollbar-thin [scrollbar-color:hsl(var(--primary)/0.4)_transparent]">
                                {seasonsForUi.map((s) => (
                                    <button
                                        key={`${s.anime_id}-${s.title}`}
                                        type="button"
                                        disabled={detailLoading}
                                        onClick={() => pickSeason(s)}
                                        data-testid={`button-season-${s.anime_id}`}
                                        className={cn(
                                            "snap-start shrink-0 min-w-[168px] max-w-[240px] rounded-2xl border p-4 text-left transition-all duration-200",
                                            "border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 hover:border-primary/50 hover:from-primary/10 hover:to-violet-950/20 hover:shadow-lg hover:shadow-primary/10",
                                            "disabled:opacity-50 disabled:pointer-events-none",
                                        )}
                                    >
                                        <Clapperboard className="w-5 h-5 text-primary/80 mb-2" />
                                        <p className="font-bold text-sm leading-snug line-clamp-3 text-foreground group-hover:text-primary">
                                            {s.title}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wider">Open →</p>
                                    </button>
                                ))}
                            </div>
                            {!detailLoading && !details && seasonsForUi.length <= 1 && (
                                <p className="text-xs text-muted-foreground text-center md:text-left">
                                    Season list unavailable — you can still open episodes from the card above.
                                </p>
                            )}
                        </section>
                    )}

                    {flow === "watch" && (
                        <div className="space-y-5 max-w-5xl mx-auto">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <div className="min-w-0">
                                    {epLoading && (
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading episodes…
                                        </p>
                                    )}
                                    {!epLoading && epCount > 0 && (
                                        <p className="text-sm text-muted-foreground">
                                            <span className="font-semibold text-foreground">{epCount}</span> episodes in this season
                                        </p>
                                    )}
                                    {!epLoading && epCount === 0 && (
                                        <p className="text-sm text-amber-600/90">No episodes for this season.</p>
                                    )}
                                </div>
                                <div className="flex items-center shrink-0 rounded-xl border border-border/50 overflow-hidden shadow-sm">
                                    <button
                                        type="button"
                                        onClick={() => { if (lang !== "sub") setLang("sub"); }}
                                        data-testid="button-type-sub"
                                        className={cn(
                                            "px-4 py-2 text-xs font-bold transition-all",
                                            lang === "sub" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        SUB
                                    </button>
                                    <div className="w-px h-6 bg-border/60" />
                                    <button
                                        type="button"
                                        onClick={() => { if (lang !== "dub") setLang("dub"); }}
                                        data-testid="button-type-dub"
                                        className={cn(
                                            "px-4 py-2 text-xs font-bold transition-all",
                                            lang === "dub" ? "bg-primary text-primary-foreground" : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
                                        )}
                                    >
                                        DUB
                                    </button>
                                </div>
                            </div>

                            {epCount > 0 && seasonPick && (
                                <WatchPlayer
                                    key={`${seasonPick.anime_id}-${lang}-${selectedEpId ?? ""}`}
                                    episodes={episodes}
                                    selectedEpId={selectedEpId}
                                    onEpIdChange={setSelectedEpId}
                                    lang={lang}
                                    watched={listAnime?.episodesWatched || 0}
                                    onBackToSeasons={backFromWatchToSeries}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
