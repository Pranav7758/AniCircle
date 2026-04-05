import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
    Search, Play, Loader2, Tv, ChevronLeft, ChevronRight,
    Film, RefreshCw, Maximize2, Volume2, VolumeX, Wifi,
    SkipForward, AlertTriangle
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

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

interface GogoResult {
    id: string;
    title: string;
    url: string;
    image: string;
}

interface EpisodeInfo {
    start: number;
    end: number;
    dubId: string | null;
    dubEnd: number | null;
}

interface StreamResult {
    stream: string;
    type: "hls" | "mp4";
    source: string;
}

interface SkipInterval {
    start: number;
    end: number;
    type: "op" | "ed";
}

// ── AniSkip API (via server proxy to avoid CORS) ─────────────────────────────

async function fetchSkipTimes(malId: number, episode: number): Promise<SkipInterval[]> {
    try {
        const res = await fetch(`/api/aniskip?malId=${malId}&episode=${episode}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (!json.found || !Array.isArray(json.results)) return [];
        return json.results.map((r: any) => ({
            start: r.interval.start_time,
            end: r.interval.end_time,
            type: r.skip_type as "op" | "ed",
        }));
    } catch {
        return [];
    }
}

// Resolve MAL ID from AniList ID when malId is missing from the DB record
async function resolveMALId(anilistId: number): Promise<number | null> {
    try {
        const res = await fetch(`/api/anilist-mal?anilistId=${anilistId}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.idMal ?? null;
    } catch {
        return null;
    }
}

// ── HLS Player ────────────────────────────────────────────────────────────────

function HlsPlayer({
    streamResult,
    malId,
    anilistId,
    episode,
    onError,
}: {
    streamResult: StreamResult;
    malId?: number | null;
    anilistId?: number | null;
    episode: number;
    onError: () => void;
}) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const [muted, setMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);

    // Fetch AniSkip timestamps — use malId directly, or resolve from anilistId if missing
    useEffect(() => {
        let cancelled = false;
        async function load() {
            let effectiveMalId = malId ?? null;

            // If no malId but we have anilistId, resolve it server-side
            if (!effectiveMalId && anilistId) {
                effectiveMalId = await resolveMALId(anilistId);
            }

            if (cancelled || !effectiveMalId) { setSkipIntervals([]); return; }

            const intervals = await fetchSkipTimes(effectiveMalId, episode);
            if (!cancelled) setSkipIntervals(intervals);
        }
        load();
        return () => { cancelled = true; };
    }, [malId, anilistId, episode]);

    // Set up HLS / video source
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }

        const proxiedUrl = `/api/proxy/stream?url=${encodeURIComponent(streamResult.stream)}`;

        if (streamResult.type === "hls") {
            if (Hls.isSupported()) {
                const hls = new Hls({ enableWorker: true, backBufferLength: 90 });
                hlsRef.current = hls;
                hls.loadSource(proxiedUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
                hls.on(Hls.Events.ERROR, (_, data) => {
                    if (data.fatal) { console.error("[HLS] Fatal:", data.type, data.details); onError(); }
                });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = proxiedUrl;
                video.play().catch(() => {});
            } else { onError(); }
        } else {
            video.src = proxiedUrl;
            video.play().catch(() => {});
        }

        return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
    }, [streamResult.stream]);

    // Track current playback time for skip buttons
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        video.addEventListener("timeupdate", onTimeUpdate);
        return () => video.removeEventListener("timeupdate", onTimeUpdate);
    }, []);

    const skipTo = (time: number) => {
        if (videoRef.current) videoRef.current.currentTime = time;
    };

    const activeIntro = skipIntervals.find(s => s.type === "op" && currentTime >= s.start && currentTime < s.end);
    const activeOutro = skipIntervals.find(s => s.type === "ed" && currentTime >= s.start && currentTime < s.end);

    return (
        <div className="relative group rounded-xl overflow-hidden border border-border/50 bg-black aspect-video">
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                controls playsInline autoPlay
                data-testid="video-player"
            />

            {/* Skip Intro button */}
            {activeIntro && (
                <button
                    onClick={() => skipTo(activeIntro.end)}
                    data-testid="button-skip-intro"
                    className="absolute bottom-14 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 border border-white/20 text-white text-xs font-semibold hover:bg-black/95 transition-colors shadow-lg backdrop-blur-sm"
                >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip Intro
                </button>
            )}

            {/* Skip Outro button */}
            {activeOutro && (
                <button
                    onClick={() => skipTo(activeOutro.end)}
                    data-testid="button-skip-outro"
                    className="absolute bottom-14 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/80 border border-white/20 text-white text-xs font-semibold hover:bg-black/95 transition-colors shadow-lg backdrop-blur-sm"
                >
                    <SkipForward className="w-3.5 h-3.5" />
                    Skip Outro
                </button>
            )}

            {/* Top-right controls */}
            <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => { if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted); } }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                    data-testid="button-toggle-mute"
                >
                    {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>
                <button
                    onClick={() => { const v = videoRef.current; if (!v) return; document.fullscreenElement ? document.exitFullscreen() : v.requestFullscreen(); }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white transition-colors"
                    data-testid="button-fullscreen"
                >
                    <Maximize2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Source badge */}
            <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="px-2 py-0.5 rounded-md bg-black/70 text-[10px] text-emerald-400 font-mono">
                    {streamResult.type.toUpperCase()} · {streamResult.source}
                </span>
            </div>
        </div>
    );
}

