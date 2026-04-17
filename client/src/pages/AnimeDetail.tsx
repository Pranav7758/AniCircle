import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { aniwatchSearch, aniwatchDetails, aniwatchEpisodes } from "@/services/aniwatch";
import { Loader2, Play } from "lucide-react";

export default function AnimeDetail() {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    
    async function load() {
      try {
        let slug = id;
        // Search first to ensure we have a valid slug
        const searchRes = await aniwatchSearch(id!);
        if (searchRes.animes && searchRes.animes.length > 0) {
           slug = searchRes.animes[0].id;
        }
        
        const [d, e] = await Promise.all([
          aniwatchDetails(slug!),
          aniwatchEpisodes(slug!)
        ]);
        setData(d);
        setEpisodes(e);
      } catch (err) {
        setError("Failed to load anime.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (error) return <div className="flex h-screen items-center justify-center text-destructive">{error}</div>;

  return (
    <div className="container mx-auto p-6 space-y-8">
      <Link href="/">
        <a className="text-primary hover:underline">&larr; Back to Home</a>
      </Link>
      <div className="flex flex-col md:flex-row gap-8">
        <img src={data?.anime?.info?.stats?.poster || data?.anime?.info?.poster} alt={data?.anime?.info?.name} className="w-64 md:w-80 rounded-xl shadow-lg border border-border" />
        <div className="space-y-4">
          <h1 className="text-4xl font-bold">{data?.anime?.info?.name}</h1>
          <p className="text-muted-foreground text-lg leading-relaxed">{data?.anime?.info?.description}</p>
          <div className="flex flex-wrap gap-2">
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium">Rating: {data?.anime?.info?.stats?.rating || "N/A"}</span>
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium">Quality: {data?.anime?.info?.stats?.quality || "HD"}</span>
            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-sm font-medium">Type: {data?.anime?.info?.stats?.type || "TV"}</span>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">Episodes</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {episodes?.episodes?.map((ep: any) => (
            <Link key={ep.episodeId} href={`/watch/${id}/${ep.episodeId}`}>
              <a className="bg-card hover:bg-card/80 border border-border hover:border-primary p-3 rounded-lg flex items-center justify-between transition-all group">
                <span className="font-medium text-sm">Ep {ep.number}</span>
                <Play className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
              </a>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}