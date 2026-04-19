import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, CheckCircle2, Clock, Trophy, Star, Tv, ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";

interface Profile {
  id: string;
  username: string | null;
  shortId: string | null;
  avatarUrl: string | null;
  createdAt: string | null;
}

interface AnimeItem {
  id: string;
  title: string;
  episodesWatched: number;
  totalEpisodes: number | null;
  status: string;
  rating: number | null;
  coverImage: string | null;
  seasonNumber: number;
  isHentai: boolean | null;
}

function snakeToCamel(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(snakeToCamel);
  if (typeof obj !== "object") return obj;
  const result: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    result[camelKey] = snakeToCamel(obj[key]);
  }
  return result;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  watching: { label: "Watching", color: "text-primary" },
  completed: { label: "Completed", color: "text-emerald-400" },
  plan_to_watch: { label: "Plan to Watch", color: "text-blue-400" },
  on_hold: { label: "On Hold", color: "text-yellow-400" },
  dropped: { label: "Dropped", color: "text-red-400" },
};

export default function PublicProfile() {
  const params = useParams<{ shortId: string }>();
  const [, setLocation] = useLocation();
  const shortId = params.shortId?.toUpperCase();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [animeList, setAnimeList] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      if (!shortId) { setNotFound(true); setLoading(false); return; }
      try {
        // Fetch profile
        const { data: profileData, error: profileErr } = await supabase
          .from("profiles")
          .select("id, username, short_id, avatar_url, created_at")
          .eq("short_id", shortId.toLowerCase())
          .single();

        if (profileErr || !profileData) { setNotFound(true); setLoading(false); return; }
        setProfile(snakeToCamel(profileData));

        // Fetch their public anime list (non-hentai only)
        const { data: animeData } = await supabase
          .from("anime")
          .select("*")
          .eq("user_id", profileData.id)
          .eq("is_hentai", false)
          .order("ranking", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: false });

        setAnimeList(snakeToCamel(animeData || []));
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [shortId]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Profile link copied!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin opacity-40" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Tv className="w-16 h-16 opacity-20" />
        <h1 className="text-2xl font-bold">Profile not found</h1>
        <p className="text-muted-foreground text-sm">No user with ID <code className="font-mono">{shortId}</code> exists.</p>
        <Button variant="outline" onClick={() => setLocation("/")}>Go Home</Button>
      </div>
    );
  }

  const nonHentai = animeList.filter(a => !a.isHentai);
  const uniqueTitles = new Set(nonHentai.map(a => a.title)).size;
  const totalEps = nonHentai.reduce((s, a) => s + a.episodesWatched, 0);
  const completed = nonHentai.filter(a => a.status === "completed").length;
  const watching = nonHentai.filter(a => a.status === "watching").length;
  const rated = nonHentai.filter(a => a.rating);
  const avgRating = rated.length ? (rated.reduce((s, a) => s + (a.rating || 0), 0) / rated.length).toFixed(1) : null;

  // Group by title
  const grouped = nonHentai.reduce((acc, a) => {
    if (!acc[a.title]) acc[a.title] = [];
    acc[a.title].push(a);
    return acc;
  }, {} as Record<string, AnimeItem[]>);

  const topRated = Object.entries(grouped)
    .map(([title, seasons]) => {
      const ratedSeasons = seasons.filter(s => s.rating);
      const avg = ratedSeasons.length
        ? ratedSeasons.reduce((s, a) => s + (a.rating || 0), 0) / ratedSeasons.length
        : 0;
      return { title, avg, cover: seasons[0].coverImage, seasons };
    })
    .filter(e => e.avg > 0)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 10);

  const currentlyWatching = nonHentai.filter(a => a.status === "watching").slice(0, 6);

  const memberSince = profile.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 glass">
        <div className="header-accent-strip" />
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="AniCircle" className="h-8 w-8 rounded-full" />
            <span className="font-black text-gradient text-lg">AniCircle</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5 text-xs rounded-none">
              <Share2 className="w-3.5 h-3.5" /> Share
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="gap-1.5 text-xs rounded-none">
              <ArrowLeft className="w-3.5 h-3.5" /> My List
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        {/* Profile Hero */}
        <div className="flex items-center gap-5 deco-card deco-corners p-4 sm:p-5">
          <div className="w-20 h-20 rounded-none gradient-primary flex items-center justify-center text-black font-black text-3xl shadow-neon shrink-0 border border-primary/70">
            {(profile.username || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-black text-gradient">{profile.username || "Anime Fan"}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs rounded-none border-primary/45">{shortId}</Badge>
              {memberSince && <span className="text-xs text-muted-foreground">Member since {memberSince}</span>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { icon: Tv, label: "Shows", value: uniqueTitles, color: "text-primary" },
            { icon: Clock, label: "Episodes", value: totalEps.toLocaleString(), color: "text-blue-400" },
            { icon: CheckCircle2, label: "Completed", value: completed, color: "text-emerald-400" },
            { icon: Play, label: "Watching", value: watching, color: "text-orange-400" },
            { icon: Star, label: "Avg Rating", value: avgRating ? `${avgRating}/10` : "—", color: "text-amber-400" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex items-center gap-2.5 px-3.5 py-3 rounded-none bg-muted/30 border border-primary/35 holo-glass">
              <Icon className={`w-4 h-4 shrink-0 ${color}`} />
              <div>
                <p className={`text-base font-black leading-none ${color}`}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Currently Watching */}
        {currentlyWatching.length > 0 && (
          <section className="deco-card deco-corners p-4 sm:p-5">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-primary" /> Currently Watching
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {currentlyWatching.map(anime => (
                <div key={anime.id} className="group">
                  <div className="relative aspect-[3/4] rounded-none overflow-hidden border border-primary/35">
                    {anime.coverImage ? (
                      <img src={anime.coverImage} alt={anime.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full bg-muted/40 flex items-center justify-center"><Tv className="w-6 h-6 opacity-20" /></div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 right-1.5">
                      <p className="text-[10px] font-semibold text-white line-clamp-2 leading-tight">{anime.title}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Top Rated */}
        {topRated.length > 0 && (
          <section className="deco-card deco-corners p-4 sm:p-5">
            <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> Top Rated
            </h2>
            <div className="space-y-2">
              {topRated.map(({ title, avg, cover, seasons }, idx) => (
                <div key={title} className="flex items-center gap-3 p-3 rounded-none bg-muted/20 border border-primary/30 holo-glass group hover:bg-muted/30 transition-colors">
                  <span className="text-sm font-black text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                  {cover && <img src={cover} alt={title} className="w-10 h-14 object-cover rounded-lg shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{title}</p>
                    <p className="text-[11px] text-muted-foreground">{seasons.length} season{seasons.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-bold text-amber-400">{avg.toFixed(1)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Status breakdown */}
          <section className="deco-card deco-corners p-4 sm:p-5">
          <h2 className="text-xl font-bold mb-3 flex items-center gap-2">
            <Tv className="w-4 h-4 text-muted-foreground" /> Full Library
          </h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(STATUS_LABELS).map(([status, { label, color }]) => {
              const count = nonHentai.filter(a => a.status === status).length;
              if (!count) return null;
              return (
                <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-none bg-muted/30 border border-primary/35 text-sm font-medium ${color}`}>
                  {label} <span className="font-black">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <p className="text-center text-xs text-muted-foreground/50 pt-4">
          Powered by <span className="text-gradient font-semibold">AniCircle</span>
        </p>
      </main>
    </div>
  );
}