// ── Episode Grid ──────────────────────────────────────────────────────────────

function EpisodeGrid({ total, watched, selected, onSelect }: {
    total: number; watched: number; selected: number; onSelect: (ep: number) => void;
}) {
    const PER_PAGE = 60;
    const pages = Math.ceil(total / PER_PAGE);
    const [page, setPage] = useState(Math.ceil(selected / PER_PAGE) || 1);
    const start = (page - 1) * PER_PAGE + 1;
    const end = Math.min(page * PER_PAGE, total);

    return (
        <div className="space-y-3">
            {pages > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setPage(p)}
                            className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${p === page ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/70"}`}>
                            {(p - 1) * PER_PAGE + 1}–{Math.min(p * PER_PAGE, total)}
                        </button>
                    ))}
                </div>
            )}
            <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5">
                {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(ep => {
                    const isWatched = ep <= watched;
                    const isSel = ep === selected;
                    return (
                        <button key={ep} onClick={() => onSelect(ep)}
                            data-testid={`button-episode-${ep}`}
                            title={`Episode ${ep}${isWatched ? " (watched)" : ""}`}
                            className={`h-8 rounded-md text-xs font-semibold transition-all ${isSel
                                ? "bg-primary text-primary-foreground shadow-neon ring-2 ring-primary/30"
                                : isWatched
                                    ? "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/30"
                            }`}>{ep}</button>
                    );
                })}
            </div>
        </div>
    );
}


// ── Stream Extraction Panel ───────────────────────────────────────────────────

const EXTRACT_LOGS = [
    "Launching browser…", "Loading episode page…",
    "Connecting to stream server…", "Intercepting network requests…",
    "Decoding video stream…",
];

type ExState = "idle" | "extracting" | "ready" | "error";

