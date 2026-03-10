import { useState, useEffect } from "react";
import { fetchAniList, GET_ANALYTICS_QUERY } from "@/services/anilist";
import { getAnimeList } from "@/services/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Loader2, Clock, PieChart as PieChartIcon, Building2, Sparkles,
    Star, TrendingUp, BarChart3, CheckCircle2, Play, BookOpen, Trophy, Flame, Zap
} from "lucide-react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

const COLORS = ['#8b5cf6', '#d946ef', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899'];
const NEON = (c: string, i: number) => `drop-shadow(0px 0px 10px ${COLORS[i % COLORS.length]}90)`;

// genre remapping: AniList genre → user-friendly display label
const GENRE_REMAP: Record<string, string> = {
    "Action": "⚔️ Action",
    "Adventure": "🌍 Adventure",
    "Comedy": "😂 Comedy",
    "Drama": "🎭 Drama",
    "Fantasy": "🧙 Fantasy",
    "Horror": "👻 Horror",
    "Mecha": "🤖 Mecha",
    "Music": "🎵 Music",
    "Mystery": "🔎 Mystery",
    "Psychological": "🧠 Psychological",
    "Romance": "💖 Romance",
    "Sci-Fi": "🚀 Sci-Fi",
    "Slice of Life": "🌸 Slice of Life",
    "Sports": "⚽ Sports",
    "Supernatural": "✨ Supernatural",
    "Thriller": "😱 Thriller",
    "Isekai": "🌀 Isekai",
    "Ecchi": "🔥 Ecchi",
    "Harem": "💞 Harem",
    "School": "🏫 School",
    "Historical": "📜 Historical",
    "Military": "🎖️ Military",
    "Shounen": "💪 Shounen",
    "Shoujo": "🌷 Shoujo",
    "Seinen": "🍷 Seinen",
    "Josei": "👑 Josei",
};

type MediaItem = {
    id: number;
    idMal: number | null;
    format: string;
    duration: number | null;
    episodes: number | null;
    genres: string[];
    seasonYear: number | null;
    title: { english: string | null; romaji: string };
    studios: { nodes: { name: string }[] };
};

export default function AnalyticsDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        totalMinutes: number;
        totalShows: number;
        genreCounts: { name: string; value: number; label: string }[];
        studioCounts: { name: string; value: number; topShows: string[] }[];
        statusBreakdown: { name: string; value: number; color: string }[];
        ratingDist: { label: string; count: number }[];
        avgRating: number;
        topRated: { title: string; rating: number }[];
        yearDist: { year: string; count: number }[];
        mostWatched: { title: string; episodes: number }[];
        completionRate: number;
    } | null>(null);

    useEffect(() => {
        async function fetchAnalytics() {
            try {
                setLoading(true);
                const animeList = await getAnimeList();
                if (!animeList?.length) { setLoading(false); return; }

                const withIds = animeList.filter(a => a.anilistId || a.malId);
                const chunkSize = 50;
                let allMedia: MediaItem[] = [];

                const withAnilist = withIds.filter(a => a.anilistId).map(a => a.anilistId as number);
                for (let i = 0; i < withAnilist.length; i += chunkSize) {
                    const data = await fetchAniList(GET_ANALYTICS_QUERY, { ids: withAnilist.slice(i, i + chunkSize) });
                    if (data?.Page?.media) allMedia = [...allMedia, ...data.Page.media];
                }

                const withMalOnly = withIds.filter(a => !a.anilistId && a.malId).map(a => a.malId as number);
                if (withMalOnly.length > 0) {
                    const MAL_QUERY = `query ($malIds: [Int]) {
                        Page(page:1,perPage:50) {
                            media(idMal_in:$malIds,type:ANIME) {
                                id idMal format duration episodes genres seasonYear
                                title { english romaji }
                                studios(isMain:true) { nodes { name } }
                            }
                        }
                    }`;
                    for (let i = 0; i < withMalOnly.length; i += chunkSize) {
                        const data = await fetchAniList(MAL_QUERY, { malIds: withMalOnly.slice(i, i + chunkSize) });
                        if (data?.Page?.media) allMedia = [...allMedia, ...data.Page.media];
                    }
                }

                // ── Build Stats ────────────────────────────────────────────────
                let totalMinutes = 0;
                const genres: Record<string, number> = {};
                const studios: Record<string, { count: number; shows: string[] }> = {};
                const yearCounts: Record<string, number> = {};
                const mostWatchedMap: { title: string; episodes: number }[] = [];

                allMedia.forEach(anime => {
                    const db = animeList.find(a =>
                        (a.anilistId && a.anilistId === anime.id) ||
                        (a.malId && a.malId === anime.idMal)
                    );
                    const displayTitle = anime.title?.english || anime.title?.romaji || "Unknown";

                    const watchedEps = (() => {
                        if (!db) return 0;
                        if (db.episodesWatched > 0) return db.episodesWatched;
                        if (db.status === 'completed') return db.totalEpisodes || anime.episodes || 0;
                        return anime.episodes || 0;
                    })();

                    const epDuration = anime.duration || (anime.format === 'TV' ? 24 : anime.format === 'MOVIE' ? 90 : 0);
                    totalMinutes += epDuration * watchedEps;
                    mostWatchedMap.push({ title: displayTitle, episodes: watchedEps });

                    anime.genres?.forEach(g => { genres[g] = (genres[g] || 0) + 1; });

                    anime.studios?.nodes?.forEach(s => {
                        if (!s.name) return;
                        if (!studios[s.name]) studios[s.name] = { count: 0, shows: [] };
                        studios[s.name].count++;
                        if (studios[s.name].shows.length < 5) studios[s.name].shows.push(displayTitle);
                    });

                    if (anime.seasonYear) {
                        const y = String(anime.seasonYear);
                        yearCounts[y] = (yearCounts[y] || 0) + 1;
                    }
                });

                // Status breakdown (from Supabase)
                const statusMap: Record<string, number> = {};
                animeList.forEach(a => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
                const statusColors: Record<string, string> = {
                    completed: '#10b981', watching: '#3b82f6',
                    plan_to_watch: '#8b5cf6', on_hold: '#f59e0b', dropped: '#f43f5e'
                };
                const statusLabels: Record<string, string> = {
                    completed: 'Completed', watching: 'Watching',
                    plan_to_watch: 'Plan to Watch', on_hold: 'On Hold', dropped: 'Dropped'
                };
                const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({
                    name: statusLabels[name] || name, value, color: statusColors[name] || '#888'
                }));

                // Rating distribution
                const ratingBuckets: Record<string, number> = { '1-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
                let ratingSum = 0, ratingCount = 0;
                const topRated: { title: string; rating: number }[] = [];
                animeList.filter(a => a.rating != null).forEach(a => {
                    const r = a.rating!;
                    ratingSum += r; ratingCount++;
                    if (r >= 1 && r <= 2) ratingBuckets['1-2']++;
                    else if (r <= 4) ratingBuckets['3-4']++;
                    else if (r <= 6) ratingBuckets['5-6']++;
                    else if (r <= 8) ratingBuckets['7-8']++;
                    else ratingBuckets['9-10']++;
                    topRated.push({ title: a.title, rating: r });
                });
                topRated.sort((a, b) => b.rating - a.rating);

                // Year distribution (top 6 most common)
                const yearDist = Object.entries(yearCounts)
                    .sort((a, b) => Number(b[0]) - Number(a[0]))
                    .slice(0, 8)
                    .map(([year, count]) => ({ year, count }))
                    .reverse();

                // Top studios with show lists
                const sortedStudios = Object.entries(studios)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 5)
                    .map(([name, d]) => ({ name, value: d.count, topShows: d.shows }));

                // Genre sorted
                const sortedGenres = Object.entries(genres)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([name, value]) => ({
                        name, value,
                        label: GENRE_REMAP[name] || name
                    }));

                const mostWatched = mostWatchedMap
                    .sort((a, b) => b.episodes - a.episodes)
                    .slice(0, 5);

                const completed = statusMap['completed'] || 0;
                const completionRate = animeList.length ? Math.round((completed / animeList.length) * 100) : 0;

                setStats({
                    totalMinutes,
                    totalShows: withIds.length,
                    genreCounts: sortedGenres,
                    studioCounts: sortedStudios,
                    statusBreakdown,
                    ratingDist: Object.entries(ratingBuckets).map(([label, count]) => ({ label, count })),
                    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
                    topRated: topRated.slice(0, 5),
                    yearDist,
                    mostWatched,
                    completionRate,
                });
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        }
        fetchAnalytics();
    }, []);

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-72 gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm animate-pulse">Crunching your otaku data…</p>
        </div>
    );
    if (error) return <p className="text-destructive p-8">Error: {error}</p>;
    if (!stats) return <p className="text-muted-foreground p-8 text-center">Add anime to see your analytics!</p>;

    const totalDays = Math.floor(stats.totalMinutes / (24 * 60));
    const remainingHours = Math.floor((stats.totalMinutes % (24 * 60)) / 60);

    return (
        <div className="space-y-8 animate-scale-in pb-10">
            {/* ── Header ── */}
            <div className="flex items-center gap-3">
                <PieChartIcon className="w-7 h-7 text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]" />
                <h2 className="text-3xl font-black text-gradient">Otaku Analytics</h2>
                <span className="ml-auto text-xs text-muted-foreground bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">{stats.totalShows} shows tracked</span>
            </div>

            {/* ── Row 1: Time / Avg Rating / Completion ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="holo-glass border border-primary/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4 text-fuchsia-400" /> Time Wasted</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-4xl font-black text-gradient-accent">{totalDays}<span className="text-xl font-semibold text-muted-foreground">d</span> {remainingHours}<span className="text-xl font-semibold text-muted-foreground">h</span></p>
                        <p className="text-xs text-muted-foreground mt-1">{stats.totalMinutes.toLocaleString()} minutes total</p>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-yellow-500/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400" /> Avg Rating</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-4xl font-black text-yellow-400">{stats.avgRating}<span className="text-xl text-muted-foreground font-semibold">/10</span></p>
                        <p className="text-xs text-muted-foreground mt-1">{stats.topRated.length} rated shows</p>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-emerald-500/20 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                    <CardHeader className="pb-1"><CardTitle className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Completion Rate</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-4xl font-black text-emerald-400">{stats.completionRate}<span className="text-xl text-muted-foreground font-semibold">%</span></p>
                        <div className="w-full bg-muted/50 rounded-full h-1.5 mt-2">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${stats.completionRate}%` }} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 2: Status Breakdown + Top Rated ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-primary/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Watch Status</CardTitle></CardHeader>
                    <CardContent className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.statusBreakdown} cx="50%" cy="50%" outerRadius={80} dataKey="value" stroke="none" paddingAngle={3}>
                                    {stats.statusBreakdown.map((entry, i) => (
                                        <Cell key={i} fill={entry.color} style={{ filter: `drop-shadow(0 0 6px ${entry.color}80)` }} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }} />
                                <Legend wrapperStyle={{ fontSize: '11px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-yellow-500/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> Your Top Rated</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.topRated.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-muted-foreground w-4">#{i + 1}</span>
                                    <span className="text-sm flex-1 truncate font-medium">{a.title}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {"★".repeat(Math.round(a.rating / 2))}{"☆".repeat(5 - Math.round(a.rating / 2))}
                                        <span className="text-xs text-yellow-400 font-bold ml-1">{a.rating}</span>
                                    </div>
                                </div>
                            ))}
                            {stats.topRated.length === 0 && <p className="text-muted-foreground text-sm">Rate your anime to see rankings!</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 3: Top Studios with Anime List ── */}
            <Card className="holo-glass border border-blue-500/20">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Top Studios & Their Anime</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {stats.studioCounts.map((studio, i) => (
                            <div key={i} className="p-3 rounded-xl border border-border/30 bg-card/30 hover:border-primary/30 transition-all group">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-sm text-foreground">{studio.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>{studio.value} shows</span>
                                </div>
                                <div className="space-y-1">
                                    {studio.topShows.map((show, j) => (
                                        <p key={j} className="text-xs text-muted-foreground truncate">• {show}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* ── Row 4: Genre DNA Pie + Bar ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-primary/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-400" /> Genre DNA</CardTitle></CardHeader>
                    <CardContent className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.genreCounts.map(g => ({ ...g, name: g.label }))} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                                    {stats.genreCounts.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ filter: `drop-shadow(0 0 10px ${COLORS[i % COLORS.length]}90)` }} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={{ background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-primary/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Genre Rankings</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.genreCounts.map((g, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs w-5 text-center font-bold" style={{ color: COLORS[i % COLORS.length] }}>#{i + 1}</span>
                                    <span className="text-sm font-medium flex-1">{g.label}</span>
                                    <div className="flex items-center gap-1 ml-auto">
                                        <div className="h-1.5 rounded-full" style={{ width: `${Math.round((g.value / stats.genreCounts[0].value) * 80)}px`, background: COLORS[i % COLORS.length], boxShadow: `0 0 6px ${COLORS[i % COLORS.length]}60` }} />
                                        <span className="text-xs text-muted-foreground w-6 text-right">{g.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 5: Year Chart + Most Binge-Watched ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-primary/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> Anime by Year</CardTitle></CardHeader>
                    <CardContent className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.yearDist} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
                                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#888' }} />
                                <RechartsTooltip contentStyle={{ background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }} />
                                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} style={{ filter: 'drop-shadow(0 0 6px #8b5cf680)' }} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-orange-500/20">
                    <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-orange-400" /> Most Binge-Watched</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {stats.mostWatched.map((a, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs font-bold w-4" style={{ color: COLORS[i] }}>#{i + 1}</span>
                                    <span className="text-sm font-medium flex-1 truncate">{a.title}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">{a.episodes} eps</span>
                                </div>
                            ))}
                            {stats.mostWatched.length === 0 && <p className="text-muted-foreground text-sm">Start watching to see stats!</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── Row 6: Rating Distribution ── */}
            <Card className="holo-glass border border-primary/20">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-violet-400" /> Rating Distribution</CardTitle></CardHeader>
                <CardContent className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.ratingDist} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
                            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#888' }} />
                            <YAxis tick={{ fontSize: 12, fill: '#888' }} />
                            <RechartsTooltip contentStyle={{ background: 'rgba(10,10,15,0.9)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, color: '#fff' }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                {stats.ratingDist.map((_, i) => (
                                    <Cell key={i} fill={['#f43f5e', '#f97316', '#f59e0b', '#10b981', '#8b5cf6'][i]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}
