import { useEffect, useState, useCallback, useMemo } from "react";
import { format, formatDistanceToNow, differenceInHours, differenceInMinutes, startOfDay, endOfDay, addDays, startOfWeek, isSameDay } from "date-fns";
import { fetchAniList, GET_WEEKLY_SCHEDULE_QUERY, GET_RELATIONS_DEEP_QUERY } from "@/services/anilist";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Loader2, Sparkles, Tv, AlertTriangle, CalendarDays, Flame, ChevronRight, ChevronLeft, GitBranch, Star, Eye } from "lucide-react";

const VALID_SEQUEL_FORMATS = ["TV", "TV_SHORT", "MOVIE", "ONA", "OVA"];
const MAX_TRAVERSAL_DEPTH = 4;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

interface ScheduleEntry {
    id: number;
    airingAt: number;
    episode: number;
    media: {
        id: number;
        idMal: number | null;
        title: { romaji: string; english: string | null };
        coverImage: { medium: string; large: string };
        format: string | null;
        episodes: number | null;
        averageScore: number | null;
        genres: string[];
        studios: { nodes: { name: string }[] };
    };
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

    if (hoursUntil < 0) return <span className="text-emerald-400 font-semibold text-xs">Aired</span>;
    if (minutesUntil < 60) return (
        <span className="text-red-400 font-bold text-xs animate-pulse">In {minutesUntil}m</span>
    );
    if (hoursUntil < 24) return (
        <span className="text-orange-400 font-semibold text-xs">In {hoursUntil}h {minutesUntil % 60}m</span>
    );
    return (
        <span className="text-primary text-xs font-medium">{formatDistanceToNow(releaseDate, { addSuffix: true })}</span>
    );
}

async function fetchDeepSequelChain(
    startIds: number[],
    userOwnedIds: Set<number>
): Promise<Map<number, any>> {
    const allDiscovered = new Map<number, any>();
    let idsToScan = [...startIds];
    const scannedIds = new Set<number>(startIds);

    for (let depth = 0; depth < MAX_TRAVERSAL_DEPTH && idsToScan.length > 0; depth++) {
        const nextLevelIds: number[] = [];
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
                    if (!scannedIds.has(seq.id)) {
                        scannedIds.add(seq.id);
                        nextLevelIds.push(seq.id);
                    }
                    if (!userOwnedIds.has(seq.id) && !allDiscovered.has(seq.id)) {
                        allDiscovered.set(seq.id, { ...seq, sourceAnime: media, depth });
                    }
                }
            }
        }
        idsToScan = nextLevelIds;
    }
    return allDiscovered;
}

function detectSeasonNumber(sourceAnimeId: number, animeList: Anime[]): number {
    const source = animeList.find(a => a.anilistId === sourceAnimeId);
    if (source) return source.seasonNumber + 1;
    return 1;
}