function StreamPanel({
    gogoId,
    animeTitle,
    episode,
    watched,
    totalEps,
    malId,
    anilistId,
    isDub,
    onEpisodeChange,
    onChangeSource,
}: {
    gogoId: string;
    animeTitle: string;
    episode: number;
    watched: number;
    totalEps: number;
    malId?: number | null;
    anilistId?: number | null;
    isDub?: boolean;
    onEpisodeChange: (ep: number) => void;
    onChangeSource: () => void;
}) {
    const [state, setState] = useState<ExState>("idle");
    const [streamResult, setStreamResult] = useState<StreamResult | null>(null);
    const [error, setError] = useState("");
    const [logIdx, setLogIdx] = useState(0);

    const extract = useCallback(async () => {
        setState("extracting");
        setStreamResult(null);
        setError("");
        setLogIdx(0);

        const timer = setInterval(() => setLogIdx(i => (i + 1) % EXTRACT_LOGS.length), 2800);
        try {
            let url: string;
            if (isDub) {
                const params = new URLSearchParams({ title: animeTitle, episode: String(episode) });
                if (malId) params.set("malId", String(malId));
                url = `/api/extract/dub?${params}`;
            } else {
                url = `/api/extract?id=${encodeURIComponent(gogoId)}&episode=${episode}`;
            }
            const res = await fetch(url);
            const json = await res.json();
            clearInterval(timer);
            if (!res.ok) throw new Error(json.message || json.error || "Extraction failed");
            setStreamResult(json);
            setState("ready");
        } catch (err: any) {
            clearInterval(timer);
            setError(err.message || "Unknown error");
            setState("error");
        }
    }, [gogoId, animeTitle, episode, isDub, malId]);

    useEffect(() => { extract(); }, [gogoId, episode, isDub]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={episode <= 1}
                    onClick={() => onEpisodeChange(episode - 1)}
                    className="gap-1.5" data-testid="button-prev-episode">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-sm text-muted-foreground font-medium">Episode {episode}</span>
                <Button variant="outline" size="sm" disabled={episode >= totalEps}
                    onClick={() => onEpisodeChange(episode + 1)}
                    className="gap-1.5" data-testid="button-next-episode">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>

            {state === "extracting" && (
                <div className="aspect-video rounded-xl border border-border/50 bg-black flex flex-col items-center justify-center gap-4 p-6">
                    <div className="relative">
                        <div className="w-16 h-16 rounded-full border-2 border-primary/20 flex items-center justify-center">
                            <Loader2 className="w-7 h-7 animate-spin text-primary" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-sm font-semibold">Extracting stream</p>
                        <p className="text-xs text-muted-foreground font-mono">{EXTRACT_LOGS[logIdx]}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground/50">Takes 5–15 seconds…</p>
                </div>
            )}

            {state === "ready" && streamResult && (
                <HlsPlayer
                    streamResult={streamResult}
                    malId={malId}
                    anilistId={anilistId}
                    episode={episode}
                    onError={() => { setError("HLS playback error. Try re-extracting."); setState("error"); }}
                />
            )}

            {state === "error" && (
                <div className="aspect-video rounded-xl border border-orange-500/20 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-400 opacity-60" />
                    <div>
                        <p className="font-semibold">Stream failed</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs line-clamp-3">{error}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <Button size="sm" variant="outline" onClick={extract} className="gap-1.5" data-testid="button-retry-extract">
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </Button>
                        <Button size="sm" variant="outline" onClick={onChangeSource} className="gap-1.5">
                            <Search className="w-3.5 h-3.5" /> Change source
                        </Button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episodes</p>
                    <button onClick={onChangeSource}
                        className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                        data-testid="button-change-gogo-source">
                        Change source
                    </button>
                </div>
                <EpisodeGrid total={totalEps} watched={watched} selected={episode} onSelect={onEpisodeChange} />
            </div>

            <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Sourced from Gogoanime via Puppeteer · Content belongs to respective rights holders.
            </p>
        </div>
    );
}

// ── Main Watch Component ──────────────────────────────────────────────────────

export default function Watch({ animeList }: { animeList: Anime[] }) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<GogoResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [gogoMatch, setGogoMatch] = useState<GogoResult | null>(null);
    const [epInfo, setEpInfo] = useState<EpisodeInfo | null>(null);
    const [epInfoLoading, setEpInfoLoading] = useState(false);
    const [selectedEp, setSelectedEp] = useState(1);
    const [lang, setLang] = useState<"sub" | "dub">("sub");

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setSearching(true);
        setSearched(false);
        try {
            const res = await fetch(`/api/gogoanime/search?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            setResults(json.results || []);
        } catch { setResults([]); }
        finally { setSearching(false); setSearched(true); }
    }, []);

    const selectMatch = async (result: GogoResult) => {
        setGogoMatch(result);
        setLang("sub");
        setSelectedEp(1);
        setEpInfo(null);
        setEpInfoLoading(true);
        try {
            const res = await fetch(`/api/gogoanime/episodes?id=${encodeURIComponent(result.id)}`);
            if (res.ok) setEpInfo(await res.json());
        } catch {}
        setEpInfoLoading(false);
    };

    const goBack = () => { setGogoMatch(null); setEpInfo(null); setLang("sub"); };

    // Match the Gogoanime result to a list entry (for watched progress / AniSkip IDs)
    const listAnime = useMemo(() => {
        if (!gogoMatch) return null;
        const t = gogoMatch.title.toLowerCase();
        return animeList.find(a =>
            a.title.toLowerCase() === t ||
            t.includes(a.title.toLowerCase()) ||
            a.title.toLowerCase().includes(t)
        ) || null;
    }, [gogoMatch, animeList]);

    // Sub uses Gogoanime · Dub uses AllAnime (always available to try)
    const activeGogoId = gogoMatch?.id || "";
    const totalEps = epInfo?.end || listAnime?.totalEpisodes || 24;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Search any anime, pick an episode, and stream directly — sub &amp; dub.
            </p>

            {gogoMatch ? (
                <div className="space-y-4">
                    {/* Back + header */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="ghost" size="sm" onClick={goBack}
                            className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground shrink-0"
                            data-testid="button-back-to-list">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">{gogoMatch.title}</h3>
                            {epInfoLoading && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading info…
                                </p>
                            )}
                            {epInfo && !epInfoLoading && (
                                <p className="text-[11px] text-muted-foreground">
                                    {epInfo.end} episodes · Sub &amp; Dub
                                </p>
                            )}
                        </div>

                        {/* Sub / Dub toggle */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => { if (lang !== "sub") { setLang("sub"); setSelectedEp(1); } }} data-testid="button-type-sub"
                                className={`px-3 py-1 rounded-l-lg rounded-r-none border text-xs font-semibold transition-all ${lang === "sub" ? "bg-primary text-white border-primary" : "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"}`}>
                                SUB
                            </button>
                            <button
                                onClick={() => { if (lang !== "dub") { setLang("dub"); setSelectedEp(1); } }}
                                data-testid="button-type-dub"
                                title="Switch to English dub"
                                className={`px-3 py-1 rounded-r-lg rounded-l-none border text-xs font-semibold transition-all ${
                                    lang === "dub" ? "bg-primary text-white border-primary"
                                    : "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"
                                }`}>
                                DUB
                            </button>
                        </div>
                    </div>

                    <StreamPanel
                        key={`${activeGogoId}-${lang}-${selectedEp}`}
                        gogoId={activeGogoId}
                        animeTitle={gogoMatch.title}
                        episode={selectedEp}
                        watched={listAnime?.episodesWatched || 0}
                        totalEps={totalEps}
                        malId={listAnime?.malId}
                        anilistId={listAnime?.anilistId}
                        isDub={lang === "dub"}
                        onEpisodeChange={setSelectedEp}
                        onChangeSource={goBack}
                    />
                </div>
            ) : (
                <>
                    {/* Direct Gogoanime search */}
                    <div className="flex gap-2 max-w-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search anime to watch…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onKeyDown={e => e.key === "Enter" && doSearch(search)}
                                className="pl-9 h-10 rounded-xl border-border/50 bg-muted/30"
                                data-testid="input-watch-search" />
                        </div>
                        <Button variant="outline" onClick={() => doSearch(search)}
                            disabled={searching || !search.trim()}
                            className="h-10 px-3 shrink-0" data-testid="button-watch-search">
                            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                    </div>

                    {!searched && !searching && (
                        <p className="text-xs text-muted-foreground/50 text-center pt-2">
                            Search any anime title to start watching.
                        </p>
                    )}
                    {searching && <p className="text-xs text-muted-foreground py-1">Searching Gogoanime…</p>}
                    {searched && !searching && results.length === 0 && (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                                <Search className="h-8 w-8 mb-1 opacity-20" />
                                <p className="font-medium">No results for "{search}"</p>
                                <p className="text-xs">Try a shorter or different title.</p>
                            </CardContent>
                        </Card>
                    )}
                    {results.length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {results.map(r => {
                                const listEntry = animeList.find(a =>
                                    a.title.toLowerCase() === r.title.toLowerCase()
                                );
                                const watched = listEntry?.episodesWatched || 0;
                                return (
                                    <button key={r.id} onClick={() => selectMatch(r)}
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
                                            {watched > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{watched} ep watched</p>}
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
