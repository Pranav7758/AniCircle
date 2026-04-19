import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
    Search, Play, Loader2, Tv, ChevronLeft, ChevronRight, Film,
    RefreshCw, AlertTriangle, Wifi, Clapperboard, Library, Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createAnime, updateAnime, upsertWatchPresence, type AnimeData } from "@/services/supabaseData";
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

interface AutoProgressEvent {
    action: "created" | "updated";
    anime: AnimeData;
}

type UiSeason = AniwatchSeason & {
    uiSeasonNumber: number;
};

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

function normalizeTitle(value: string): string {
    return value
        .toLowerCase()
        .replace(/season\s*\d+|part\s*\d+/gi, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function parseSeasonNumber(label?: string | null): number {
    if (!label) return 1;
    const match = label.match(/season\s*(\d+)/i);
    if (match) return parseInt(match[1], 10);
    return 1;
}

function resolveSeasonNumber(season: Pick<AniwatchSeason, "title" | "anime_id">, fallback: number): number {
    const fromTitle = parseSeasonNumber(season.title);
    if (fromTitle > 1) return fromTitle;
    const idMatch = season.anime_id.match(/(?:season|s)[-_ ]?(\d{1,2})/i);
    if (idMatch) {
        const n = parseInt(idMatch[1], 10);
        if (Number.isFinite(n) && n > 0) return n;
    }
    return fallback;
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
    const [findEpisode, setFindEpisode] = useState("");
    const [episodesOpenMobile, setEpisodesOpenMobile] = useState(false);

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

    const PER_RANGE = 100;
    const selectedNumber = idx >= 0 ? parseInt(episodes[idx].number, 10) : NaN;
    const rangeCount = Math.max(1, Math.ceil(totalEps / PER_RANGE));
    const initialRange = Number.isFinite(selectedNumber) && selectedNumber > 0
        ? Math.ceil(selectedNumber / PER_RANGE)
        : 1;
    const [range, setRange] = useState(initialRange);

    // Keep range in sync when user changes episode via prev/next or programmatically
    useEffect(() => {
        if (!Number.isFinite(selectedNumber) || selectedNumber <= 0) return;
        const r = Math.ceil(selectedNumber / PER_RANGE);
        if (r !== range) setRange(r);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEpId]);

    const rangeStart = (range - 1) * PER_RANGE + 1;
    const rangeEnd = Math.min(range * PER_RANGE, totalEps);

    const jumpToEpisodeNumber = (n: number) => {
        if (!Number.isFinite(n) || n <= 0) return;
        const target = episodes.find((e) => parseInt(e.number, 10) === n);
        if (target) onEpIdChange(target.ep_id);
    };

    const onFindKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== "Enter") return;
        const n = parseInt(findEpisode.trim(), 10);
        jumpToEpisodeNumber(n);
    };

    return (
        <div className="space-y-5">
            {/* HiAnime-style layout: episode sidebar + player */}
            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[320px_1fr] lg:gap-5 items-start">
                {/* Player panel first on mobile */}
                <section className="space-y-4 order-1 lg:order-2 w-full">
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
                </section>

                {/* Episodes sidebar (collapsible on mobile) */}
                <aside className="order-2 lg:order-1 w-full rounded-2xl border border-border/45 bg-card/70 backdrop-blur-sm overflow-hidden lg:sticky lg:top-3">
                    <div className="p-4 border-b border-border/35">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Clapperboard className="w-4 h-4 text-primary/80" />
                                Episodes
                            </p>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 rounded-lg lg:hidden"
                                    onClick={() => setEpisodesOpenMobile((v) => !v)}
                                    data-testid="button-toggle-episodes"
                                >
                                    {episodesOpenMobile ? "Hide" : "Show"}
                                </Button>
                                <button
                                    type="button"
                                    onClick={onBackToSeasons}
                                    className="text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                                    data-testid="button-back-seasons"
                                >
                                    ← Seasons
                                </button>
                            </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                            <div className="flex items-center gap-2 rounded-xl border border-border/45 bg-muted/20 px-3 py-2">
                                <span className="text-[11px] font-mono text-muted-foreground/80">
                                    {String(rangeStart).padStart(3, "0")}–{String(rangeEnd).padStart(3, "0")}
                                </span>
                                <select
                                    value={range}
                                    onChange={(e) => setRange(parseInt(e.target.value, 10))}
                                    className="bg-transparent text-[11px] font-semibold text-foreground outline-none"
                                    aria-label="Episode range"
                                    data-testid="select-episode-range"
                                >
                                    {Array.from({ length: rangeCount }, (_, i) => i + 1).map((r) => {
                                        const s = (r - 1) * PER_RANGE + 1;
                                        const en = Math.min(r * PER_RANGE, totalEps);
                                        return (
                                            <option key={r} value={r}>
                                                {String(s).padStart(3, "0")}–{String(en).padStart(3, "0")}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/70" />
                                <Input
                                    value={findEpisode}
                                    onChange={(e) => setFindEpisode(e.target.value)}
                                    onKeyDown={onFindKeyDown}
                                    placeholder="Find #"
                                    inputMode="numeric"
                                    className="pl-9 h-10 rounded-xl border-border/50 bg-muted/25 text-sm"
                                    data-testid="input-find-episode"
                                />
                            </div>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-10 rounded-xl"
                                onClick={() => jumpToEpisodeNumber(parseInt(findEpisode.trim(), 10))}
                                disabled={!findEpisode.trim()}
                                data-testid="button-find-episode"
                            >
                                Go
                            </Button>
                        </div>
                    </div>

                    <div className={cn("p-3", "lg:block", !episodesOpenMobile && "hidden")}>
                        <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 max-h-[520px] lg:max-h-[520px] overflow-y-auto pr-1">
                            {episodes
                                .filter((ep) => {
                                    const n = parseInt(ep.number, 10);
                                    return Number.isFinite(n) && n >= rangeStart && n <= rangeEnd;
                                })
                                .map((ep) => {
                                    const n = parseInt(ep.number, 10);
                                    const isWatched = Number.isFinite(n) && n > 0 && watched > 0 && n <= watched;
                                    const isSel = ep.ep_id === selectedEpId;
                                    return (
                                        <button
                                            key={ep.ep_id}
                                            type="button"
                                            onClick={() => onEpIdChange(ep.ep_id)}
                                            data-testid={`button-aniw-ep-${ep.ep_id}`}
                                            className={cn(
                                                "h-10 rounded-xl border text-xs font-bold tabular-nums transition-all",
                                                isSel
                                                    ? "bg-primary text-primary-foreground border-primary/60 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]"
                                                    : "bg-muted/20 border-border/45 hover:bg-muted/40 hover:border-primary/45",
                                                isWatched && !isSel && "text-muted-foreground",
                                            )}
                                            title={ep.title || `Episode ${ep.number}`}
                                        >
                                            {n}
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </aside>
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

export default function Watch({
    animeList,
    onAutoProgress,
}: {
    animeList: Anime[];
    onAutoProgress?: (event: AutoProgressEvent) => void;
}) {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [searched, setSearched] = useState(false);

    const [flow, setFlow] = useState<Flow>("browse");
    const [hubShow, setHubShow] = useState<SearchResult | null>(null);
    const [details, setDetails] = useState<AniwatchAnimeDetails | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [seasonPick, setSeasonPick] = useState<UiSeason | null>(null);
    const [episodes, setEpisodes] = useState<AniwatchEpisode[]>([]);
    const [epLoading, setEpLoading] = useState(false);
    const [selectedEpId, setSelectedEpId] = useState<string | null>(null);
    const [lang, setLang] = useState<"sub" | "dub">("sub");
    const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncedSelectionsRef = useRef<Set<string>>(new Set());

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

    // Always keep the selected anime/hero at the top when navigating
    useEffect(() => {
        if (flow === "browse") return;
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [flow, hubShow?.id, seasonPick?.anime_id]);

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

    const seasonsForUi: UiSeason[] = useMemo(() => {
        if (!hubShow) return [];
        const raw = details?.seasons;
        if (raw && raw.length > 0) {
            return raw.map((season, index) => ({
                ...season,
                uiSeasonNumber: resolveSeasonNumber(season, index + 1),
            }));
        }
        return [{ title: "All episodes", anime_id: hubShow.id, uiSeasonNumber: 1 }];
    }, [details, hubShow]);

    const pickSeason = async (season: UiSeason) => {
        setSeasonPick(season);
        setEpisodes([]);
        setSelectedEpId(null);
        setFlow("watch");
        window.scrollTo({ top: 0, behavior: "smooth" });
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
    const selectedEpisodeNumber = useMemo(() => {
        const ep = episodes.find((e) => e.ep_id === selectedEpId);
        if (!ep) return null;
        const n = parseInt(ep.number, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
    }, [episodes, selectedEpId]);
    const resolvedSeasonNumber = useMemo(() => seasonPick?.uiSeasonNumber ?? 1, [seasonPick?.uiSeasonNumber]);
    const canonicalTitle = useMemo(
        () => (details?.title || hubShow?.title || "").trim(),
        [details?.title, hubShow?.title],
    );

    useEffect(() => {
        if (syncTimerRef.current) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
        }
        if (flow !== "watch" || !hubShow || !seasonPick || !selectedEpId || !selectedEpisodeNumber || !canonicalTitle) {
            return;
        }

        const selectionKey = `${hubShow.id}:${seasonPick.anime_id}:${selectedEpId}:${selectedEpisodeNumber}`;
        if (syncedSelectionsRef.current.has(selectionKey)) return;

        syncTimerRef.current = setTimeout(async () => {
            try {
                const normalizedTarget = normalizeTitle(canonicalTitle);
                const candidates = animeList.filter((a) => {
                    const left = normalizeTitle(a.title);
                    return left === normalizedTarget || left.includes(normalizedTarget) || normalizedTarget.includes(left);
                });

                const matched = candidates.find((a) => (a.seasonNumber || 1) === resolvedSeasonNumber) || null;

                if (matched) {
                    const nextEpisodes = Math.max(matched.episodesWatched || 0, selectedEpisodeNumber);
                    const reachedEnd = matched.totalEpisodes !== null && nextEpisodes >= matched.totalEpisodes;
                    const nextStatus = reachedEnd ? "completed" : "watching";
                    if (nextEpisodes !== matched.episodesWatched || nextStatus !== matched.status) {
                        const updated = await updateAnime(matched.id, {
                            episodesWatched: nextEpisodes,
                            status: nextStatus,
                        });
                        onAutoProgress?.({ action: "updated", anime: updated });
                    }
                } else {
                    const [created] = await createAnime([{
                        title: canonicalTitle,
                        episodesWatched: selectedEpisodeNumber,
                        totalEpisodes: epCount || null,
                        status: "watching",
                        rating: null,
                        notes: null,
                        coverImage: poster || null,
                        seasonNumber: resolvedSeasonNumber,
                        anilistId: null,
                        malId: null,
                        ranking: null,
                        isHentai: false,
                    }]);
                    if (created) onAutoProgress?.({ action: "created", anime: created });
                }
                syncedSelectionsRef.current.add(selectionKey);
            } catch {
                // Fail silently; manual controls remain available.
            }
        }, 90000);

        return () => {
            if (syncTimerRef.current) {
                clearTimeout(syncTimerRef.current);
                syncTimerRef.current = null;
            }
        };
    }, [
        flow,
        hubShow,
        seasonPick,
        selectedEpId,
        selectedEpisodeNumber,
        canonicalTitle,
        animeList,
        resolvedSeasonNumber,
        epCount,
        poster,
        onAutoProgress,
    ]);

    // Presence: "currently watching <title> Sx Ep y" for friends UI.
    useEffect(() => {
        if (flow !== "watch" || !selectedEpId || !selectedEpisodeNumber || !canonicalTitle) return;
        const timer = setTimeout(() => {
            upsertWatchPresence({
                animeTitle: canonicalTitle,
                seasonNumber: resolvedSeasonNumber,
                episodeNumber: selectedEpisodeNumber,
            }).catch(() => {});
        }, 15000);
        return () => clearTimeout(timer);
    }, [flow, selectedEpId, selectedEpisodeNumber, canonicalTitle, resolvedSeasonNumber]);

    return (
        <div className="space-y-6 pb-6">
            {/* Header — browse only full title; series/watch slimmer */}
            {flow === "browse" && (
                <div className="space-y-3">
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
                <div className="space-y-5 animate-in fade-in duration-300">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-2.5 py-1.5 w-fit">
                        <Button variant="ghost" size="sm" onClick={resetToBrowse}
                            className="gap-1.5 h-8 text-muted-foreground hover:text-foreground rounded-lg"
                            data-testid="button-back-to-list">
                            <ChevronLeft className="w-4 h-4" /> Browse
                        </Button>
                        {flow === "watch" && (
                            <>
                                <span className="text-muted-foreground/40 text-sm">/</span>
                                <Button variant="ghost" size="sm" onClick={backFromWatchToSeries}
                                    className="h-8 text-muted-foreground hover:text-foreground rounded-lg">
                                    Seasons
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Hero — series hub (always show when not browse); watch keeps context */}
                    <div className="relative overflow-hidden rounded-3xl border border-border/40 bg-card shadow-xl ring-1 ring-white/5">
                        <div className="absolute inset-0 pointer-events-none">
                            {poster ? (
                                <img src={poster} alt="" className="h-full w-full object-cover blur-3xl scale-125 opacity-35" />
                            ) : null}
                            <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-violet-950/20" />
                        </div>
                        <div className="relative flex flex-col md:flex-row gap-6 md:gap-8 p-5 sm:p-6 md:p-8">
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
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {seasonsForUi.map((s) => (
                                    <button
                                        key={`${s.anime_id}-${s.title}`}
                                        type="button"
                                        disabled={detailLoading}
                                        onClick={() => pickSeason(s)}
                                        data-testid={`button-season-${s.anime_id}`}
                                        className={cn(
                                            "rounded-2xl border p-4 text-left transition-all duration-200 min-h-[124px]",
                                            "border-border/50 bg-gradient-to-br from-muted/40 to-muted/10 hover:border-primary/50 hover:from-primary/10 hover:to-violet-950/20 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5",
                                            "disabled:opacity-50 disabled:pointer-events-none",
                                        )}
                                    >
                                        <Clapperboard className="w-5 h-5 text-primary/80 mb-2" />
                                        <p className="font-bold text-sm leading-snug line-clamp-3 text-foreground group-hover:text-primary">
                                            {s.title}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground mt-2 font-medium uppercase tracking-wider">Play</p>
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
                        <div className="space-y-5 max-w-6xl mx-auto">
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
