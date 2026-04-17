import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { aniwatchEpisodes, aniwatchMegaplay } from "@/services/aniwatch";
import { Loader2, ArrowLeft } from "lucide-react";

export default function AnimeWatch() {
  const { id, epId } = useParams();
  const [sources, setSources] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!epId || !id) return;
    setLoading(true);
    
    aniwatchEpisodes(id).then(e => setEpisodes(e));

    aniwatchMegaplay(epId).then(src => {
      setSources(src);
      setLoading(false);
    });
  }, [epId, id]);

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background">
      <div className="flex-1 flex flex-col">
        <div className="p-4 flex items-center gap-4 bg-card/50 border-b border-border">
          <Link href={`/anime/${id}`}>
            <a className="text-muted-foreground hover:text-foreground transition-colors p-2 hover:bg-accent rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </a>
          </Link>
          <h1 className="text-xl font-bold">Watch</h1>
        </div>
        
        <div className="flex-1 relative bg-black">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : sources?.sub ? (
            <iframe
              src={sources.sub}
              className="w-full h-full border-0"
              allowFullScreen
            />
          ) : (
             <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
               No playable sources found.
             </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-80 border-l border-border bg-card/30 flex flex-col h-1/3 lg:h-full overflow-y-auto p-4 gap-2">
        <h2 className="font-bold text-lg mb-2 sticky top-0 bg-background/95 backdrop-blur z-10 p-2 -mx-2 -mt-2">All Episodes</h2>
        {episodes?.episodes?.map((ep: any) => {
          const isActive = ep.episodeId === epId;
          return (
            <Link key={ep.episodeId} href={`/watch/${id}/${ep.episodeId}`}>
              <a className={`p-3 rounded-lg border transition-all ${
                isActive 
                  ? "bg-primary/20 border-primary text-primary" 
                  : "bg-card border-border hover:border-primary/50"
              }`}>
                <div className="font-medium text-sm truncate flex justify-between items-center">
                  <span>Ep {ep.number}</span>
                  {ep.title && <span className="text-xs opacity-70 truncate ml-2 max-w-[150px]">{ep.title}</span>}
                </div>
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}