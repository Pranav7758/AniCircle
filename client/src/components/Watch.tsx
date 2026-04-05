import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
    Search, Play, Pause, Loader2, Tv, ChevronLeft, ChevronRight,
    Film, RefreshCw, Maximize2, Minimize2, Volume2, VolumeX, Volume1,
    SkipForward, SkipBack, AlertTriangle, Wifi
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
    isAllAnime?: boolean;
    subEps?: number;
    dubEps?: number;
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
    animeId?: string;
    slug?: string;
}

interface SkipInterval {
    start: number;
    end: number;
    type: "op" | "ed";
}

// ── AniSkip API ───────────────────────────────────────────────────────────────

async function fetchSkipTimes(malId: number, episode: number): Promise<SkipInterval[]> {
    try {
        const res = await fetch(`/api/aniskip?malId=${malId}&episode=${episode}`, {
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return [];
        const json = await res.json();
        if (!json.found || !Array.isArray(json.results)) return [];
        return json.results.map((r: any) => ({
            start: r.interval.startTime,
            end: r.interval.endTime,
            type: r.skipType as "op" | "ed",
        }));
    } catch {
        return [];
    }
}

async function resolveMALId(anilistId: number): Promise<number | null> {
    try {
        const res = await fetch(`/api/anilist-mal?anilistId=${anilistId}`, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const json = await res.json();
        return json.idMal ?? null;
    } catch { return null; }
}

function formatTime(s: number): string {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Custom HLS Video Player ───────────────────────────────────────────────────

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
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seekbarRef = useRef<HTMLDivElement>(null);

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [seeking, setSeeking] = useState(false);
    const [hoverTime, setHoverTime] = useState<number | null>(null);
    const [hoverX, setHoverX] = useState(0);
    const [skipIntervals, setSkipIntervals] = useState<SkipInterval[]>([]);
    const [buffered, setBuffered] = useState(0);
    const [clickFlash, setClickFlash] = useState<"play" | "pause" | "rewind" | "forward" | null>(null);
    const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Fetch skip timestamps
    useEffect(() => {
        let cancelled = false;
        async function load() {
            let mid = malId ?? null;
            if (!mid && anilistId) mid = await resolveMALId(anilistId);
            if (cancelled || !mid) { setSkipIntervals([]); return; }
            const intervals = await fetchSkipTimes(mid, episode);
            if (!cancelled) setSkipIntervals(intervals);
        }
        load();
        return () => { cancelled = true; };
    }, [malId, anilistId, episode]);

    // Set up HLS source
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        const proxied = `/api/proxy/stream?url=${encodeURIComponent(streamResult.stream)}`;
        if (streamResult.type === "hls") {
            if (Hls.isSupported()) {
                const hls = new Hls({ enableWorker: true, backBufferLength: 90 });
                hlsRef.current = hls;
                hls.loadSource(proxied);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
                hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) onError(); });
            } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
                video.src = proxied;
                video.play().catch(() => {});
            } else { onError(); }
        } else {
            video.src = proxied;
            video.play().catch(() => {});
        }
        return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
    }, [streamResult.stream]);

    // Video event listeners
    useEffect(() => {
        const v = videoRef.current;
        if (!v) return;
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onTimeUpdate = () => {
            setCurrentTime(v.currentTime);
            if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
        };
        const onDurationChange = () => setDuration(v.duration);
        const onVolumeChange = () => { setVolume(v.volume); setMuted(v.muted); };
        v.addEventListener("play", onPlay);
        v.addEventListener("pause", onPause);
        v.addEventListener("timeupdate", onTimeUpdate);
        v.addEventListener("durationchange", onDurationChange);
        v.addEventListener("volumechange", onVolumeChange);
        return () => {
            v.removeEventListener("play", onPlay);
            v.removeEventListener("pause", onPause);
            v.removeEventListener("timeupdate", onTimeUpdate);
            v.removeEventListener("durationchange", onDurationChange);
            v.removeEventListener("volumechange", onVolumeChange);
        };
    }, []);

    // Fullscreen change listener
    useEffect(() => {
        const onChange = () => setFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", onChange);
        return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    // Auto-hide controls
    const showControlsTemp = useCallback(() => {
        setShowControls(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }, []);

    const flash = (type: "play" | "pause" | "rewind" | "forward") => {
        setClickFlash(type);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setClickFlash(null), 600);
    };

    const togglePlay = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) { v.play().catch(() => {}); flash("play"); }
        else { v.pause(); flash("pause"); }
    };

    const rewind5 = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.max(0, v.currentTime - 5);
        flash("rewind");
        showControlsTemp();
    };

    const forward10 = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const v = videoRef.current;
        if (!v) return;
        v.currentTime = Math.min(duration, v.currentTime + 10);
        flash("forward");
        showControlsTemp();
    };

    const toggleMute = () => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = !v.muted;
    };

    const changeVolume = (val: number) => {
        const v = videoRef.current;
        if (!v) return;
        v.volume = val;
        v.muted = val === 0;
    };

    const toggleFullscreen = () => {
        const el = containerRef.current;
        if (!el) return;
        document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen();
    };

    const seekTo = (time: number) => {
        const v = videoRef.current;
        if (v) v.currentTime = Math.max(0, Math.min(time, duration));
    };

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            // Don't fire when typing in an input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === "Space") { e.preventDefault(); togglePlay(); }
            if (e.code === "ArrowLeft") { e.preventDefault(); rewind5(); }
            if (e.code === "ArrowRight") { e.preventDefault(); forward10(); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [duration]);

    // Seekbar interaction
    const getTimeFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = seekbarRef.current?.getBoundingClientRect();
        if (!rect || !duration) return null;
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        return ratio * duration;
    };

    const onSeekbarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const t = getTimeFromEvent(e);
        if (t !== null) { setHoverTime(t); setHoverX(e.clientX - (seekbarRef.current?.getBoundingClientRect().left ?? 0)); }
        if (seeking) seekTo(t ?? 0);
    };

    const onSeekbarMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setSeeking(true);
        const t = getTimeFromEvent(e);
        if (t !== null) seekTo(t);
    };

    const onSeekbarMouseUp = () => setSeeking(false);
    const onSeekbarMouseLeave = () => { setHoverTime(null); if (seeking) setSeeking(false); };

    const skipTo = (time: number) => seekTo(time);

    const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
    const buffPct = duration > 0 ? (buffered / duration) * 100 : 0;

    const intro = skipIntervals.find(s => s.type === "op");
    const outro = skipIntervals.find(s => s.type === "ed");
    const activeIntro = intro && currentTime >= intro.start && currentTime < intro.end;
    const activeOutro = outro && currentTime >= outro.start && currentTime < outro.end;

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

    return (
        <div
            ref={containerRef}
            className="relative bg-black rounded-xl overflow-hidden aspect-video select-none group"
            onMouseMove={showControlsTemp}
            onMouseEnter={showControlsTemp}
            onMouseLeave={() => {
                if (hideTimer.current) clearTimeout(hideTimer.current);
                hideTimer.current = setTimeout(() => setShowControls(false), 1000);
            }}
            onClick={togglePlay}
            data-testid="player-container"
        >
            <video
                ref={videoRef}
                className="w-full h-full object-contain"
                playsInline
                data-testid="video-player"
            />

            {/* Centre click flash (play/pause/rewind/forward) */}
            {clickFlash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="flex items-center gap-6">
                        {clickFlash === "rewind" && (
                            <div className="flex flex-col items-center gap-1 animate-ping-once">
                                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                    <SkipBack className="w-7 h-7 text-white fill-white" />
                                </div>
                                <span className="text-white text-xs font-bold drop-shadow">-5s</span>
                            </div>
                        )}
                        {(clickFlash === "play" || clickFlash === "pause") && (
                            <div className="animate-ping-once">
                                <div className="w-16 h-16 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                    {clickFlash === "play"
                                        ? <Play className="w-8 h-8 text-white fill-white ml-1" />
                                        : <Pause className="w-8 h-8 text-white fill-white" />
                                    }
                                </div>
                            </div>
                        )}
                        {clickFlash === "forward" && (
                            <div className="flex flex-col items-center gap-1 animate-ping-once">
                                <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                                    <SkipForward className="w-7 h-7 text-white fill-white" />
                                </div>
                                <span className="text-white text-xs font-bold drop-shadow">+10s</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Paused state — static play icon (no flash) */}
            {!playing && !clickFlash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                        <Play className="w-8 h-8 text-white fill-white ml-1" />
                    </div>
                </div>
            )}

            {/* Skip intro button */}
            {activeIntro && (
                <button
                    onClick={e => { e.stopPropagation(); skipTo(intro!.end); }}
                    data-testid="button-skip-intro"
                    className="absolute bottom-20 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 border border-white/30 text-white text-sm font-semibold hover:bg-white hover:text-black transition-all shadow-xl backdrop-blur-sm z-10"
                >
                    <SkipForward className="w-4 h-4" />
                    Skip Intro
                </button>
            )}

            {/* Skip outro button */}
            {activeOutro && (
                <button
                    onClick={e => { e.stopPropagation(); skipTo(outro!.end); }}
                    data-testid="button-skip-outro"
                    className="absolute bottom-20 right-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-black/80 border border-white/30 text-white text-sm font-semibold hover:bg-white hover:text-black transition-all shadow-xl backdrop-blur-sm z-10"
                >
                    <SkipForward className="w-4 h-4" />
                    Skip Outro
                </button>
            )}

            {/* Controls overlay — does NOT stopPropagation so clicking video area toggles play */}
            <div
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 40%, transparent 100%)" }}
            >
                {/* Seekbar — stopPropagation so scrubbing doesn't trigger play/pause */}
                <div className="px-3 pb-1.5" onClick={e => e.stopPropagation()}>
                    {/* Hover time tooltip */}
                    {hoverTime !== null && (
                        <div
                            className="absolute bottom-14 text-[11px] font-mono text-white bg-black/80 px-1.5 py-0.5 rounded pointer-events-none z-20 -translate-x-1/2"
                            style={{ left: hoverX + 12 }}
                        >
                            {formatTime(hoverTime)}
                        </div>
                    )}

                    <div
                        ref={seekbarRef}
                        className="relative cursor-pointer group/seek py-2 -my-2"
                        onMouseMove={onSeekbarMouseMove}
                        onMouseDown={onSeekbarMouseDown}
                        onMouseUp={onSeekbarMouseUp}
                        onMouseLeave={onSeekbarMouseLeave}
                        data-testid="seekbar"
                    >
                        {/* Track */}
                        <div className="relative h-1 group-hover/seek:h-[5px] transition-all duration-100 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }}>

                            {/* Buffered */}
                            <div
                                className="absolute left-0 top-0 h-full rounded-full"
                                style={{ width: `${buffPct}%`, background: "rgba(255,255,255,0.22)" }}
                            />

                            {/* Played */}
                            <div
                                className="absolute left-0 top-0 h-full rounded-full"
                                style={{ width: `${pct}%`, background: "#a78bfa" }}
                            />

                            {/* Intro strip — rendered last to be on top, extends above track */}
                            {intro && duration > 0 && (
                                <div
                                    className="absolute rounded-[2px] pointer-events-none"
                                    style={{
                                        left: `${(intro.start / duration) * 100}%`,
                                        width: `${Math.max(((intro.end - intro.start) / duration) * 100, 0.5)}%`,
                                        top: "-3px",
                                        bottom: "-3px",
                                        background: "#f59e0b",
                                        zIndex: 10,
                                    }}
                                    title={`Intro: ${formatTime(intro.start)}–${formatTime(intro.end)}`}
                                />
                            )}

                            {/* Outro strip — rendered last to be on top */}
                            {outro && duration > 0 && (
                                <div
                                    className="absolute rounded-[2px] pointer-events-none"
                                    style={{
                                        left: `${(outro.start / duration) * 100}%`,
                                        width: `${Math.max(((outro.end - outro.start) / duration) * 100, 0.5)}%`,
                                        top: "-3px",
                                        bottom: "-3px",
                                        background: "#f59e0b",
                                        zIndex: 10,
                                    }}
                                    title={`Outro: ${formatTime(outro.start)}–${formatTime(outro.end)}`}
                                />
                            )}

                            {/* Thumb */}
                            <div
                                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
                                style={{ left: `calc(${pct}% - 6px)`, zIndex: 20 }}
                            />
                        </div>
                    </div>
                </div>

                {/* Bottom bar — stopPropagation here so clicks on controls don't toggle play */}
                <div className="flex items-center gap-2 px-3 pb-3" onClick={e => e.stopPropagation()}>
                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        className="text-white hover:text-white/80 transition-colors"
                        data-testid="button-play-pause"
                    >
                        {playing
                            ? <Pause className="w-5 h-5 fill-white" />
                            : <Play className="w-5 h-5 fill-white ml-0.5" />
                        }
                    </button>

                    {/* Rewind 5s */}
                    <button
                        onClick={rewind5}
                        className="flex items-center gap-0.5 text-white hover:text-white/80 transition-colors"
                        title="Rewind 5 seconds (←)"
                        data-testid="button-rewind-5"
                    >
                        <SkipBack className="w-4 h-4 fill-white" />
                        <span className="text-[10px] font-bold tabular-nums">5</span>
                    </button>

                    {/* Forward 10s */}
                    <button
                        onClick={forward10}
                        className="flex items-center gap-0.5 text-white hover:text-white/80 transition-colors"
                        title="Skip forward 10 seconds (→)"
                        data-testid="button-forward-10"
                    >
                        <span className="text-[10px] font-bold tabular-nums">10</span>
                        <SkipForward className="w-4 h-4 fill-white" />
                    </button>

                    {/* Time */}
                    <span className="text-white text-xs font-mono shrink-0 tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="flex-1" />

                    {/* Volume */}
                    <div className="flex items-center gap-1.5 group/vol">
                        <button onClick={e => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-white/80 transition-colors" data-testid="button-toggle-mute">
                            <VolumeIcon className="w-4 h-4" />
                        </button>
                        <input
                            type="range" min={0} max={1} step={0.05}
                            value={muted ? 0 : volume}
                            onChange={e => changeVolume(parseFloat(e.target.value))}
                            onClick={e => e.stopPropagation()}
                            className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-violet-400 cursor-pointer"
                            data-testid="input-volume"
                        />
                    </div>

                    {/* Source badge */}
                    <span className="hidden sm:inline px-1.5 py-0.5 rounded text-[9px] font-mono text-emerald-400 bg-black/40">
                        {streamResult.type.toUpperCase()} · {streamResult.source}
                    </span>

                    {/* Fullscreen */}
                    <button
                        onClick={e => { e.stopPropagation(); toggleFullscreen(); }}
                        className="text-white hover:text-white/80 transition-colors"
                        data-testid="button-fullscreen"
                    >
                        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── HiAnime-Style Episode List ────────────────────────────────────────────────

function EpisodeList({ total, watched, selected, onSelect }: {
    total: number; watched: number; selected: number; onSelect: (ep: number) => void;
}) {
    const PER_RANGE = 100;
    const ranges = Math.ceil(total / PER_RANGE);
    const initRange = Math.ceil(selected / PER_RANGE) || 1;
    const [range, setRange] = useState(initRange);

    const start = (range - 1) * PER_RANGE + 1;
    const end = Math.min(range * PER_RANGE, total);

    // Scroll selected episode into view
    const selRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        selRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [selected]);

    return (
        <div className="space-y-2">
            {/* Range selector */}
            {ranges > 1 && (
                <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: ranges }, (_, i) => i + 1).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-2.5 py-0.5 rounded text-xs font-medium transition-all ${r === range
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted/80 border border-border/30"
                            }`}
                        >
                            {(r - 1) * PER_RANGE + 1}–{Math.min(r * PER_RANGE, total)}
                        </button>
                    ))}
                </div>
            )}

            {/* Episode scroll list */}
            <div className="max-h-52 overflow-y-auto rounded-xl border border-border/30 bg-muted/10 divide-y divide-border/20">
                {Array.from({ length: end - start + 1 }, (_, i) => start + i).map(ep => {
                    const isWatched = ep <= watched;
                    const isSel = ep === selected;
                    return (
                        <button
                            key={ep}
                            ref={isSel ? selRef : undefined}
                            onClick={() => onSelect(ep)}
                            data-testid={`button-episode-${ep}`}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-all hover:bg-muted/40 ${
                                isSel
                                    ? "bg-primary/15 border-l-2 border-primary text-primary font-semibold"
                                    : isWatched
                                        ? "text-muted-foreground/70"
                                        : "text-foreground"
                            }`}
                        >
                            <span className={`text-xs font-mono w-8 shrink-0 ${isSel ? "text-primary" : "text-muted-foreground/60"}`}>
                                {ep}
                            </span>
                            <span className="flex-1 truncate">Episode {ep}</span>
                            {isWatched && !isSel && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 shrink-0" />
                            )}
                            {isSel && (
                                <span className="flex items-center gap-1 text-[10px] text-primary/80 shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                    Playing
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ── Stream Extraction Panel ───────────────────────────────────────────────────

const EXTRACT_LOGS = [
    "Fetching stream servers…",
    "Connecting to video host…",
    "Intercepting network requests…",
    "Decoding video stream…",
    "Almost there…",
];

type ExState = "idle" | "extracting" | "ready" | "error";

interface AllAnimeSource { url: string; sourceName: string; priority: number; type: string; }

function StreamPanel({
    gogoId, animeTitle, episode, watched, totalEps,
    malId, anilistId, isDub, aniwavesAnimeId, aniwavesSlug,
    isAllAnime,
    onEpisodeChange, onChangeSource, onAniwavesFound,
}: {
    gogoId: string; animeTitle: string; episode: number; watched: number; totalEps: number;
    malId?: number | null; anilistId?: number | null; isDub?: boolean;
    aniwavesAnimeId?: string; aniwavesSlug?: string;
    isAllAnime?: boolean;
    onEpisodeChange: (ep: number) => void; onChangeSource: () => void;
    onAniwavesFound?: (animeId: string, slug: string) => void;
}) {
    const [state, setState] = useState<ExState>("idle");
    const [streamResult, setStreamResult] = useState<StreamResult | null>(null);
    const [error, setError] = useState("");
    const [logIdx, setLogIdx] = useState(0);
    const [allAnimeSources, setAllAnimeSources] = useState<AllAnimeSource[]>([]);
    const [sourceIdx, setSourceIdx] = useState(0);

    const extract = useCallback(async () => {
        setState("extracting");
        setStreamResult(null);
        setAllAnimeSources([]);
        setSourceIdx(0);
        setError("");
        setLogIdx(0);
        const timer = setInterval(() => setLogIdx(i => (i + 1) % EXTRACT_LOGS.length), 2500);
        try {
            // ── AllAnime path (Vercel fallback) ──────────────────────────────
            if (isAllAnime) {
                const params = new URLSearchParams({
                    showId: gogoId,
                    episode: String(episode),
                    type: isDub ? "dub" : "sub",
                });
                const res = await fetch(`/api/watch/sources?${params}`);
                const json = await res.json();
                clearInterval(timer);
                if (!res.ok) throw new Error(json.error || "Failed to fetch sources");
                const sources: AllAnimeSource[] = json.sources || [];
                if (sources.length === 0) throw new Error("No sources available for this episode");
                // Try to find a direct HLS/MP4 source first
                const direct = sources.find(s => s.type === "hls" || s.type === "mp4");
                if (direct) {
                    setStreamResult({ stream: direct.url, type: direct.type as "hls" | "mp4", source: direct.sourceName });
                    setState("ready");
                } else {
                    // Iframe sources
                    setAllAnimeSources(sources);
                    setState("ready");
                }
                return;
            }

            // ── Gogoanime / Puppeteer path (with AllAnime fallback) ──────────
            let puppeteerOk = false;
            try {
                let url: string;
                if (isDub) {
                    const params = new URLSearchParams({ episode: String(episode) });
                    if (aniwavesAnimeId && aniwavesSlug) {
                        params.set("animeId", aniwavesAnimeId);
                        params.set("slug", aniwavesSlug);
                    } else {
                        params.set("title", animeTitle);
                    }
                    url = `/api/extract/dub?${params}`;
                } else {
                    url = `/api/extract?id=${encodeURIComponent(gogoId)}&episode=${episode}`;
                }
                const res = await fetch(url);
                const json = await res.json();
                if (res.ok) {
                    clearInterval(timer);
                    setStreamResult(json);
                    setState("ready");
                    if (isDub && json.animeId && json.slug) {
                        onAniwavesFound?.(json.animeId, json.slug);
                    }
                    puppeteerOk = true;
                }
            } catch {}

            // If Puppeteer extraction failed (e.g. Chromium not available on server),
            // fall back to AllAnime which uses a plain API — no Puppeteer needed.
            if (!puppeteerOk) {
                const params = new URLSearchParams({
                    title: animeTitle,
                    episode: String(episode),
                    type: isDub ? "dub" : "sub",
                });
                const res = await fetch(`/api/watch/sources?${params}`);
                const json = await res.json();
                clearInterval(timer);
                if (!res.ok) throw new Error(json.error || "Playback failed");
                const sources: AllAnimeSource[] = json.sources || [];
                if (sources.length === 0) throw new Error("No sources available for this episode");
                const direct = sources.find(s => s.type === "hls" || s.type === "mp4");
                if (direct) {
                    setStreamResult({ stream: direct.url, type: direct.type as "hls" | "mp4", source: direct.sourceName });
                    setState("ready");
                } else {
                    setAllAnimeSources(sources);
                    setState("ready");
                }
            }
        } catch (err: any) {
            clearInterval(timer);
            setError(err.message || "Unknown error");
            setState("error");
        }
    }, [gogoId, animeTitle, episode, isDub, aniwavesAnimeId, aniwavesSlug, isAllAnime]);

    useEffect(() => { extract(); }, [gogoId, episode, isDub, isAllAnime]);

    return (
        <div className="space-y-4">
            {/* Prev / Next */}
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={episode <= 1}
                    onClick={() => onEpisodeChange(episode - 1)}
                    className="gap-1.5 h-8" data-testid="button-prev-episode">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-sm font-semibold">Episode {episode}</span>
                <Button variant="outline" size="sm" disabled={episode >= totalEps}
                    onClick={() => onEpisodeChange(episode + 1)}
                    className="gap-1.5 h-8" data-testid="button-next-episode">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>

            {/* Extracting state */}
            {state === "extracting" && (
                <div className="aspect-video rounded-xl border border-border/40 bg-black flex flex-col items-center justify-center gap-5">
                    <div className="relative">
                        <div className="w-14 h-14 rounded-full border-2 border-primary/20 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
                    </div>
                    <div className="text-center space-y-1.5">
                        <p className="text-sm font-semibold text-white">Loading stream</p>
                        <p className="text-xs text-muted-foreground font-mono">{EXTRACT_LOGS[logIdx]}</p>
                    </div>
                    <div className="w-48 h-0.5 bg-muted/30 rounded-full overflow-hidden">
                        <div className="h-full bg-primary/60 rounded-full animate-pulse w-2/3" />
                    </div>
                </div>
            )}

            {/* HLS/MP4 Player */}
            {state === "ready" && streamResult && (
                <HlsPlayer
                    streamResult={streamResult}
                    malId={malId}
                    anilistId={anilistId}
                    episode={episode}
                    onError={() => { setError("Playback error. Try retrying."); setState("error"); }}
                />
            )}

            {/* AllAnime iframe player (when no direct stream is available) */}
            {state === "ready" && !streamResult && allAnimeSources.length > 0 && (
                <div className="space-y-2">
                    <div className="aspect-video rounded-xl overflow-hidden border border-border/40 bg-black">
                        <iframe
                            src={allAnimeSources[sourceIdx]?.url}
                            className="w-full h-full"
                            allowFullScreen
                            allow="autoplay; fullscreen"
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                            title={`Episode ${episode} — ${allAnimeSources[sourceIdx]?.sourceName}`}
                        />
                    </div>
                    {allAnimeSources.length > 1 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">Server:</span>
                            {allAnimeSources.map((s, i) => (
                                <Button
                                    key={i}
                                    size="sm"
                                    variant={i === sourceIdx ? "default" : "outline"}
                                    className="h-7 text-xs px-2"
                                    onClick={() => setSourceIdx(i)}
                                    data-testid={`button-allanime-source-${i}`}
                                >
                                    {s.sourceName}
                                </Button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Error state */}
            {state === "error" && (
                <div className="aspect-video rounded-xl border border-orange-500/20 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-400 opacity-60" />
                    <div>
                        <p className="font-semibold text-white">Stream failed</p>
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

            {/* Episode list */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Episodes</p>
                    <button
                        onClick={onChangeSource}
                        className="text-[11px] text-muted-foreground/60 hover:text-primary transition-colors"
                        data-testid="button-change-gogo-source"
                    >
                        Change source
                    </button>
                </div>
                <EpisodeList total={totalEps} watched={watched} selected={episode} onSelect={onEpisodeChange} />
            </div>

            <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Sub via Gogoanime · Dub via Aniwaves · Content belongs to respective rights holders.
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
    const [aniwavesInfo, setAniwavesInfo] = useState<{ animeId: string; slug: string } | null>(null);

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setSearching(true);
        setSearched(false);
        let found: GogoResult[] = [];
        try {
            // Try gogoanime first
            const res = await fetch(`/api/gogoanime/search?q=${encodeURIComponent(q)}`);
            if (res.ok) {
                const json = await res.json();
                found = json.results || [];
            }
        } catch {}

        // If gogoanime failed or returned nothing (e.g. blocked on Vercel), fall back to AllAnime
        if (found.length === 0) {
            try {
                const aaRes = await fetch(`/api/allanime/search?q=${encodeURIComponent(q)}`);
                if (aaRes.ok) {
                    const aaJson = await aaRes.json();
                    found = (aaJson.results || []).map((r: any) => ({
                        id: r.id,
                        title: r.name,
                        url: "",
                        image: r.thumbnail || "",
                        isAllAnime: true,
                        subEps: r.subEpisodes || 0,
                        dubEps: r.dubEpisodes || 0,
                    }));
                }
            } catch {}
        }

        setResults(found);
        setSearching(false);
        setSearched(true);
    }, []);

    const selectMatch = async (result: GogoResult) => {
        setGogoMatch(result);
        setLang("sub");
        setSelectedEp(1);
        setEpInfo(null);
        setAniwavesInfo(null);

        // AllAnime results already carry episode counts — no extra fetch needed
        if (result.isAllAnime) {
            setEpInfo({
                start: 1,
                end: result.subEps || 12,
                dubId: (result.dubEps && result.dubEps > 0) ? "dub" : null,
                dubEnd: result.dubEps || null,
            });
            return;
        }

        setEpInfoLoading(true);
        try {
            const res = await fetch(`/api/gogoanime/episodes?id=${encodeURIComponent(result.id)}`);
            if (res.ok) setEpInfo(await res.json());
        } catch {}
        setEpInfoLoading(false);
    };

    const goBack = () => { setGogoMatch(null); setEpInfo(null); setLang("sub"); setAniwavesInfo(null); };

    const listAnime = useMemo(() => {
        if (!gogoMatch) return null;
        const t = gogoMatch.title.toLowerCase();
        return animeList.find(a =>
            a.title.toLowerCase() === t ||
            t.includes(a.title.toLowerCase()) ||
            a.title.toLowerCase().includes(t)
        ) || null;
    }, [gogoMatch, animeList]);

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
                    {/* Header */}
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
                                    {epInfo.end} episodes · Sub &amp; Dub available
                                </p>
                            )}
                        </div>

                        {/* Sub / Dub toggle */}
                        <div className="flex items-center shrink-0 rounded-lg border border-border/50 overflow-hidden">
                            <button
                                onClick={() => { if (lang !== "sub") { setLang("sub"); setSelectedEp(1); } }}
                                data-testid="button-type-sub"
                                className={`px-3 py-1.5 text-xs font-semibold transition-all ${lang === "sub" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
                                SUB
                            </button>
                            <div className="w-px h-4 bg-border/50" />
                            <button
                                onClick={() => { if (lang !== "dub") { setLang("dub"); setSelectedEp(1); } }}
                                data-testid="button-type-dub"
                                className={`px-3 py-1.5 text-xs font-semibold transition-all ${lang === "dub" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"}`}>
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
                        aniwavesAnimeId={aniwavesInfo?.animeId}
                        aniwavesSlug={aniwavesInfo?.slug}
                        isAllAnime={gogoMatch.isAllAnime}
                        onEpisodeChange={setSelectedEp}
                        onChangeSource={goBack}
                        onAniwavesFound={(animeId, slug) => setAniwavesInfo({ animeId, slug })}
                    />
                </div>
            ) : (
                <>
                    {/* Search */}
                    <div className="flex gap-2 max-w-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search anime to watch…"
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
                            Search any anime title to start watching.
                        </p>
                    )}
                    {searching && <p className="text-xs text-muted-foreground py-1">Searching…</p>}
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
                                const listEntry = animeList.find(a => a.title.toLowerCase() === r.title.toLowerCase());
                                const watchedEps = listEntry?.episodesWatched || 0;
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
