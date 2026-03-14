import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes } from "date-fns";
import { fetchAniList, GET_AIRING_SCHEDULE_QUERY, GET_RELATIONS_DEEP_QUERY } from "@/services/anilist";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Loader2, Sparkles, Tv, AlertTriangle, CalendarDays, Flame, ChevronRight, GitBranch, Star } from "lucide-react";

const VALID_SEQUEL_FORMATS = ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA"];
const MAX_TRAVERSAL_DEPTH = 4; // follow sequel chains up to 4 levels deep

interface Anime {
    id: string;
    title: string;
    episodesWatched: number;
    totalEpisodes: number | null;
    status: string;
    rating: number | null;
    notes: string | null;
    coverImage: string | null;
    seasonNumber: number;
    anilistId: number | null;
    malId: number | null;
}

interface RadarProps {
    userId: string;
    animeList: Anime[];
    onAddAnime: (animeData: any) => Promise<void>;
}

function getSeasonLabel(season: string | null, year: number | null) {
    if (!season || !year) return null;
    const icons: Record<string, string> = { WINTER: "❄️", SPRING: "🌸", SUMMER: "☀️", FALL: "🍂" };
    return `${icons[season] || ""} ${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`;
}

function AiringCountdown({ airingAt }: { airingAt: number }) {
    const releaseDate = new Date(airingAt * 1000);
    const now = new Date();
    const hoursUntil = differenceInHours(releaseDate, now);
    const minutesUntil = differenceInMinutes(releaseDate, now);

    if (hoursUntil < 0) return <span className="text-emerald-400 font-semibold text-xs">🟢 Aired!</span>;
    if (minutesUntil < 60) return (
        <span className="text-red-400 font-bold text-xs animate-pulse">
            🔴 In {minutesUntil}m
        </span>
    );
    if (hoursUntil < 24) return (
        <span className="text-orange-400 font-semibold text-xs animate-pulse">
            🟠 In {hoursUntil}h {minutesUntil % 60}m
        </span>
    );
    if (hoursUntil < 72) return (
        <span className="text-yellow-400 font-semibold text-xs">
            🟡 {format(releaseDate, "EEE")} · {formatDistanceToNow(releaseDate, { addSuffix: true })}
        </span>
    );
    return (
        <span className="text-primary text-xs font-medium">
            {format(releaseDate, "MMM d")} · {formatDistanceToNow(releaseDate, { addSuffix: true })}
        </span>
    );
}

// Deep sequel chain traversal — follows SEQUEL relations recursively up to MAX_TRAVERSAL_DEPTH levels
async function fetchDeepSequelChain(
    startIds: number[],
    userOwnedIds: Set<number>
): Promise<Map<number, any>> {
    const allDiscovered = new Map<number, any>(); // id → sequel node data
    let idsToScan = [...startIds];
    const scannedIds = new Set<number>(startIds);

    for (let depth = 0; depth < MAX_TRAVERSAL_DEPTH && idsToScan.length > 0; depth++) {
        const nextLevelIds: number[] = [];

        // Batch 50 at a time
        for (let i = 0; i < idsToScan.length; i += 50) {
            const chunk = idsToScan.slice(i, i + 50);
            const data = await fetchAniList(GET_RELATIONS_DEEP_QUERY, { ids: chunk });

            if (!data?.Page?.media) continue;

            for (const media of data.Page.media) {
                if (!media.relations?.edges) continue;

                const sequels = media.relations.edges.filter((rel: any) =>
                    rel.relationType === "SEQUEL" &&
                    rel.node.type === "ANIME" &&
                    VALID_SEQUEL_FORMATS.includes(rel.node.format)
                ).map((rel: any) => rel.node);

                for (const seq of sequels) {
                    // Queue for next traversal level even if user owns it (to follow the chain)
                    if (!scannedIds.has(seq.id)) {
                        scannedIds.add(seq.id);
                        nextLevelIds.push(seq.id);
                    }

                    // Only add to "missing" if user doesn't own it
                    if (!userOwnedIds.has(seq.id) && !allDiscovered.has(seq.id)) {
                        allDiscovered.set(seq.id, {
                            ...seq,
                            sourceAnime: media,
                            depth,
                        });
                    }
                }
            }
        }

        idsToScan = nextLevelIds;
    }

    return allDiscovered;
}

