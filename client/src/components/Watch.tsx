import { useState, useRef, useEffect, useCallback } from "react";
import Hls from "hls.js";
import {
    Search, Play, Pause, Loader2, Tv, ChevronLeft, ChevronRight,
    Film, RefreshCw, Maximize2, Minimize2, Volume2, VolumeX, Volume1,
    SkipForward, SkipBack, AlertTriangle, Wifi, Library, ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Anime {
    id: string;
    title: string;
    episodesWatched: number;
    totalEpisodes: number | null;
    status: string;
    rating: number | null;
    coverImage: string | null;
    seasonNumber: number;
    anilistId: number | null;
    malId: number | null;
}

interface JikanSearchItem {
    mal_id: number;
    title?: string;
    titles?: { en?: string; ja_jp?: string; default?: string };
    episodes?: number | null;
    images?: { jpg?: { image_url?: string; large_image_url?: string } };
    type?: string;
}

interface AniwatchSearchItem {
    anime_id: string;
    title: string;
    image?: string;
    sub?: string | null;
    dub?: string | null;
}

interface AniwatchEpisodeRow {
    ep_id: string;
    number: string;
    title?: string;
}

interface FranchiseSeason {
    malId: number;
    title: string;
    relation: string;
    image: string | null;
    episodes: number | null;
}

function jikanDataToSearchItem(d: any): JikanSearchItem {
    if (!d?.mal_id) throw new Error("Invalid anime payload");
    return {
        mal_id: d.mal_id,
        title: d.title,
        titles: d.titles,
        episodes: d.episodes ?? null,
        images: d.images,
        type: d.type,
    };
}

function dedupeFranchiseSeasons(rows: FranchiseSeason[]): FranchiseSeason[] {
    const seen = new Set<number>();
    const out: FranchiseSeason[] = [];
    for (const r of rows) {
        if (seen.has(r.malId)) continue;
        seen.add(r.malId);
        out.push(r);
    }
    return out;
}

function buildFranchiseFromRelations(
    groups: { relation: string; entry: { mal_id: number; type: string; name: string }[] }[],
    currentMalId: number,
): FranchiseSeason[] {
    const WANT = new Set(["Sequel", "Prequel", "Side story", "Parent story", "Alternative version", "Spin-off"]);
    const raw: FranchiseSeason[] = [];
    for (const g of groups || []) {
        const rel = String(g.relation || "");
        if (!WANT.has(rel)) continue;
        for (const e of g.entry || []) {
            if (e.type !== "anime" || e.mal_id === currentMalId) continue;
            raw.push({
                malId: e.mal_id,
                title: e.name,
                relation: rel,
                image: null,
                episodes: null,
            });
        }
    }
    return dedupeFranchiseSeasons(raw);
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
    onEpisodeNearFinished,
}: {
    streamResult: StreamResult;
    malId?: number | null;
    anilistId?: number | null;
    episode: number;
    onError: () => void;
    onEpisodeNearFinished?: (episode: number) => void;
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
    const nearEndFiredForEp = useRef<number | null>(null);

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

    useEffect(() => {
        nearEndFiredForEp.current = null;
    }, [episode]);

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
            const d = v.duration;
            if (onEpisodeNearFinished && episode > 0 && d > 30 && v.currentTime / d >= 0.82) {
                if (nearEndFiredForEp.current !== episode) {
                    nearEndFiredForEp.current = episode;
                    onEpisodeNearFinished(episode);
                }
            }
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
    }, [episode, onEpisodeNearFinished]);

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

// ── Episode grid + jump (better scrolling than a single cramped list) ───────

const EP_CHUNK = 28;

