import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fetchAniList, GET_AIRING_SCHEDULE_QUERY, GET_SEQUELS_QUERY } from "@/services/anilist";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Loader2, Sparkles, Tv, AlertCircle } from "lucide-react";

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

export default function Radar({ userId, animeList, onAddAnime }: RadarProps) {
    const [airingSchedule, setAiringSchedule] = useState<any[]>([]);
    const [missingSequels, setMissingSequels] = useState<any[]>([]);
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [loadingSequels, setLoadingSequels] = useState(true);

    // Derive target subset for Airing Schedule ("watching" anime)
    const watchingIds = animeList
        .filter((a) => a.status === "watching" && a.anilistId)
        .map((a) => a.anilistId as number);

    // Derive target subset for Sequel Scanner ("completed" or "watching" anime)
    const completedIds = animeList
        .filter((a) => (a.status === "completed" || a.status === "watching") && a.anilistId)
        .map((a) => a.anilistId as number);

    useEffect(() => {
        async function loadAiringSchedule() {
            if (watchingIds.length === 0) {
                setLoadingSchedule(false);
                return;
            }

            try {
                // AniList limits to 50 items per page, so we must chunk large lists
                const chunkSize = 50;
                let allAiring: any[] = [];

                for (let i = 0; i < watchingIds.length; i += chunkSize) {
                    const chunk = watchingIds.slice(i, i + chunkSize);
                    const data = await fetchAniList(GET_AIRING_SCHEDULE_QUERY, { ids: chunk });

                    if (data?.Page?.media) {
                        const airing = data.Page.media.filter((m: any) => m.nextAiringEpisode);
                        allAiring = [...allAiring, ...airing];
                    }
                }

                // Sort by nearest airing episode
                allAiring.sort((a: any, b: any) => a.nextAiringEpisode.airingAt - b.nextAiringEpisode.airingAt);

                // Map DB ID to the AniList media so we can interact with it later if needed
                const enriched = allAiring.map((m: any) => {
                    const dbMatch = animeList.find((a) => a.anilistId === m.id && a.status === "watching");
                    return { ...m, dbAnime: dbMatch };
                });

                setAiringSchedule(enriched);
            } catch (err) {
                console.error("Failed to fetch airing schedule:", err);
            } finally {
                setLoadingSchedule(false);
            }
        }

        loadAiringSchedule();
    }, [JSON.stringify(watchingIds)]);

    useEffect(() => {
        async function loadMissingSequels() {
            if (completedIds.length === 0) {
                setLoadingSequels(false);
                return;
            }

            try {
                const chunkSize = 50;
                const newSequelsMap = new Map();

                for (let i = 0; i < completedIds.length; i += chunkSize) {
                    const chunk = completedIds.slice(i, i + chunkSize);
                    const data = await fetchAniList(GET_SEQUELS_QUERY, { ids: chunk });

                    if (data?.Page?.media) {
                        data.Page.media.forEach((media: any) => {
                            if (!media.relations?.edges) return;

                            const sequels = media.relations.edges
                                .filter((rel: any) =>
                                    (rel.relationType === "SEQUEL" || rel.relationType === "PREQUEL") &&
                                    (rel.node.format === "TV" || rel.node.format === "TV_SHORT" || rel.node.format === "MOVIE" || rel.node.format === "ONA")
                                )
                                .map((rel: any) => rel.node);

                            sequels.forEach((seq: any) => {
                                // Check if user already has this sequel added
                                const alreadyHas = animeList.some((a) => a.anilistId === seq.id);
                                if (!alreadyHas) {
                                    newSequelsMap.set(seq.id, seq);
                                }
                            });
                        });
                    }
                }

                const sequelsArray = Array.from(newSequelsMap.values());

                // Sort chronologically by start date or next airing date
                sequelsArray.sort((a: any, b: any) => {
                    const getSortDate = (anime: any) => {
                        if (anime.nextAiringEpisode) return anime.nextAiringEpisode.airingAt * 1000;
                        if (anime.startDate?.year) {
                            return new Date(anime.startDate.year, anime.startDate.month ? anime.startDate.month - 1 : 0, anime.startDate.day || 1).getTime();
                        }
                        return 9999999999999; // Unknown dates at the end
                    };
                    return getSortDate(a) - getSortDate(b);
                });

                // Deduplicate by franchise: only show the *earliest* unwatched season for a franchise
                // Example: If user hasn't watched AoT S2, S3, S4... only show S2.
                const dedupedSequels = [];
                const franchiseSet = new Set();

                for (const seq of sequelsArray) {
                    const title = (seq.title.english || seq.title.romaji || "").toLowerCase();
                    // Heuristic: The text before a colon, hyphen, or just the first 4 words
                    let coreName = title.split(':')[0].split('-')[0].trim();
                    if (coreName.split(' ').length > 4) {
                        coreName = coreName.split(' ').slice(0, 4).join(' ');
                    }

                    if (!franchiseSet.has(coreName)) {
                        franchiseSet.add(coreName);
                        dedupedSequels.push(seq);
                    }
                }

                // Filter out ANY anime that aired too long ago (e.g., more than 1.5 years ago).
                // The Sequel Radar should prioritize *upcoming* or *recently released* news, not 2018 anime.
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const oneYearAgoTime = oneYearAgo.getTime();

                const freshSequels = dedupedSequels.filter((seq: any) => {
                    // Always show upcoming unreleased stuff
                    if (seq.status === "NOT_YET_RELEASED" || seq.nextAiringEpisode) return true;

                    // If it has a start date, only show it if it started recently
                    if (seq.startDate?.year) {
                        const startDate = new Date(seq.startDate.year, seq.startDate.month ? seq.startDate.month - 1 : 0, seq.startDate.day || 1);
                        return startDate.getTime() >= oneYearAgoTime;
                    }

                    // If we have literally no idea when it aired, it's safer to hide it to prevent clutter
                    return false;
                });

                setMissingSequels(freshSequels);
            } catch (err) {
                console.error("Failed to fetch sequels:", err);
            } finally {
                setLoadingSequels(false);
            }
        }

        loadMissingSequels();
    }, [JSON.stringify(completedIds), animeList.length]);

    const handleQuickAdd = async (sequelNode: any) => {
        const parentAnime = animeList.find(a => a.title.toLowerCase().includes(sequelNode.title.english?.toLowerCase()?.split(' ')?.[0] || 'xyzxyz'));
        const nextSeason = parentAnime ? parentAnime.seasonNumber + 1 : 1;

        try {
            await onAddAnime({
                title: sequelNode.title.english || sequelNode.title.romaji,
                episodesWatched: 0,
                totalEpisodes: sequelNode.episodes,
                status: "plan_to_watch",
                rating: null,
                notes: "",
                coverImage: sequelNode.coverImage?.large,
                seasonNumber: nextSeason,
                anilistId: sequelNode.id,
                malId: sequelNode.idMal,
                isHentai: false,
            });
            // Remove from missing list directly for quick UI response
            setMissingSequels((prev) => prev.filter((s) => s.id !== sequelNode.id));
        } catch (err) {
            console.error("Quick add failed", err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Airing Schedule Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-primary" />
                    <h2 className="text-2xl font-bold">Airing Schedule</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                    Keep track of exact release times for the anime you are currently watching.
                </p>

                {loadingSchedule ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
                ) : airingSchedule.length === 0 ? (
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                            <Tv className="h-10 w-10 mb-2 opacity-20" />
                            <p>None of your "Watching" anime are currently airing new episodes.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {airingSchedule.map((anime) => {
                            const releaseDate = new Date(anime.nextAiringEpisode.airingAt * 1000);
                            const timeString = formatDistanceToNow(releaseDate, { addSuffix: true });
                            return (
                                <Card key={anime.id} className="card-3d-hover perspective-1000 transform-3d border-border/50 holo-glass overflow-hidden group">
                                    <div className="flex h-32 relative z-10 bg-background/40">
                                        {/* Cover Image */}
                                        <div className="w-24 shrink-0 overflow-hidden relative">
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                            <img
                                                src={anime.coverImage.large || anime.coverImage.medium}
                                                alt="Cover"
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                        </div>
                                        {/* Content */}
                                        <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                            <div>
                                                <h4 className="font-semibold text-sm truncate" title={anime.title.english || anime.title.romaji}>
                                                    {anime.title.english || anime.title.romaji}
                                                </h4>
                                                <div className="mt-1 flex items-center gap-2">
                                                    <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4 uppercase">
                                                        Ep {anime.nextAiringEpisode.episode}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="mt-auto pt-2 text-xs text-primary font-medium flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Releases {timeString}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* Sequel Scanner Section */}
            <section className="pt-4 border-t border-border/50">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    <h2 className="text-2xl font-bold">Sequel Radar</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                    We scanned your "Completed" and "Watching" lists. Here are released direct sequels you haven't added yet!
                </p>

                {loadingSequels ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin opacity-50" /></div>
                ) : missingSequels.length === 0 ? (
                    <Card className="bg-muted/50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center p-10 text-center text-muted-foreground">
                            <Sparkles className="h-10 w-10 mb-2 opacity-20" />
                            <p>You're completely caught up on all sequels!</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {missingSequels.map((anime) => (
                            <Card key={anime.id} className="card-3d-hover perspective-1000 transform-3d border-primary/20 holo-glass border-b-primary/40 overflow-hidden group">
                                <div className="flex h-32 relative z-10 bg-background/40">
                                    {/* Cover Image */}
                                    <div className="w-24 shrink-0 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-background/90 z-10" />
                                        <img
                                            src={anime.coverImage.large}
                                            alt="Cover"
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent flex items-end p-1 z-20">
                                            <span className={`text-[10px] font-bold text-white uppercase tracking-wider w-full text-center truncate ${anime.status === 'NOT_YET_RELEASED' ? 'text-primary drop-shadow-[0_0_5px_rgba(124,58,237,0.8)]' : ''}`}>
                                                {anime.status === 'NOT_YET_RELEASED' ? 'UPCOMING NEWS' : 'NEW SEASON'}
                                            </span>
                                        </div>
                                    </div>
                                    {/* Content */}
                                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-2" title={anime.title.english || anime.title.romaji}>
                                                {anime.title.english || anime.title.romaji}
                                            </h4>
                                            <p className="text-xs text-muted-foreground mt-1 capitalize truncate">
                                                {anime.format?.replace(/_/g, " ") || 'TV'} • {anime.episodes ? `${anime.episodes} Eps` : 'TBA'}
                                            </p>
                                            <p className="text-xs text-primary/80 mt-0.5 mt-auto">
                                                {(() => {
                                                    if (anime.nextAiringEpisode) {
                                                        const d = new Date(anime.nextAiringEpisode.airingAt * 1000);
                                                        return `Releasing: ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
                                                    } else if (anime.startDate?.year) {
                                                        const d = new Date(anime.startDate.year, anime.startDate.month ? anime.startDate.month - 1 : 0, anime.startDate.day || 1);
                                                        return d > new Date() ? `Expected: ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : `Aired: ${d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`;
                                                    }
                                                    return "Release date unknown";
                                                })()}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            className="mt-2 w-full h-7 text-xs gap-1 gradient-primary hover:opacity-90 transition-smooth shadow-glow text-white border-0"
                                            onClick={() => handleQuickAdd(anime)}
                                        >
                                            <Plus className="w-3 h-3" /> Add to List
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
