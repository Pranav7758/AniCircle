import { useEffect, useState } from "react";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fetchAniList, GET_AIRING_SCHEDULE_QUERY, GET_SEQUELS_QUERY } from "@/services/anilist";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Loader2, Sparkles, Tv, AlertTriangle, Play, CalendarDays, Flame } from "lucide-react";

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
    const icons: Record<string, string> = { WINTER: '❄️', SPRING: '🌸', SUMMER: '☀️', FALL: '🍂' };
    return `${icons[season] || ''} ${season.charAt(0) + season.slice(1).toLowerCase()} ${year}`;
}

function AiringCountdown({ airingAt }: { airingAt: number }) {
    const releaseDate = new Date(airingAt * 1000);
    const now = new Date();
    const hoursUntil = differenceInHours(releaseDate, now);

    if (hoursUntil < 0) return <span className="text-emerald-400 font-semibold text-xs">🟢 Aired!</span>;
    if (hoursUntil < 24) return (
        <span className="text-orange-400 font-semibold text-xs animate-pulse">
            🔴 In {hoursUntil}h {Math.floor(((airingAt * 1000 - now.getTime()) % 3600000) / 60000)}m
        </span>
    );
    return <span className="text-primary text-xs font-medium">{formatDistanceToNow(releaseDate, { addSuffix: true })}</span>;
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

    // Only "watching" anime with anilistId for the airing schedule
    const watchingIds = animeList
        .filter((a) => a.status === "watching" && a.anilistId)
        .map((a) => a.anilistId as number);

    // "completed" or "watching" anime for sequel scanning
    const completedOrWatchingIds = animeList
        .filter((a) => (a.status === "completed" || a.status === "watching") && a.anilistId)
        .map((a) => a.anilistId as number);

    // All known anilist IDs in user's list (for dedup)
    const allKnownAnilistIds = new Set(animeList.map(a => a.anilistId).filter(Boolean));

    useEffect(() => {
        async function loadAiringSchedule() {
            if (watchingIds.length === 0) { setLoadingSchedule(false); return; }
            setLoadingSchedule(true);
            setAiringError(null);
            try {
                const chunkSize = 50;
                let allAiring: any[] = [];
                for (let i = 0; i < watchingIds.length; i += chunkSize) {
                    const data = await fetchAniList(GET_AIRING_SCHEDULE_QUERY, { ids: watchingIds.slice(i, i + chunkSize) });
                    if (data?.Page?.media) allAiring = [...allAiring, ...data.Page.media];
                }

                // Filter out any without airing data first, then sort by nearest
                allAiring = allAiring.filter((m: any) => m.nextAiringEpisode);
                allAiring.sort((a: any, b: any) => a.nextAiringEpisode.airingAt - b.nextAiringEpisode.airingAt);

                const enriched = allAiring
                    .filter((m: any) => m.nextAiringEpisode)
                    .map((m: any) => {
                        const dbMatch = animeList.find((a) => a.anilistId === m.id);
                        return { ...m, dbAnime: dbMatch };
                    });

                setAiringSchedule(enriched);

                // Build "behind" list: currently airing shows where user's watched < (nextEp - 1)
                const behind = allAiring
                    .filter((m: any) => m.nextAiringEpisode && m.nextAiringEpisode.episode > 1)
                    .map((m: any) => {
                        const dbMatch = animeList.find((a) => a.anilistId === m.id);
                        const latestAiredEp = m.nextAiringEpisode.episode - 1;
                        const watched = dbMatch?.episodesWatched || 0;
                        const epsBehind = latestAiredEp - watched;
                        return { ...m, dbAnime: dbMatch, latestAiredEp, watched, epsBehind };
                    })
                    .filter(m => m.epsBehind > 0)
                    .sort((a, b) => b.epsBehind - a.epsBehind);

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
                const chunkSize = 50;
                const newSequelsMap = new Map();

                for (let i = 0; i < completedOrWatchingIds.length; i += chunkSize) {
                    const chunk = completedOrWatchingIds.slice(i, i + chunkSize);
                    const data = await fetchAniList(GET_SEQUELS_QUERY, { ids: chunk });

                    if (data?.Page?.media) {
                        data.Page.media.forEach((media: any) => {
                            if (!media.relations?.edges) return;

                            // ONLY follow SEQUEL relations — never PREQUEL (that would show what came before)
                            const sequels = media.relations.edges
                                .filter((rel: any) =>
                                    rel.relationType === "SEQUEL" &&
                                    (rel.node.format === "TV" || rel.node.format === "TV_SHORT" || rel.node.format === "MOVIE" || rel.node.format === "ONA")
                                )
                                .map((rel: any) => rel.node);

                            sequels.forEach((seq: any) => {
                                // Skip if user already has this in their list (check by anilist ID)
                                if (allKnownAnilistIds.has(seq.id)) return;
                                if (!newSequelsMap.has(seq.id)) {
                                    newSequelsMap.set(seq.id, { ...seq, sourceAnime: media });
                                }
                            });
                        });
                    }
                }

                let sequelsArray = Array.from(newSequelsMap.values());

                // Sort: upcoming first, then recently aired, then unknown
                sequelsArray.sort((a: any, b: any) => {
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

                // Deduplicate franchises: only show the earliest unwatched season
                const seen = new Set<string>();
                const deduped: any[] = [];
                for (const seq of sequelsArray) {
                    const baseTitle = (seq.title.english || seq.title.romaji || "")
                        .toLowerCase()
                        .split(':')[0]
                        .split(' season')[0]
                        .trim()
                        .split(' ').slice(0, 3).join(' ');
                    if (!seen.has(baseTitle)) {
                        seen.add(baseTitle);
                        deduped.push(seq);
                    }
                }

                // Filter: keep upcoming/currently airing, and only recently-aired (within 18 months)
                const cutoffDate = new Date();
                cutoffDate.setMonth(cutoffDate.getMonth() - 18);
                const cutoff = cutoffDate.getTime();

                const filtered = deduped.filter((seq: any) => {
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

    const handleQuickAdd = async (sequelNode: any) => {
        try {
            await onAddAnime({
                title: sequelNode.title.english || sequelNode.title.romaji,
                episodesWatched: 0,
                totalEpisodes: sequelNode.episodes,
                status: "plan_to_watch",
                rating: null,
                notes: "",
                coverImage: sequelNode.coverImage?.large,
                seasonNumber: 1,
                anilistId: sequelNode.id,
                malId: sequelNode.idMal,
                isHentai: false,
            });
            setMissingSequels((prev) => prev.filter((s) => s.id !== sequelNode.id));
        } catch (err) {
            console.error("Quick add failed", err);
        }
    };

    const isCurrentlyAiring = (anime: any) => !!anime.nextAiringEpisode;
    const isUpcoming = (anime: any) => anime.status === "NOT_YET_RELEASED";

    return (
        <div className="space-y-8">

            {/* ── Airing Schedule ── */}
            <section>
                <div className="flex items-center gap-2.5 mb-1">
                    <Clock className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                    <h2 className="text-2xl font-bold">Airing Schedule</h2>
                    {airingSchedule.length > 0 && (
                        <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">{airingSchedule.length} shows</span>
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
                            <p className="text-xs text-muted-foreground max-w-xs">{airingError.includes("rate_limit") ? "AniList API is rate-limited. Wait a moment and retry." : airingError}</p>
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
                            const epsBehind = anime.nextAiringEpisode.episode - 1 - (dbAnime?.episodesWatched || 0);
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
                                                        Ep {anime.nextAiringEpisode.episode} next
                                                    </Badge>
                                                    {dbAnime && (
                                                        <span className="text-[10px] text-muted-foreground">
                                                            You: {dbAnime.episodesWatched}/{anime.nextAiringEpisode.episode - 1} watched
                                                        </span>
                                                    )}
                                                </div>
                                                {epsBehind > 0 && (
                                                    <div className="mt-1 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3 text-orange-400" />
                                                        <span className="text-[10px] text-orange-400 font-medium">{epsBehind} ep{epsBehind > 1 ? 's' : ''} behind</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="mt-auto flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-primary shrink-0" />
                                                <AiringCountdown airingAt={anime.nextAiringEpisode.airingAt} />
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
                        <span className="ml-auto text-xs bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full text-orange-400">{behindShows.length} shows</span>
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
                                        <h4 className="font-semibold text-xs line-clamp-2 leading-tight">{anime.title.english || anime.title.romaji}</h4>
                                        <div className="space-y-1">
                                            <div className="w-full bg-muted/40 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-orange-500 transition-all" style={{ width: `${Math.min(100, (anime.watched / anime.latestAiredEp) * 100)}%` }} />
                                            </div>
                                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                                <span>{anime.watched} watched</span>
                                                <span className="text-orange-400 font-semibold">{anime.epsBehind} ep{anime.epsBehind > 1 ? 's' : ''} to go</span>
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
                        <span className="ml-auto text-xs bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full text-yellow-400">{missingSequels.length} found</span>
                    )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                    Direct sequels of your completed &amp; watching anime that aren't in your list yet.
                </p>

                {loadingSequels ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
                ) : sequelError ? (
                    <Card className="bg-muted/30 border-dashed border-orange-500/30">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center gap-3">
                            <AlertTriangle className="h-10 w-10 mb-1 text-orange-400 opacity-70" />
                            <p className="font-medium text-foreground">Couldn't load sequel data</p>
                            <p className="text-xs text-muted-foreground max-w-xs">{sequelError.includes("rate_limit") ? "AniList API is rate-limited. Wait a moment and retry." : sequelError}</p>
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
                            <p className="text-xs">No missing direct sequels found — impressive!</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {missingSequels.map((anime) => {
                            const title = anime.title.english || anime.title.romaji;
                            const season = getSeasonLabel(anime.season, anime.seasonYear);
                            const isAiring = isCurrentlyAiring(anime);
                            const upcoming = isUpcoming(anime);

                            return (
                                <Card key={anime.id} className="card-3d-hover border-primary/20 holo-glass overflow-hidden group flex flex-col">
                                    <div className="flex h-32 relative z-10">
                                        <div className="w-24 shrink-0 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                            <img
                                                src={anime.coverImage?.large}
                                                alt="Cover"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute top-1.5 left-1.5 z-20">
                                                {isAiring ? (
                                                    <span className="text-[9px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Airing</span>
                                                ) : upcoming ? (
                                                    <span className="text-[9px] font-bold bg-primary text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">Upcoming</span>
                                                ) : (
                                                    <span className="text-[9px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide">New</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                            <div>
                                                <h4 className="font-semibold text-sm line-clamp-2 leading-tight" title={title}>{title}</h4>
                                                <div className="flex flex-wrap gap-1 mt-1.5">
                                                    <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
                                                        {anime.format?.replace(/_/g, " ") || 'TV'}
                                                    </span>
                                                    {anime.episodes && (
                                                        <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-full">
                                                            {anime.episodes} eps
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-1.5 flex items-center gap-1 text-[10px]">
                                                    <CalendarDays className="w-3 h-3 text-primary/60 shrink-0" />
                                                    <span className="text-primary/80 truncate">
                                                        {anime.nextAiringEpisode
                                                            ? <>Ep {anime.nextAiringEpisode.episode} <AiringCountdown airingAt={anime.nextAiringEpisode.airingAt} /></>
                                                            : season
                                                            ? season
                                                            : anime.startDate?.year
                                                            ? `${anime.startDate.year}`
                                                            : "Date TBA"}
                                                    </span>
                                                </div>
                                                {anime.sourceAnime && (
                                                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                                                        Sequel of: {anime.sourceAnime.title?.english || anime.sourceAnime.title?.romaji}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="px-3 pb-3">
                                        <Button
                                            size="sm"
                                            className="w-full h-7 text-xs gap-1 gradient-primary hover:opacity-90 transition-smooth shadow-glow text-white border-0"
                                            onClick={() => handleQuickAdd(anime)}
                                        >
                                            <Plus className="w-3 h-3" /> Add to Plan to Watch
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
