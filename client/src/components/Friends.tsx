import { useState, useEffect, useMemo } from "react";
import { getFriends, getFriendRequests, getFriendAnimeList, sendFriendRequest, updateFriendStatus, getProfileByShortId, getFriendsActivity, getFriendsWatchPresence, getFriendsUserPresence, type WatchPresenceData, type UserPresenceData } from "@/services/supabaseData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Check, X, Users, Search, Copy, Swords, Activity, Star, Plus, CheckCircle2, Play, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import AnimeGroupCard from "./AnimeGroupCard";
import FriendCompare from "./FriendCompare";
import { useAuth } from "@/hooks/use-auth";

interface Friend {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  friendName?: string;
}

interface FriendsProps {
  currentUserId: string;
}

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
  malId: number | null;
  ranking: number | null;
  isHentai: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const Friends = ({ currentUserId }: FriendsProps) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friend[]>([]);
  const [searchShortId, setSearchShortId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [friendAnimeList, setFriendAnimeList] = useState<Anime[]>([]);
  const [filteredFriendAnimeList, setFilteredFriendAnimeList] = useState<Anime[]>([]);
  const [selectedFriendForList, setSelectedFriendForList] = useState<string>("");
  const [friendSearchQuery, setFriendSearchQuery] = useState("");
  const [friendStatusFilter, setFriendStatusFilter] = useState<string>("all");
  const [friendHentaiFilter, setFriendHentaiFilter] = useState<string>("hide");
  const [friendRankingFilter, setFriendRankingFilter] = useState<string>("all");
  const [friendSortBy, setFriendSortBy] = useState<string>(() => localStorage.getItem("friendAnimeSortBy") || "default");
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [watchPresenceByUserId, setWatchPresenceByUserId] = useState<Record<string, WatchPresenceData>>({});
  const [onlineByUserId, setOnlineByUserId] = useState<Record<string, UserPresenceData>>({});

  const fetchFriendsData = async () => {
    try {
      const data = await getFriends();
      setFriends(data || []);
    } catch (error) {
      console.error("Error fetching friends:", error);
      toast.error("Failed to load friends");
    }
  };

  const fetchFriendRequestsData = async () => {
    try {
      const data = await getFriendRequests();
      setPendingRequests(data || []);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
    }
  };

  const fetchFriendAnimeListData = async (friendId: string) => {
    try {
      const data = await getFriendAnimeList(friendId);
      setFriendAnimeList(data || []);
    } catch (error) {
      console.error("Error fetching friend's anime list:", error);
      toast.error("Failed to load friend's anime list");
      setFriendAnimeList([]);
    }
  };

  useEffect(() => {
    fetchFriendsData();
    fetchFriendRequestsData();
  }, [currentUserId]);

  useEffect(() => {
    if (friends.length === 0) return;
    const friendUserIds = friends.map(f =>
      f.userId === currentUserId ? f.friendId : f.userId
    );
    setLoadingActivity(true);
    getFriendsActivity(friendUserIds)
      .then(data => setActivityFeed(data))
      .catch(() => {})
      .finally(() => setLoadingActivity(false));
  }, [friends, currentUserId]);

  useEffect(() => {
    if (friends.length === 0) {
      setOnlineByUserId({});
      return;
    }
    const friendUserIds = friends.map(f =>
      f.userId === currentUserId ? f.friendId : f.userId
    );

    let cancelled = false;
    const loadOnline = async () => {
      try {
        const rows = await getFriendsUserPresence(friendUserIds);
        if (cancelled) return;
        const map: Record<string, UserPresenceData> = {};
        for (const row of rows) map[row.userId] = row;
        setOnlineByUserId(map);
      } catch {
        if (!cancelled) setOnlineByUserId({});
      }
    };
    loadOnline();
    const iv = setInterval(loadOnline, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [friends, currentUserId]);

  useEffect(() => {
    if (friends.length === 0) {
      setWatchPresenceByUserId({});
      return;
    }
    const friendUserIds = friends.map(f =>
      f.userId === currentUserId ? f.friendId : f.userId
    );

    let cancelled = false;
    const loadPresence = async () => {
      try {
        const rows = await getFriendsWatchPresence(friendUserIds);
        if (cancelled) return;
        const map: Record<string, WatchPresenceData> = {};
        for (const row of rows) map[row.userId] = row;
        setWatchPresenceByUserId(map);
      } catch {
        if (!cancelled) setWatchPresenceByUserId({});
      }
    };

    loadPresence();
    const iv = setInterval(loadPresence, 30000);
    return () => {
      cancelled = true;
      clearInterval(iv);
    };
  }, [friends, currentUserId]);

  useEffect(() => {
    if (selectedFriendForList) {
      fetchFriendAnimeListData(selectedFriendForList);
    } else {
      setFriendAnimeList([]);
      setFilteredFriendAnimeList([]);
    }
  }, [selectedFriendForList]);

  useEffect(() => {
    let filtered = friendAnimeList;

    if (friendSearchQuery) {
      filtered = filtered.filter((anime) =>
        anime.title.toLowerCase().includes(friendSearchQuery.toLowerCase())
      );
    }

    if (friendStatusFilter !== "all") {
      filtered = filtered.filter((anime) => anime.status === friendStatusFilter);
    }

    if (friendHentaiFilter === "hide") {
      filtered = filtered.filter((anime) => !anime.isHentai);
    } else if (friendHentaiFilter === "only") {
      filtered = filtered.filter((anime) => anime.isHentai === true);
    }

    if (friendRankingFilter === "ranked") {
      filtered = filtered.filter((anime) => anime.ranking !== null);
    } else if (friendRankingFilter === "unranked") {
      filtered = filtered.filter((anime) => anime.ranking === null);
    }

    setFilteredFriendAnimeList(filtered);
  }, [friendAnimeList, friendSearchQuery, friendStatusFilter, friendHentaiFilter, friendRankingFilter]);

  const groupedFriendAnime = useMemo(() => {
      const groups = filteredFriendAnimeList.reduce((acc, anime) => {
        const title = anime.title;
        if (!acc[title]) acc[title] = [];
        acc[title].push(anime);
        return acc;
      }, {} as Record<string, Anime[]>);

      const entries = Object.entries(groups);
      const getRecentTs = (seasons: Anime[]) =>
        Math.max(
          ...seasons.map((s) => {
            const t = Date.parse(s.createdAt || s.updatedAt || "");
            return Number.isFinite(t) ? t : 0;
          }),
        );

      switch (friendSortBy) {
        case "title-asc":
          entries.sort(([a], [b]) => a.localeCompare(b));
          break;
        case "title-desc":
          entries.sort(([a], [b]) => b.localeCompare(a));
          break;
        case "rating-desc":
          entries.sort(([, seasonsA], [, seasonsB]) => {
            const avgA = seasonsA.filter(s => s.rating).length
              ? seasonsA.reduce((sum, s) => sum + (s.rating || 0), 0) / seasonsA.filter(s => s.rating).length
              : 0;
            const avgB = seasonsB.filter(s => s.rating).length
              ? seasonsB.reduce((sum, s) => sum + (s.rating || 0), 0) / seasonsB.filter(s => s.rating).length
              : 0;
            return avgB - avgA;
          });
          break;
        case "progress-desc":
          entries.sort(([, seasonsA], [, seasonsB]) => {
            const progressA = seasonsA.reduce((sum, s) => sum + s.episodesWatched, 0);
            const progressB = seasonsB.reduce((sum, s) => sum + s.episodesWatched, 0);
            return progressB - progressA;
          });
          break;
        default:
          entries.sort(([, seasonsA], [, seasonsB]) => getRecentTs(seasonsB) - getRecentTs(seasonsA));
          break;
      }

      return Object.fromEntries(entries);
  }, [filteredFriendAnimeList, friendSortBy]);

  const handleSendFriendRequest = async () => {
    if (!searchShortId || searchShortId.trim().length !== 5) {
      toast.error("Please enter a valid 5-character User ID");
      return;
    }
    if (searchShortId.toUpperCase().trim() === user?.shortId?.toUpperCase()) {
      toast.error("You can't add yourself!");
      return;
    }

    setIsLoading(true);
    try {
      const profile = await getProfileByShortId(searchShortId.toUpperCase().trim());
      if (!profile) {
        toast.error("No user found with that ID. Check the ID and try again.");
        return;
      }
      await sendFriendRequest(profile.id);
      toast.success(`Friend request sent to ${profile.name || "user"}!`);
      setSearchShortId("");
      fetchFriendsData();
      fetchFriendRequestsData();
    } catch (error: any) {
      console.error("Error sending friend request:", error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        toast.error("You already sent a request to this user, or you're already friends.");
      } else {
        toast.error(error.message || "Failed to send friend request");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const acceptFriendRequest = async (requestId: string) => {
    try {
      await updateFriendStatus(requestId, "accepted");
      toast.success("Friend request accepted!");
      fetchFriendsData();
      fetchFriendRequestsData();
    } catch (error) {
      console.error("Error accepting request:", error);
      toast.error("Failed to accept friend request");
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    try {
      await updateFriendStatus(requestId, "rejected");
      toast.success("Friend request rejected");
      fetchFriendRequestsData();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error("Failed to reject friend request");
    }
  };

  const copyShortId = () => {
    if (user?.shortId) {
      navigator.clipboard.writeText(user.shortId.toUpperCase());
      toast.success("Your User ID copied to clipboard!");
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="friends" className="w-full">
        <TabsList className="grid w-full h-auto grid-cols-3 gap-1 p-1 md:grid-cols-5 premium-section">
          <TabsTrigger value="friends" data-testid="tab-my-friends" className="gap-1 text-xs py-2 rounded-none border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black">
            <Users className="w-3.5 h-3.5 shrink-0" />
            Friends
          </TabsTrigger>
          <TabsTrigger value="feed" data-testid="tab-feed" className="gap-1 text-xs py-2 rounded-none border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black">
            <Activity className="w-3.5 h-3.5 shrink-0" />
            Feed
          </TabsTrigger>
          <TabsTrigger value="compare" data-testid="tab-compare" className="gap-1 text-xs py-2 rounded-none border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black">
            <Swords className="w-3.5 h-3.5 shrink-0" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="requests" data-testid="tab-requests" className="gap-1 text-xs py-2 col-span-1 rounded-none border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black">
            <UserPlus className="w-3.5 h-3.5 shrink-0" />
            Requests
          </TabsTrigger>
          <TabsTrigger value="find" data-testid="tab-find-friends" className="gap-1 text-xs py-2 col-span-2 md:col-span-1 rounded-none border border-transparent data-[state=active]:border-primary/80 data-[state=active]:bg-primary data-[state=active]:text-black">
            <Search className="w-3.5 h-3.5 shrink-0" />
            Find Friends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">View Friend's Anime List</h3>
                <Select value={selectedFriendForList} onValueChange={setSelectedFriendForList}>
                  <SelectTrigger className="w-full md:w-64" data-testid="select-friend">
                    <SelectValue placeholder="Select a friend to view their list" />
                  </SelectTrigger>
                  <SelectContent>
                    {friends.length === 0 ? (
                      <SelectItem value="no-friends" disabled>No friends yet</SelectItem>
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

              {selectedFriendForList && (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        placeholder="Search anime..."
                        value={friendSearchQuery}
                        onChange={(e) => setFriendSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="input-friend-search"
                      />
                    </div>
                    <Select value={friendStatusFilter} onValueChange={setFriendStatusFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Filter by status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="watching">Watching</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="plan_to_watch">Plan to Watch</SelectItem>
                        <SelectItem value="on_hold">On Hold</SelectItem>
                        <SelectItem value="dropped">Dropped</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={friendHentaiFilter} onValueChange={setFriendHentaiFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Hentai filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="show">Show All</SelectItem>
                        <SelectItem value="hide">Hide Hentai</SelectItem>
                        <SelectItem value="only">Hentai Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={friendRankingFilter} onValueChange={setFriendRankingFilter}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="Ranking filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Anime</SelectItem>
                        <SelectItem value="ranked">Ranked Only</SelectItem>
                        <SelectItem value="unranked">Unranked Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={friendSortBy} onValueChange={(v) => { setFriendSortBy(v); localStorage.setItem("friendAnimeSortBy", v); }}>
                      <SelectTrigger className="w-full md:w-48" data-testid="select-friend-sort">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Recently Added</SelectItem>
                        <SelectItem value="title-asc">Title A → Z</SelectItem>
                        <SelectItem value="title-desc">Title Z → A</SelectItem>
                        <SelectItem value="rating-desc">Highest Rated</SelectItem>
                        <SelectItem value="progress-desc">Most Watched</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filteredFriendAnimeList.length === 0 ? (
                    <div className="text-center py-20 space-y-4">
                      <div className="text-8xl opacity-20">TV</div>
                      <h2 className="text-2xl font-bold text-foreground">No anime found</h2>
                      <p className="text-muted-foreground">
                        {friendSearchQuery || friendStatusFilter !== "all" || friendHentaiFilter !== "show" || friendRankingFilter !== "all"
                          ? "Try adjusting your filters"
                          : "This friend hasn't added any anime yet"}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 animate-fade-in">
                      {Object.entries(groupedFriendAnime).map(([title, seasons]) => (
                        <AnimeGroupCard
                          key={title}
                          title={title}
                          coverImage={seasons[0].coverImage}
                          seasons={seasons.map(s => ({
                            id: s.id,
                            seasonNumber: s.seasonNumber,
                            episodesWatched: s.episodesWatched,
                            totalEpisodes: s.totalEpisodes,
                            status: s.status,
                            rating: s.rating,
                            notes: s.notes || "",
                          }))}
                          onEdit={() => { }}
                          onDelete={() => { }}
                          readOnly
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6">
                <h3 className="font-semibold mb-4">My Friends</h3>
                {friends.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No friends yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {friends.map((friend, fi) => {
                      const friendId = friend.userId === currentUserId ? friend.friendId : friend.userId;
                      const presence = watchPresenceByUserId[friendId];
                      const isFresh = presence?.updatedAt
                        ? (Date.now() - new Date(presence.updatedAt).getTime()) < 10 * 60 * 1000
                        : false;
                      const onlinePresence = onlineByUserId[friendId];
                      const hasRecentHeartbeat = onlinePresence?.updatedAt
                        ? (Date.now() - new Date(onlinePresence.updatedAt).getTime()) < 2 * 60 * 1000
                        : false;
                      const hasRecentWatchPulse = presence?.updatedAt
                        ? (Date.now() - new Date(presence.updatedAt).getTime()) < 2 * 60 * 1000
                        : false;
                      const isOnline = hasRecentHeartbeat || hasRecentWatchPulse;
                      return (
                        <Card key={friend.id} className="cursor-pointer premium-shell interactive-lift animate-stagger-in" style={{ animationDelay: `${fi * 70}ms` }} data-testid={`friend-card-${friend.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <div className="relative w-12 h-12">
                                  <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                                  {friend.friendName?.charAt(0).toUpperCase() || "?"}
                                  </div>
                                  <span
                                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${
                                      isOnline ? "bg-emerald-500" : "bg-zinc-500/60"
                                    }`}
                                    title={isOnline ? "Online" : "Offline"}
                                  />
                                </div>
                                <div>
                                  <p className="font-semibold flex items-center gap-2">
                                    {friend.friendName || "Friend"}
                                    <span className={`text-[10px] font-medium ${isOnline ? "text-emerald-500" : "text-muted-foreground"}`}>
                                      {isOnline ? "Online" : "Offline"}
                                    </span>
                                  </p>
                                  {!isOnline && onlinePresence?.updatedAt && (
                                    <p className="text-[11px] text-muted-foreground/90 mt-0.5">
                                      Last seen {formatDistanceToNow(new Date(onlinePresence.updatedAt), { addSuffix: true })}
                                    </p>
                                  )}
                                  {presence && isFresh && (
                                    <p className="text-xs text-primary/90 mt-0.5">
                                      Watching {presence.animeTitle}
                                      {presence.seasonNumber ? ` · S${presence.seasonNumber}` : ""}
                                      {presence.episodeNumber ? ` · Ep ${presence.episodeNumber}` : ""}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button variant="outline" onClick={() => setSelectedFriendForList(friendId)} data-testid={`button-view-friend-${friend.id}`}>
                                View List
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="feed" className="space-y-4 pt-4">
          {loadingActivity ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin opacity-40" />
            </div>
          ) : activityFeed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-base">No activity yet</p>
              <p className="text-sm mt-1 opacity-70">
                {friends.length === 0
                  ? "Add some friends to see their activity here."
                  : "Your friends haven't logged any activity yet. Activity appears when they add or complete anime."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activityFeed.map((item, ai) => {
                const icon =
                  item.type === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> :
                  item.type === "rated" ? <Star className="w-4 h-4 text-amber-400 shrink-0" /> :
                  item.type === "dropped" ? <Trash2 className="w-4 h-4 text-red-400 shrink-0" /> :
                  item.type === "started" ? <Play className="w-4 h-4 text-primary shrink-0" /> :
                  <Plus className="w-4 h-4 text-primary shrink-0" />;

                const verb =
                  item.type === "completed" ? "completed" :
                  item.type === "rated" ? "rated" :
                  item.type === "dropped" ? "dropped" :
                  item.type === "started" ? "started watching" :
                  "added";

                const extra =
                  item.type === "rated" && item.rating ? ` — ${item.rating}/10` :
                  item.type === "completed" && item.rating ? ` — ${item.rating}/10` : "";

                return (
                  <div key={item.id} className="relative flex items-center gap-3 p-3 rounded-none bg-card/80 border border-primary/30 hover:border-primary/60 transition-colors animate-stagger-in deco-corners" style={{ animationDelay: `${ai * 60}ms` }}>
                    {item.coverImage ? (
                      <img src={item.coverImage} alt={item.animeTitle} className="w-10 h-14 object-cover rounded-none border border-primary/30 shrink-0" />
                    ) : (
                      <div className="w-10 h-14 bg-muted/40 rounded-none border border-primary/30 shrink-0 flex items-center justify-center">
                        {icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug">
                        <span className="font-bold">{item.username}</span>
                        {" "}{verb}{" "}
                        <span className="font-semibold text-foreground">{item.animeTitle}</span>
                        {item.seasonNumber && item.seasonNumber > 1 ? ` S${item.seasonNumber}` : ""}
                        {extra && <span className="text-amber-400 font-bold">{extra}</span>}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {icon}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="compare" className="space-y-4 pt-2">
          <FriendCompare
            currentUserId={currentUserId}
            myUsername={user?.username || user?.email?.split("@")[0] || "You"}
            friends={friends}
          />
        </TabsContent>

        <TabsContent value="requests" className="space-y-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Pending Requests</h3>
              {pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {pendingRequests.map((request, ri) => (
                    <Card key={request.id} className="animate-stagger-in" style={{ animationDelay: `${ri * 70}ms` }} data-testid={`request-card-${request.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                              <UserPlus className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{request.friendName || "Friend Request"}</p>
                              <p className="text-sm text-muted-foreground">Pending request</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acceptFriendRequest(request.id)}
                              data-testid={`button-accept-${request.id}`}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => rejectFriendRequest(request.id)}
                              data-testid={`button-reject-${request.id}`}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="find" className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Your User ID</h3>
                <p className="text-sm text-muted-foreground">
                  Share this ID with friends so they can add you
                </p>
                <div className="flex items-center gap-2">
                  {user?.shortId ? (
                    <>
                      <Badge variant="secondary" className="text-lg font-mono px-4 py-2 tracking-widest">
                        {user.shortId.toUpperCase()}
                      </Badge>
                      <Button variant="outline" size="icon" onClick={copyShortId} data-testid="button-copy-id">
                        <Copy className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Loading your User ID... (try refreshing if this persists)</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Add a Friend</h3>
                <p className="text-sm text-muted-foreground">
                  Enter your friend's 5-character User ID to send them a friend request
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter User ID (e.g., ABC12)"
                    value={searchShortId}
                    onChange={(e) => setSearchShortId(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="font-mono"
                    data-testid="input-friend-id"
                  />
                  <Button
                    onClick={handleSendFriendRequest}
                    disabled={isLoading || searchShortId.length !== 5}
                    data-testid="button-send-request"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Send Request
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Friends;
