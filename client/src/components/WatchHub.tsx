import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, List, Play, Sparkles } from "lucide-react";
import Watch from "@/components/Watch";
import { DiscoverSections } from "@/components/Discover";
import type { AnimeData } from "@/services/supabaseData";

interface AnimeItem {
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
  ranking: number | null;
  isHentai: boolean | null;
}

interface WatchHubProps {
  animeList: AnimeItem[];
  showMature: boolean;
  onAddAnime: (data: any) => Promise<void>;
  onAutoProgress?: (event: { action: "created" | "updated"; anime: AnimeData }) => void;
  onOpenMyList: () => void;
}

export default function WatchHub({
  animeList,
  showMature,
  onAddAnime,
  onAutoProgress,
  onOpenMyList,
}: WatchHubProps) {
  const [quickListOpen, setQuickListOpen] = useState(false);
  const [watchSearchSeed, setWatchSearchSeed] = useState("");

  const continueWatching = useMemo(
    () =>
      animeList
        .filter((a) => a.status === "watching")
        .sort((a, b) => (b.episodesWatched || 0) - (a.episodesWatched || 0))
        .slice(0, 8),
    [animeList],
  );

  return (
    <div className="space-y-7 pb-8">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5 items-start">
        <section className="space-y-5 min-w-0">
          <Watch animeList={animeList} onAutoProgress={onAutoProgress} externalQuery={watchSearchSeed} />
        </section>

        <aside className="xl:sticky xl:top-3 space-y-3">
          <Card className="border-border/45 bg-card/75 backdrop-blur-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <List className="w-4 h-4 text-primary" />
                  <p className="text-sm font-bold">My List Quick View</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 xl:hidden"
                  onClick={() => setQuickListOpen((v) => !v)}
                >
                  {quickListOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>

              <div className={`${quickListOpen ? "block" : "hidden"} xl:block space-y-3`}>
                {continueWatching.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Start watching from the player and your continue-watching list will appear here.
                  </p>
                ) : (
                  continueWatching.map((anime) => (
                    <button
                      key={`${anime.id}-${anime.seasonNumber}`}
                      type="button"
                      className="w-full flex items-center gap-2.5 p-2 rounded-xl border border-border/45 bg-muted/20 hover:bg-muted/35 transition text-left"
                      onClick={() => setWatchSearchSeed(`${anime.title} season ${anime.seasonNumber}`)}
                    >
                      <div className="h-12 w-9 rounded overflow-hidden bg-muted/40 shrink-0">
                        {anime.coverImage ? (
                          <img src={anime.coverImage} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold leading-snug line-clamp-2">{anime.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          S{anime.seasonNumber} · Ep {anime.episodesWatched || 0}
                        </p>
                      </div>
                      <Play className="w-3.5 h-3.5 text-primary shrink-0" />
                    </button>
                  ))
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs rounded-lg"
                    onClick={onOpenMyList}
                  >
                    Open My List
                  </Button>
                  <Badge variant="secondary" className="text-[10px]">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Quick resume
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <DiscoverSections animeList={animeList} onAddAnime={onAddAnime} showMature={showMature} />
    </div>
  );
}
