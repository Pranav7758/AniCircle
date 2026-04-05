import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
    Search, Play, Loader2, Tv, AlertTriangle, ChevronLeft, ChevronRight,
    Film, RefreshCw, Maximize2, Volume2, VolumeX, CheckCircle2, Wifi,
    SkipForward
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

// ── Gogoanime Match Panel ─────────────────────────────────────────────────────

function GogoMatchPanel({ title, onSelect, onClose }: {
    title: string;
    onSelect: (result: GogoResult) => void;
    onClose: () => void;
}) {
    const [query, setQuery] = useState(title);
    const [results, setResults] = useState<GogoResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setLoading(true);
        setSearched(false);
        try {
            const res = await fetch(`/api/gogoanime/search?q=${encodeURIComponent(q)}`);
            const json = await res.json();
            setResults(json.results || []);
        } catch { setResults([]); }
        finally { setLoading(false); setSearched(true); }
    }, []);

    useEffect(() => { doSearch(title); }, [title]);

    return (
        <div className="space-y-3 p-4 border border-border/50 rounded-xl bg-card/60">
            <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">Select match on Gogoanime</p>
                <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
            <div className="flex gap-2">
                <Input value={query} onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && doSearch(query)}
                    placeholder="Search Gogoanime…" className="h-8 text-xs flex-1"
                    data-testid="input-gogo-search" />
                <Button size="sm" variant="outline" onClick={() => doSearch(query)} disabled={loading}
                    className="h-8 px-3 shrink-0" data-testid="button-gogo-search">
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                </Button>
            </div>
            {loading && <p className="text-xs text-muted-foreground py-1">Searching…</p>}
            {searched && !loading && results.length === 0 && <p className="text-xs text-muted-foreground py-1">No results. Try a shorter title.</p>}
            {results.length > 0 && (
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                    {results.map(r => (
                        <button key={r.id} onClick={() => onSelect(r)}
                            data-testid={`button-gogo-result-${r.id}`}
                            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-primary/10 border border-transparent hover:border-primary/20 text-left transition-all">
                            {r.image && <img src={r.image} alt={r.title} className="w-8 h-11 object-cover rounded shrink-0" />}
                            <span className="text-xs font-medium line-clamp-2">{r.title}</span>
                        </button>
                    ))}
                </div>
            )}
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
    episode,
    watched,
    totalEps,
    malId,
    anilistId,
    onEpisodeChange,
    onChangeSource,
}: {
    gogoId: string;
    episode: number;
    watched: number;
    totalEps: number;
    malId?: number | null;
    anilistId?: number | null;
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
            const res = await fetch(`/api/extract?id=${encodeURIComponent(gogoId)}&episode=${episode}`);
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
    }, [gogoId, episode]);

    useEffect(() => { extract(); }, [gogoId, episode]);

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
    const [selectedAnime, setSelectedAnime] = useState<Anime | null>(null);
    const [gogoMatch, setGogoMatch] = useState<GogoResult | null>(null);
    const [epInfo, setEpInfo] = useState<EpisodeInfo | null>(null);
    const [epInfoLoading, setEpInfoLoading] = useState(false);
    const [selectedEp, setSelectedEp] = useState(1);
    const [lang, setLang] = useState<"sub" | "dub">("sub");
    const [showMatchPanel, setShowMatchPanel] = useState(false);
    const [customDubId, setCustomDubId] = useState("");
    const [showDubInput, setShowDubInput] = useState(false);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        return q ? animeList.filter(a => a.title.toLowerCase().includes(q)) : animeList;
    }, [search, animeList]);

    const selectAnime = (anime: Anime) => {
        setSelectedAnime(anime);
        setGogoMatch(null);
        setEpInfo(null);
        setShowMatchPanel(true);
        setLang("sub");
        setSelectedEp(Math.max(1, anime.episodesWatched || 0));
        setCustomDubId("");
        setShowDubInput(false);
    };

    const onGogoMatch = async (result: GogoResult) => {
        setGogoMatch(result);
        setShowMatchPanel(false);
        setEpInfoLoading(true);
        setLang("sub");
        try {
            const res = await fetch(`/api/gogoanime/episodes?id=${encodeURIComponent(result.id)}`);
            if (res.ok) setEpInfo(await res.json());
        } catch {}
        setEpInfoLoading(false);
    };

    // Active ID: use customDubId (manual) > epInfo.dubId (auto) when lang=dub
    const effectiveDubId = customDubId.trim() || epInfo?.dubId || null;
    const activeGogoId = lang === "dub" && effectiveDubId ? effectiveDubId : (gogoMatch?.id || "");
    const activeTotalEps = lang === "dub" && epInfo?.dubEnd && !customDubId ? epInfo.dubEnd : (epInfo?.end || selectedAnime?.totalEpisodes || 24);
    const dubAvailable = !!effectiveDubId;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
                <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">
                    Gogoanime · {animeList.length} titles
                </span>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Direct HLS streams extracted from Gogoanime — native video player, sub &amp; dub.
            </p>

            {selectedAnime ? (
                <div className="space-y-4">
                    {/* Back + header */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <Button variant="ghost" size="sm"
                            onClick={() => { setSelectedAnime(null); setGogoMatch(null); setEpInfo(null); setShowMatchPanel(false); }}
                            className="gap-1.5 -ml-2 h-8 text-muted-foreground hover:text-foreground shrink-0"
                            data-testid="button-back-to-list">
                            <ChevronLeft className="w-4 h-4" /> Back
                        </Button>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base truncate">{selectedAnime.title}</h3>
                            {gogoMatch && (
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                    {gogoMatch.title}
                                </p>
                            )}
                        </div>

                        {/* Sub / Dub toggle */}
                        {gogoMatch && (
                            <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setLang("sub")}
                                        data-testid="button-type-sub"
                                        className={`px-3 py-1 rounded-l-lg rounded-r-none border text-xs font-semibold transition-all ${lang === "sub" ? "bg-primary text-white border-primary" : "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"}`}>
                                        SUB
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (dubAvailable) {
                                                setLang("dub");
                                            } else if (!epInfoLoading) {
                                                setShowDubInput(v => !v);
                                            }
                                        }}
                                        data-testid="button-type-dub"
                                        title={dubAvailable ? "Switch to English dub" : "Click to enter a Gogoanime dub ID manually"}
                                        className={`px-3 py-1 rounded-r-lg rounded-l-none border text-xs font-semibold transition-all ${
                                            lang === "dub"
                                                ? "bg-primary text-white border-primary"
                                                : dubAvailable
                                                    ? "bg-muted/40 border-border/40 text-muted-foreground hover:text-foreground"
                                                    : epInfoLoading
                                                        ? "bg-muted/40 border-border/40 text-muted-foreground/60 cursor-wait"
                                                        : "bg-muted/30 border-border/30 text-muted-foreground/50 hover:text-muted-foreground"
                                        }`}>
                                        {epInfoLoading
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : "DUB"
                                        }
                                    </button>
                                </div>
                                {/* Manual dub ID entry — shown when auto-detect failed */}
                                {showDubInput && !epInfoLoading && (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <Input
                                            value={customDubId}
                                            onChange={e => setCustomDubId(e.target.value)}
                                            placeholder="e.g. naruto-dub"
                                            className="h-6 text-[11px] w-44 px-2 bg-muted/30 border-border/50"
                                            data-testid="input-custom-dub-id"
                                            onKeyDown={e => {
                                                if (e.key === "Enter" && customDubId.trim()) {
                                                    setLang("dub");
                                                    setShowDubInput(false);
                                                }
                                            }}
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-2 text-[11px]"
                                            data-testid="button-apply-custom-dub"
                                            onClick={() => {
                                                if (customDubId.trim()) {
                                                    setLang("dub");
                                                    setShowDubInput(false);
                                                }
                                            }}
                                        >
                                            Use
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Match panel */}
                    {showMatchPanel && (
                        <GogoMatchPanel title={selectedAnime.title} onSelect={onGogoMatch} onClose={() => setShowMatchPanel(false)} />
                    )}

                    {/* Stream panel */}
                    {gogoMatch && !showMatchPanel && (
                        <StreamPanel
                            key={`${activeGogoId}-${selectedEp}`}
                            gogoId={activeGogoId}
                            episode={selectedEp}
                            watched={selectedAnime.episodesWatched || 0}
                            totalEps={activeTotalEps}
                            malId={selectedAnime.malId}
                            anilistId={selectedAnime.anilistId}
                            onEpisodeChange={setSelectedEp}
                            onChangeSource={() => setShowMatchPanel(true)}
                        />
                    )}

                    {/* Waiting for match */}
                    {!gogoMatch && !showMatchPanel && (
                        <Card className="bg-muted/20 border-dashed">
                            <CardContent className="flex items-center justify-center gap-3 p-8 text-muted-foreground">
                                <AlertTriangle className="w-4 h-4 opacity-40" />
                                <p className="text-sm">Select a match to start streaming.</p>
                                <Button size="sm" variant="outline" onClick={() => setShowMatchPanel(true)}>Find match</Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : (
                <>
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input placeholder="Search your list…" value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-9 h-10 rounded-xl border-border/50 bg-muted/30"
                            data-testid="input-watch-search" />
                    </div>

                    {animeList.length === 0 ? (
                        <Card className="bg-muted/30 border-dashed">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                                <Tv className="h-10 w-10 mb-1 opacity-20" />
                                <p className="font-medium">Your list is empty</p>
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
                                    <button key={anime.id} onClick={() => selectAnime(anime)}
                                        data-testid={`button-watch-anime-${anime.id}`}
                                        className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-primary/50 transition-all hover:shadow-neon text-left">
                                        <div className="aspect-[3/4] overflow-hidden bg-muted/30 relative">
                                            {anime.coverImage
                                                ? <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                : <div className="w-full h-full flex items-center justify-center"><Tv className="w-8 h-8 opacity-20" /></div>
                                            }
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-neon">
                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                            <div className="absolute top-1.5 left-1.5">
                                                <Badge className={`text-[9px] px-1.5 py-0 h-4 ${anime.status === "watching" ? "bg-primary/80 text-white" : anime.status === "completed" ? "bg-emerald-500/80 text-white" : "bg-muted/80 text-muted-foreground"}`}>
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
