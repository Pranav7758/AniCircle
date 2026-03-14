import { useState, useEffect } from "react";
import { fetchAniList, GET_ANALYTICS_QUERY } from "@/services/anilist";
import { getAnimeList } from "@/services/supabaseData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Loader2, Clock, PieChart as PieChartIcon, Building2, Sparkles,
    Star, TrendingUp, BarChart3, CheckCircle2, Trophy, Flame, Zap,
    Tv, Film, Play, Brain, Heart, Swords, Laugh, Ghost, Rocket,
    Users, BookOpen, Activity
} from "lucide-react";
import {
    PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
    Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
    AreaChart, Area
} from "recharts";

const COLORS = ['#8b5cf6', '#d946ef', '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#ec4899', '#a3e635', '#fb923c'];
const STATUS_COLORS: Record<string, string> = {
    completed: '#10b981', watching: '#3b82f6',
    plan_to_watch: '#8b5cf6', on_hold: '#f59e0b', dropped: '#f43f5e'
};
const STATUS_LABELS: Record<string, string> = {
    completed: 'Completed', watching: 'Watching',
    plan_to_watch: 'Plan to Watch', on_hold: 'On Hold', dropped: 'Dropped'
};
const FORMAT_COLORS: Record<string, string> = {
    TV: '#8b5cf6', MOVIE: '#3b82f6', OVA: '#10b981',
    ONA: '#f59e0b', SPECIAL: '#ec4899', TV_SHORT: '#06b6d4', MUSIC: '#f43f5e'
};
const SEASON_COLORS: Record<string, string> = {
    WINTER: '#93c5fd', SPRING: '#86efac', SUMMER: '#fde047', FALL: '#fb923c'
};
const SEASON_ICONS: Record<string, string> = {
    WINTER: '❄️', SPRING: '🌸', SUMMER: '☀️', FALL: '🍂'
};

const GENRE_REMAP: Record<string, string> = {
    "Action": "⚔️ Action", "Adventure": "🌍 Adventure", "Comedy": "😂 Comedy",
    "Drama": "🎭 Drama", "Fantasy": "🧙 Fantasy", "Horror": "👻 Horror",
    "Mecha": "🤖 Mecha", "Music": "🎵 Music", "Mystery": "🔎 Mystery",
    "Psychological": "🧠 Psychological", "Romance": "💖 Romance", "Sci-Fi": "🚀 Sci-Fi",
    "Slice of Life": "🌸 Slice of Life", "Sports": "⚽ Sports", "Supernatural": "✨ Supernatural",
    "Thriller": "😱 Thriller", "Isekai": "🌀 Isekai", "Ecchi": "🔥 Ecchi",
    "Harem": "💞 Harem", "School": "🏫 School", "Historical": "📜 Historical",
    "Military": "🎖️ Military", "Shounen": "💪 Shounen", "Shoujo": "🌷 Shoujo",
    "Seinen": "🍷 Seinen", "Josei": "👑 Josei",
};

const PERSONA_MAP: { genres: string[]; label: string; desc: string; icon: any; color: string }[] = [
    { genres: ["Action", "Shounen"], label: "Shonen Warrior", desc: "You live for hype, power-ups, and never giving up!", icon: Swords, color: "#f43f5e" },
    { genres: ["Romance", "Shoujo"], label: "Hopeless Romantic", desc: "Your heart belongs to love stories and emotional arcs.", icon: Heart, color: "#ec4899" },
    { genres: ["Psychological", "Thriller"], label: "Deep Thinker", desc: "You crave mind-bending plots and complex characters.", icon: Brain, color: "#8b5cf6" },
    { genres: ["Comedy", "Slice of Life"], label: "Chill Enjoyer", desc: "You watch anime to relax and feel warm inside.", icon: Laugh, color: "#f59e0b" },
    { genres: ["Sci-Fi", "Mecha"], label: "Sci-Fi Nerd", desc: "You're all about futuristic tech and epic battles.", icon: Rocket, color: "#3b82f6" },
    { genres: ["Fantasy", "Adventure"], label: "World Explorer", desc: "You get lost in rich fantasy worlds and grand quests.", icon: Sparkles, color: "#10b981" },
    { genres: ["Horror", "Supernatural"], label: "Dark Soul", desc: "The darker and scarier, the better. You embrace the abyss.", icon: Ghost, color: "#6366f1" },
    { genres: ["Sports"], label: "Sports Fanatic", desc: "Nothing beats the thrill of competition and teamwork.", icon: Activity, color: "#06b6d4" },
    { genres: ["Drama", "Historical"], label: "Drama Connoisseur", desc: "You appreciate complex storylines and deep emotional weight.", icon: BookOpen, color: "#a78bfa" },
];