export default function Radar({ userId, animeList, onAddAnime }: RadarProps) {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const [weekOffset, setWeekOffset] = useState(0);
    const [selectedDay, setSelectedDay] = useState(now.getDay() === 0 ? 6 : now.getDay() - 1); // 0=Mon, 6=Sun
    const [weekSchedule, setWeekSchedule] = useState<ScheduleEntry[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [scheduleError, setScheduleError] = useState<string | null>(null);

    const [missingSequels, setMissingSequels] = useState<any[]>([]);
    const [loadingSequels, setLoadingSequels] = useState(true);
    const [sequelError, setSequelError] = useState<string | null>(null);
    const [sequelRetry, setSequelRetry] = useState(0);
    const [addingId, setAddingId] = useState<number | null>(null);

    const allKnownAnilistIds = useMemo(
        () => new Set(animeList.map(a => a.anilistId).filter(Boolean) as number[]),
        [animeList]
    );
    const watchingIds = useMemo(
        () => animeList.filter(a => a.status === "watching" && a.anilistId).map(a => a.anilistId as number),
        [animeList]
    );
    const completedOrWatchingIds = useMemo(
        () => animeList.filter(a => (a.status === "completed" || a.status === "watching") && a.anilistId).map(a => a.anilistId as number),
        [animeList]
    );

    // Current week days (Mon–Sun) based on weekOffset
    const weekDays = useMemo(() => {
        return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i + weekOffset * 7));
    }, [weekStart, weekOffset]);

    // Fetch the full week's schedule from AniList
    useEffect(() => {
        async function loadWeekSchedule() {
            setLoadingSchedule(true);
            setScheduleError(null);
            const from = Math.floor(startOfDay(weekDays[0]).getTime() / 1000);
            const to = Math.floor(endOfDay(weekDays[6]).getTime() / 1000);

            try {
                let all: ScheduleEntry[] = [];
                let page = 1;
                let hasNext = true;
                while (hasNext && page <= 4) {
                    const data = await fetchAniList(GET_WEEKLY_SCHEDULE_QUERY, {
                        airingAt_greater: from,
                        airingAt_lesser: to,
                        page,
                    });
                    const entries: ScheduleEntry[] = data?.Page?.airingSchedules || [];
                    all = [...all, ...entries];
                    hasNext = data?.Page?.pageInfo?.hasNextPage || false;
                    page++;
                }
                setWeekSchedule(all);
            } catch (err: any) {
                setScheduleError(err?.message || "Failed to load schedule");
            } finally {
                setLoadingSchedule(false);
            }
        }
        loadWeekSchedule();
    }, [weekOffset]);

    // Group schedule entries by day — only include anime the user is tracking
    const scheduleByDay = useMemo(() => {
        const map: ScheduleEntry[][] = Array.from({ length: 7 }, () => []);
        for (const entry of weekSchedule) {
            if (!allKnownAnilistIds.has(entry.media.id)) continue;
            const d = new Date(entry.airingAt * 1000);
            for (let i = 0; i < 7; i++) {
                if (isSameDay(d, weekDays[i])) {
                    map[i].push(entry);
                    break;
                }
            }
        }
        return map;
    }, [weekSchedule, weekDays, allKnownAnilistIds]);

    const todayDayIndex = useMemo(() => {
        for (let i = 0; i < 7; i++) {
            if (isSameDay(now, weekDays[i])) return i;
        }
        return -1;
    }, [weekDays]);

    // Sequel data
    useEffect(() => {
        async function loadMissingSequels() {
            if (completedOrWatchingIds.length === 0) { setLoadingSequels(false); return; }
            setLoadingSequels(true);
            setSequelError(null);
            try {
                const discoveredMap = await fetchDeepSequelChain(completedOrWatchingIds, allKnownAnilistIds);
                let sequelsArray = Array.from(discoveredMap.values());
                sequelsArray.sort((a: any, b: any) => {
                    const priority = (s: any) => {
                        if (s.nextAiringEpisode) return 0;
                        if (s.status === "NOT_YET_RELEASED") return 1;
                        if (s.status === "RELEASING") return 2;
                        return 3;
                    };
                    const pa = priority(a), pb = priority(b);
                    if (pa !== pb) return pa - pb;
                    const getDate = (anime: any) => {
                        if (anime.nextAiringEpisode) return anime.nextAiringEpisode.airingAt * 1000;
                        if (anime.startDate?.year) {
                            return new Date(anime.startDate.year, anime.startDate.month ? anime.startDate.month - 1 : 0, anime.startDate.day || 1).getTime();
                        }
                        return 9999999999999;
                    };
                    return getDate(a) - getDate(b);
                });
                const cutoff = new Date();
                cutoff.setMonth(cutoff.getMonth() - 36);
                const filtered = sequelsArray.filter((seq: any) => {
                    // Only show sequels that are currently airing or already finished — never unreleased
                    if (seq.status === "RELEASING" || seq.nextAiringEpisode) return true;
                    if (seq.status === "FINISHED" && seq.startDate?.year) {
                        const d = new Date(seq.startDate.year, seq.startDate.month ? seq.startDate.month - 1 : 0, seq.startDate.day || 1);
                        return d.getTime() >= cutoff.getTime();
                    }
                    return false;
                });
                setMissingSequels(filtered);
            } catch (err: any) {
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
            setMissingSequels(prev => prev.filter(s => s.id !== sequelNode.id));
        } catch (err) {
            console.error("Quick add failed", err);
        } finally {
            setAddingId(null);
        }
    }, [animeList, onAddAnime]);

    const selectedDayEntries = scheduleByDay[selectedDay] || [];
    const isCurrentWeek = weekOffset === 0;
    const weekLabel = isCurrentWeek
        ? `This Week · ${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d")}`
        : weekOffset < 0
            ? `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d")}`
            : `${format(weekDays[0], "MMM d")} – ${format(weekDays[6], "MMM d")}`;

    return (
        <div className="space-y-8">

            {/* ── Weekly Broadcast Schedule ── */}
            <section>
                <div className="flex items-center gap-2.5 mb-1">
                    <CalendarDays className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(139,92,246,0.7)]" />
                    <h2 className="text-2xl font-bold">Broadcast Schedule</h2>
                    {!loadingSchedule && scheduleByDay.flat().length > 0 && (
                        <span className="ml-auto text-xs bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full text-muted-foreground">
                            {scheduleByDay.flat().length} episodes
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground text-sm mb-4">Your tracked anime airing this week, by day.</p>

                {/* Week Navigator */}
                <div className="flex items-center justify-between mb-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWeekOffset(w => w - 1)}
                        className="gap-1.5 h-8"
                        data-testid="button-prev-week"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">{weekLabel}</span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setWeekOffset(w => w + 1)}
                        className="gap-1.5 h-8"
                        data-testid="button-next-week"
                    >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Day Tabs */}
                <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                    {weekDays.map((day, i) => {
                        const isToday = isSameDay(day, now);
                        const count = scheduleByDay[i]?.length || 0;
                        const isSelected = selectedDay === i;
                        const yourShowsCount = scheduleByDay[i]?.filter(e => allKnownAnilistIds.has(e.media.id)).length || 0;
                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedDay(i)}
                                data-testid={`button-day-${DAYS[i].toLowerCase()}`}
                                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all shrink-0 min-w-[52px] ${
                                    isSelected
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : isToday
                                            ? "border-primary/50 text-primary bg-primary/5 hover:bg-primary/10"
                                            : "border-border/50 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                }`}
                            >
                                <span className="font-semibold">{DAYS[i]}</span>
                                <span className="text-[10px] opacity-70">{format(day, "MMM d")}</span>
                                {count > 0 && (
                                    <span className={`text-[10px] font-bold leading-none ${isSelected ? "opacity-90" : "text-primary"}`}>
                                        {count}{yourShowsCount > 0 ? ` · ${yourShowsCount}★` : ""}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Schedule Content */}
                {loadingSchedule ? (
                    <div className="flex flex-col items-center justify-center p-12 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                        <p className="text-xs text-muted-foreground">Fetching broadcast schedule…</p>
                    </div>
                ) : scheduleError ? (
                    <Card className="bg-muted/30 border-dashed border-orange-500/30">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center gap-3">
                            <AlertTriangle className="h-10 w-10 mb-1 text-orange-400 opacity-70" />
                            <p className="font-medium text-foreground">Couldn't load schedule</p>
                            <p className="text-xs text-muted-foreground max-w-xs">
                                {scheduleError.includes("rate_limit") ? "AniList is rate-limited. Wait a moment and retry." : scheduleError}
                            </p>
                            <Button size="sm" variant="outline" onClick={() => setWeekOffset(w => w)} className="mt-1 gap-1.5">
                                <Loader2 className="w-3.5 h-3.5" /> Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : selectedDayEntries.length === 0 ? (
                    <Card className="bg-muted/30 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground gap-2">
                            <Tv className="h-10 w-10 mb-1 opacity-20" />
                            <p className="font-medium">No episodes on {DAY_FULL[DAYS.indexOf(DAYS[selectedDay])]}</p>
                            <p className="text-xs">Check another day or navigate to a different week.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {selectedDayEntries.map((entry) => {
                            const title = entry.media.title.english || entry.media.title.romaji;
                            const isTracked = allKnownAnilistIds.has(entry.media.id);
                            const dbAnime = isTracked ? animeList.find(a => a.anilistId === entry.media.id) : null;
                            const isWatching = dbAnime?.status === "watching";
                            const airingDate = new Date(entry.airingAt * 1000);
                            const hasAired = airingDate < now;
                            const studio = entry.media.studios?.nodes?.[0]?.name;

                            return (
                                <div
                                    key={entry.id}
                                    data-testid={`schedule-entry-${entry.id}`}
                                    className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${
                                        isTracked
                                            ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                                            : "border-border/40 bg-card/50 hover:bg-muted/30"
                                    }`}
                                >
                                    {/* Time */}
                                    <div className="shrink-0 w-14 text-right">
                                        <p className={`text-xs font-bold tabular-nums ${hasAired ? "text-muted-foreground" : "text-foreground"}`}>
                                            {format(airingDate, "h:mm")}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">{format(airingDate, "a")}</p>
                                    </div>

                                    {/* Thin divider */}
                                    <div className={`w-0.5 h-10 rounded-full shrink-0 ${isTracked ? "bg-primary/40" : "bg-border/40"}`} />

                                    {/* Cover */}
                                    <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 bg-muted/30">
                                        {entry.media.coverImage?.medium ? (
                                            <img
                                                src={entry.media.coverImage.medium}
                                                alt={title}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Tv className="w-4 h-4 opacity-20" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start gap-2 flex-wrap">
                                            <p className={`text-sm font-semibold leading-tight line-clamp-1 ${isTracked ? "text-foreground" : "text-foreground/80"}`} title={title}>
                                                {title}
                                            </p>
                                            {isTracked && (
                                                <Badge className="text-[9px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-primary/30 shrink-0">
                                                    <Eye className="w-2.5 h-2.5 mr-0.5" />
                                                    {isWatching ? "Watching" : dbAnime?.status?.replace("_", " ")}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[11px] text-muted-foreground font-medium">
                                                Ep {entry.episode}{entry.media.episodes ? ` / ${entry.media.episodes}` : ""}
                                            </span>
                                            {studio && (
                                                <span className="text-[11px] text-muted-foreground opacity-60 truncate">{studio}</span>
                                            )}
                                            {entry.media.averageScore && (
                                                <span className="text-[11px] text-amber-400 flex items-center gap-0.5 shrink-0">
                                                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                                                    {(entry.media.averageScore / 10).toFixed(1)}
                                                </span>
                                            )}
                                            {entry.media.format && (
                                                <span className="text-[10px] text-muted-foreground/50">{entry.media.format.replace("_", " ")}</span>
                                            )}
                                        </div>
                                        {isTracked && dbAnime && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <div className="flex-1 max-w-24 bg-muted/40 rounded-full h-1 overflow-hidden">
                                                    <div
                                                        className="h-1 rounded-full bg-primary/60"
                                                        style={{ width: `${Math.min(100, ((dbAnime.episodesWatched || 0) / (entry.episode - 1 || 1)) * 100)}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {dbAnime.episodesWatched || 0} / {entry.episode - 1} watched
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Countdown */}
                                    <div className="shrink-0 text-right">
                                        {hasAired ? (
                                            <span className="text-[10px] text-emerald-400 font-semibold">Aired</span>
                                        ) : (
                                            <AiringCountdown airingAt={entry.airingAt} />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

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
                                            data-testid={`button-add-sequel-${anime.id}`}
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
