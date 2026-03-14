import { useState, useEffect, useMemo } from "react";
import { getAnimeList, getFriendAnimeList } from "@/services/supabaseData";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trophy, Play, Star, CheckCircle2, Tv, Flame, Swords, TrendingUp, Crown, Equal } from "lucide-react";
import { toast } from "sonner";

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

interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  friendName?: string;
}

interface Props {
  currentUserId: string;
  myUsername: string;
  friends: Friend[];
}

function statWinner(myVal: number, friendVal: number): "me" | "friend" | "tie" {
  if (myVal > friendVal) return "me";
  if (friendVal > myVal) return "friend";
  return "tie";
}

function WinBadge({ winner, myName, friendName }: { winner: "me" | "friend" | "tie"; myName: string; friendName: string }) {
  if (winner === "tie") return (
    <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
      <Equal className="w-3 h-3" /> Tie
    </span>
  );
  return (
    <span className={`flex items-center gap-1 text-[10px] font-semibold ${winner === "me" ? "text-primary" : "text-yellow-400"}`}>
      <Crown className="w-3 h-3" /> {winner === "me" ? myName : friendName}
    </span>
  );
}

function StatRow({ label, myVal, friendVal, myName, friendName, suffix = "", higherWins = true }: {
  label: string; myVal: number; friendVal: number; myName: string; friendName: string; suffix?: string; higherWins?: boolean;
}) {
  const winner = higherWins ? statWinner(myVal, friendVal) : statWinner(friendVal, myVal);
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
      <div className={`text-right w-24 shrink-0 font-bold text-sm ${winner === "me" ? "text-primary" : "text-foreground/70"}`}>
        {myVal.toLocaleString()}{suffix}
      </div>
      <div className="flex-1 text-center space-y-0.5">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <WinBadge winner={winner} myName={myName} friendName={friendName} />
      </div>
      <div className={`text-left w-24 shrink-0 font-bold text-sm ${winner === "friend" ? "text-yellow-400" : "text-foreground/70"}`}>
        {friendVal.toLocaleString()}{suffix}
      </div>
    </div>
  );
}