type MediaItem = {
    id: number; idMal: number | null; format: string; duration: number | null;
    episodes: number | null; genres: string[]; season: string | null;
    seasonYear: number | null; averageScore: number | null; source: string | null;
    title: { english: string | null; romaji: string };
    studios: { nodes: { name: string }[] };
};

function getPersona(genreCounts: { name: string; value: number }[]) {
    if (!genreCounts.length) return null;
    const top3 = new Set(genreCounts.slice(0, 3).map(g => g.name));
    for (const p of PERSONA_MAP) {
        if (p.genres.some(g => top3.has(g))) return p;
    }
    return PERSONA_MAP[0];
}

function StatCard({ title, value, sub, icon: Icon, color, extra }: {
    title: string; value: string; sub?: string; icon: any; color: string; extra?: any;
}) {
    return (
        <Card className={`holo-glass border relative overflow-hidden group`} style={{ borderColor: `${color}30` }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(135deg, ${color}08, transparent)` }} />
            <CardHeader className="pb-1">
                <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <p className="text-3xl font-black" style={{ color }}>{value}</p>
                {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                {extra}
            </CardContent>
        </Card>
    );
}

const CustomTooltipStyle = {
    background: 'rgba(10,10,15,0.95)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: 10,
    color: '#fff',
    fontSize: 12,
};

export default function AnalyticsDashboard() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<{
        totalMinutes: number;
        totalEpisodesWatched: number;
        totalShows: number;
        totalWithIds: number;
        genreCounts: { name: string; value: number; label: string }[];
        studioCounts: { name: string; value: number; topShows: string[] }[];
        statusBreakdown: { name: string; value: number; color: string }[];
        formatBreakdown: { name: string; value: number; color: string }[];
        seasonBreakdown: { name: string; value: number; color: string; icon: string }[];
        ratingDist: { label: string; count: number }[];
        avgRating: number;
        avgCommunityScore: number;
        communityComparison: { label: string; personal: number; community: number }[];
        topRated: { title: string; rating: number }[];
        yearDist: { year: string; count: number }[];
        mostWatched: { title: string; episodes: number }[];
        completionRate: number;
        persona: typeof PERSONA_MAP[0] | null;
        genreRadar: { genre: string; count: number; fullMark: number }[];
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
                                id idMal format duration episodes genres season seasonYear averageScore source
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

                let totalMinutes = 0;
                let totalEpisodesWatched = 0;
                const genres: Record<string, number> = {};
                const studios: Record<string, { count: number; shows: string[] }> = {};
                const yearCounts: Record<string, number> = {};
                const seasonCounts: Record<string, number> = {};
                const formatCounts: Record<string, number> = {};
                const mostWatchedMap: { title: string; episodes: number }[] = [];
                let communityScoreSum = 0;
                let communityScoreCount = 0;

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
                        return 0;
                    })();

                    const epDuration = anime.duration || (anime.format === 'TV' ? 24 : anime.format === 'MOVIE' ? 90 : 24);
                    totalMinutes += epDuration * watchedEps;
                    totalEpisodesWatched += watchedEps;
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
                    if (anime.season) {
                        seasonCounts[anime.season] = (seasonCounts[anime.season] || 0) + 1;
                    }
                    if (anime.format) {
                        formatCounts[anime.format] = (formatCounts[anime.format] || 0) + 1;
                    }
                    if (anime.averageScore) {
                        communityScoreSum += anime.averageScore / 10;
                        communityScoreCount++;
                    }
                });

                const statusMap: Record<string, number> = {};
                animeList.forEach(a => { statusMap[a.status] = (statusMap[a.status] || 0) + 1; });
                const statusBreakdown = Object.entries(statusMap).map(([name, value]) => ({
                    name: STATUS_LABELS[name] || name, value, color: STATUS_COLORS[name] || '#888'
                }));

                const formatBreakdown = Object.entries(formatCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, value]) => ({
                        name: name.replace('_', ' '),
                        value,
                        color: FORMAT_COLORS[name] || '#888'
                    }));

                const seasonOrder = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
                const seasonBreakdown = seasonOrder
                    .filter(s => seasonCounts[s])
                    .map(s => ({
                        name: s.charAt(0) + s.slice(1).toLowerCase(),
                        value: seasonCounts[s],
                        color: SEASON_COLORS[s] || '#888',
                        icon: SEASON_ICONS[s] || '📅'
                    }));

                const ratingBuckets: Record<string, number> = { '1-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
                let ratingSum = 0, ratingCount = 0;
                const topRated: { title: string; rating: number }[] = [];
                const ratingByGenre: Record<string, { sum: number; count: number }> = {};

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

                const yearDist = Object.entries(yearCounts)
                    .sort((a, b) => Number(a[0]) - Number(b[0]))
                    .slice(-10)
                    .map(([year, count]) => ({ year, count }));

                const sortedStudios = Object.entries(studios)
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 6)
                    .map(([name, d]) => ({ name, value: d.count, topShows: d.shows }));

                const sortedGenres = Object.entries(genres)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 10)
                    .map(([name, value]) => ({ name, value, label: GENRE_REMAP[name] || name }));

                const top8Genres = sortedGenres.slice(0, 8);
                const maxGenre = top8Genres[0]?.value || 1;
                const genreRadar = top8Genres.map(g => ({
                    genre: g.name.length > 12 ? g.name.slice(0, 10) + '…' : g.name,
                    count: Math.round((g.value / maxGenre) * 100),
                    fullMark: 100
                }));

                const mostWatched = mostWatchedMap
                    .sort((a, b) => b.episodes - a.episodes)
                    .slice(0, 5);

                const completed = statusMap['completed'] || 0;
                const completionRate = animeList.length ? Math.round((completed / animeList.length) * 100) : 0;
                const avgRating = ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;
                const avgCommunityScore = communityScoreCount ? Math.round((communityScoreSum / communityScoreCount) * 10) / 10 : 0;

                const communityComparison = ratingCount > 0 && avgCommunityScore > 0
                    ? [{ label: "Your Avg", personal: avgRating, community: avgCommunityScore }]
                    : [];

                setStats({
                    totalMinutes, totalEpisodesWatched,
                    totalShows: animeList.length,
                    totalWithIds: withIds.length,
                    genreCounts: sortedGenres,
                    studioCounts: sortedStudios,
                    statusBreakdown, formatBreakdown, seasonBreakdown,
                    ratingDist: Object.entries(ratingBuckets).map(([label, count]) => ({ label, count })),
                    avgRating, avgCommunityScore, communityComparison,
                    topRated: topRated.slice(0, 5),
                    yearDist, mostWatched, completionRate,
                    persona: getPersona(sortedGenres),
                    genreRadar,
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
    const totalMinutesDisplay = stats.totalMinutes >= 60
        ? `${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`
        : `${stats.totalMinutes}m`;

    return (
        <div className="space-y-6 animate-scale-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-3 flex-wrap">
                <PieChartIcon className="w-7 h-7 text-primary drop-shadow-[0_0_10px_rgba(139,92,246,0.9)]" />
                <h2 className="text-3xl font-black text-gradient">Otaku Analytics</h2>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground bg-primary/10 border border-primary/20 px-2 py-1 rounded-full">{stats.totalShows} total shows</span>
                    <span className="text-xs text-muted-foreground bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-full">{stats.totalWithIds} tracked</span>
                </div>
            </div>

            {/* Row 1: 4 Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    title="Time Invested"
                    value={totalDays > 0 ? `${totalDays}d ${remainingHours}h` : totalMinutesDisplay}
                    sub={`${stats.totalMinutes.toLocaleString()} minutes total`}
                    icon={Clock}
                    color="#d946ef"
                />
                <StatCard
                    title="Episodes Watched"
                    value={stats.totalEpisodesWatched.toLocaleString()}
                    sub={`across ${stats.totalWithIds} shows`}
                    icon={Play}
                    color="#3b82f6"
                />
                <StatCard
                    title="Avg Rating"
                    value={stats.avgRating > 0 ? `${stats.avgRating}/10` : "—"}
                    sub={stats.avgRating > 0 ? `Community avg: ${stats.avgCommunityScore}/10` : "Rate shows to see avg"}
                    icon={Star}
                    color="#f59e0b"
                />
                <StatCard
                    title="Completion Rate"
                    value={`${stats.completionRate}%`}
                    sub="of all tracked shows"
                    icon={CheckCircle2}
                    color="#10b981"
                    extra={
                        <div className="w-full bg-muted/50 rounded-full h-1.5 mt-2">
                            <div className="h-1.5 rounded-full transition-all" style={{ width: `${stats.completionRate}%`, background: '#10b981', boxShadow: '0 0 8px #10b98160' }} />
                        </div>
                    }
                />
            </div>

            {/* Row 2: Status Pie + Format Breakdown + Otaku Persona */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="holo-glass border border-primary/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Watch Status</CardTitle></CardHeader>
                    <CardContent className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stats.statusBreakdown} cx="50%" cy="45%" outerRadius={70} innerRadius={30} dataKey="value" stroke="none" paddingAngle={3}>
                                    {stats.statusBreakdown.map((e, i) => (
                                        <Cell key={i} fill={e.color} style={{ filter: `drop-shadow(0 0 5px ${e.color}80)` }} />
                                    ))}
                                </Pie>
                                <RechartsTooltip contentStyle={CustomTooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: '10px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-blue-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Tv className="w-4 h-4 text-cyan-400" /> Format Breakdown</CardTitle></CardHeader>
                    <CardContent className="h-52">
                        {stats.formatBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={stats.formatBreakdown} cx="50%" cy="45%" outerRadius={70} innerRadius={30} dataKey="value" stroke="none" paddingAngle={3}>
                                        {stats.formatBreakdown.map((e, i) => (
                                            <Cell key={i} fill={e.color} style={{ filter: `drop-shadow(0 0 5px ${e.color}80)` }} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip contentStyle={CustomTooltipStyle} />
                                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-muted-foreground text-sm text-center pt-8">No format data yet</p>
                        )}
                    </CardContent>
                </Card>

                {/* Otaku Persona Card */}
                <Card className="holo-glass border border-primary/20 relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none" style={{ background: stats.persona ? `radial-gradient(ellipse at top right, ${stats.persona.color}15, transparent 70%)` : 'none' }} />
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-yellow-400" /> Your Otaku Persona</CardTitle></CardHeader>
                    <CardContent className="h-52 flex flex-col justify-center items-center text-center gap-3">
                        {stats.persona ? (
                            <>
                                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: `${stats.persona.color}20`, border: `1px solid ${stats.persona.color}40` }}>
                                    <stats.persona.icon className="w-8 h-8" style={{ color: stats.persona.color }} />
                                </div>
                                <div>
                                    <p className="text-xl font-black" style={{ color: stats.persona.color }}>{stats.persona.label}</p>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{stats.persona.desc}</p>
                                </div>
                                <div className="flex flex-wrap justify-center gap-1">
                                    {stats.genreCounts.slice(0, 3).map((g, i) => (
                                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${COLORS[i]}20`, color: COLORS[i], border: `1px solid ${COLORS[i]}40` }}>{g.label}</span>
                                    ))}
                                </div>
                            </>
                        ) : <p className="text-muted-foreground text-sm">Add more anime to reveal your persona!</p>}
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Genre Radar + Genre Rankings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-primary/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-violet-400" /> Genre DNA Radar</CardTitle></CardHeader>
                    <CardContent className="h-72">
                        {stats.genreRadar.length >= 3 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart data={stats.genreRadar} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                                    <PolarGrid stroke="rgba(139,92,246,0.2)" />
                                    <PolarAngleAxis dataKey="genre" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: '#6b7280' }} />
                                    <Radar name="Your Profile" dataKey="count" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} strokeWidth={2} dot={{ fill: '#8b5cf6', r: 3 }} />
                                    <RechartsTooltip contentStyle={CustomTooltipStyle} formatter={(val: any) => [`${val}%`, "Affinity"]} />
                                </RadarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Add more anime to generate your genre radar!</div>
                        )}
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-primary/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="w-4 h-4 text-orange-400" /> Genre Rankings</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2.5 pt-1">
                            {stats.genreCounts.slice(0, 8).map((g, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-xs w-4 text-center font-bold shrink-0" style={{ color: COLORS[i % COLORS.length] }}>#{i + 1}</span>
                                    <span className="text-xs font-medium w-28 truncate shrink-0">{g.label}</span>
                                    <div className="flex-1 bg-muted/30 rounded-full h-1.5 overflow-hidden">
                                        <div className="h-1.5 rounded-full transition-all" style={{
                                            width: `${Math.round((g.value / stats.genreCounts[0].value) * 100)}%`,
                                            background: COLORS[i % COLORS.length],
                                            boxShadow: `0 0 6px ${COLORS[i % COLORS.length]}60`
                                        }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{g.value}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 4: Score Distribution + Top Rated */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-yellow-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-yellow-400" /> Score Distribution</CardTitle></CardHeader>
                    <CardContent className="h-52">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.ratingDist} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                                <RechartsTooltip contentStyle={CustomTooltipStyle} formatter={(val: any) => [val, 'Shows']} />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                    {stats.ratingDist.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ filter: `drop-shadow(0 0 4px ${COLORS[i % COLORS.length]}60)` }} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-yellow-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="w-4 h-4 text-yellow-400" /> Your Top Rated</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-2.5 pt-1">
                            {stats.topRated.slice(0, 5).map((a, i) => (
                                <div key={i} className="flex items-center gap-2.5 p-2 rounded-lg bg-card/30 border border-border/20">
                                    <span className="text-sm font-black w-5 text-center" style={{ color: i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#666' }}>
                                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                                    </span>
                                    <span className="text-sm flex-1 truncate font-medium">{a.title}</span>
                                    <div className="flex items-center gap-1 shrink-0 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                                        <span className="text-xs text-yellow-400 font-bold">{a.rating}</span>
                                    </div>
                                </div>
                            ))}
                            {stats.topRated.length === 0 && <p className="text-muted-foreground text-sm pt-4 text-center">Rate your anime to see rankings!</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 5: Personal vs Community Score + Seasonal Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="holo-glass border border-violet-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="w-4 h-4 text-violet-400" /> You vs Community</CardTitle></CardHeader>
                    <CardContent>
                        {stats.avgRating > 0 && stats.avgCommunityScore > 0 ? (
                            <div className="space-y-4 pt-2">
                                <div className="flex items-center justify-around">
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-primary">{stats.avgRating}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Your Avg</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`text-lg font-bold ${stats.avgRating > stats.avgCommunityScore ? 'text-emerald-400' : stats.avgRating < stats.avgCommunityScore ? 'text-rose-400' : 'text-muted-foreground'}`}>
                                            {stats.avgRating > stats.avgCommunityScore ? '▲' : stats.avgRating < stats.avgCommunityScore ? '▼' : '='} {Math.abs(Math.round((stats.avgRating - stats.avgCommunityScore) * 10) / 10)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">difference</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-3xl font-black text-blue-400">{stats.avgCommunityScore}</p>
                                        <p className="text-xs text-muted-foreground mt-1">Community</p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Your Avg</span><span>{stats.avgRating}/10</span></div>
                                        <div className="w-full bg-muted/30 rounded-full h-2">
                                            <div className="h-2 rounded-full" style={{ width: `${stats.avgRating * 10}%`, background: '#8b5cf6', boxShadow: '0 0 8px #8b5cf660' }} />
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1"><span>Community Avg</span><span>{stats.avgCommunityScore}/10</span></div>
                                        <div className="w-full bg-muted/30 rounded-full h-2">
                                            <div className="h-2 rounded-full" style={{ width: `${stats.avgCommunityScore * 10}%`, background: '#3b82f6', boxShadow: '0 0 8px #3b82f660' }} />
                                        </div>
                                    </div>
                                </div>
                                <p className="text-xs text-center text-muted-foreground">
                                    {stats.avgRating > stats.avgCommunityScore + 1 ? "You're a generous rater! 🌟" :
                                        stats.avgRating < stats.avgCommunityScore - 1 ? "You're a tough critic! 🔍" :
                                            "Your taste aligns with the community! 👍"}
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm text-center pt-8">Rate at least a few shows to see this comparison!</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="holo-glass border border-orange-500/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-orange-400" /> Seasonal Preferences</CardTitle></CardHeader>
                    <CardContent>
                        {stats.seasonBreakdown.length > 0 ? (
                            <div className="space-y-3 pt-2">
                                {stats.seasonBreakdown.map((s, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-lg w-6">{s.icon}</span>
                                        <span className="text-sm font-medium w-14 shrink-0">{s.name}</span>
                                        <div className="flex-1 bg-muted/30 rounded-full h-2.5 overflow-hidden">
                                            <div className="h-2.5 rounded-full transition-all" style={{
                                                width: `${Math.round((s.value / Math.max(...stats.seasonBreakdown.map(x => x.value))) * 100)}%`,
                                                background: s.color,
                                                boxShadow: `0 0 8px ${s.color}80`
                                            }} />
                                        </div>
                                        <span className="text-xs text-muted-foreground w-8 text-right shrink-0">{s.value} shows</span>
                                    </div>
                                ))}
                                <p className="text-xs text-muted-foreground text-center pt-1">
                                    You watch most anime in <span className="text-foreground font-semibold">{stats.seasonBreakdown[0]?.icon} {stats.seasonBreakdown[0]?.name}</span>
                                </p>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm text-center pt-8">No seasonal data available yet</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Row 6: Year Timeline */}
            <Card className="holo-glass border border-cyan-500/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> Anime by Release Year</CardTitle></CardHeader>
                <CardContent className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.yearDist} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="yearGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.08)" />
                            <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#888' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                            <RechartsTooltip contentStyle={CustomTooltipStyle} formatter={(val: any) => [val, 'Shows']} />
                            <Area type="monotone" dataKey="count" stroke="#8b5cf6" strokeWidth={2} fill="url(#yearGradient)" dot={{ fill: '#8b5cf6', r: 3 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Row 7: Top Studios */}
            <Card className="holo-glass border border-blue-500/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-400" /> Top Studios</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {stats.studioCounts.map((studio, i) => (
                            <div key={i} className="p-3 rounded-xl border border-border/30 bg-card/30 hover:border-primary/30 transition-all flex flex-col gap-2">
                                <div className="flex items-center justify-between gap-1">
                                    <span className="font-bold text-xs truncate flex-1">{studio.name}</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0" style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>{studio.value}</span>
                                </div>
                                <div className="space-y-0.5">
                                    {studio.topShows.slice(0, 3).map((show, j) => (
                                        <p key={j} className="text-[10px] text-muted-foreground truncate">• {show}</p>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Row 8: Most Binge-Watched */}
            <Card className="holo-glass border border-orange-500/20">
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-orange-400" /> Most Episodes Watched</CardTitle></CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {stats.mostWatched.filter(a => a.episodes > 0).map((a, i) => (
                            <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-card/30 border border-border/20">
                                <span className="text-sm font-black w-5" style={{ color: COLORS[i % COLORS.length] }}>#{i + 1}</span>
                                <span className="text-sm font-medium flex-1 truncate">{a.title}</span>
                                <div className="flex items-center gap-1 shrink-0 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">
                                    <Play className="w-3 h-3 text-orange-400" />
                                    <span className="text-xs text-orange-400 font-bold">{a.episodes} eps</span>
                                </div>
                            </div>
                        ))}
                        {stats.mostWatched.filter(a => a.episodes > 0).length === 0 && (
                            <p className="text-muted-foreground text-sm text-center py-4">Track your episode progress to see this!</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