function WatchEpisodePicker({
    episodes,
    selectedEp,
    watched,
    onSelect,
}: {
    episodes: AniwatchEpisodeRow[];
    selectedEp: number;
    watched: number;
    onSelect: (ep: number) => void;
}) {
    const total = episodes.length;
    const chunkCount = Math.max(1, Math.ceil(total / EP_CHUNK));
    const [chunkIdx, setChunkIdx] = useState(() =>
        Math.min(chunkCount - 1, Math.floor(Math.max(0, selectedEp - 1) / EP_CHUNK)));
    const [jumpVal, setJumpVal] = useState("");

    useEffect(() => {
        setChunkIdx(Math.min(chunkCount - 1, Math.floor(Math.max(0, selectedEp - 1) / EP_CHUNK)));
    }, [selectedEp, total, chunkCount]);

    const start = chunkIdx * EP_CHUNK + 1;
    const end = Math.min((chunkIdx + 1) * EP_CHUNK, total);
    const slice = episodes.slice(start - 1, end);

    const gridRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = gridRef.current?.querySelector(`[data-ep="${selectedEp}"]`);
        el?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }, [selectedEp, chunkIdx]);

    const doJump = () => {
        const n = parseInt(jumpVal, 10);
        if (!Number.isFinite(n) || n < 1 || n > total) return;
        onSelect(n);
        setJumpVal("");
    };

    return (
        <div className="rounded-2xl border border-border/50 bg-gradient-to-b from-card/90 to-muted/20 shadow-sm overflow-hidden">
            <div className="flex flex-col gap-2.5 border-b border-border/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between bg-muted/25">
                <div className="flex items-center gap-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Episodes</p>
                    <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
                        {total} total
                    </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {chunkCount > 1 && (
                        <div className="flex flex-wrap gap-1">
                            {Array.from({ length: chunkCount }, (_, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => setChunkIdx(i)}
                                    className={cn(
                                        "px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors",
                                        i === chunkIdx
                                            ? "bg-primary text-primary-foreground border-primary"
                                            : "bg-background/60 border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                                    )}
                                >
                                    {i * EP_CHUNK + 1}–{Math.min((i + 1) * EP_CHUNK, total)}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Input
                            inputMode="numeric"
                            placeholder="Go to #"
                            value={jumpVal}
                            onChange={e => setJumpVal(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && doJump()}
                            className="h-8 w-24 text-xs rounded-lg bg-background/80"
                        />
                        <Button type="button" size="sm" variant="secondary" className="h-8 text-xs" onClick={doJump}>
                            Go
                        </Button>
                    </div>
                </div>
            </div>

            <ScrollArea className="h-[min(52vh,560px)] w-full touch-pan-y">
                <div
                    ref={gridRef}
                    className="p-3 sm:p-4 grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2"
                >
                    {slice.map((row, i) => {
                        const epNum = start + i;
                        const isSel = epNum === selectedEp;
                        const isWatched = epNum <= watched;
                        const label = row.title?.trim() || `Ep ${row.number}`;
                        return (
                            <button
                                key={row.ep_id}
                                type="button"
                                data-ep={epNum}
                                data-testid={`button-episode-${epNum}`}
                                title={label}
                                onClick={() => onSelect(epNum)}
                                className={cn(
                                    "group relative flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition-all",
                                    isSel
                                        ? "border-primary bg-primary/20 shadow-[0_0_20px_rgba(139,92,246,0.35)] ring-1 ring-primary/50"
                                        : "border-border/50 bg-background/50 hover:border-primary/40 hover:bg-muted/50",
                                    isWatched && !isSel && "opacity-75",
                                )}
                            >
                                <span className={cn(
                                    "text-sm font-black tabular-nums leading-none",
                                    isSel ? "text-primary" : "text-foreground",
                                )}>
                                    {row.number || epNum}
                                </span>
                                <span className="mt-1 line-clamp-2 w-full px-0.5 text-[9px] leading-tight text-muted-foreground group-hover:text-foreground/90">
                                    {row.title?.trim() || "—"}
                                </span>
                                {isWatched && !isSel && (
                                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                                )}
                                {isSel && (
                                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}

function FranchiseSeasonStrip({
    currentMalId,
    seasons,
    disabled,
    onPickSeason,
}: {
    currentMalId: number;
    seasons: FranchiseSeason[];
    disabled: boolean;
    onPickSeason: (malId: number) => void;
}) {
    const nextLike = seasons.filter(s =>
        s.malId !== currentMalId && (s.relation === "Sequel" || s.relation === "Side story"));
    const earlierLike = seasons.filter(s =>
        s.malId !== currentMalId && ["Prequel", "Parent story", "Alternative version", "Spin-off"].includes(s.relation));

    if (nextLike.length === 0 && earlierLike.length === 0) return null;

    const card = (s: FranchiseSeason) => (
        <button
            key={`${s.malId}-${s.relation}`}
            type="button"
            disabled={disabled}
            onClick={() => onPickSeason(s.malId)}
            className={cn(
                "group flex w-[148px] shrink-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-card text-left transition-all",
                "hover:border-primary/50 hover:shadow-md disabled:pointer-events-none disabled:opacity-50",
            )}
        >
            <div className="relative aspect-[4/5] bg-muted/40">
                {s.image
                    ? <img src={s.image} alt="" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
                    : <div className="flex h-full w-full items-center justify-center"><Tv className="h-8 w-8 text-muted-foreground/30" /></div>}
                <Badge className="absolute left-1.5 top-1.5 max-w-[90%] truncate text-[9px]" variant="secondary">
                    {s.relation}
                </Badge>
            </div>
            <div className="flex flex-1 flex-col gap-0.5 p-2">
                <p className="line-clamp-3 text-[11px] font-semibold leading-snug">{s.title}</p>
                {s.episodes != null && (
                    <p className="text-[10px] text-muted-foreground">{s.episodes === 0 ? "?" : s.episodes} eps (MAL)</p>
                )}
                <span className="mt-auto flex items-center gap-0.5 text-[10px] font-medium text-primary opacity-0 transition group-hover:opacity-100">
                    Watch <ArrowRight className="h-3 w-3" />
                </span>
            </div>
        </button>
    );

    return (
        <div className="space-y-5 rounded-2xl border border-border/40 bg-card/30 p-4">
            {nextLike.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Library className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-bold tracking-tight">What&apos;s next</h4>
                        <span className="text-[10px] text-muted-foreground">Sequels &amp; related cours from MAL</span>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
                        {nextLike.map(card)}
                    </div>
                </div>
            )}
            {earlierLike.length > 0 && (
                <div className="space-y-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earlier / alternate entries</h4>
                    <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:thin]">
                        {earlierLike.map(card)}
                    </div>
                </div>
            )}
        </div>
    );
}

function normalizeTitle(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
}

function pickAniwatchMatch(jikanTitle: string, results: AniwatchSearchItem[]): AniwatchSearchItem | null {
    if (!results.length) return null;
    const jn = normalizeTitle(jikanTitle);
    const exact = results.find(r => normalizeTitle(r.title) === jn);
    if (exact) return exact;
    const contains = results.find(r => {
        const rn = normalizeTitle(r.title);
        return rn.includes(jn) || jn.includes(rn);
    });
    return contains || results[0];
}

const LOAD_LOGS = [
    "Resolving playback from Aniwatch…",
    "Handshaking with video CDN…",
    "Buffering stream…",
];

type PbState = "loading" | "ready" | "error";

function AniwatchStreamPanel({
    animeTitle,
    epId,
    episode,
    totalEps,
    watched,
    malId,
    anilistId,
    lang,
    onEpisodeChange,
    onBack,
    onReportEpisodeFinished,
    onPlaybackReady,
}: {
    animeTitle: string;
    epId: string;
    episode: number;
    totalEps: number;
    watched: number;
    malId: number;
    anilistId?: number | null;
    lang: "sub" | "dub";
    onEpisodeChange: (ep: number) => void;
    onBack: () => void;
    onReportEpisodeFinished: (completedEpisode: number) => void;
    onPlaybackReady: () => void;
}) {
    const [state, setState] = useState<PbState>("loading");
    const [error, setError] = useState("");
    const [logIdx, setLogIdx] = useState(0);
    const [playback, setPlayback] = useState<{ mode: "iframe" | "hls" | "mp4"; url: string; source: string } | null>(null);

    const load = useCallback(async () => {
        setState("loading");
        setError("");
        setPlayback(null);
        const timer = setInterval(() => setLogIdx(i => (i + 1) % LOAD_LOGS.length), 2200);
        try {
            const params = new URLSearchParams({ epId, lang });
            const res = await fetch(`/api/aniwatch/playback?${params}`, { signal: AbortSignal.timeout(28000) });
            const json = await res.json();
            clearInterval(timer);
            if (!res.ok) throw new Error(json.error || json.message || "Playback failed");
            if (!json.url || !json.mode) throw new Error("Invalid playback response");
            setPlayback({ mode: json.mode, url: json.url, source: json.source || "stream" });
            setState("ready");
        } catch (err: any) {
            clearInterval(timer);
            setError(err.message || "Unknown error");
            setState("error");
        }
    }, [epId, lang]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (state === "ready") onPlaybackReady();
    }, [state, onPlaybackReady]);

    const streamResult: StreamResult | null = playback && (playback.mode === "hls" || playback.mode === "mp4")
        ? { stream: playback.url, type: playback.mode, source: playback.source }
        : null;

    const goNext = () => {
        onReportEpisodeFinished(episode);
        onEpisodeChange(episode + 1);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" disabled={episode <= 1}
                    onClick={() => onEpisodeChange(episode - 1)}
                    className="gap-1.5 h-8" data-testid="button-prev-episode">
                    <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Button>
                <span className="text-sm font-semibold">Episode {episode}</span>
                <Button variant="outline" size="sm" disabled={episode >= totalEps}
                    onClick={goNext}
                    className="gap-1.5 h-8" data-testid="button-next-episode">
                    Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
            </div>

            {state === "loading" && (
                <div className="aspect-video rounded-xl border border-border/40 bg-black flex flex-col items-center justify-center gap-5">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground font-mono">{LOAD_LOGS[logIdx]}</p>
                </div>
            )}

            {state === "ready" && playback?.mode === "iframe" && (
                <div className="aspect-video rounded-xl overflow-hidden border border-border/40 bg-black">
                    <iframe
                        key={`${epId}-${lang}-${playback.url}`}
                        src={playback.url}
                        className="w-full h-full"
                        allowFullScreen
                        allow="autoplay; fullscreen; encrypted-media"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                        title={`${animeTitle} — Episode ${episode}`}
                    />
                </div>
            )}

            {state === "ready" && streamResult && (
                <HlsPlayer
                    streamResult={streamResult}
                    malId={malId}
                    anilistId={anilistId ?? null}
                    episode={episode}
                    onError={() => { setError("Playback error."); setState("error"); }}
                    onEpisodeNearFinished={onReportEpisodeFinished}
                />
            )}

            {state === "error" && (
                <div className="aspect-video rounded-xl border border-orange-500/20 bg-black flex flex-col items-center justify-center gap-4 p-6 text-center">
                    <AlertTriangle className="h-10 w-10 text-orange-400 opacity-60" />
                    <div>
                        <p className="font-semibold text-white">Stream failed</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs line-clamp-3">{error}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-center">
                        <Button size="sm" variant="outline" onClick={load} className="gap-1.5" data-testid="button-retry-extract">
                            <RefreshCw className="w-3.5 h-3.5" /> Retry
                        </Button>
                        <Button size="sm" variant="outline" onClick={onBack} className="gap-1.5">
                            <Search className="w-3.5 h-3.5" /> Back
                        </Button>
                    </div>
                </div>
            )}

            <p className="text-[11px] text-muted-foreground/40 flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Metadata from Jikan · Streams via your Aniwatch scraper (Vercel). For your list only.
            </p>
        </div>
    );
}

export interface WatchListSyncPayload {
    malId: number;
    title: string;
    coverImage: string | null;
    totalEpisodes: number | null;
    episodesWatched: number;
}

// ── Main Watch Component ──────────────────────────────────────────────────────

export default function Watch({
    animeList,
    onWatchListSync,
}: {
    animeList: Anime[];
    onWatchListSync?: (payload: WatchListSyncPayload) => Promise<void>;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<JikanSearchItem[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [session, setSession] = useState<{
        jikan: JikanSearchItem;
        aniwatchId: string;
        aniwatchTitle: string;
        episodes: AniwatchEpisodeRow[];
    } | null>(null);
    const [linking, setLinking] = useState(false);
    const [linkError, setLinkError] = useState("");
    const [selectedEp, setSelectedEp] = useState(1);
    const [lang, setLang] = useState<"sub" | "dub">("sub");
    const [homeData, setHomeData] = useState<{ spotlight: AniwatchSearchItem[]; trending: AniwatchSearchItem[] } | null>(null);
    const [franchiseSeasons, setFranchiseSeasons] = useState<FranchiseSeason[]>([]);
    const listEnsureRef = useRef(false);

    useEffect(() => {
        if (!session) {
            setFranchiseSeasons([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/jikan/anime/${session.jikan.mal_id}/relations`, { signal: AbortSignal.timeout(15000) });
                if (!res.ok) {
                    if (!cancelled) setFranchiseSeasons([]);
                    return;
                }
                const json = await res.json();
                const built = buildFranchiseFromRelations(json.data || [], session.jikan.mal_id);
                const take = built.slice(0, 16);
                const enriched = await Promise.all(take.map(async (s) => {
                    try {
                        const ar = await fetch(`/api/jikan/anime/${s.malId}`, { signal: AbortSignal.timeout(8000) });
                        if (!ar.ok) return s;
                        const aj = await ar.json();
                        const d = aj.data;
                        return {
                            ...s,
                            image: d?.images?.jpg?.small_image_url || d?.images?.jpg?.image_url || null,
                            episodes: d?.episodes ?? null,
                        };
                    } catch {
                        return s;
                    }
                }));
                if (!cancelled) setFranchiseSeasons(enriched);
            } catch {
                if (!cancelled) setFranchiseSeasons([]);
            }
        })();
        return () => { cancelled = true; };
    }, [session?.jikan.mal_id]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/aniwatch/home", { signal: AbortSignal.timeout(15000) });
                if (!res.ok) return;
                const json = await res.json();
                if (!cancelled) {
                    setHomeData({
                        spotlight: (json.spotlight || []).slice(0, 8),
                        trending: (json.trending || []).slice(0, 10),
                    });
                }
            } catch { /* optional home rail */ }
        })();
        return () => { cancelled = true; };
    }, []);

    const jikanDisplayTitle = (j: JikanSearchItem) =>
        j.title || j.titles?.en || j.titles?.default || j.titles?.ja_jp || "Untitled";

    const jikanImage = (j: JikanSearchItem) =>
        j.images?.jpg?.large_image_url || j.images?.jpg?.image_url || null;

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) return;
        setSearching(true);
        setSearched(false);
        try {
            const res = await fetch(`/api/jikan/search?q=${encodeURIComponent(q)}&limit=20`, { signal: AbortSignal.timeout(15000) });
            const json = await res.json();
            setResults(res.ok && Array.isArray(json.data) ? json.data : []);
        } catch {
            setResults([]);
        }
        setSearching(false);
        setSearched(true);
    }, []);

    const syncList = useCallback(async (episodesWatched: number, j: JikanSearchItem, totalEpisodes: number) => {
        if (!onWatchListSync) return;
        await onWatchListSync({
            malId: j.mal_id,
            title: jikanDisplayTitle(j),
            coverImage: jikanImage(j),
            totalEpisodes: j.episodes ?? totalEpisodes ?? null,
            episodesWatched,
        });
    }, [onWatchListSync]);

    const listByMal = useCallback((malId: number) =>
        animeList.find(a => a.malId === malId && a.seasonNumber === 1) || null,
    [animeList]);

    const resolveStreamingSession = useCallback(async (j: JikanSearchItem) => {
        const title = j.title || j.titles?.en || j.titles?.default || j.titles?.ja_jp || "Untitled";
        const res = await fetch(`/api/aniwatch/search?q=${encodeURIComponent(title)}`, { signal: AbortSignal.timeout(20000) });
        const json = await res.json();
        const raw: AniwatchSearchItem[] = json.results || [];
        const match = pickAniwatchMatch(title, raw);
        if (!match) {
            throw new Error("No streaming source found for this title. Try a different spelling or search.");
        }
        const epRes = await fetch(`/api/aniwatch/episodes/${encodeURIComponent(match.anime_id)}`, { signal: AbortSignal.timeout(20000) });
        const epJson = await epRes.json();
        if (!epRes.ok) throw new Error(epJson.error || "Episode list failed");
        const episodes: AniwatchEpisodeRow[] = epJson.episodes || [];
        if (episodes.length === 0) throw new Error("No episodes returned");
        listEnsureRef.current = false;
        setSession({
            jikan: j,
            aniwatchId: match.anime_id,
            aniwatchTitle: match.title,
            episodes,
        });
        const resume = listByMal(j.mal_id)?.episodesWatched || 0;
        const startEp = Math.min(Math.max(1, resume), episodes.length);
        setSelectedEp(startEp);
    }, [listByMal]);

    const selectJikan = async (j: JikanSearchItem) => {
        setLinking(true);
        setLinkError("");
        setSession(null);
        setSelectedEp(1);
        setLang("sub");
        try {
            await resolveStreamingSession(j);
        } catch (e: any) {
            setLinkError(e.message || "Failed to link stream source");
        }
        setLinking(false);
    };

    const switchToSeasonMal = async (malId: number) => {
        setLinking(true);
        setLinkError("");
        listEnsureRef.current = false;
        try {
            const res = await fetch(`/api/jikan/anime/${malId}`, { signal: AbortSignal.timeout(12000) });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Could not load that season from MAL.");
            const j = jikanDataToSearchItem(json.data);
            setSelectedEp(1);
            setLang("sub");
            await resolveStreamingSession(j);
        } catch (e: any) {
            setLinkError(e.message || "Could not switch season.");
        }
        setLinking(false);
    };

    const openHomePick = async (item: AniwatchSearchItem) => {
        setSearch(item.title);
        await doSearch(item.title);
        setSearched(true);
    };

    const goBack = () => {
        listEnsureRef.current = false;
        setSession(null);
        setLinkError("");
        setSelectedEp(1);
        setLang("sub");
    };

    const currentEpRow = session?.episodes[selectedEp - 1];
    const totalEps = session?.episodes.length || 1;
    const listEntry = session ? listByMal(session.jikan.mal_id) : null;
    const watched = listEntry?.episodesWatched || 0;

    const reportFinished = useCallback((completedEpisode: number) => {
        if (!session) return;
        void syncList(completedEpisode, session.jikan, totalEps);
    }, [session, syncList, totalEps]);

    const onPlaybackReady = useCallback(() => {
        if (!session || listEnsureRef.current) return;
        listEnsureRef.current = true;
        void syncList(Math.max(0, watched), session.jikan, totalEps);
    }, [session, syncList, totalEps, watched]);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2.5">
                <Film className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                <h2 className="text-2xl font-bold">Watch</h2>
            </div>
            <p className="text-muted-foreground text-sm -mt-4">
                Search with Jikan (MyAnimeList), stream via your Aniwatch scraper — progress syncs to your list.
            </p>

            {session && currentEpRow ? (
                <div className="mx-auto max-w-6xl space-y-5">
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card/40 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Button variant="ghost" size="sm" onClick={goBack}
                                className="gap-1.5 -ml-1 h-9 shrink-0 text-muted-foreground hover:text-foreground"
                                data-testid="button-back-to-list">
                                <ChevronLeft className="w-4 h-4" /> Back
                            </Button>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-lg font-bold leading-tight tracking-tight sm:text-xl">
                                        {jikanDisplayTitle(session.jikan)}
                                    </h3>
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                        MAL {session.jikan.mal_id}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                    <span className="font-medium text-foreground/80">Source:</span>{" "}
                                    {session.aniwatchTitle} · {totalEps} episodes on site
                                </p>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                            <div className="flex overflow-hidden rounded-lg border border-border/50">
                                <button
                                    type="button"
                                    onClick={() => { if (lang !== "sub") setLang("sub"); }}
                                    data-testid="button-type-sub"
                                    className={`px-3 py-2 text-xs font-semibold transition-all ${lang === "sub" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                                    SUB
                                </button>
                                <div className="w-px bg-border/50" />
                                <button
                                    type="button"
                                    onClick={() => { if (lang !== "dub") setLang("dub"); }}
                                    data-testid="button-type-dub"
                                    className={`px-3 py-2 text-xs font-semibold transition-all ${lang === "dub" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/50"}`}>
                                    DUB
                                </button>
                            </div>
                        </div>
                    </div>

                    <div key={`${currentEpRow.ep_id}-${lang}`} className="rounded-2xl border border-border/30 bg-black/20 p-2 sm:p-3">
                        <AniwatchStreamPanel
                            animeTitle={jikanDisplayTitle(session.jikan)}
                            epId={currentEpRow.ep_id}
                            episode={selectedEp}
                            totalEps={totalEps}
                            watched={watched}
                            malId={session.jikan.mal_id}
                            anilistId={listEntry?.anilistId}
                            lang={lang}
                            onEpisodeChange={setSelectedEp}
                            onBack={goBack}
                            onReportEpisodeFinished={reportFinished}
                            onPlaybackReady={onPlaybackReady}
                        />
                    </div>

                    <WatchEpisodePicker
                        episodes={session.episodes}
                        selectedEp={selectedEp}
                        watched={watched}
                        onSelect={setSelectedEp}
                    />

                    <FranchiseSeasonStrip
                        currentMalId={session.jikan.mal_id}
                        seasons={franchiseSeasons}
                        disabled={linking}
                        onPickSeason={(id) => { void switchToSeasonMal(id); }}
                    />
                </div>
            ) : (
                <>
                    <div className="flex gap-2 max-w-sm">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search anime (Jikan)…"
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

                    {linking && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Linking Jikan entry to Aniwatch…
                        </p>
                    )}
                    {linkError && (
                        <Card className="border-orange-500/30 bg-orange-500/5">
                            <CardContent className="p-4 text-sm text-orange-200">{linkError}</CardContent>
                        </Card>
                    )}

                    {homeData && (homeData.spotlight.length > 0 || homeData.trending.length > 0) && !searched && !searching && (
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From scraper home</p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {(() => {
                                    const seen = new Set<string>();
                                    const merged: AniwatchSearchItem[] = [];
                                    for (const item of [...homeData.spotlight, ...homeData.trending]) {
                                        if (seen.has(item.anime_id)) continue;
                                        seen.add(item.anime_id);
                                        merged.push(item);
                                        if (merged.length >= 12) break;
                                    }
                                    return merged;
                                })().map((item) => (
                                    <button
                                        key={item.anime_id}
                                        type="button"
                                        onClick={() => void openHomePick(item)}
                                        className="shrink-0 w-24 text-left rounded-lg border border-border/40 overflow-hidden bg-card hover:border-primary/50 transition-colors"
                                    >
                                        <div className="aspect-[3/4] bg-muted/40">
                                            {item.image
                                                ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                                                : <div className="w-full h-full flex items-center justify-center"><Tv className="w-6 h-6 opacity-30" /></div>}
                                        </div>
                                        <p className="p-1.5 text-[10px] font-medium line-clamp-2 leading-tight">{item.title}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {!searched && !searching && (
                        <p className="text-xs text-muted-foreground/50 text-center pt-2">
                            Search by title, or tap a poster above to search that name.
                        </p>
                    )}
                    {searching && <p className="text-xs text-muted-foreground py-1">Searching Jikan…</p>}
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
                                const listEntryRow = listByMal(r.mal_id);
                                const watchedEps = listEntryRow?.episodesWatched || 0;
                                return (
                                    <button
                                        key={r.mal_id}
                                        type="button"
                                        onClick={() => void selectJikan(r)}
                                        disabled={linking}
                                        data-testid={`button-watch-result-${r.mal_id}`}
                                        className="group relative rounded-xl overflow-hidden border border-border/40 bg-card hover:border-primary/50 transition-all hover:shadow-neon text-left disabled:opacity-50"
                                    >
                                        <div className="aspect-[3/4] overflow-hidden bg-muted/30 relative">
                                            {jikanImage(r)
                                                ? <img src={jikanImage(r)!} alt={jikanDisplayTitle(r)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                : <div className="w-full h-full flex items-center justify-center"><Tv className="w-8 h-8 opacity-20" /></div>}
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-neon">
                                                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                                                </div>
                                            </div>
                                            {listEntryRow && (
                                                <div className="absolute top-1.5 left-1.5">
                                                    <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/80 text-white">In List</Badge>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-2">
                                            <p className="text-xs font-semibold line-clamp-2 leading-tight">{jikanDisplayTitle(r)}</p>
                                            {watchedEps > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">{watchedEps} ep in list</p>}
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