export default function FriendCompare({ currentUserId, myUsername, friends }: Props) {
  const [selectedFriendId, setSelectedFriendId] = useState<string>("");
  const [myList, setMyList] = useState<AnimeItem[]>([]);
  const [friendList, setFriendList] = useState<AnimeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFriendName, setSelectedFriendName] = useState("Friend");

  useEffect(() => {
    async function load() {
      if (!selectedFriendId) return;
      setLoading(true);
      try {
        const [me, friend] = await Promise.all([
          getAnimeList(),
          getFriendAnimeList(selectedFriendId),
        ]);
        setMyList((me || []).filter(a => !a.isHentai));
        setFriendList((friend || []).filter((a: AnimeItem) => !a.isHentai));
      } catch (err) {
        toast.error("Failed to load comparison data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [selectedFriendId]);

  const stats = useMemo(() => {
    if (!myList.length && !friendList.length) return null;

    const uniqueTitles = (list: AnimeItem[]) => new Set(list.map(a => a.title)).size;
    const totalEps = (list: AnimeItem[]) => list.reduce((s, a) => s + a.episodesWatched, 0);
    const completed = (list: AnimeItem[]) => new Set(list.filter(a => a.status === "completed").map(a => a.title)).size;
    const watching = (list: AnimeItem[]) => list.filter(a => a.status === "watching").length;
    const dropped = (list: AnimeItem[]) => new Set(list.filter(a => a.status === "dropped").map(a => a.title)).size;
    const rated = (list: AnimeItem[]) => list.filter(a => a.rating);
    const avgRating = (list: AnimeItem[]) => {
      const r = rated(list);
      return r.length ? Math.round((r.reduce((s, a) => s + (a.rating || 0), 0) / r.length) * 10) / 10 : 0;
    };
    const completionRate = (list: AnimeItem[]) => {
      const total = uniqueTitles(list);
      return total ? Math.round((completed(list) / total) * 100) : 0;
    };

    // Common titles (both have it)
    const myTitles = new Set(myList.map(a => a.title.toLowerCase()));
    const friendTitles = new Set(friendList.map((a: AnimeItem) => a.title.toLowerCase()));
    const common = [...myTitles].filter(t => friendTitles.has(t));

    // Unique to each
    const myUnique = myList.filter(a => !friendTitles.has(a.title.toLowerCase()));
    const friendUnique = friendList.filter((a: AnimeItem) => !myTitles.has(a.title.toLowerCase()));

    // Unique titles for myUnique/friendUnique
    const myUniqueTitles = [...new Set(myUnique.map(a => a.title))];
    const friendUniqueTitles = [...new Set(friendUnique.map(a => a.title))];

    // Common titles with both covers
    const commonWithData = common.map(title => {
      const myEntry = myList.find(a => a.title.toLowerCase() === title);
      const friendEntry = friendList.find((a: AnimeItem) => a.title.toLowerCase() === title);
      return { title: myEntry?.title || title, myCover: myEntry?.coverImage, friendCover: friendEntry?.coverImage };
    }).slice(0, 12);

    return {
      myShows: uniqueTitles(myList),
      friendShows: uniqueTitles(friendList),
      myEps: totalEps(myList),
      friendEps: totalEps(friendList),
      myCompleted: completed(myList),
      friendCompleted: completed(friendList),
      myWatching: watching(myList),
      friendWatching: watching(friendList),
      myDropped: dropped(myList),
      friendDropped: dropped(friendList),
      myAvgRating: avgRating(myList),
      friendAvgRating: avgRating(friendList),
      myCompletionRate: completionRate(myList),
      friendCompletionRate: completionRate(friendList),
      commonCount: common.length,
      commonWithData,
      myUniqueTitles,
      friendUniqueTitles,
    };
  }, [myList, friendList]);

  // Overall winner: tally across 5 key stats
  const overallWinner = useMemo(() => {
    if (!stats) return null;
    let myScore = 0, friendScore = 0;
    const checks = [
      [stats.myShows, stats.friendShows],
      [stats.myEps, stats.friendEps],
      [stats.myCompleted, stats.friendCompleted],
      [stats.myAvgRating * 10, stats.friendAvgRating * 10],
      [stats.myCompletionRate, stats.friendCompletionRate],
    ];
    for (const [m, f] of checks) {
      if (m > f) myScore++;
      else if (f > m) friendScore++;
    }
    if (myScore > friendScore) return "me";
    if (friendScore > myScore) return "friend";
    return "tie";
  }, [stats]);

  const myShortName = myUsername || "You";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary" /> Head-to-Head Comparison
        </h3>
        <p className="text-sm text-muted-foreground">Pick a friend and see how your anime stats stack up.</p>
        <Select value={selectedFriendId} onValueChange={(val) => {
          setSelectedFriendId(val);
          const friend = friends.find(f => {
            const fId = f.userId === currentUserId ? f.friendId : f.userId;
            return fId === val;
          });
          setSelectedFriendName(friend?.friendName || "Friend");
        }}>
          <SelectTrigger className="w-full md:w-72 rounded-xl border-border/50 bg-muted/30">
            <SelectValue placeholder="Choose a friend to compare with…" />
          </SelectTrigger>
          <SelectContent>
            {friends.length === 0 ? (
              <SelectItem value="none" disabled>No friends yet</SelectItem>
            ) : (
              friends.map((friend) => {
                const friendId = friend.userId === currentUserId ? friend.friendId : friend.userId;
                return (
                  <SelectItem key={friend.id} value={friendId}>
                    {friend.friendName || "Friend"}
                  </SelectItem>
                );
              })
            )}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin opacity-40" />
        </div>
      )}

      {!loading && !selectedFriendId && (
        <Card className="bg-muted/20 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2 text-muted-foreground">
            <Swords className="w-10 h-10 opacity-20 mb-1" />
            <p className="font-medium">Select a friend above to start the battle</p>
          </CardContent>
        </Card>
      )}

      {!loading && selectedFriendId && stats && (
        <div className="space-y-6 animate-fade-in">

          {/* VS header */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex-1 text-center">
              <div className="w-14 h-14 rounded-full gradient-primary mx-auto flex items-center justify-center text-white font-black text-xl mb-1">
                {myShortName.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm">{myShortName}</p>
              <p className="text-[10px] text-muted-foreground">You</p>
            </div>
            <div className="shrink-0 text-center px-3">
              <div className="text-2xl font-black text-gradient">VS</div>
            </div>
            <div className="flex-1 text-center">
              <div className="w-14 h-14 rounded-full bg-yellow-500/20 border border-yellow-500/40 mx-auto flex items-center justify-center text-yellow-400 font-black text-xl mb-1">
                {selectedFriendName.charAt(0).toUpperCase()}
              </div>
              <p className="font-bold text-sm">{selectedFriendName}</p>
              <p className="text-[10px] text-muted-foreground">Friend</p>
            </div>
          </div>

          {/* Overall verdict */}
          <Card className={`border-2 ${overallWinner === "me" ? "border-primary/50 bg-primary/5" : overallWinner === "friend" ? "border-yellow-500/50 bg-yellow-500/5" : "border-border/50 bg-muted/20"}`}>
            <CardContent className="py-4 text-center space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Overall Winner</p>
              {overallWinner === "me" && (
                <>
                  <Crown className="w-7 h-7 text-primary mx-auto" />
                  <p className="text-lg font-black text-primary">{myShortName} wins! 🎉</p>
                  <p className="text-xs text-muted-foreground">You dominate across more categories</p>
                </>
              )}
              {overallWinner === "friend" && (
                <>
                  <Crown className="w-7 h-7 text-yellow-400 mx-auto" />
                  <p className="text-lg font-black text-yellow-400">{selectedFriendName} wins! 🔥</p>
                  <p className="text-xs text-muted-foreground">They dominate across more categories</p>
                </>
              )}
              {overallWinner === "tie" && (
                <>
                  <Equal className="w-7 h-7 text-muted-foreground mx-auto" />
                  <p className="text-lg font-black">It's a tie! 🤝</p>
                  <p className="text-xs text-muted-foreground">You're perfectly matched anime watchers</p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Stat-by-stat comparison */}
          <Card className="holo-glass border-border/40">
            <CardContent className="py-3 px-5">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 pb-2 border-b border-border/30">
                <span className="font-semibold text-primary w-24">{myShortName}</span>
                <span className="text-center flex-1">Category</span>
                <span className="font-semibold text-yellow-400 w-24 text-right">{selectedFriendName}</span>
              </div>
              <StatRow label="Total Shows" myVal={stats.myShows} friendVal={stats.friendShows} myName={myShortName} friendName={selectedFriendName} />
              <StatRow label="Total Episodes" myVal={stats.myEps} friendVal={stats.friendEps} myName={myShortName} friendName={selectedFriendName} />
              <StatRow label="Completed" myVal={stats.myCompleted} friendVal={stats.friendCompleted} myName={myShortName} friendName={selectedFriendName} />
              <StatRow label="Currently Watching" myVal={stats.myWatching} friendVal={stats.friendWatching} myName={myShortName} friendName={selectedFriendName} />
              <StatRow label="Avg Rating" myVal={stats.myAvgRating} friendVal={stats.friendAvgRating} myName={myShortName} friendName={selectedFriendName} suffix="/10" />
              <StatRow label="Completion Rate" myVal={stats.myCompletionRate} friendVal={stats.friendCompletionRate} myName={myShortName} friendName={selectedFriendName} suffix="%" />
              <StatRow label="Dropped" myVal={stats.myDropped} friendVal={stats.friendDropped} myName={myShortName} friendName={selectedFriendName} higherWins={false} />
            </CardContent>
          </Card>

          {/* Common shows */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Anime You Both Have
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{stats.commonCount}</Badge>
            </h4>
            {stats.commonWithData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No common anime found yet.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {stats.commonWithData.map(({ title, myCover }) => (
                  <div key={title} className="flex items-center gap-1.5 bg-muted/30 border border-border/40 rounded-lg px-2 py-1 holo-glass">
                    {myCover && (
                      <img src={myCover} alt={title} className="w-5 h-5 rounded object-cover shrink-0" />
                    )}
                    <span className="text-xs font-medium truncate max-w-[120px]">{title}</span>
                  </div>
                ))}
                {stats.commonCount > 12 && (
                  <div className="flex items-center px-2 py-1 text-xs text-muted-foreground">
                    +{stats.commonCount - 12} more
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Unique shows */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4">
                <h5 className="text-xs font-semibold text-primary mb-2 flex items-center gap-1.5">
                  <Play className="w-3 h-3" /> Only {myShortName} has ({stats.myUniqueTitles.length})
                </h5>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {stats.myUniqueTitles.slice(0, 20).map(title => (
                    <p key={title} className="text-xs text-muted-foreground truncate">{title}</p>
                  ))}
                  {stats.myUniqueTitles.length > 20 && (
                    <p className="text-xs text-muted-foreground/60">+{stats.myUniqueTitles.length - 20} more</p>
                  )}
                  {stats.myUniqueTitles.length === 0 && <p className="text-xs text-muted-foreground/50 italic">None</p>}
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-500/20 bg-yellow-500/5">
              <CardContent className="py-3 px-4">
                <h5 className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
                  <Play className="w-3 h-3" /> Only {selectedFriendName} has ({stats.friendUniqueTitles.length})
                </h5>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {stats.friendUniqueTitles.slice(0, 20).map(title => (
                    <p key={title} className="text-xs text-muted-foreground truncate">{title}</p>
                  ))}
                  {stats.friendUniqueTitles.length > 20 && (
                    <p className="text-xs text-muted-foreground/60">+{stats.friendUniqueTitles.length - 20} more</p>
                  )}
                  {stats.friendUniqueTitles.length === 0 && <p className="text-xs text-muted-foreground/50 italic">None</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