// Detect what season number a new sequel should be, based on the source in user's list
function detectSeasonNumber(sourceAnimeId: number, animeList: Anime[]): number {
    // Find source in user's list and get its season number, then +1
    const source = animeList.find(a => a.anilistId === sourceAnimeId);
    if (source) return source.seasonNumber + 1;
    return 1;
}

export default function Radar({ userId, animeList, onAddAnime }: RadarProps) {
    const [airingSchedule, setAiringSchedule] = useState<any[]>([]);
    const [missingSequels, setMissingSequels] = useState<any[]>([]);
    const [behindShows, setBehindShows] = useState<any[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [loadingSequels, setLoadingSequels] = useState(true);
    const [airingError, setAiringError] = useState<string | null>(null);
    const [sequelError, setSequelError] = useState<string | null>(null);
    const [scheduleRetry, setScheduleRetry] = useState(0);
    const [sequelRetry, setSequelRetry] = useState(0);
    const [addingId, setAddingId] = useState<number | null>(null);

    // Only "watching" anime with anilistId for the airing schedule
    const watchingIds = animeList
        .filter((a) => a.status === "watching" && a.anilistId)
        .map((a) => a.anilistId as number);

    // "completed" or "watching" anime for sequel scanning
    const completedOrWatchingIds = animeList
        .filter((a) => (a.status === "completed" || a.status === "watching") && a.anilistId)
        .map((a) => a.anilistId as number);

    // All known anilist IDs in user's list (for dedup)
    const allKnownAnilistIds = new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]);

    useEffect(() => {
        async function loadAiringSchedule() {
            if (watchingIds.length === 0) { setLoadingSchedule(false); return; }
            setLoadingSchedule(true);
            setAiringError(null);
            try {
                let allAiring: any[] = [];
                for (let i = 0; i < watchingIds.length; i += 50) {
                    const data = await fetchAniList(GET_AIRING_SCHEDULE_QUERY, { ids: watchingIds.slice(i, i + 50) });
                    if (data?.Page?.media) allAiring = [...allAiring, ...data.Page.media];
                }

                // Sort by nearest episode first
                const withNext = allAiring.filter((m: any) => m.nextAiringEpisode);
                withNext.sort((a: any, b: any) => a.nextAiringEpisode.airingAt - b.nextAiringEpisode.airingAt);

                const enriched = withNext.map((m: any) => ({
                    ...m,
                    dbAnime: animeList.find((a) => a.anilistId === m.id),
                }));

                setAiringSchedule(enriched);

                // Build "behind" list: shows where user watched < latest aired ep
                const behind = withNext
                    .filter((m: any) => m.nextAiringEpisode.episode > 1)
                    .map((m: any) => {
                        const dbMatch = animeList.find((a) => a.anilistId === m.id);
                        const latestAiredEp = m.nextAiringEpisode.episode - 1;
                        const watched = dbMatch?.episodesWatched || 0;
                        const epsBehind = latestAiredEp - watched;
                        return { ...m, dbAnime: dbMatch, latestAiredEp, watched, epsBehind };
                    })
                    .filter(m => m.epsBehind > 0)
                    .sort((a: any, b: any) => b.epsBehind - a.epsBehind);

                setBehindShows(behind);
            } catch (err: any) {
                console.error("Airing schedule fetch failed:", err?.message || err);
                setAiringError(err?.message || "Failed to fetch airing schedule");
            } finally {
                setLoadingSchedule(false);
            }
        }
        loadAiringSchedule();
    }, [JSON.stringify(watchingIds), scheduleRetry]);

    useEffect(() => {
        async function loadMissingSequels() {
            if (completedOrWatchingIds.length === 0) { setLoadingSequels(false); return; }
            setLoadingSequels(true);
            setSequelError(null);
            try {
                // Deep traversal — follows sequel chains up to 4 levels
                const discoveredMap = await fetchDeepSequelChain(completedOrWatchingIds, allKnownAnilistIds);
                let sequelsArray = Array.from(discoveredMap.values());

                // Sort priority:
                // 1. Currently airing (RELEASING with nextAiringEpisode)
                // 2. Upcoming / not yet released
                // 3. Recently finished (newest first)
                sequelsArray.sort((a: any, b: any) => {
                    const priority = (s: any) => {
                        if (s.nextAiringEpisode) return 0;      // currently airing
                        if (s.status === "NOT_YET_RELEASED") return 1;
                        if (s.status === "RELEASING") return 2;
                        return 3;                               // finished
                    };
                    const pa = priority(a), pb = priority(b);
                    if (pa !== pb) return pa - pb;

                    // Secondary: by date
                    const getDate = (anime: any) => {
                        if (anime.nextAiringEpisode) return anime.nextAiringEpisode.airingAt * 1000;
                        if (anime.startDate?.year) {
                            return new Date(
                                anime.startDate.year,
                                anime.startDate.month ? anime.startDate.month - 1 : 0,
                                anime.startDate.day || 1
                            ).getTime();
                        }
                        return 9999999999999;
                    };
                    return getDate(a) - getDate(b);
                });

                // Filter: keep airing/upcoming freely; for finished keep within 36 months
                const cutoffDate = new Date();
                cutoffDate.setMonth(cutoffDate.getMonth() - 36);
                const cutoff = cutoffDate.getTime();

                const filtered = sequelsArray.filter((seq: any) => {
                    if (seq.status === "NOT_YET_RELEASED" || seq.status === "RELEASING" || seq.nextAiringEpisode) return true;
                    if (seq.startDate?.year) {
                        const d = new Date(
                            seq.startDate.year,
                            seq.startDate.month ? seq.startDate.month - 1 : 0,
                            seq.startDate.day || 1
                        );
                        return d.getTime() >= cutoff;
                    }
                    return false;
                });

                setMissingSequels(filtered);
            } catch (err: any) {
                console.error("Sequel fetch failed:", err?.message || err);
                setSequelError(err?.message || "Failed to fetch sequels");
            } finally {
                setLoadingSequels(false);
            }
        }
        loadMissingSequels();
    }, [JSON.stringify(completedOrWatchingIds), animeList.length, sequelRetry]);

    const handleQuickAdd = useCallback(async (sequelNode: any) => {
        setAddingId(sequelNode.id);
        try {
            const seasonNum = detectSeasonNumber(sequelNode.sourceAnime?.id, animeList);
            await onAddAnime({
                title: sequelNode.title.english || sequelNode.title.romaji,
                episodesWatched: 0,
                totalEpisodes: sequelNode.episodes,
                status: "plan_to_watch",
                rating: null,
                notes: "",
                coverImage: sequelNode.coverImage?.large || sequelNode.coverImage?.medium,
                seasonNumber: seasonNum,
                anilistId: sequelNode.id,
                malId: sequelNode.idMal,
                isHentai: false,
            });
            setMissingSequels((prev) => prev.filter((s) => s.id !== sequelNode.id));
        } catch (err) {
            console.error("Quick add failed", err);
        } finally {
            setAddingId(null);
        }
    }, [animeList, onAddAnime]);

    return (
        <div className="space-y-8">

            {/* ── Airing Schedule ── */}
            <section>
                <div className="flex items-center gap-2.5 mb-1">
                    <Clock className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                    <h2 className="text-2xl font-bold">Airing Schedule</h2>
                    {airingSchedule.length > 0 && (
                        <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">
                            {airingSchedule.length} shows
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">Next episode release times for anime you're currently watching.</p>

                {loadingSchedule ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
                ) : airingError ? (
                    <Card className="bg-muted/30 border-dashed border-orange-500/30">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center gap-3">
                            <AlertTriangle className="h-10 w-10 mb-1 text-orange-400 opacity-70" />
                            <p className="font-medium text-foreground">Couldn't load airing schedule</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                {airingError.includes("rate_limit") ? "AniList API is rate-limited. Wait a moment and retry." : airingError}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => setScheduleRetry(r => r + 1)} className="mt-1 gap-1.5">
                                <Loader2 className="w-3.5 h-3.5" /> Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : watchingIds.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                            <Tv className="h-10 w-10 mb-1 opacity-20" />
                            <p className="font-medium">No watching anime with AniList IDs</p>
                            <p className="text-xs">Add anime via search (not manual) to get airing schedule data.</p>
                        </CardContent>
                    </Card>
                ) : airingSchedule.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                            <Tv className="h-10 w-10 mb-1 opacity-20" />
                            <p className="font-medium">All caught up for now</p>
                            <p className="text-xs">None of your "Watching" anime have a next episode scheduled yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {airingSchedule.map((anime) => {
                            const dbAnime = anime.dbAnime as Anime | undefined;
                            const nextEp = anime.nextAiringEpisode.episode;
                            const latestAired = nextEp - 1;
                            const watched = dbAnime?.episodesWatched || 0;
                            const epsBehind = latestAired - watched;
                            const nextAirDate = new Date(anime.nextAiringEpisode.airingAt * 1000);

                            return (
                                <Card key={anime.id} className="card-3d-hover border-border/50 holo-glass overflow-hidden group">
                                    <div className="flex h-36 relative z-10">
                                        <div className="w-24 shrink-0 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                            <img
                                                src={anime.coverImage?.large || anime.coverImage?.medium}
                                                alt="Cover"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>
                                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                            <div>
                                                <h4 className="font-semibold text-sm line-clamp-2 leading-tight" title={anime.title.english || anime.title.romaji}>
                                                    {anime.title.english || anime.title.romaji}
                                                </h4>
                                                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                                                    <Badge className="text-[10px] px-1.5 py-0 h-4">
                                                        Ep {nextEp} next
                                                    </Badge>
                                                    {dbAnime && latestAired > 0 && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            {watched}/{latestAired} watched
                                                        </span>
                                                    )}
                                                </div>
                                                {epsBehind > 0 && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                                                        <span className="text-[10px] text-orange-400 font-medium">
                                                            {epsBehind} ep{epsBehind > 1 ? "s" : ""} behind
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-auto space-y-0.5">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3 text-primary shrink-0" />
                                                    <AiringCountdown airingAt={anime.nextAiringEpisode.airingAt} />
                                                </div>
                                                <p className="text-[9px] text-muted-foreground pl-4">
                                                    {format(nextAirDate, "EEE, MMM d · h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Episodes Behind ── */}
            {!loadingSchedule && behindShows.length > 0 && (
                <section className="pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2.5 mb-1">
                        <Flame className="h-5 w-5 text-orange-400" />
                        <h2 className="text-2xl font-bold">Catching Up</h2>
                        <span className="ml-auto text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-orange-400">
                            {behindShows.length} shows
                        </span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">Currently airing shows where you have episodes waiting.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {behindShows.slice(0, 6).map((anime) => (
                            <Card key={anime.id} className="card-3d-hover border-orange-500/20 holo-glass overflow-hidden group">
                                <div className="flex h-28 relative z-10">
                                    <div className="w-20 shrink-0 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                        <img
                                            src={anime.coverImage?.large || anime.coverImage?.medium}
                                            alt="Cover"
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                    </div>
                                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                        <h4 className="font-semibold text-xs line-clamp-2 leading-tight">
                                            {anime.title.english || anime.title.romaji}
                                        </h4>
                                        <div className="space-y-1">
                                            <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                                                <div
                                                    className="h-1.5 rounded-full bg-orange-500 transition-all"
                                                    style={{ width: `${Math.min(100, (anime.watched / anime.latestAiredEp) * 100)}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>{anime.watched} watched</span>
                                                <span className="text-orange-400 font-semibold">
                                                    {anime.epsBehind} ep{anime.epsBehind > 1 ? "s" : ""} to go
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            {/* ── Sequel Radar ── */}
            <section className="pt-2 border-t border-border/40">
                <div className="flex items-center gap-2.5 mb-1">
                    <Sparkles className="h-5 w-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.7)]" />
                    <h2 className="text-2xl font-bold">Sequel Radar</h2>
                    {missingSequels.length > 0 && (
                        <span className="ml-auto text-xs bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full text-yellow-400">
                            {missingSequels.length} found
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground text-sm mb-1">
                    Full sequel chains for your completed &amp; watching anime — up to 4 levels deep.
                </p>
                {loadingSequels && (
                    <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1.5">
                        <GitBranch className="w-3 h-3" /> Traversing sequel chains…
                    </p>
                )}
                {!loadingSequels && <div className="mb-4" />}

                {loadingSequels ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
                ) : sequelError ? (
                    <Card className="bg-muted/30 border-dashed border-orange-500/30">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center gap-3">
                            <AlertTriangle className="h-10 w-10 mb-1 text-orange-400 opacity-70" />
                            <p className="font-medium text-foreground">Couldn't load sequel data</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                {sequelError.includes("rate_limit") ? "AniList API is rate-limited. Wait a moment and retry." : sequelError}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => setSequelRetry(r => r + 1)} className="mt-1 gap-1.5">
                                <Loader2 className="w-3.5 h-3.5" /> Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : missingSequels.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                            <Sparkles className="h-10 w-10 mb-1 opacity-20" />
                            <p className="font-medium">You're all caught up!</p>
                            <p className="text-xs">No missing sequels found across your entire franchise chains — impressive!</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {missingSequels.map((anime) => {
                            const title = anime.title.english || anime.title.romaji;
                            const seasonLabel = getSeasonLabel(anime.season, anime.seasonYear);
                            const isAiring = !!anime.nextAiringEpisode;
                            const upcoming = anime.status === "NOT_YET_RELEASED";
                            const isAdding = addingId === anime.id;

                            return (
                                <Card key={anime.id} className="card-3d-hover border-primary/20 holo-glass overflow-hidden group flex flex-col">
                                    <div className="flex h-32 relative z-10">
                                        <div className="w-24 shrink-0 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                            {anime.coverImage?.large || anime.coverImage?.medium ? (
                                                <img
                                                    src={anime.coverImage.large || anime.coverImage.medium}
                                                    alt="Cover"
                                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                                                    <Tv className="w-6 h-6 opacity-20" />
                                                </div>
                                            )}
                                            {/* Depth badge */}
                                            {anime.depth > 0 && (
                                                <div className="absolute top-1 left-1 z-20 bg-black/70 rounded px-1 text-[9px] text-white/70 flex items-center gap-0.5">
                                                    <ChevronRight className="w-2 h-2" />×{anime.depth + 1}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                            <div>
                                                <h4 className="font-semibold text-sm line-clamp-2 leading-tight" title={title}>
                                                    {title}
                                                </h4>
                                                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                                    ↳ {anime.sourceAnime?.title?.english || anime.sourceAnime?.title?.romaji}
                                                </p>
                                                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                                                    {isAiring && (
                                                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                                                            Airing
                                                        </Badge>
                                                    )}
                                                    {upcoming && (
                                                        <Badge className="text-[10px] px-1.5 py-0 h-4 bg-blue-500/20 text-blue-400 border-blue-500/30">
                                                            Upcoming
                                                        </Badge>
                                                    )}
                                                    {anime.format && (
                                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                                            {anime.format.replace("_", " ")}
                                                        </Badge>
                                                    )}
                                                    {anime.averageScore && (
                                                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                                                            <Star className="w-2.5 h-2.5 fill-amber-400" />{(anime.averageScore / 10).toFixed(1)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                {seasonLabel && (
                                                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <CalendarDays className="w-2.5 h-2.5 shrink-0" />
                                                        {seasonLabel}
                                                    </p>
                                                )}
                                                {isAiring && anime.nextAiringEpisode && (
                                                    <div className="flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5 text-primary shrink-0" />
                                                        <AiringCountdown airingAt={anime.nextAiringEpisode.airingAt} />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-3 pb-3 flex items-center justify-between gap-2 relative z-10">
                                        {anime.episodes && (
                                            <span className="text-[10px] text-muted-foreground">{anime.episodes} ep{anime.episodes !== 1 ? "s" : ""}</span>
                                        )}
                                        <Button
                                            size="sm"
                                            className="ml-auto h-7 text-xs gap-1"
                                            disabled={isAdding}
                                            onClick={() => handleQuickAdd(anime)}
                                        >
                                            {isAdding ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                            Add to List
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
